import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
} from "../opus-v2-full-manuscript-eval/paid-authorization.ts";
import {
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_VERSION,
} from "../opus-v2-full-manuscript-eval/lock.ts";
import {
  OPUS_V2_EVAL_V2_CALL_ORDER,
  OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_ID,
  OPUS_V2_EVAL_V2_MAX_TOKENS,
  OPUS_V2_EVAL_V2_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE,
  OPUS_V2_EVAL_V2_PAID_COST_MODEL,
  OPUS_V2_EVAL_V2_PAID_PERSISTENCE_FORBIDDEN,
  OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR,
  OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF,
  OPUS_V2_EVAL_V2_PROMPT_VERSION,
  OPUS_V2_EVAL_V2_REQUIRED_FREEZE_HEAD,
  OPUS_V2_EVAL_V2_VERSION,
  OpusV2EvalV2PaidAuthorizationError,
  assertCanonicalV2PaidAuthorizationPrepared,
  assertHistoricalConsumedAuthorizationUnchanged,
  assertOpusV2EvalV2CandidateOnlySafety,
  assertOpusV2EvalV2PaidAuthorizationGate,
  constructOpusV2EvalV2Provider,
  fenceOpusV2EvalV2PaidProvider,
  matchingOpusV2EvalV2PaidGateRequest,
  opusV2EvalV2ProviderConstructCount,
} from "./index.ts";

const MODULE_FILES = [
  "fixtures.ts",
  "index.ts",
  "lock.ts",
  "opus-v2-full-manuscript-eval-v2.test.ts",
  "paid-authorization.ts",
  "paid-authorization.test.ts",
  "raw-persistence.ts",
];

describe("prepared Opus eval @v2 $5 authorization", () => {
  it("creates a new prepared identity without reusing or mutating 20260925", () => {
    assertCanonicalV2PaidAuthorizationPrepared();
    assertHistoricalConsumedAuthorizationUnchanged();
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
      "reckoning-revised-13-opus-v2-full-eval-v2-20260926",
    );
    assert.equal(
      OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
      "reckoning-revised-13-opus-v2-full-eval-20260925",
    );
    assert.notEqual(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.equal(OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.equal(OPUS_V2_EVAL_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorization_id, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.status, "prepared");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.bound_workflow_id, null);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.spend_authorized, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.authorized_to_run, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.hard_cost_ceiling_usd, 5);
    assert.equal(
      OPUS_V2_EVAL_V2_REQUIRED_FREEZE_HEAD,
      "02c94bb706fefd5c663894de301a2c1373d52a50",
    );
  });

  it("binds eval @v2 execution identity, not historical @v1", () => {
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_id, OPUS_V2_EVAL_V2_ID);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_id, "archivist-opus-v2-full-manuscript-eval-v2");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_version, "archivist_opus_v2_full_manuscript_eval@v2");
    assert.equal(OPUS_V2_EVAL_V2_VERSION, "archivist_opus_v2_full_manuscript_eval@v2");
    assert.equal(OPUS_V2_EVAL_VERSION, "archivist_opus_v2_full_manuscript_eval@v1");
    assert.notEqual(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_version, OPUS_V2_EVAL_VERSION);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.prompt_version, "archivist_v2_extraction_prompt@v3");
    assert.equal(OPUS_V2_EVAL_V2_PROMPT_VERSION, "archivist_v2_extraction_prompt@v3");
    assert.equal(OPUS_V2_EVAL_PROMPT_VERSION, "archivist_v2_extraction_prompt@v2");
    assert.notEqual(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.prompt_version, OPUS_V2_EVAL_PROMPT_VERSION);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.max_tokens, 6000);
    assert.equal(OPUS_V2_EVAL_V2_MAX_TOKENS, 6000);
    assert.equal(OPUS_V2_EVAL_MAX_TOKENS, 4000);
    assert.notEqual(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.max_tokens, OPUS_V2_EVAL_MAX_TOKENS);
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.execution_fingerprint,
      OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
    );
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.execution_fingerprint.length, 64);
    assert.notEqual(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.execution_fingerprint,
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.plan_fingerprint,
    );
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.schema_version, "archivist_segment_observation@v2");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.workflow_kind, "experimental_opus_v2_full_manuscript_eval");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.provider, "anthropic");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.model, "claude-opus-5-5");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.effort, "medium");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.cache, "off");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.fallback, "none");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.max_workflows, 1);
  });

  it("binds REVISED-13 source, plan, staging, and candidate-only safety", () => {
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.manuscript_version_id,
      "19ec5084-3426-4a91-a946-05895bb3e556",
    );
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.content_hash,
      "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    );
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.analytical_word_count, 109887);
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.plan_fingerprint,
      "c10f91f8efdc7e1ae821f5c7c7f824da8b085913506cab7d2c4b3514d5656686",
    );
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_unit_count, 30);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_segment_count, 14);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_unique_words, 109887);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_coverage_percentage, 100);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_uncovered_ranges, 0);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_overlap_words, 27582);
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.staging_supabase_project_ref,
      "xwkphouojohyouhdvkgh",
    );
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.production_supabase_project_ref,
      OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF,
    );
    assert.equal(OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF, "tumcpxklduhiigxjwlrp");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.pairing_version, "archivist_v2_observation_comparison@v1");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.evidence_version, "archivist_v2_contiguous_evidence@v1");
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.prefix_recovery_version,
      "archivist_v2_truncated_prefix_recovery@v1",
    );
    assert.equal(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.raw_archive_relative_dir,
      ".calibration-results/archivist-opus-v2-full-manuscript-eval-v2/raw",
    );
    assert.deepEqual([...OPUS_V2_EVAL_V2_CALL_ORDER], [
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
    assertOpusV2EvalV2CandidateOnlySafety();
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.accepted_canon_writes_allowed, false);
    assert.ok(OPUS_V2_EVAL_V2_PAID_PERSISTENCE_FORBIDDEN.includes("accepted_canon"));
  });

  it("records the $5 prepared ceiling, cost model, observation, and repair policy", () => {
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.input_usd_per_mtok, 4);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.output_usd_per_mtok, 20);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.cache, "off");
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.low_usd, 2.2);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.expected_usd_min, 3.0);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.expected_usd_max, 3.1);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.high_usd_min, 3.4);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.high_usd_max, 3.7);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.hard_ceiling_usd, 5);
    assert.equal(OPUS_V2_EVAL_V2_PAID_COST_MODEL.ceiling_authorized_for_spend, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.expected_primary_observation_calls, 14);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.default_repair_allowance, 0);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.emergency_repair_max, 3);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.repairs_authorized, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.reconciliation_batch_size, 8);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.reconciliation_batch_cap, 8);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.normal_parse_rate_min, "1/14");
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.max_tokens_rate_max, "7/14");
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.timestamp_share_max, 0.35);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.injury_min, 4);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.travel_leg_min, 3);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.relationship_min, 6);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.identity_min, 4);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.location_presence_min, 6);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.repeated_object_continuity_min, 1);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.comparable_pairs_min, 5);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.fabricated_evidence, 0);
    assert.equal(OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR.candidate_count_is_success_metric, false);
  });

  it("does not reuse 0027, invent a migration, or write a database row", () => {
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.kind, "code_bound_prepared_authorization");
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.table, null);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.existing_0027_usable, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.migration_invented, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.db_row_written, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.reused_consumed_20260925, false);
    assert.equal(OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE.mutated_historical_authorization, false);
  });

  it("refuses provider construction and every mismatched pin at $0", () => {
    const refusals: Array<[ReturnType<typeof matchingOpusV2EvalV2PaidGateRequest>, string]> = [
      [matchingOpusV2EvalV2PaidGateRequest(), "prepared_cannot_construct_provider"],
      [
        matchingOpusV2EvalV2PaidGateRequest({ action: "start_workflow" }),
        "prepared_cannot_start_workflow",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({
          manuscript_id: "00000000-0000-0000-0000-000000000000",
        }),
        "manuscript_id_mismatch",
      ],
      [matchingOpusV2EvalV2PaidGateRequest({ content_hash: "0".repeat(64) }), "content_hash_mismatch"],
      [matchingOpusV2EvalV2PaidGateRequest({ plan_fingerprint: "wrong-plan" }), "plan_fingerprint_mismatch"],
      [
        matchingOpusV2EvalV2PaidGateRequest({ execution_fingerprint: "1".repeat(64) }),
        "execution_fingerprint_mismatch",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({ prompt_version: "archivist_v2_extraction_prompt@v2" }),
        "prompt_version_mismatch",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({ schema_version: "archivist_segment_observation@v1" }),
        "schema_version_mismatch",
      ],
      [matchingOpusV2EvalV2PaidGateRequest({ model: "claude-haiku-4-5-20251001" }), "haiku_forbidden"],
      [matchingOpusV2EvalV2PaidGateRequest({ model: "claude-sonnet-4-5" }), "sonnet_forbidden"],
      [matchingOpusV2EvalV2PaidGateRequest({ model: "claude-opus-4-8" }), "model_mismatch"],
      [matchingOpusV2EvalV2PaidGateRequest({ effort: "high" }), "effort_mismatch"],
      [matchingOpusV2EvalV2PaidGateRequest({ max_tokens: 4000 }), "max_tokens_mismatch"],
      [
        matchingOpusV2EvalV2PaidGateRequest({ staging_supabase_project_ref: "other-project" }),
        "staging_project_mismatch",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({
          staging_supabase_project_ref: OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF,
        }),
        "production_project_forbidden",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({
          authorization_id: OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID,
        }),
        "historical_authorization_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({
          workflow_id: OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
        }),
        "historical_workflow_reuse_forbidden",
      ],
      [
        matchingOpusV2EvalV2PaidGateRequest({
          action: "resume_workflow",
          resume_workflow_id: OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
        }),
        "historical_workflow_reuse_forbidden",
      ],
    ];
    for (const [request, reason] of refusals) {
      assert.equal(fenceOpusV2EvalV2PaidProvider(request), 0);
      assert.throws(
        () => assertOpusV2EvalV2PaidAuthorizationGate(request),
        (error: unknown) => {
          assert.ok(error instanceof OpusV2EvalV2PaidAuthorizationError);
          assert.equal(error.reason, reason);
          return true;
        },
      );
    }
    assert.throws(() => constructOpusV2EvalV2Provider(), /prepared_cannot_construct_provider/);
    assert.equal(opusV2EvalV2ProviderConstructCount(), 0);
  });

  it("keeps public live, runtime, Studio, and Production closed", () => {
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(opusV2EvalV2ProviderConstructCount(), 0);
  });

  it("keeps held-out Rule 8 IDs out of the prepared authorization", () => {
    for (const file of MODULE_FILES) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(text.includes(id), false, `${file} ${id}`);
      }
    }
    assert.equal(opusV2EvalV2ProviderConstructCount(), 0);
  });
});
