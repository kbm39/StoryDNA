import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { createMemorySegmentedPersistence } from "../../persistence.ts";
import { RECONCILIATION_MAX_BATCH_SIZE } from "../../constants.ts";
import { RECKONING_REVISED_13_SEGMENT_PLAN } from "../../reckoning-revised-13-segment-plan.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  OPUS_V2_EVAL_AUTHORIZATION,
  OPUS_V2_EVAL_AUTHORIZED_TO_RUN,
  OPUS_V2_EVAL_HELD_OUT_IDS,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  OPUS_V2_EVAL_ID,
  OPUS_V2_EVAL_RECONCILIATION_CONTRACT,
  OPUS_V2_EVAL_SOURCE_PIN,
  OPUS_V2_EVAL_WIRED_TO_PAID_PATH,
  OPUS_V2_EVAL_WIRED_TO_PUBLIC_LIVE,
  OpusV2EvalUnauthorizedError,
  assertIncompatibleResumeRejected,
  assertNextCallFitsCeiling,
  assertNotHistoricalRevised13Workflow,
  assertOpusV2EvalPaidExecutionForbidden,
  assertPlanMatchesFrozenRevised13,
  constructOpusV2EvalProvider,
  diagnoseAllV2Pairs,
  nextCallFitsCeiling,
  opusV2EvalProviderConstructCount,
  projectOpusV2EvalCostBands,
  rehearsalCoverageFromPlan,
  rehearsalObservationsForSegment,
  rehearsalPlanFromFrozenRevised13,
  runOpusV2EvalRehearsal,
} from "./index.ts";

const MODULE_FILES = [
  "authorization.ts",
  "cost.ts",
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "runner.ts",
];

describe("isolated Opus V2 full-manuscript eval runner", () => {
  it("stays fail-closed and refuses provider construction", () => {
    assert.equal(OPUS_V2_EVAL_ID, "archivist-opus-v2-full-manuscript-eval");
    assert.equal(OPUS_V2_EVAL_AUTHORIZED_TO_RUN, false);
    assert.equal(OPUS_V2_EVAL_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_WIRED_TO_PAID_PATH, false);
    assert.equal(OPUS_V2_EVAL_WIRED_TO_PUBLIC_LIVE, false);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.doesNotThrow(() => assertOpusV2EvalPaidExecutionForbidden());
    assert.throws(() => constructOpusV2EvalProvider(), OpusV2EvalUnauthorizedError);
    assert.equal(opusV2EvalProviderConstructCount(), 0);
  });

  it("pins REVISED-13 source, plan, prompt, schema, model, and effort", () => {
    const plan = rehearsalPlanFromFrozenRevised13();
    const coverage = rehearsalCoverageFromPlan(plan);
    assertPlanMatchesFrozenRevised13(plan, coverage);
    assert.equal(plan.plan_fingerprint, RECKONING_REVISED_13_SEGMENT_PLAN.plan_fingerprint);
    assert.equal(plan.unit_count, 30);
    assert.equal(plan.segment_count, coverage.segment_count);
    assert.equal(coverage.unique_words_covered, 109887);
    assert.equal(coverage.coverage_percentage, 100);
    assert.equal(coverage.uncovered_ranges.length, 0);
    assert.equal(OPUS_V2_EVAL_SOURCE_PIN.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id, "19ec5084-3426-4a91-a946-05895bb3e556");
    assert.equal(OPUS_V2_EVAL_SOURCE_PIN.content_hash, "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f");
  });

  it("schedules one observation document per planned segment", () => {
    const plan = rehearsalPlanFromFrozenRevised13();
    for (const segment of plan.segments) {
      const doc = rehearsalObservationsForSegment(segment.segment_id);
      assert.equal(doc.schema, "archivist_segment_observation@v2");
      assert.equal(doc.segment_id, segment.segment_id);
      assert.equal(doc.manuscript_id, OPUS_V2_EVAL_SOURCE_PIN.manuscript_id);
    }
  });

  it("completes a $0 rehearsal with canon, pairing, and no accepted canon", async () => {
    const persistence = createMemorySegmentedPersistence();
    const result = await runOpusV2EvalRehearsal({ persistence });
    assert.equal(result.execution_scope, "complete");
    assert.equal(result.validated, result.segment_count);
    assert.equal(result.failed, 0);
    assert.equal(result.pending, 0);
    assert.equal(result.coverage_complete, true);
    assert.equal(result.unique_words_covered, 109887);
    assert.ok(result.candidate_canon_count > 0);
    assert.ok(result.comparable_pairs > 0);
    assert.ok(result.rejected_pairs > 0);
    assert.ok(result.equivalent_pairs > 0);
    assert.ok(result.compatible_transitions > 0);
    assert.equal(result.accepted_canon, 0);
    assert.equal(result.series_bible_writes, 0);
    assert.equal(result.provider_calls, 0);
    assert.equal(result.cost_usd, 0);
    assert.equal(result.review_persisted, true);
    assert.equal(result.historical_workflow_touched, false);
    assert.notEqual(result.workflow_id, OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID);
    assert.equal(result.findings.some((item) => item.classification === "confirmed_contradiction"), false);
    assert.ok(result.findings.some((item) => item.classification === "possible_continuity_conflict"));
    assert.ok(result.ambiguities_blocked_confirmation > 0);
    const stored = await persistence.getWorkflow(result.workflow_id);
    assert.equal(stored?.status, "completed");
    assert.equal(stored?.authorized_to_run, false);
    const historical = await persistence.getWorkflow(OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID);
    assert.equal(historical, null);
  });

  it("keeps compatible facts in canon and rejects bad pairs as findings", async () => {
    const plan = rehearsalPlanFromFrozenRevised13();
    const observations = plan.segments.flatMap((segment) => rehearsalObservationsForSegment(segment.segment_id).observations);
    const diagnoses = diagnoseAllV2Pairs(observations);
    const spouse = diagnoses.find((row) => row.left_id === "rel-spouse-a" && row.right_id === "rel-spouse-b");
    const sibling = diagnoses.find((row) => row.left_id === "rel-sib" && row.right_id === "rel-col");
    const locations = diagnoses.find((row) => row.left_id === "loc-a" && row.right_id === "loc-b");
    const ranks = diagnoses.find((row) => row.left_id === "role-navy" && row.right_id === "role-lead");
    const tattoos = diagnoses.find((row) => row.left_id === "tattoo-a" && row.right_id === "tattoo-b");
    const clocks = diagnoses.find((row) => row.left_id === "clock-a" && row.right_id === "clock-b");
    const knowledge = diagnoses.find((row) => row.left_id === "k-use" && row.right_id === "k-learn");
    const injury = diagnoses.find((row) => row.left_id === "inj-l" && row.right_id === "inj-r");
    assert.equal(spouse?.eligibility, "equivalent");
    assert.equal(sibling?.eligibility, "not_comparable");
    assert.equal(locations?.eligibility, "not_comparable");
    assert.equal(ranks?.eligibility, "not_comparable");
    assert.equal(tattoos?.eligibility, "equivalent");
    assert.equal(clocks?.eligibility, "comparable");
    assert.equal(knowledge?.eligibility, "comparable");
    assert.equal(injury?.eligibility, "comparable");
  });

  it("blocks confirmation for ambiguous identity and unverified evidence", async () => {
    const result = await runOpusV2EvalRehearsal({ persistence: createMemorySegmentedPersistence() });
    const ambiguous = result.findings.find((item) => item.id.includes("amb-use"));
    const unverified = result.findings.find((item) => item.id.includes("unverified-a"));
    assert.ok(ambiguous);
    assert.equal(ambiguous?.classification, "author_verification_needed");
    assert.equal(ambiguous?.confirmation_eligibility, "ineligible");
    assert.ok(unverified);
    assert.equal(unverified?.confirmation_eligibility, "ineligible");
  });

  it("fails closed on the first pass and resumes the same workflow", async () => {
    const persistence = createMemorySegmentedPersistence();
    const plan = rehearsalPlanFromFrozenRevised13();
    const failId = plan.segments[7]!.segment_id;
    const first = await runOpusV2EvalRehearsal({ persistence, fail_segment_id: failId });
    assert.equal(first.execution_scope, "incomplete");
    assert.equal(first.review_persisted, false);
    assert.ok(first.validated > 0);
    assert.equal(first.failed, 1);
    assert.ok(first.pending > 0);
    const resume = await runOpusV2EvalRehearsal({
      persistence,
      resume_workflow_id: first.workflow_id,
    });
    assert.equal(resume.workflow_id, first.workflow_id);
    assert.ok(resume.reused.length >= first.validated);
    assert.equal(resume.rescheduled.includes(failId), true);
    assert.equal(resume.duplicate_scheduling, false);
    assert.equal(resume.execution_scope, "complete");
    assert.equal(resume.coverage_complete, true);
    assert.equal(resume.review_persisted, true);
    assert.equal(resume.validated, plan.segment_count);
  });

  it("rejects a second experimental workflow and the historical REVISED-13 id", async () => {
    const persistence = createMemorySegmentedPersistence();
    const first = await runOpusV2EvalRehearsal({ persistence });
    await assert.rejects(
      () => runOpusV2EvalRehearsal({ persistence }),
      OpusV2EvalUnauthorizedError,
    );
    assert.throws(
      () => assertNotHistoricalRevised13Workflow(OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID),
      /historical_revised_13_workflow_is_immutable/,
    );
    await assert.rejects(
      () => runOpusV2EvalRehearsal({ persistence: createMemorySegmentedPersistence(), workflow_id: OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID }),
      /historical_revised_13_workflow_is_immutable/,
    );
    assert.notEqual(first.workflow_id, OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID);
  });

  it("rejects incompatible resume pins before any provider construction", () => {
    assert.throws(() => assertIncompatibleResumeRejected({ content_hash: "wrong" }), /content_hash_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ plan_fingerprint: "wrong" }), /plan_fingerprint_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ prompt_version: "wrong" }), /prompt_version_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ schema_version: "wrong" }), /schema_version_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ model: "claude-haiku-4-5-20251001" }), /model_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ effort: "high" }), /effort_mismatch/);
    assert.throws(() => assertIncompatibleResumeRejected({ workflow_id: OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID }), /historical/);
    assert.equal(opusV2EvalProviderConstructCount(), 0);
  });

  it("freezes reconciliation batch size 8 and the future cost gate", () => {
    assert.equal(OPUS_V2_EVAL_RECONCILIATION_CONTRACT.batch_size, 8);
    assert.equal(OPUS_V2_EVAL_RECONCILIATION_CONTRACT.shared_batch_constant, RECONCILIATION_MAX_BATCH_SIZE);
    const bands = projectOpusV2EvalCostBands();
    assert.equal(bands.low_usd, 1.47);
    assert.equal(bands.expected_usd, 2.18);
    assert.equal(bands.high_usd, 3.1);
    assert.equal(bands.hard_ceiling_usd, 6);
    assert.equal(bands.ceiling_authorized, false);
    assert.equal(nextCallFitsCeiling({ accrued_usd: 3.1, next_call_high_usd: 0.3, ceiling_usd: 6 }), true);
    assert.equal(nextCallFitsCeiling({ accrued_usd: 5.9, next_call_high_usd: 0.3, ceiling_usd: 6 }), false);
    assert.throws(
      () => assertNextCallFitsCeiling({ accrued_usd: 5.9, next_call_high_usd: 0.3, ceiling_usd: 6 }),
      /cost_gate/,
    );
  });

  it("keeps held-out Rule 8 IDs out of the runner module", () => {
    assert.deepEqual([...OPUS_V2_EVAL_HELD_OUT_IDS], [...V2_PHASE2_HELD_OUT_IDS]);
    const production = MODULE_FILES.filter((file) => !file.endsWith(".test.ts"));
    for (const file of MODULE_FILES) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
    }
    for (const file of production) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      assert.equal(/hold fast/i.test(text), false, file);
    }
  });
});
