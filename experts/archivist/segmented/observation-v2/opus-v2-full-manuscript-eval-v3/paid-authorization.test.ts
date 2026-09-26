import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import { OPUS_V2_EVAL_PAID_AUTHORIZATION_ID } from "../opus-v2-full-manuscript-eval/paid-authorization.ts";
import { OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID } from "../opus-v2-full-manuscript-eval-v2/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V3_CALL_ORDER,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS,
  OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_ID,
  OPUS_V2_EVAL_V3_MAX_TOKENS,
  OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE,
  OPUS_V2_EVAL_V3_PAID_COST_MODEL,
  OPUS_V2_EVAL_V3_PAID_PERSISTENCE_FORBIDDEN,
  OPUS_V2_EVAL_V3_PAID_SUCCESS_BAR,
  OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
  OPUS_V2_EVAL_V3_PROMPT_VERSION,
  OPUS_V2_EVAL_V3_REQUIRED_FREEZE_HEAD,
  OPUS_V2_EVAL_V3_VERSION,
  OpusV2EvalV3PaidAuthorizationError,
  assertCanonicalV3PaidAuthorizationPrepared,
  assertHistoricalConsumedAuthorizationUnchanged,
  assertOpusV2EvalV3CandidateOnlySafety,
  assertOpusV2EvalV3PaidAuthorizationGate,
  constructOpusV2EvalV3Provider,
  fenceOpusV2EvalV3PaidProvider,
  matchingOpusV2EvalV3PaidGateRequest,
  opusV2EvalV3ProviderConstructCount,
} from "./index.ts";

const MODULE_FILES = [
  "explicit-grant.ts",
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval-v3.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "paid-authorization-lifecycle.test.ts",
  "raw-persistence.ts",
];

describe("prepared Opus eval @v3 $5 authorization", () => {
  it("creates a new prepared identity without reusing 20260925 or 20260926", () => {
    assertCanonicalV3PaidAuthorizationPrepared();
    assertHistoricalConsumedAuthorizationUnchanged();
    assert.equal(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
      "reckoning-revised-13-opus-v2-full-eval-v3-20260926",
    );
    assert.notEqual(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.notEqual(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID, OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID);
    assert.deepEqual([...OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS], [
      OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
    ]);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.spend_authorized, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.hard_cost_ceiling_usd, 5);
    assert.equal(
      OPUS_V2_EVAL_V3_REQUIRED_FREEZE_HEAD,
      "12f2766eb180659934aff11bd53f605a13905b01",
    );
  });

  it("binds prompt @v4, observation cap 16, and a new runner identity", () => {
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.runner_id, OPUS_V2_EVAL_V3_ID);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.runner_version, OPUS_V2_EVAL_V3_VERSION);
    assert.equal(OPUS_V2_EVAL_V3_PROMPT_VERSION, "archivist_v2_extraction_prompt@v4");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.prompt_version, "archivist_v2_extraction_prompt@v4");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.max_tokens, 6000);
    assert.equal(OPUS_V2_EVAL_V3_MAX_TOKENS, 6000);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.observation_hard_cap, 16);
    assert.equal(OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP, 16);
    assert.equal(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.execution_fingerprint,
      OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
    );
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.model, "claude-opus-5-5");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.effort, "medium");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.cache, "off");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.max_workflows, 1);
  });

  it("binds REVISED-13 source, plan, staging, and candidate-only safety", () => {
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.manuscript_version_id,
      "19ec5084-3426-4a91-a946-05895bb3e556",
    );
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.analytical_word_count, 109887);
    assert.equal(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.plan_fingerprint,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.expected_segment_count, 14);
    assert.equal(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.staging_supabase_project_ref,
      "xwkphouojohyouhdvkgh",
    );
    assert.equal(OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF, "tumcpxklduhiigxjwlrp");
    assertOpusV2EvalV3CandidateOnlySafety();
    assert.ok(OPUS_V2_EVAL_V3_PAID_PERSISTENCE_FORBIDDEN.includes("accepted_canon"));
    assert.deepEqual([...OPUS_V2_EVAL_V3_CALL_ORDER], [
      "authorization_and_pins",
      "cost_gate",
      "provider_call",
      "usage_cost_capture",
      "raw_output_persistence",
      "normal_parse",
      "prefix_recovery_if_needed",
      "normalization",
      "evidence_validation",
      "observation_checkpoint_persistence",
    ]);
  });

  it("records the $5 prepared ceiling without authorizing spend", () => {
    assert.equal(OPUS_V2_EVAL_V3_PAID_COST_MODEL.hard_ceiling_usd, 5);
    assert.equal(OPUS_V2_EVAL_V3_PAID_COST_MODEL.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_COST_MODEL.input_usd_per_mtok, 4);
    assert.equal(OPUS_V2_EVAL_V3_PAID_COST_MODEL.output_usd_per_mtok, 20);
    assert.equal(OPUS_V2_EVAL_V3_PAID_SUCCESS_BAR.injury_min, 4);
    assert.equal(OPUS_V2_EVAL_V3_PAID_SUCCESS_BAR.travel_leg_min, 3);
    assert.equal(OPUS_V2_EVAL_V3_PAID_SUCCESS_BAR.observation_hard_cap, 16);
  });

  it("does not reuse 0027 or invent a database row", () => {
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE.kind, "code_bound_prepared_authorization");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE.table, null);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE.reused_consumed_20260925, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE.reused_consumed_20260926, false);
  });

  it("refuses provider construction and every mismatched pin at $0", () => {
    const refusals: Array<[ReturnType<typeof matchingOpusV2EvalV3PaidGateRequest>, string]> = [
      [matchingOpusV2EvalV3PaidGateRequest(), "prepared_cannot_construct_provider"],
      [
        matchingOpusV2EvalV3PaidGateRequest({ action: "start_workflow" }),
        "prepared_cannot_start_workflow",
      ],
      [
        matchingOpusV2EvalV3PaidGateRequest({ prompt_version: "archivist_v2_extraction_prompt@v3" }),
        "prompt_version_mismatch",
      ],
      [matchingOpusV2EvalV3PaidGateRequest({ max_tokens: 4000 }), "max_tokens_mismatch"],
      [matchingOpusV2EvalV3PaidGateRequest({ model: "claude-haiku-4-5-20251001" }), "haiku_forbidden"],
      [
        matchingOpusV2EvalV3PaidGateRequest({
          authorization_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
        }),
        "historical_authorization_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV3PaidGateRequest({
          workflow_id: OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
        }),
        "historical_workflow_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV3PaidGateRequest({
          action: "resume_workflow",
          resume_workflow_id: OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
        }),
        "historical_workflow_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV3PaidGateRequest({
          action: "resume_workflow",
          resume_workflow_id: OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
        }),
        "historical_workflow_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV3PaidGateRequest({
          staging_supabase_project_ref: OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
        }),
        "production_project_forbidden",
      ],
    ];
    for (const [request, reason] of refusals) {
      assert.equal(fenceOpusV2EvalV3PaidProvider(request), 0);
      assert.throws(
        () => assertOpusV2EvalV3PaidAuthorizationGate(request),
        (error: unknown) => {
          assert.ok(error instanceof OpusV2EvalV3PaidAuthorizationError);
          assert.equal(error.reason, reason);
          return true;
        },
      );
    }
    assert.throws(() => constructOpusV2EvalV3Provider(), /prepared_cannot_construct_provider/);
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });

  it("keeps public live, runtime, Studio, and Production closed", () => {
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });

  it("keeps held-out Rule 8 IDs out of the prepared authorization", () => {
    for (const file of MODULE_FILES) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
    }
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });
});
