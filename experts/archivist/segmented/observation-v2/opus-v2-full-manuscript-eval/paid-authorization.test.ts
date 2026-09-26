import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  OPUS_V2_EVAL_AUTHORIZATION,
  OPUS_V2_EVAL_AUTHORIZED_TO_RUN,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  constructOpusV2EvalProvider,
  opusV2EvalProviderConstructCount,
} from "./index.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_GRANT,
} from "./explicit-grant.ts";
import {
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
  OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE,
  OPUS_V2_EVAL_PAID_COST_MODEL,
  OPUS_V2_EVAL_PAID_LEDGER_FIELDS,
  OPUS_V2_EVAL_PAID_PERSISTENCE_FORBIDDEN,
  OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
  OPUS_V2_EVAL_PAID_REQUIRED_RUNNER_FREEZE_HEAD,
  OPUS_V2_EVAL_PAID_SUCCESS_BAR,
  OpusV2EvalPaidAuthorizationError,
  assertCanonicalPaidAuthorizationPrepared,
  assertOpusV2EvalPaidAuthorizationGate,
  assertOpusV2EvalPaidCostGate,
  cloneOpusV2EvalPaidAuthorization,
  fenceOpusV2EvalPaidProvider,
  matchingOpusV2EvalPaidGateRequest,
  projectOpusV2EvalPaidAuthorization,
} from "./paid-authorization.ts";

const MODULE_FILES = [
  "authorization.ts",
  "cost.ts",
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval.test.ts",
  "explicit-grant.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "paid-authorization-lifecycle.test.ts",
  "runner.ts",
];

describe("prepared Opus V2 full-manuscript paid authorization", () => {
  it("stays prepared, does not pre-bind a workflow, and does not authorize spend", () => {
    assertCanonicalPaidAuthorizationPrepared();
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_ID, "reckoning-revised-13-opus-v2-full-eval-20260925");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.spend_authorized, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.hard_cost_ceiling_usd, 6);
    assert.equal(OPUS_V2_EVAL_AUTHORIZED_TO_RUN, false);
    assert.equal(OPUS_V2_EVAL_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.required_runner_freeze_head, OPUS_V2_EVAL_PAID_REQUIRED_RUNNER_FREEZE_HEAD);
    assert.throws(
      () => projectOpusV2EvalPaidAuthorization(OPUS_V2_EVAL_PAID_AUTHORIZATION, "authorize"),
      /canonical_prepared_authorization_is_immutable/,
    );
  });

  it("binds REVISED-13 source, plan, runner, prompt, schema, model, and staging", () => {
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.manuscript_version_id, "19ec5084-3426-4a91-a946-05895bb3e556");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.content_hash, "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.analytical_word_count, 109887);
    assert.equal(
      OPUS_V2_EVAL_PAID_AUTHORIZATION.plan_fingerprint,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_unit_count, 30);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_segment_count, 14);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_unique_words, 109887);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_coverage_percentage, 100);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_uncovered_ranges, 0);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_overlap_words, 27582);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.workflow_kind, "experimental_opus_v2_full_manuscript_eval");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.runner_id, "archivist-opus-v2-full-manuscript-eval");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.runner_version, "archivist_opus_v2_full_manuscript_eval@v1");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.max_workflows, 1);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.prompt_version, "archivist_v2_extraction_prompt@v2");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.schema_version, "archivist_segment_observation@v2");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.provider, "anthropic");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.model, "claude-opus-5-5");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.effort, "medium");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.max_tokens, 4000);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.cache, "off");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.fallback, "none");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.staging_supabase_project_ref, "xwkphouojohyouhdvkgh");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.production_supabase_project_ref, OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF);
  });

  it("refuses provider construction and every mismatched pin at $0", () => {
    const refusals = [
      matchingOpusV2EvalPaidGateRequest(),
      matchingOpusV2EvalPaidGateRequest({ manuscript_id: "00000000-0000-0000-0000-000000000000" }),
      matchingOpusV2EvalPaidGateRequest({ content_hash: "0".repeat(64) }),
      matchingOpusV2EvalPaidGateRequest({ plan_fingerprint: "wrong-plan" }),
      matchingOpusV2EvalPaidGateRequest({ prompt_version: "archivist_v2_extraction_prompt@v1" }),
      matchingOpusV2EvalPaidGateRequest({ schema_version: "archivist_segment_observation@v1" }),
      matchingOpusV2EvalPaidGateRequest({ model: "claude-haiku-4-5-20251001" }),
      matchingOpusV2EvalPaidGateRequest({ model: "claude-sonnet-4-5" }),
      matchingOpusV2EvalPaidGateRequest({ model: "claude-opus-4-8" }),
      matchingOpusV2EvalPaidGateRequest({ effort: "high" }),
      matchingOpusV2EvalPaidGateRequest({ staging_supabase_project_ref: "other-project" }),
      matchingOpusV2EvalPaidGateRequest({
        staging_supabase_project_ref: OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
      }),
      matchingOpusV2EvalPaidGateRequest({ workflow_kind: "archivist-segmented-pilot" }),
      matchingOpusV2EvalPaidGateRequest({
        action: "start_workflow",
        authorization: projectOpusV2EvalPaidAuthorization(
          projectOpusV2EvalPaidAuthorization(cloneOpusV2EvalPaidAuthorization(), "authorize", {
            grant: OPUS_V2_EVAL_EXPLICIT_GRANT,
          }),
          "consume",
          { workflow_id: "11111111-1111-1111-1111-111111111111" },
        ),
      }),
      matchingOpusV2EvalPaidGateRequest({
        action: "resume_workflow",
        authorization: projectOpusV2EvalPaidAuthorization(
          projectOpusV2EvalPaidAuthorization(cloneOpusV2EvalPaidAuthorization(), "authorize", {
            grant: OPUS_V2_EVAL_EXPLICIT_GRANT,
          }),
          "consume",
          { workflow_id: "11111111-1111-1111-1111-111111111111" },
        ),
        resume_workflow_id: "22222222-2222-2222-2222-222222222222",
      }),
      matchingOpusV2EvalPaidGateRequest({
        authorization: cloneOpusV2EvalPaidAuthorization({ status: "revoked" }),
      }),
    ];
    for (const request of refusals) {
      assert.equal(fenceOpusV2EvalPaidProvider(request), 0);
      assert.throws(
        () => assertOpusV2EvalPaidAuthorizationGate(request),
        OpusV2EvalPaidAuthorizationError,
      );
    }
    assert.throws(() => constructOpusV2EvalProvider(), /provider_construction_is_not_authorized/);
    assert.equal(opusV2EvalProviderConstructCount(), 0);
  });

  it("projects consume/resume/revoke in memory without mutating the prepared authorization", () => {
    const authorized = projectOpusV2EvalPaidAuthorization(
      cloneOpusV2EvalPaidAuthorization(),
      "authorize",
      { grant: OPUS_V2_EVAL_EXPLICIT_GRANT },
    );
    assert.equal(authorized.status, "explicitly_authorized");
    assert.equal(authorized.bound_workflow_id, null);
    assert.equal(authorized.spend_authorized, true);
    const consumed = projectOpusV2EvalPaidAuthorization(authorized, "consume", {
      workflow_id: "11111111-1111-1111-1111-111111111111",
    });
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.bound_workflow_id, "11111111-1111-1111-1111-111111111111");
    assert.equal(
      projectOpusV2EvalPaidAuthorization(consumed, "consume", {
        workflow_id: "11111111-1111-1111-1111-111111111111",
      }).bound_workflow_id,
      "11111111-1111-1111-1111-111111111111",
    );
    assert.throws(
      () =>
        projectOpusV2EvalPaidAuthorization(consumed, "consume", {
          workflow_id: "22222222-2222-2222-2222-222222222222",
        }),
      /second_workflow_rejected/,
    );
    assert.throws(
      () =>
        projectOpusV2EvalPaidAuthorization(authorized, "consume", {
          workflow_id: OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
        }),
      /historical_revised_13_workflow_is_immutable/,
    );
    const revoked = projectOpusV2EvalPaidAuthorization(cloneOpusV2EvalPaidAuthorization(), "revoke");
    assert.equal(revoked.status, "revoked");
    assert.equal(fenceOpusV2EvalPaidProvider(matchingOpusV2EvalPaidGateRequest({ authorization: revoked })), 0);
    assertCanonicalPaidAuthorizationPrepared();
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(opusV2EvalProviderConstructCount(), 0);
  });

  it("freezes the prepared ceiling, cost gate, ledger, and candidate-only success bar", () => {
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.input_usd_per_mtok, 4);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.output_usd_per_mtok, 20);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.low_usd, 1.47);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.expected_usd, 2.18);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.high_usd, 3.1);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.hard_ceiling_usd, 6);
    assert.equal(OPUS_V2_EVAL_PAID_COST_MODEL.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.expected_primary_observation_calls, 14);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.default_repair_allowance, 0);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.emergency_repair_max, 3);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.repairs_authorized, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.reconciliation_batch_size, 8);
    assert.doesNotThrow(() => assertOpusV2EvalPaidCostGate({ accrued_usd: 3.1, next_call_high_usd: 0.3 }));
    assert.throws(
      () => assertOpusV2EvalPaidCostGate({ accrued_usd: 5.9, next_call_high_usd: 0.3 }),
      /cost_gate/,
    );
    assert.ok(OPUS_V2_EVAL_PAID_LEDGER_FIELDS.includes("per_call_exact_cost"));
    assert.ok(OPUS_V2_EVAL_PAID_PERSISTENCE_FORBIDDEN.includes("accepted_canon"));
    assert.equal(OPUS_V2_EVAL_PAID_SUCCESS_BAR.accepted_canon_writes, 0);
    assert.equal(OPUS_V2_EVAL_PAID_SUCCESS_BAR.unique_coverage, "109887/109887");
  });

  it("does not reuse 0027, invent a migration, or write a database row", () => {
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.kind, "code_bound_prepared_authorization");
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.existing_0027_usable, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.migration_invented, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.db_row_written, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.reused_old_authorization, false);
    assert.ok(OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE.existing_0027_blockers.includes("hard_cost_ceiling_usd <= 1 cannot store 6.00"));
  });

  it("keeps public live, runtime, Studio, and historical workflow closed", () => {
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(
      fenceOpusV2EvalPaidProvider(
        matchingOpusV2EvalPaidGateRequest({
          action: "resume_workflow",
          resume_workflow_id: OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
        }),
      ),
      0,
    );
  });

  it("keeps held-out Rule 8 IDs out of the prepared authorization", () => {
    for (const file of MODULE_FILES) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
    }
    assert.equal(opusV2EvalProviderConstructCount(), 0);
  });
});
