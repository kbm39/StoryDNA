import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import { getLiveProviderInvocationCount } from "@/lib/execute-expert/dry-run-guard.ts";
import { ARCHIVIST_CONSTITUTION } from "../constitution.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED, isArchivistLiveExecutionAllowed } from "../live-flags.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import { RECKONING_REVISED_11_SOURCE_PIN } from "../reckoning-revised-11-source-pin.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { assertCertifiedSegmentedModel } from "./certified-model.ts";
import { CertifiedModelMismatchError } from "./errors.ts";
import { buildSyntheticThirtyUnitManuscript } from "./fixtures.ts";
import { createMemoryManuscriptStore } from "./manuscript-loader.ts";
import { createMemorySegmentedPersistence } from "./persistence.ts";
import { RECKONING_REVISED_11_SEGMENT_PLAN } from "./reckoning-revised-11-segment-plan.ts";
import { RECKONING_REVISED_11_2_SEGMENT_PLAN } from "./reckoning-revised-11-2-segment-plan.ts";
import {
  assertRehearsalGatesClosed,
  costExactZero,
  rejectIncompatibleResume,
  runSegmentedRehearsal,
} from "./rehearsal.ts";

function stores() {
  const { snapshot } = buildSyntheticThirtyUnitManuscript();
  return {
    snapshot,
    manuscriptStore: createMemoryManuscriptStore(snapshot),
    persistence: createMemorySegmentedPersistence(),
    identity: {
      manuscript_id: snapshot.manuscript_id,
      manuscript_version_id: snapshot.manuscript_version_id,
      content_hash: snapshot.content_hash,
    },
  };
}

describe("segmented rehearsal persistence and $0 fence", () => {
  it("keeps the rehearsal provider fence at none/none and $0 exact", async () => {
    const { manuscriptStore, persistence, identity } = stores();
    const result = await runSegmentedRehearsal({
      manuscriptStore,
      persistence,
      identity,
      usePinnedLoader: false,
    });
    assert.equal(result.ok, true);
    assert.equal(result.provider, "none");
    assert.equal(result.model, "none");
    assert.equal(costExactZero(result), true);
    assert.equal(getLiveProviderInvocationCount(), 0);
    assert.ok(result.review?.canon_delta.every((delta) => delta.status === "candidate"));
    assert.equal(result.canon_writes, 0);
    const kinds = new Set(result.contradiction_pairs.map((pair) => pair.kind));
    assert.ok(kinds.has("appearance_unexplained"));
    assert.ok(kinds.has("knowledge_before_acquisition"));
    assert.ok(kinds.has("injury_laterality"));
    assert.ok(kinds.has("unique_object_possession"));
  });

  it("fails a middle segment, then resumes only incomplete checkpoints", async () => {
    const { manuscriptStore, persistence, identity } = stores();
    const first = await runSegmentedRehearsal({
      manuscriptStore,
      persistence,
      identity,
      usePinnedLoader: false,
      failSegmentOrdinal: 2,
    });
    assert.equal(first.ok, false);
    assert.ok(first.checkpoints.some((item) => item.status === "failed"));
    assert.equal(first.coverage.complete, false);
    assert.equal(first.review, null);
    const failedId = first.checkpoints.find((item) => item.status === "failed")?.segment_id;
    const validatedBefore = first.checkpoints.filter((item) => item.status === "validated").map((item) => item.segment_id);

    const resumed = await runSegmentedRehearsal({
      manuscriptStore,
      persistence,
      identity,
      usePinnedLoader: false,
      resumeWorkflowId: first.workflow_id,
    });
    assert.equal(resumed.ok, true);
    assert.deepEqual(resumed.reused_segment_ids.slice().sort(), validatedBefore.slice().sort());
    assert.ok(resumed.rerun_segment_ids.includes(failedId ?? ""));
    assert.equal(resumed.duplicate_scheduling, false);
    assert.equal(
      resumed.checkpoints.filter((item) => item.status === "validated").length,
      resumed.plan.segment_count,
    );
    assert.ok(resumed.reused_segment_ids.every((id) => !resumed.rerun_segment_ids.includes(id)));
  });

  it("rejects incompatible resume before execution", async () => {
    const { manuscriptStore, persistence, identity } = stores();
    const first = await runSegmentedRehearsal({
      manuscriptStore,
      persistence,
      identity,
      usePinnedLoader: false,
    });
    const rejectedHash = rejectIncompatibleResume({
      plan: first.plan,
      checkpoints: first.checkpoints,
      mutated: { content_hash: "0".repeat(64) },
    });
    const rejectedPlan = rejectIncompatibleResume({
      plan: first.plan,
      checkpoints: first.checkpoints,
      mutated: { plan_fingerprint: "incompatible-plan" },
    });
    const rejectedContract = rejectIncompatibleResume({
      plan: first.plan,
      checkpoints: first.checkpoints,
      mutated: { segment_contract_version: "wrong@v0" },
    });
    assert.equal(rejectedHash.rejected, true);
    assert.equal(rejectedPlan.rejected, true);
    assert.equal(rejectedContract.rejected, true);
  });

  it("refuses to publish a full review when a segment is omitted", async () => {
    const { manuscriptStore, persistence, identity } = stores();
    const result = await runSegmentedRehearsal({
      manuscriptStore,
      persistence,
      identity,
      usePinnedLoader: false,
      omitSegmentOrdinal: 2,
    });
    assert.equal(result.ok, false);
    assert.ok(result.coverage.coverage_percentage < 100);
    assert.equal(result.coverage.complete, false);
    assert.ok(result.coverage.uncovered_ranges.length > 0);
    assert.equal(result.review, null);
    assert.ok(result.diagnostics.some((item) => /incomplete coverage/i.test(item)));
    assert.ok(result.diagnostics.some((item) => /uncovered segments:/i.test(item)));
    assert.equal(result.execution_scope, "incomplete");
    assert.notEqual(result.execution_scope, "full_manuscript");
  });

  it("rejects future paid model mismatch without constructing a provider", () => {
    assert.throws(
      () => assertCertifiedSegmentedModel({ provider: "anthropic", model: "claude-opus-4-8" }),
      CertifiedModelMismatchError,
    );
    assert.throws(
      () => assertCertifiedSegmentedModel({ provider: "openai", model: "claude-haiku-4-5-20251001" }),
      CertifiedModelMismatchError,
    );
    assert.throws(() => assertCertifiedSegmentedModel({ provider: "anthropic", model: "" }), CertifiedModelMismatchError);
    assert.deepEqual(
      assertCertifiedSegmentedModel({
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
      }),
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    );
  });

  it("records the frozen 14-segment plan without making it a planner invariant", () => {
    assert.equal(RECKONING_REVISED_11_SEGMENT_PLAN.segment_count, 14);
    assert.equal(RECKONING_REVISED_11_SEGMENT_PLAN.unique_manuscript_words, 110156);
    assert.equal(RECKONING_REVISED_11_2_SEGMENT_PLAN.segment_count, 14);
    assert.equal(RECKONING_REVISED_11_2_SEGMENT_PLAN.unique_manuscript_words, 109907);
    assert.notEqual(
      RECKONING_REVISED_11_2_SEGMENT_PLAN.plan_fingerprint,
      "d901d178fa03e526d1f1248f313650b4455f2c9b21dded7904fc40d24714b503",
    );
  });

  it("keeps public live execution and rehearsal gates closed", async () => {
    assertRehearsalGatesClosed();
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run, false);
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run, false);
    const live = await executeExpert({
      expert_key: "archivist",
      expert_version_id: "883407ad-4afe-4f3c-a69b-eaa3234fc9c6",
      manuscript_id: "ms",
      manuscript_version_id: "mv",
      content_hash: "a".repeat(64),
      mode: "live",
    });
    assert.equal(live.ok, false);
  });
});
