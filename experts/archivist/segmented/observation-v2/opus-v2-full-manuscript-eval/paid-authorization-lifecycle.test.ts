import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPUS_V2_EVAL_AUTHORIZED_TO_RUN,
  constructOpusV2EvalProvider,
  opusV2EvalProviderConstructCount,
} from "./index.ts";
import { OPUS_V2_EVAL_EXPLICIT_GRANT } from "./explicit-grant.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION_STORAGE,
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_PERSISTENCE_FORBIDDEN,
  OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
  OPUS_V2_EVAL_PAID_SUCCESS_BAR,
  OpusV2EvalPaidAuthorizationError,
  assertCanonicalPaidAuthorizationPrepared,
  assertGrantMatchesPrepared,
  assertOpusV2EvalPaidAuthorizationGate,
  assertValidAuthorizationState,
  authorizeOpusV2EvalPaidAuthorization,
  cloneOpusV2EvalPaidAuthorization,
  fenceOpusV2EvalPaidProvider,
  matchingOpusV2EvalPaidGateRequest,
  projectOpusV2EvalPaidAuthorization,
} from "./paid-authorization.ts";

const SYNTHETIC_WORKFLOW_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OTHER_WORKFLOW_ID = "ffffffff-1111-2222-3333-444444444444";

function authorizedFromGrant() {
  return authorizeOpusV2EvalPaidAuthorization(
    cloneOpusV2EvalPaidAuthorization(),
    OPUS_V2_EVAL_EXPLICIT_GRANT,
  );
}

describe("isolated Opus V2 paid authorization lifecycle", () => {
  it("keeps the canonical prepared object immutable", () => {
    assertCanonicalPaidAuthorizationPrepared();
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.status, "prepared");
    assert.throws(
      () => projectOpusV2EvalPaidAuthorization(OPUS_V2_EVAL_PAID_AUTHORIZATION, "authorize", {
        grant: OPUS_V2_EVAL_EXPLICIT_GRANT,
      }),
      /canonical_prepared_authorization_is_immutable/,
    );
  });

  it("enforces the prepared invariant", () => {
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.spend_authorized, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(OPUS_V2_EVAL_AUTHORIZED_TO_RUN, false);
    assert.throws(
      () => cloneOpusV2EvalPaidAuthorization({ spend_authorized: true }),
      /authorize_requires_explicit_grant/,
    );
  });

  it("creates explicitly authorized state from the explicit grant", () => {
    const authorized = authorizedFromGrant();
    assert.equal(authorized.status, "explicitly_authorized");
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.status, "explicitly_authorized");
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION_STORAGE.parallel_overlay, false);
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION_STORAGE.migration_invented, false);
  });

  it("preserves every immutable pin through authorization", () => {
    const authorized = OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION;
    const prepared = OPUS_V2_EVAL_PAID_AUTHORIZATION;
    assert.equal(authorized.authorization_id, prepared.authorization_id);
    assert.equal(authorized.manuscript_id, prepared.manuscript_id);
    assert.equal(authorized.manuscript_version_id, prepared.manuscript_version_id);
    assert.equal(authorized.content_hash, prepared.content_hash);
    assert.equal(authorized.analytical_word_count, prepared.analytical_word_count);
    assert.equal(authorized.plan_fingerprint, prepared.plan_fingerprint);
    assert.equal(authorized.workflow_kind, prepared.workflow_kind);
    assert.equal(authorized.runner_id, prepared.runner_id);
    assert.equal(authorized.runner_version, prepared.runner_version);
    assert.equal(authorized.prompt_version, prepared.prompt_version);
    assert.equal(authorized.schema_version, prepared.schema_version);
    assert.equal(authorized.provider, prepared.provider);
    assert.equal(authorized.model, prepared.model);
    assert.equal(authorized.effort, prepared.effort);
    assert.equal(authorized.max_tokens, prepared.max_tokens);
    assert.equal(authorized.cache, prepared.cache);
    assert.equal(authorized.fallback, prepared.fallback);
    assert.equal(authorized.staging_supabase_project_ref, prepared.staging_supabase_project_ref);
    assert.equal(authorized.hard_cost_ceiling_usd, 6);
  });

  it("sets authorized flags true and leaves the workflow unbound", () => {
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.spend_authorized, true);
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.ceiling_authorized_for_spend, true);
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorized_to_run, true);
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.bound_workflow_id, null);
  });

  it("rejects a wrong authorization ID, ceiling, and every mismatched pin on the grant", () => {
    const prepared = cloneOpusV2EvalPaidAuthorization();
    const mismatches: Array<[string, Partial<typeof OPUS_V2_EVAL_EXPLICIT_GRANT>]> = [
      ["authorization_id_mismatch", { authorization_id: "other-id" }],
      ["ceiling_mismatch", { hard_cost_ceiling_usd: 6.01 }],
      ["manuscript_id_mismatch", { manuscript_id: "00000000-0000-0000-0000-000000000000" }],
      ["manuscript_version_id_mismatch", { manuscript_version_id: "00000000-0000-0000-0000-000000000001" }],
      ["content_hash_mismatch", { content_hash: "0".repeat(64) }],
      ["plan_fingerprint_mismatch", { plan_fingerprint: "wrong-plan" }],
      ["runner_mismatch", { runner_id: "other-runner" }],
      ["workflow_kind_mismatch", { workflow_kind: "archivist-segmented-pilot" }],
      ["prompt_version_mismatch", { prompt_version: "archivist_v2_extraction_prompt@v1" }],
      ["schema_version_mismatch", { schema_version: "archivist_segment_observation@v1" }],
      ["provider_mismatch", { provider: "openai" }],
      ["model_mismatch", { model: "claude-haiku-4-5-20251001" }],
      ["effort_mismatch", { effort: "high" }],
      ["max_tokens_mismatch", { max_tokens: 8000 }],
      ["cache_or_fallback_forbidden", { cache: "on" }],
      ["staging_project_mismatch", { staging_supabase_project_ref: "other-project" }],
    ];
    for (const [reason, patch] of mismatches) {
      assert.throws(
        () => authorizeOpusV2EvalPaidAuthorization(prepared, { ...OPUS_V2_EVAL_EXPLICIT_GRANT, ...patch }),
        (error: unknown) => error instanceof OpusV2EvalPaidAuthorizationError && error.reason === reason,
      );
    }
    assert.throws(
      () =>
        authorizeOpusV2EvalPaidAuthorization(prepared, {
          ...OPUS_V2_EVAL_EXPLICIT_GRANT,
          staging_supabase_project_ref: OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
        }),
      /staging_project_mismatch|production_project_forbidden/,
    );
  });

  it("consumes one synthetic workflow and rejects a second", () => {
    const authorized = authorizedFromGrant();
    const consumed = projectOpusV2EvalPaidAuthorization(authorized, "consume", {
      workflow_id: SYNTHETIC_WORKFLOW_ID,
    });
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.bound_workflow_id, SYNTHETIC_WORKFLOW_ID);
    assert.equal(consumed.spend_authorized, true);
    assert.throws(
      () => projectOpusV2EvalPaidAuthorization(consumed, "consume", { workflow_id: OTHER_WORKFLOW_ID }),
      /second_workflow_rejected/,
    );
    assert.doesNotThrow(() =>
      assertOpusV2EvalPaidAuthorizationGate(
        matchingOpusV2EvalPaidGateRequest({
          authorization: consumed,
          action: "resume_workflow",
          resume_workflow_id: SYNTHETIC_WORKFLOW_ID,
        }),
      ),
    );
    assert.throws(
      () =>
        assertOpusV2EvalPaidAuthorizationGate(
          matchingOpusV2EvalPaidGateRequest({
            authorization: consumed,
            action: "resume_workflow",
            resume_workflow_id: OTHER_WORKFLOW_ID,
          }),
        ),
      /consumed_wrong_workflow_resume/,
    );
  });

  it("revokes prepared and authorized states and refuses restart", () => {
    const revokedPrepared = projectOpusV2EvalPaidAuthorization(cloneOpusV2EvalPaidAuthorization(), "revoke");
    assert.equal(revokedPrepared.status, "revoked");
    assert.equal(revokedPrepared.authorized_to_run, false);
    const revokedAuthorized = projectOpusV2EvalPaidAuthorization(authorizedFromGrant(), "revoke");
    assert.equal(revokedAuthorized.status, "revoked");
    assert.equal(revokedAuthorized.spend_authorized, true);
    assert.equal(revokedAuthorized.authorized_to_run, false);
    assert.throws(
      () =>
        assertOpusV2EvalPaidAuthorizationGate(
          matchingOpusV2EvalPaidGateRequest({
            authorization: revokedAuthorized,
            action: "start_workflow",
          }),
        ),
      /revoked_no_provider_calls/,
    );
    assert.throws(
      () => projectOpusV2EvalPaidAuthorization(revokedAuthorized, "authorize", { grant: OPUS_V2_EVAL_EXPLICIT_GRANT }),
      /authorize_requires_prepared/,
    );
    assert.throws(
      () => projectOpusV2EvalPaidAuthorization(revokedAuthorized, "consume", { workflow_id: SYNTHETIC_WORKFLOW_ID }),
      /terminal_does_not_reopen/,
    );
  });

  it("does not strip legitimate authorized state on clone", () => {
    const authorized = authorizedFromGrant();
    const cloned = cloneOpusV2EvalPaidAuthorization({}, authorized);
    assert.equal(cloned.status, "explicitly_authorized");
    assert.equal(cloned.spend_authorized, true);
    assert.equal(cloned.ceiling_authorized_for_spend, true);
    assert.equal(cloned.authorized_to_run, true);
    assert.equal(cloned.bound_workflow_id, null);
  });

  it("rejects invalid boolean and status combinations", () => {
    assert.throws(
      () =>
        assertValidAuthorizationState({
          ...OPUS_V2_EVAL_PAID_AUTHORIZATION,
          spend_authorized: true,
        }),
      /prepared_invariant_violation/,
    );
    assert.throws(
      () =>
        assertValidAuthorizationState({
          ...OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
          spend_authorized: false,
        }),
      /explicitly_authorized_invariant_violation/,
    );
    assert.throws(
      () =>
        assertValidAuthorizationState({
          ...OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
          bound_workflow_id: SYNTHETIC_WORKFLOW_ID,
        } as typeof OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION),
      /explicitly_authorized_invariant_violation/,
    );
    assert.throws(
      () =>
        assertValidAuthorizationState({
          ...OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
          status: "consumed",
          bound_workflow_id: null,
        } as never),
      /consumed_invariant_violation/,
    );
    assert.throws(
      () =>
        assertValidAuthorizationState({
          ...OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
          status: "revoked",
          authorized_to_run: true,
        } as never),
      /revoked_invariant_violation/,
    );
  });

  it("keeps candidate-only restrictions unchanged", () => {
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.accepted_canon_writes_allowed, false);
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.series_bible_writes_allowed, false);
    assert.ok(OPUS_V2_EVAL_PAID_PERSISTENCE_FORBIDDEN.includes("accepted_canon"));
    assert.equal(OPUS_V2_EVAL_PAID_SUCCESS_BAR.accepted_canon_writes, 0);
  });

  it("refuses provider construction across prepared, mismatched authorized, and revoked states", () => {
    const authorized = OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION;
    const cases = [
      matchingOpusV2EvalPaidGateRequest(),
      matchingOpusV2EvalPaidGateRequest({ authorization: authorized, manuscript_id: "00000000-0000-0000-0000-000000000000" }),
      matchingOpusV2EvalPaidGateRequest({ authorization: authorized, plan_fingerprint: "wrong-plan" }),
      matchingOpusV2EvalPaidGateRequest({ authorization: authorized, model: "claude-sonnet-4-5" }),
      matchingOpusV2EvalPaidGateRequest({ authorization: authorized, effort: "high" }),
      matchingOpusV2EvalPaidGateRequest({
        authorization: authorized,
        staging_supabase_project_ref: OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
      }),
      matchingOpusV2EvalPaidGateRequest({ authorization: authorized, workflow_kind: "archivist-segmented-pilot" }),
      matchingOpusV2EvalPaidGateRequest({
        authorization: projectOpusV2EvalPaidAuthorization(authorizedFromGrant(), "revoke"),
      }),
    ];
    for (const request of cases) {
      assert.equal(fenceOpusV2EvalPaidProvider(request), 0);
    }
    assert.doesNotThrow(() =>
      assertOpusV2EvalPaidAuthorizationGate(
        matchingOpusV2EvalPaidGateRequest({
          authorization: authorized,
          action: "start_workflow",
        }),
      ),
    );
    assert.throws(() => constructOpusV2EvalProvider(), /provider_construction_is_not_authorized/);
    assert.equal(opusV2EvalProviderConstructCount(), 0);
    assert.doesNotThrow(() => assertGrantMatchesPrepared(OPUS_V2_EVAL_EXPLICIT_GRANT));
  });
});
