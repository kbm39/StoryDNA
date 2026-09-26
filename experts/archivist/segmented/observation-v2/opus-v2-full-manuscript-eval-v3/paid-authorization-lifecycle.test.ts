import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
} from "../opus-v2-full-manuscript-eval/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V2_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
} from "../opus-v2-full-manuscript-eval-v2/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETION_SUCCESS_BAR,
  OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS,
  OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION_STORAGE,
  OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
  OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
  OpusV2EvalV3PaidAuthorizationError,
  assertCanonicalV3PaidAuthorizationPrepared,
  assertGrantMatchesPreparedV3,
  assertHistoricalConsumedAuthorizationUnchanged,
  assertOpusV2EvalV3PaidAuthorizationGate,
  assertOpusV2EvalV3PaidCostGate,
  authorizeOpusV2EvalV3PaidAuthorization,
  cloneOpusV2EvalV3PaidAuthorization,
  constructOpusV2EvalV3Provider,
  fenceOpusV2EvalV3PaidProvider,
  matchingOpusV2EvalV3PaidGateRequest,
  opusV2EvalV3ProviderConstructCount,
  projectOpusV2EvalV3PaidAuthorization,
} from "./index.ts";

const SYNTHETIC_WORKFLOW_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_WORKFLOW_ID = "ffffffff-1111-4222-8333-444444444444";

const MODULE_FILES = [
  "explicit-grant.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval-v3.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "paid-authorization-lifecycle.test.ts",
  "raw-persistence.ts",
];

function authorizedFromGrant() {
  return authorizeOpusV2EvalV3PaidAuthorization(
    cloneOpusV2EvalV3PaidAuthorization(),
    OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
  );
}

describe("isolated Opus eval @v3 explicit authorization lifecycle", () => {
  it("keeps the canonical prepared object immutable and derives explicit state", () => {
    assertCanonicalV3PaidAuthorizationPrepared();
    assertHistoricalConsumedAuthorizationUnchanged();
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.spend_authorized, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.bound_workflow_id, null);
    assert.throws(
      () =>
        projectOpusV2EvalV3PaidAuthorization(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION, "authorize", {
          grant: OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
        }),
      /canonical_prepared_authorization_is_immutable/,
    );
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.status, "explicitly_authorized");
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.spend_authorized, true);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.ceiling_authorized_for_spend, true);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.authorized_to_run, true);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.hard_cost_ceiling_usd, 5);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION_STORAGE.kind, "code_bound_explicit_authorization");
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION_STORAGE.reused_consumed_20260925, false);
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION_STORAGE.reused_consumed_20260926, false);
  });

  it("preserves every pin through the explicit grant", () => {
    const authorized = OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION;
    const prepared = OPUS_V2_EVAL_V3_PAID_AUTHORIZATION;
    assertGrantMatchesPreparedV3(OPUS_V2_EVAL_V3_EXPLICIT_GRANT, prepared);
    assert.equal(authorized.authorization_id, "reckoning-revised-13-opus-v2-full-eval-v3-20260926");
    assert.equal(authorized.authorization_id, prepared.authorization_id);
    assert.equal(authorized.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(authorized.manuscript_version_id, "19ec5084-3426-4a91-a946-05895bb3e556");
    assert.equal(authorized.content_hash, "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f");
    assert.equal(authorized.analytical_word_count, 109887);
    assert.equal(
      authorized.plan_fingerprint,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(authorized.execution_fingerprint, OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT);
    assert.equal(authorized.runner_id, "archivist-opus-v2-full-manuscript-eval-v3");
    assert.equal(authorized.runner_version, "archivist_opus_v2_full_manuscript_eval@v3");
    assert.equal(authorized.prompt_version, "archivist_v2_extraction_prompt@v4");
    assert.equal(authorized.schema_version, "archivist_segment_observation@v2");
    assert.equal(authorized.provider, "anthropic");
    assert.equal(authorized.model, "claude-opus-5-5");
    assert.equal(authorized.effort, "medium");
    assert.equal(authorized.max_tokens, 6000);
    assert.equal(authorized.observation_hard_cap, 16);
    assert.equal(authorized.cache, "off");
    assert.equal(authorized.fallback, "none");
    assert.equal(authorized.staging_supabase_project_ref, "xwkphouojohyouhdvkgh");
    assert.equal(OPUS_V2_EVAL_V3_COMPLETION_SUCCESS_BAR.units, "30/30");
    assert.equal(OPUS_V2_EVAL_V3_COMPLETION_SUCCESS_BAR.planned_segments_validated, "14/14");
    assert.equal(OPUS_V2_EVAL_V3_COMPLETION_SUCCESS_BAR.accepted_canon_writes, 0);
  });

  it("does not mutate or reuse the historical 20260925 or 20260926 authorizations", () => {
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION_ID, "reckoning-revised-13-opus-v2-full-eval-20260925");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID, "reckoning-revised-13-opus-v2-full-eval-v2-20260926");
    assert.deepEqual([...OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS], [
      OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
    ]);
    assert.notEqual(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.notEqual(OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID, OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorization_id, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.equal(OPUS_V2_EVAL_V2_EXPLICIT_AUTHORIZATION.authorization_id, OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID);
    assert.notEqual(
      OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.authorization_id,
      OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorization_id,
    );
    assert.notEqual(
      OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.authorization_id,
      OPUS_V2_EVAL_V2_EXPLICIT_AUTHORIZATION.authorization_id,
    );
    assert.equal(fenceOpusV2EvalV3PaidProvider(
      matchingOpusV2EvalV3PaidGateRequest({
        authorization_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
      }),
    ), 0);
  });

  it("rejects mismatched grants and every wrong pin at $0", () => {
    const prepared = cloneOpusV2EvalV3PaidAuthorization();
    const mismatches: Array<[string, Partial<typeof OPUS_V2_EVAL_V3_EXPLICIT_GRANT>]> = [
      ["authorization_id_mismatch", { authorization_id: "reckoning-revised-13-opus-v2-full-eval-v2-20260926" }],
      ["ceiling_mismatch", { hard_cost_ceiling_usd: 5.01 }],
      ["manuscript_id_mismatch", { manuscript_id: "00000000-0000-0000-0000-000000000000" }],
      ["content_hash_mismatch", { content_hash: "0".repeat(64) }],
      ["plan_fingerprint_mismatch", { plan_fingerprint: "wrong-plan" }],
      ["execution_fingerprint_mismatch", { execution_fingerprint: "1".repeat(64) }],
      ["runner_mismatch", { runner_id: "archivist-opus-v2-full-manuscript-eval-v2" }],
      ["prompt_version_mismatch", { prompt_version: "archivist_v2_extraction_prompt@v3" }],
      ["model_mismatch", { model: "claude-haiku-4-5-20251001" }],
      ["effort_mismatch", { effort: "high" }],
      ["max_tokens_mismatch", { max_tokens: 4000 }],
      ["observation_hard_cap_mismatch", { observation_hard_cap: 18 }],
      ["cache_or_fallback_forbidden", { cache: "on" }],
      ["staging_project_mismatch", { staging_supabase_project_ref: "other-project" }],
    ];
    for (const [reason, patch] of mismatches) {
      assert.throws(
        () =>
          authorizeOpusV2EvalV3PaidAuthorization(prepared, {
            ...OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
            ...patch,
          }),
        (error: unknown) => error instanceof OpusV2EvalV3PaidAuthorizationError && error.reason === reason,
      );
    }
    assert.throws(
      () =>
        authorizeOpusV2EvalV3PaidAuthorization(prepared, {
          ...OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
          staging_supabase_project_ref: OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
        }),
      /staging_project_mismatch|production_project_forbidden/,
    );
  });

  it("allows start-workflow on explicit state without constructing a provider or binding a workflow", () => {
    const authorized = OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION;
    assert.doesNotThrow(() =>
      assertOpusV2EvalV3PaidAuthorizationGate(
        matchingOpusV2EvalV3PaidGateRequest({
          authorization: authorized,
          action: "start_workflow",
        }),
      ),
    );
    assert.equal(
      fenceOpusV2EvalV3PaidProvider(
        matchingOpusV2EvalV3PaidGateRequest({
          authorization: authorized,
          action: "construct_provider",
        }),
      ),
      0,
    );
    assert.throws(() => constructOpusV2EvalV3Provider(), /prepared_cannot_construct_provider/);
    assert.equal(authorized.bound_workflow_id, null);
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });

  it("projects consume/resume/revoke in memory without consuming the derived grant", () => {
    const authorized = authorizedFromGrant();
    const consumed = projectOpusV2EvalV3PaidAuthorization(authorized, "consume", {
      workflow_id: SYNTHETIC_WORKFLOW_ID,
    });
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.bound_workflow_id, SYNTHETIC_WORKFLOW_ID);
    assert.throws(
      () =>
        projectOpusV2EvalV3PaidAuthorization(consumed, "consume", {
          workflow_id: OTHER_WORKFLOW_ID,
        }),
      /second_workflow_rejected/,
    );
    assert.throws(
      () =>
        projectOpusV2EvalV3PaidAuthorization(authorized, "consume", {
          workflow_id: OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
        }),
      /historical_workflow_reuse_forbidden/,
    );
    assert.throws(
      () =>
        projectOpusV2EvalV3PaidAuthorization(authorized, "consume", {
          workflow_id: OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
        }),
      /historical_workflow_reuse_forbidden/,
    );
    assert.throws(
      () =>
        projectOpusV2EvalV3PaidAuthorization(authorized, "consume", {
          workflow_id: OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
        }),
      /historical_workflow_reuse_forbidden/,
    );
    assert.doesNotThrow(() =>
      assertOpusV2EvalV3PaidAuthorizationGate(
        matchingOpusV2EvalV3PaidGateRequest({
          authorization: consumed,
          action: "resume_workflow",
          resume_workflow_id: SYNTHETIC_WORKFLOW_ID,
        }),
      ),
    );
    const revoked = projectOpusV2EvalV3PaidAuthorization(authorizedFromGrant(), "revoke");
    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.authorized_to_run, false);
    assert.throws(
      () =>
        assertOpusV2EvalV3PaidAuthorizationGate(
          matchingOpusV2EvalV3PaidGateRequest({
            authorization: revoked,
            action: "start_workflow",
          }),
        ),
      /revoked_no_provider_calls/,
    );
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.status, "explicitly_authorized");
    assert.equal(OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });

  it("enforces the $5 cost gate without swallowing a later call", () => {
    assert.doesNotThrow(() =>
      assertOpusV2EvalV3PaidCostGate({ accrued_usd: 3.6, next_call_high_usd: 1.4 }),
    );
    assert.throws(
      () => assertOpusV2EvalV3PaidCostGate({ accrued_usd: 4.8, next_call_high_usd: 0.3 }),
      /cost_gate/,
    );
  });

  it("keeps held-out Rule 8 IDs out of the explicit grant", () => {
    for (const file of MODULE_FILES) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
    }
    assert.equal(opusV2EvalV3ProviderConstructCount(), 0);
  });
});
