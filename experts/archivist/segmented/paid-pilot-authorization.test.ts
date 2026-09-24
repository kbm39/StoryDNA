import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeExpert } from "@/lib/execute-expert/execute.ts";
import { getLiveProviderInvocationCount, resetLiveProviderInvocationCountForTests } from "@/lib/execute-expert/dry-run-guard.ts";
import { ARCHIVIST_CONSTITUTION } from "../constitution.ts";
import { ARCHIVIST_LIVE_MODEL_CERTIFIED, isArchivistLiveExecutionAllowed } from "../live-flags.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { CertifiedModelMismatchError, PaidPilotCostCeilingError, PaidPilotUnauthorizedError } from "./errors.ts";
import {
  RECKONING_PAID_PILOT_AUTHORIZATION,
  clonePaidPilotAuthorization,
} from "./paid-pilot-authorization.ts";
import {
  matchingPaidPilotGateRequest,
  reachPaidPilotProviderBoundary,
} from "./paid-pilot-gate.ts";
import {
  accruedPaidPilotCostUsd,
  assertOptionalCallWithinCeiling,
  futureCallRolesRemain,
  recordPaidCallBeforeParse,
  RECKONING_PAID_PILOT_COST_PROJECTION,
} from "./paid-pilot-cost.ts";
import {
  CANDIDATE_REVIEW_COMPANION_FIELDS,
  PAID_PILOT_PERSISTENCE_FORBIDDEN,
  PAID_PILOT_RESUME_POLICY,
  PAID_PILOT_RETRY_POLICY,
  PAID_PILOT_SUCCESS_CRITERIA,
  requiresModelReconciliation,
  selectPairsNeedingModel,
} from "./paid-pilot-policy.ts";
import { RECKONING_REVISED_11_2_SEGMENT_PLAN } from "./reckoning-revised-11-2-segment-plan.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function fence(request = matchingPaidPilotGateRequest()) {
  let constructed = 0;
  try {
    reachPaidPilotProviderBoundary(request, () => {
      constructed += 1;
      return true;
    });
  } catch {
    return constructed;
  }
  return constructed;
}

describe("REVISED-11-2 paid-pilot authorization preparation", () => {
  it("stays prepared and is not a global Archivist-enabled boolean", () => {
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.status, "prepared");
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.authorized_to_run, false);
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_id, RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id);
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.content_hash, RECKONING_REVISED_11_2_SOURCE_PIN.content_hash);
    assert.equal(
      RECKONING_PAID_PILOT_AUTHORIZATION.plan_fingerprint,
      RECKONING_REVISED_11_2_SEGMENT_PLAN.plan_fingerprint,
    );
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.provider, "anthropic");
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.model, "claude-haiku-4-5-20251001");
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.hard_cost_ceiling_usd, 1);
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.max_active_workflows, 1);
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(RECKONING_PAID_PILOT_AUTHORIZATION.series_id, null);
  });

  it("keeps the provider fence at 0 unless an explicit fixture is authorized", () => {
    resetLiveProviderInvocationCountForTests();
    assert.equal(fence(), 0);
    assert.equal(
      fence(matchingPaidPilotGateRequest({ manuscript_id: "0".repeat(36) })),
      0,
    );
    assert.equal(
      fence(matchingPaidPilotGateRequest({ content_hash: "0".repeat(64) })),
      0,
    );
    assert.equal(
      fence(matchingPaidPilotGateRequest({ model: "claude-opus-4-8" })),
      0,
    );
    assert.equal(
      fence(matchingPaidPilotGateRequest({ staging_supabase_project_ref: "tumcpxklduhiigxjwlrp" })),
      0,
    );
    assert.equal(
      fence(
        matchingPaidPilotGateRequest({
          authorization: clonePaidPilotAuthorization({ status: "consumed", bound_workflow_id: "wf-1" }),
        }),
      ),
      0,
    );
    assert.equal(
      fence(
        matchingPaidPilotGateRequest({
          authorization: clonePaidPilotAuthorization({ status: "prepared" }),
        }),
      ),
      0,
    );
    const allowed = fence(
      matchingPaidPilotGateRequest({
        authorization: clonePaidPilotAuthorization({ status: "explicitly_authorized" }),
      }),
    );
    assert.equal(allowed, 1);
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("lets a consumed authorization resume only the bound workflow", () => {
    const authorization = clonePaidPilotAuthorization({
      status: "consumed",
      bound_workflow_id: "wf-resume",
    });
    assert.equal(
      fence(matchingPaidPilotGateRequest({ authorization, resume_workflow_id: "other" })),
      0,
    );
    assert.equal(
      fence(matchingPaidPilotGateRequest({ authorization, resume_workflow_id: "wf-resume" })),
      1,
    );
  });

  it("rejects unset or mismatched models before provider construction", () => {
    assert.throws(
      () =>
        reachPaidPilotProviderBoundary(
          matchingPaidPilotGateRequest({
            authorization: clonePaidPilotAuthorization({ status: "explicitly_authorized" }),
            model: "",
          }),
          () => true,
        ),
      CertifiedModelMismatchError,
    );
    assert.throws(
      () =>
        reachPaidPilotProviderBoundary(
          matchingPaidPilotGateRequest({
            authorization: clonePaidPilotAuthorization({ status: "explicitly_authorized" }),
            provider: "openai",
          }),
          () => true,
        ),
      CertifiedModelMismatchError,
    );
  });

  it("refuses optional calls that would exceed the $1.00 ceiling and keeps roles after parse failure", () => {
    const ledger = [];
    recordPaidCallBeforeParse({
      role: "segment_observation",
      segment_or_batch_id: "seg-01",
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      input_tokens: 18000,
      output_tokens: 2500,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      finish_reason: "stop",
      duration_ms: 10,
      status: "parse_failed",
      estimated_usd: 0.92,
      usage_confidence: "exact",
    }, ledger);
    assert.equal(accruedPaidPilotCostUsd(ledger), 0.92);
    assert.throws(
      () => assertOptionalCallWithinCeiling({ accrued_usd: 0.92, proposed_call_estimate_usd: 0.12 }),
      PaidPilotCostCeilingError,
    );
    assertOptionalCallWithinCeiling({
      accrued_usd: 0.92,
      proposed_call_estimate_usd: 0.12,
      mandatory_in_flight: true,
    });
    assert.deepEqual(futureCallRolesRemain(), [
      "segment_observation",
      "segment_repair",
      "global_reconciliation",
      "global_repair",
    ]);
    assert.equal(RECKONING_PAID_PILOT_COST_PROJECTION.hard_ceiling_usd, 1);
  });

  it("prefers deterministic pairing and documents resume/retry/success policy", () => {
    assert.equal(requiresModelReconciliation({ kind: "injury_laterality" }), false);
    assert.equal(requiresModelReconciliation({ kind: "relationship_history" }), true);
    assert.equal(selectPairsNeedingModel([{ kind: "appearance_unexplained" }, { kind: "travel_timeline" }]).length, 1);
    assert.equal(PAID_PILOT_RESUME_POLICY.same_one_shot_authorization_permits_resume, true);
    assert.equal(PAID_PILOT_RETRY_POLICY.representation_repair.max, 1);
    assert.equal(PAID_PILOT_RETRY_POLICY.provider_network_retry.trigger_max_attempts, 2);
    assert.equal(PAID_PILOT_SUCCESS_CRITERIA.completion_alone_is_not_success, true);
    assert.ok(PAID_PILOT_PERSISTENCE_FORBIDDEN.includes("accepted_canon"));
    assert.ok(CANDIDATE_REVIEW_COMPANION_FIELDS.some((item) => /coverage/.test(item)));
  });

  it("keeps public live execution and source-pin gates closed", async () => {
    assert.equal(ARCHIVIST_LIVE_MODEL_CERTIFIED, true);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run, false);
    const live = await executeExpert({
      expert_key: "archivist",
      expert_version_id: RECKONING_PAID_PILOT_AUTHORIZATION.expert_version_id,
      manuscript_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_id,
      manuscript_version_id: RECKONING_PAID_PILOT_AUTHORIZATION.manuscript_version_id,
      content_hash: RECKONING_PAID_PILOT_AUTHORIZATION.content_hash,
      mode: "live",
    });
    assert.equal(live.ok, false);
    assert.throws(
      () => reachPaidPilotProviderBoundary(matchingPaidPilotGateRequest(), () => true),
      PaidPilotUnauthorizedError,
    );
  });
});

describe("0027 paid-pilot authorization schema (source only, not applied)", () => {
  const sql = readFileSync(
    join(ROOT, "experts/archivist/segmented/schema/0027_archivist_pilot_authorizations.sql"),
    "utf8",
  );

  it("is additive, RLS-closed, and excluded from supabase/migrations", () => {
    assert.match(sql, /DO NOT APPLY/);
    assert.match(sql, /archivist_pilot_authorizations/);
    assert.match(sql, /prepared/);
    assert.match(sql, /explicitly_authorized/);
    assert.match(sql, /consumed/);
    assert.match(sql, /revoked/);
    assert.match(sql, /tumcpxklduhiigxjwlrp/);
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /canon_facts/);
    const applied = readFileSync(join(ROOT, "supabase/migrations/0026_archivist_segmented_workflows.sql"), "utf8");
    assert.doesNotMatch(applied, /archivist_pilot_authorizations/);
  });
});
