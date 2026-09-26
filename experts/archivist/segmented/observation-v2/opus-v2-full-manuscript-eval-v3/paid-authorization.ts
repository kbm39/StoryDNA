/**
 * Isolated one-shot authorization for a future Opus eval @v3 rerun.
 * Prompt @v4, hard observation cap 16, max_tokens 6000, ceiling $5.
 * Canonical prepared object stays prepared. Explicit grant derives authorized state.
 * Does not execute. Does not mutate consumed 20260925 or 20260926 authorizations.
 */

import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { RECONCILIATION_MAX_BATCH_SIZE } from "../../constants.ts";
import { V2_EVIDENCE_GATE_VERSION } from "../evidence-contiguity.ts";
import { V2_OBSERVATION_COMPARISON_VERSION } from "../comparison.ts";
import { V2_TRUNCATED_PREFIX_RECOVERY_VERSION } from "../truncated-prefix-recovery.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
} from "../opus-v2-full-manuscript-eval/paid-authorization.ts";
import { OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID } from "../opus-v2-full-manuscript-eval-v2/paid-authorization.ts";
import {
  OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
  type OpusV2EvalV3ExplicitGrant,
} from "./explicit-grant.ts";
import {
  OPUS_V2_EVAL_V3_CACHE,
  OPUS_V2_EVAL_V3_CEILING_AUTHORIZED,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS,
  OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  OPUS_V2_EVAL_V3_EFFORT,
  OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V3_FALLBACK,
  OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MAX,
  OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MIN,
  OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MAX,
  OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MIN,
  OPUS_V2_EVAL_V3_FUTURE_LOW_USD,
  OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_ID,
  OPUS_V2_EVAL_V3_INPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_V3_MAX_TOKENS,
  OPUS_V2_EVAL_V3_MODEL,
  OPUS_V2_EVAL_V3_OUTPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_V3_PROMPT_VERSION,
  OPUS_V2_EVAL_V3_PROVIDER,
  OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR,
  OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
  OPUS_V2_EVAL_V3_SCHEMA_VERSION,
  OPUS_V2_EVAL_V3_SOURCE_PIN,
  OPUS_V2_EVAL_V3_SPEND_AUTHORIZED,
  OPUS_V2_EVAL_V3_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_V3_SUCCESS_BAR,
  OPUS_V2_EVAL_V3_VERSION,
  OPUS_V2_EVAL_V3_WORKFLOW_KIND,
} from "./lock.ts";

export const OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID =
  "reckoning-revised-13-opus-v2-full-eval-v3-20260926" as const;

export const OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STATUSES = [
  "prepared",
  "explicitly_authorized",
  "consumed",
  "revoked",
] as const;

export const OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF = "tumcpxklduhiigxjwlrp" as const;
export const OPUS_V2_EVAL_V3_REQUIRED_FREEZE_HEAD =
  "12f2766eb180659934aff11bd53f605a13905b01" as const;

export const OPUS_V2_EVAL_V3_DEFAULT_REPAIR_ALLOWANCE = 0 as const;
export const OPUS_V2_EVAL_V3_EMERGENCY_REPAIR_MAX = 3 as const;
export const OPUS_V2_EVAL_V3_REPAIRS_AUTHORIZED = false;
export const OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_SIZE = RECONCILIATION_MAX_BATCH_SIZE;
export const OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_CAP = 8 as const;

export const OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_STORAGE = {
  kind: "code_bound_prepared_authorization",
  table: null,
  existing_0027_usable: false,
  migration_invented: false,
  db_row_written: false,
  reused_consumed_20260925: false,
  reused_consumed_20260926: false,
  mutated_historical_authorization: false,
} as const;

export class OpusV2EvalV3PaidAuthorizationError extends Error {
  readonly code = "opus_v2_eval_v3_paid_authorization" as const;
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "OpusV2EvalV3PaidAuthorizationError";
    this.reason = reason;
  }
}

const providerConstructCount = 0;

export function opusV2EvalV3ProviderConstructCount(): number {
  return providerConstructCount;
}

export function constructOpusV2EvalV3Provider(): never {
  throw new OpusV2EvalV3PaidAuthorizationError("prepared_cannot_construct_provider");
}

export interface OpusV2EvalV3PreparedAuthorization {
  authorization_id: typeof OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID;
  status: "prepared";
  bound_workflow_id: null;
  spend_authorized: false;
  ceiling_authorized_for_spend: false;
  authorized_to_run: false;
  manuscript_id: typeof OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_id;
  manuscript_version_id: typeof OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_version_id;
  content_hash: typeof OPUS_V2_EVAL_V3_SOURCE_PIN.content_hash;
  analytical_word_count: typeof OPUS_V2_EVAL_V3_SOURCE_PIN.analytical_word_count;
  plan_fingerprint: typeof OPUS_V2_EVAL_V3_SOURCE_PIN.plan_fingerprint;
  expected_unit_count: 30;
  expected_segment_count: 14;
  expected_unique_words: 109887;
  expected_coverage_percentage: 100;
  expected_uncovered_ranges: 0;
  expected_overlap_words: 27582;
  workflow_kind: typeof OPUS_V2_EVAL_V3_WORKFLOW_KIND;
  runner_id: typeof OPUS_V2_EVAL_V3_ID;
  runner_version: typeof OPUS_V2_EVAL_V3_VERSION;
  max_workflows: 1;
  prompt_version: typeof OPUS_V2_EVAL_V3_PROMPT_VERSION;
  schema_version: typeof OPUS_V2_EVAL_V3_SCHEMA_VERSION;
  provider: typeof OPUS_V2_EVAL_V3_PROVIDER;
  model: typeof OPUS_V2_EVAL_V3_MODEL;
  effort: typeof OPUS_V2_EVAL_V3_EFFORT;
  max_tokens: typeof OPUS_V2_EVAL_V3_MAX_TOKENS;
  observation_hard_cap: typeof OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP;
  cache: typeof OPUS_V2_EVAL_V3_CACHE;
  fallback: typeof OPUS_V2_EVAL_V3_FALLBACK;
  execution_fingerprint: typeof OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT;
  staging_supabase_project_ref: typeof OPUS_V2_EVAL_V3_STAGING_PROJECT_REF;
  production_supabase_project_ref: typeof OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF;
  required_freeze_head: typeof OPUS_V2_EVAL_V3_REQUIRED_FREEZE_HEAD;
  hard_cost_ceiling_usd: typeof OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD;
  input_usd_per_mtok: typeof OPUS_V2_EVAL_V3_INPUT_USD_PER_MTOK;
  output_usd_per_mtok: typeof OPUS_V2_EVAL_V3_OUTPUT_USD_PER_MTOK;
  expected_primary_observation_calls: 14;
  default_repair_allowance: typeof OPUS_V2_EVAL_V3_DEFAULT_REPAIR_ALLOWANCE;
  emergency_repair_max: typeof OPUS_V2_EVAL_V3_EMERGENCY_REPAIR_MAX;
  repairs_authorized: false;
  reconciliation_batch_size: typeof OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_SIZE;
  reconciliation_batch_cap: typeof OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_CAP;
  pairing_version: typeof V2_OBSERVATION_COMPARISON_VERSION;
  evidence_version: typeof V2_EVIDENCE_GATE_VERSION;
  prefix_recovery_version: typeof V2_TRUNCATED_PREFIX_RECOVERY_VERSION;
  raw_archive_relative_dir: typeof OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR;
  success_bar: typeof OPUS_V2_EVAL_V3_SUCCESS_BAR;
  accepted_canon_writes_allowed: false;
  series_bible_writes_allowed: false;
  retcon_writes_allowed: false;
  supersession_writes_allowed: false;
  disposition_writes_allowed: false;
}

export const OPUS_V2_EVAL_V3_PAID_AUTHORIZATION = {
  authorization_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
  status: "prepared",
  bound_workflow_id: null,
  spend_authorized: false,
  ceiling_authorized_for_spend: false,
  authorized_to_run: false,
  manuscript_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_V3_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_V3_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_V3_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_V3_SOURCE_PIN.plan_fingerprint,
  expected_unit_count: 30,
  expected_segment_count: 14,
  expected_unique_words: 109887,
  expected_coverage_percentage: 100,
  expected_uncovered_ranges: 0,
  expected_overlap_words: 27582,
  workflow_kind: OPUS_V2_EVAL_V3_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_V3_ID,
  runner_version: OPUS_V2_EVAL_V3_VERSION,
  max_workflows: 1,
  prompt_version: OPUS_V2_EVAL_V3_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_V3_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_V3_PROVIDER,
  model: OPUS_V2_EVAL_V3_MODEL,
  effort: OPUS_V2_EVAL_V3_EFFORT,
  max_tokens: OPUS_V2_EVAL_V3_MAX_TOKENS,
  observation_hard_cap: OPUS_V2_EVAL_V3_OBSERVATION_HARD_CAP,
  cache: OPUS_V2_EVAL_V3_CACHE,
  fallback: OPUS_V2_EVAL_V3_FALLBACK,
  execution_fingerprint: OPUS_V2_EVAL_V3_EXECUTION_FINGERPRINT,
  staging_supabase_project_ref: OPUS_V2_EVAL_V3_STAGING_PROJECT_REF,
  production_supabase_project_ref: OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
  required_freeze_head: OPUS_V2_EVAL_V3_REQUIRED_FREEZE_HEAD,
  hard_cost_ceiling_usd: OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
  input_usd_per_mtok: OPUS_V2_EVAL_V3_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_V3_OUTPUT_USD_PER_MTOK,
  expected_primary_observation_calls: 14,
  default_repair_allowance: OPUS_V2_EVAL_V3_DEFAULT_REPAIR_ALLOWANCE,
  emergency_repair_max: OPUS_V2_EVAL_V3_EMERGENCY_REPAIR_MAX,
  repairs_authorized: false,
  reconciliation_batch_size: OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_SIZE,
  reconciliation_batch_cap: OPUS_V2_EVAL_V3_RECONCILIATION_BATCH_CAP,
  pairing_version: V2_OBSERVATION_COMPARISON_VERSION,
  evidence_version: V2_EVIDENCE_GATE_VERSION,
  prefix_recovery_version: V2_TRUNCATED_PREFIX_RECOVERY_VERSION,
  raw_archive_relative_dir: OPUS_V2_EVAL_V3_RAW_ARCHIVE_RELATIVE_DIR,
  success_bar: OPUS_V2_EVAL_V3_SUCCESS_BAR,
  accepted_canon_writes_allowed: false,
  series_bible_writes_allowed: false,
  retcon_writes_allowed: false,
  supersession_writes_allowed: false,
  disposition_writes_allowed: false,
} as const satisfies OpusV2EvalV3PreparedAuthorization;

export interface OpusV2EvalV3ExplicitlyAuthorizedAuthorization
  extends Omit<
    OpusV2EvalV3PreparedAuthorization,
    "status" | "spend_authorized" | "ceiling_authorized_for_spend" | "authorized_to_run"
  > {
  status: "explicitly_authorized";
  spend_authorized: true;
  ceiling_authorized_for_spend: true;
  authorized_to_run: true;
  bound_workflow_id: null;
}

export interface OpusV2EvalV3ConsumedAuthorization
  extends Omit<
    OpusV2EvalV3PreparedAuthorization,
    "status" | "spend_authorized" | "ceiling_authorized_for_spend" | "authorized_to_run" | "bound_workflow_id"
  > {
  status: "consumed";
  spend_authorized: true;
  ceiling_authorized_for_spend: true;
  authorized_to_run: true;
  bound_workflow_id: string;
}

export interface OpusV2EvalV3RevokedAuthorization
  extends Omit<
    OpusV2EvalV3PreparedAuthorization,
    "status" | "spend_authorized" | "ceiling_authorized_for_spend" | "authorized_to_run" | "bound_workflow_id"
  > {
  status: "revoked";
  spend_authorized: boolean;
  ceiling_authorized_for_spend: boolean;
  authorized_to_run: false;
  bound_workflow_id: string | null;
}

export type OpusV2EvalV3PaidAuthorization =
  | OpusV2EvalV3PreparedAuthorization
  | OpusV2EvalV3ExplicitlyAuthorizedAuthorization
  | OpusV2EvalV3ConsumedAuthorization
  | OpusV2EvalV3RevokedAuthorization;

const WORKFLOW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pinMismatch(actual: unknown, expected: unknown, reason: string): void {
  if (actual !== expected) {
    throw new OpusV2EvalV3PaidAuthorizationError(reason);
  }
}

export function assertValidV3AuthorizationState(
  authorization: OpusV2EvalV3PaidAuthorization,
): void {
  pinMismatch(authorization.authorization_id, OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID, "authorization_id_mismatch");
  pinMismatch(authorization.hard_cost_ceiling_usd, 5, "ceiling_mismatch");
  pinMismatch(authorization.accepted_canon_writes_allowed, false, "accepted_canon_forbidden");
  pinMismatch(authorization.series_bible_writes_allowed, false, "series_bible_forbidden");
  if (authorization.status === "prepared") {
    if (
      authorization.spend_authorized !== false ||
      authorization.ceiling_authorized_for_spend !== false ||
      authorization.authorized_to_run !== false ||
      authorization.bound_workflow_id !== null
    ) {
      throw new OpusV2EvalV3PaidAuthorizationError("prepared_invariant_violation");
    }
    return;
  }
  if (authorization.status === "explicitly_authorized") {
    if (
      authorization.spend_authorized !== true ||
      authorization.ceiling_authorized_for_spend !== true ||
      authorization.authorized_to_run !== true ||
      authorization.bound_workflow_id !== null
    ) {
      throw new OpusV2EvalV3PaidAuthorizationError("explicitly_authorized_invariant_violation");
    }
    return;
  }
  if (authorization.status === "consumed") {
    if (
      authorization.spend_authorized !== true ||
      authorization.ceiling_authorized_for_spend !== true ||
      authorization.authorized_to_run !== true ||
      !authorization.bound_workflow_id
    ) {
      throw new OpusV2EvalV3PaidAuthorizationError("consumed_invariant_violation");
    }
    return;
  }
  if (authorization.status === "revoked") {
    if (authorization.authorized_to_run !== false) {
      throw new OpusV2EvalV3PaidAuthorizationError("revoked_invariant_violation");
    }
    return;
  }
  throw new OpusV2EvalV3PaidAuthorizationError("unknown_authorization_status");
}

export function assertGrantMatchesPreparedV3(
  grant: OpusV2EvalV3ExplicitGrant,
  prepared: OpusV2EvalV3PreparedAuthorization = OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
): void {
  pinMismatch(grant.authorization_id, prepared.authorization_id, "authorization_id_mismatch");
  pinMismatch(grant.hard_cost_ceiling_usd, prepared.hard_cost_ceiling_usd, "ceiling_mismatch");
  pinMismatch(grant.manuscript_id, prepared.manuscript_id, "manuscript_id_mismatch");
  pinMismatch(grant.manuscript_version_id, prepared.manuscript_version_id, "manuscript_version_id_mismatch");
  pinMismatch(grant.content_hash, prepared.content_hash, "content_hash_mismatch");
  pinMismatch(grant.analytical_word_count, prepared.analytical_word_count, "word_count_mismatch");
  pinMismatch(grant.plan_fingerprint, prepared.plan_fingerprint, "plan_fingerprint_mismatch");
  pinMismatch(grant.execution_fingerprint, prepared.execution_fingerprint, "execution_fingerprint_mismatch");
  pinMismatch(grant.workflow_kind, prepared.workflow_kind, "workflow_kind_mismatch");
  pinMismatch(grant.runner_id, prepared.runner_id, "runner_mismatch");
  pinMismatch(grant.runner_version, prepared.runner_version, "runner_mismatch");
  pinMismatch(grant.prompt_version, prepared.prompt_version, "prompt_version_mismatch");
  pinMismatch(grant.schema_version, prepared.schema_version, "schema_version_mismatch");
  pinMismatch(grant.provider, prepared.provider, "provider_mismatch");
  pinMismatch(grant.model, prepared.model, "model_mismatch");
  pinMismatch(grant.effort, prepared.effort, "effort_mismatch");
  pinMismatch(grant.max_tokens, prepared.max_tokens, "max_tokens_mismatch");
  pinMismatch(grant.observation_hard_cap, prepared.observation_hard_cap, "observation_hard_cap_mismatch");
  pinMismatch(grant.cache, prepared.cache, "cache_or_fallback_forbidden");
  pinMismatch(grant.fallback, prepared.fallback, "cache_or_fallback_forbidden");
  pinMismatch(grant.environment, "staging", "staging_project_mismatch");
  pinMismatch(grant.staging_supabase_project_ref, prepared.staging_supabase_project_ref, "staging_project_mismatch");
  pinMismatch(
    grant.production_supabase_project_ref,
    OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF,
    "production_project_forbidden",
  );
}

export function authorizeOpusV2EvalV3PaidAuthorization(
  prepared: OpusV2EvalV3PreparedAuthorization,
  grant: OpusV2EvalV3ExplicitGrant,
): OpusV2EvalV3ExplicitlyAuthorizedAuthorization {
  if (prepared.status !== "prepared") {
    throw new OpusV2EvalV3PaidAuthorizationError("authorize_requires_prepared");
  }
  assertValidV3AuthorizationState(prepared);
  assertGrantMatchesPreparedV3(grant, prepared);
  const authorized = {
    ...prepared,
    status: "explicitly_authorized",
    bound_workflow_id: null,
    spend_authorized: true,
    ceiling_authorized_for_spend: true,
    authorized_to_run: true,
  } as const satisfies OpusV2EvalV3ExplicitlyAuthorizedAuthorization;
  assertValidV3AuthorizationState(authorized);
  return authorized;
}

export const OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION = authorizeOpusV2EvalV3PaidAuthorization(
  OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_V3_EXPLICIT_GRANT,
);

export const OPUS_V2_EVAL_V3_EXPLICIT_AUTHORIZATION_STORAGE = {
  kind: "code_bound_explicit_authorization",
  derived_from: "OPUS_V2_EVAL_V3_PAID_AUTHORIZATION",
  grant: "OPUS_V2_EVAL_V3_EXPLICIT_GRANT",
  table: null,
  existing_0027_usable: false,
  migration_invented: false,
  db_row_written: false,
  parallel_overlay: false,
  reused_consumed_20260925: false,
  reused_consumed_20260926: false,
  mutated_historical_authorization: false,
} as const;

export const OPUS_V2_EVAL_V3_COMPLETION_SUCCESS_BAR = {
  units: "30/30",
  planned_segments_validated: "14/14",
  unique_coverage: "109887/109887",
  coverage_percentage: 100,
  unexplained_gaps: 0,
  plan_pin_match: true,
  candidate_canon_assembled: true,
  v2_pairing_completes: true,
  continuity_candidate_review_validates: true,
  complete_cost_ledger: true,
  accepted_canon_writes: 0,
  series_bible_writes: 0,
} as const;

export function cloneOpusV2EvalV3PaidAuthorization(
  overrides: Partial<OpusV2EvalV3PaidAuthorization> = {},
  base: OpusV2EvalV3PaidAuthorization = OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
): OpusV2EvalV3PaidAuthorization {
  if (
    base.status === "prepared" &&
    (overrides.status === "explicitly_authorized" ||
      overrides.status === "consumed" ||
      overrides.spend_authorized === true ||
      overrides.ceiling_authorized_for_spend === true ||
      overrides.authorized_to_run === true)
  ) {
    throw new OpusV2EvalV3PaidAuthorizationError(
      overrides.status === "consumed" ? "consume_requires_explicitly_authorized" : "authorize_requires_explicit_grant",
    );
  }
  const merged = {
    ...base,
    ...overrides,
    authorization_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
    hard_cost_ceiling_usd: OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
    accepted_canon_writes_allowed: false as const,
    series_bible_writes_allowed: false as const,
    retcon_writes_allowed: false as const,
    supersession_writes_allowed: false as const,
    disposition_writes_allowed: false as const,
  };
  let next: OpusV2EvalV3PaidAuthorization;
  if (merged.status === "prepared") {
    next = {
      ...merged,
      status: "prepared",
      bound_workflow_id: null,
      spend_authorized: false,
      ceiling_authorized_for_spend: false,
      authorized_to_run: false,
    };
  } else if (merged.status === "explicitly_authorized") {
    next = {
      ...merged,
      status: "explicitly_authorized",
      bound_workflow_id: null,
      spend_authorized: true,
      ceiling_authorized_for_spend: true,
      authorized_to_run: true,
    };
  } else if (merged.status === "consumed") {
    if (!merged.bound_workflow_id) {
      throw new OpusV2EvalV3PaidAuthorizationError("consumed_invariant_violation");
    }
    next = {
      ...merged,
      status: "consumed",
      bound_workflow_id: merged.bound_workflow_id,
      spend_authorized: true,
      ceiling_authorized_for_spend: true,
      authorized_to_run: true,
    };
  } else {
    next = {
      ...merged,
      status: "revoked",
      authorized_to_run: false,
      spend_authorized: merged.spend_authorized,
      ceiling_authorized_for_spend: merged.ceiling_authorized_for_spend,
      bound_workflow_id: merged.bound_workflow_id,
    };
  }
  assertValidV3AuthorizationState(next);
  return next;
}

export function projectOpusV2EvalV3PaidAuthorization(
  current: OpusV2EvalV3PaidAuthorization,
  action: "authorize" | "consume" | "revoke",
  args: { workflow_id?: string | null; grant?: OpusV2EvalV3ExplicitGrant } = {},
): OpusV2EvalV3PaidAuthorization {
  if (current.authorization_id !== OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV3PaidAuthorizationError("authorization_id_mismatch");
  }
  if (current === OPUS_V2_EVAL_V3_PAID_AUTHORIZATION) {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_prepared_authorization_is_immutable");
  }
  assertValidV3AuthorizationState(current);
  if (action === "authorize") {
    if (!args.grant) {
      throw new OpusV2EvalV3PaidAuthorizationError("authorize_requires_explicit_grant");
    }
    if (current.status !== "prepared") {
      throw new OpusV2EvalV3PaidAuthorizationError("authorize_requires_prepared");
    }
    return authorizeOpusV2EvalV3PaidAuthorization(current, args.grant);
  }
  if (action === "revoke") {
    if (current.status !== "prepared" && current.status !== "explicitly_authorized") {
      throw new OpusV2EvalV3PaidAuthorizationError("revoke_requires_prepared_or_authorized");
    }
    return cloneOpusV2EvalV3PaidAuthorization(
      {
        status: "revoked",
        authorized_to_run: false,
        spend_authorized: current.status === "explicitly_authorized",
        ceiling_authorized_for_spend: current.status === "explicitly_authorized",
        bound_workflow_id: null,
      },
      current,
    );
  }
  if (action === "consume") {
    if (current.status === "consumed") {
      if (!args.workflow_id || args.workflow_id !== current.bound_workflow_id) {
        throw new OpusV2EvalV3PaidAuthorizationError("second_workflow_rejected");
      }
      return current;
    }
    if (current.status === "revoked") {
      throw new OpusV2EvalV3PaidAuthorizationError("terminal_does_not_reopen");
    }
    if (current.status !== "explicitly_authorized") {
      throw new OpusV2EvalV3PaidAuthorizationError("consume_requires_explicitly_authorized");
    }
    if (!args.workflow_id || !WORKFLOW_UUID.test(args.workflow_id)) {
      throw new OpusV2EvalV3PaidAuthorizationError("consume_requires_workflow_id");
    }
    if (
      args.workflow_id === OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID ||
      args.workflow_id === OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID ||
      args.workflow_id === OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID
    ) {
      throw new OpusV2EvalV3PaidAuthorizationError("historical_workflow_reuse_forbidden");
    }
    return cloneOpusV2EvalV3PaidAuthorization(
      {
        status: "consumed",
        bound_workflow_id: args.workflow_id,
        spend_authorized: true,
        ceiling_authorized_for_spend: true,
        authorized_to_run: true,
      },
      current,
    );
  }
  throw new OpusV2EvalV3PaidAuthorizationError("unknown_lifecycle_action");
}

export const OPUS_V2_EVAL_V3_PAID_COST_MODEL = {
  input_usd_per_mtok: OPUS_V2_EVAL_V3_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_V3_OUTPUT_USD_PER_MTOK,
  cache: OPUS_V2_EVAL_V3_CACHE,
  low_usd: OPUS_V2_EVAL_V3_FUTURE_LOW_USD,
  expected_usd_min: OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MIN,
  expected_usd_max: OPUS_V2_EVAL_V3_FUTURE_EXPECTED_USD_MAX,
  high_usd_min: OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MIN,
  high_usd_max: OPUS_V2_EVAL_V3_FUTURE_HIGH_USD_MAX,
  hard_ceiling_usd: OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD,
  ceiling_authorized_for_spend: false,
} as const;

export const OPUS_V2_EVAL_V3_CALL_ORDER = [
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
] as const;

export const OPUS_V2_EVAL_V3_FORBIDDEN_WORKFLOW_IDS = [
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V1_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_COMPLETED_OPUS_V2_WORKFLOW_ID,
  OPUS_V2_EVAL_V3_HISTORICAL_REVISED_13_WORKFLOW_ID,
] as const;

export interface OpusV2EvalV3PaidGateRequest {
  authorization?: OpusV2EvalV3PaidAuthorization;
  authorization_id: string;
  action: "construct_provider" | "start_workflow" | "resume_workflow";
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  plan_fingerprint: string;
  execution_fingerprint: string;
  prompt_version: string;
  schema_version: string;
  provider: string;
  model: string;
  effort: string;
  max_tokens: number;
  cache: string;
  fallback: string;
  workflow_kind: string;
  runner_id: string;
  runner_version: string;
  staging_supabase_project_ref: string;
  workflow_id?: string | null;
  resume_workflow_id?: string | null;
}

export function matchingOpusV2EvalV3PaidGateRequest(
  overrides: Partial<OpusV2EvalV3PaidGateRequest> = {},
): OpusV2EvalV3PaidGateRequest {
  return {
    authorization_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
    action: "construct_provider",
    manuscript_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.content_hash,
    plan_fingerprint: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.plan_fingerprint,
    execution_fingerprint: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.execution_fingerprint,
    prompt_version: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.prompt_version,
    schema_version: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.schema_version,
    provider: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.provider,
    model: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.model,
    effort: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.effort,
    max_tokens: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.max_tokens,
    cache: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.cache,
    fallback: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.fallback,
    workflow_kind: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.workflow_kind,
    runner_id: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.runner_id,
    runner_version: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.runner_version,
    staging_supabase_project_ref: OPUS_V2_EVAL_V3_PAID_AUTHORIZATION.staging_supabase_project_ref,
    workflow_id: null,
    resume_workflow_id: null,
    ...overrides,
  };
}

export function assertHistoricalConsumedAuthorizationUnchanged(): void {
  if (!OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS.includes(OPUS_V2_EVAL_PAID_AUTHORIZATION_ID)) {
    throw new OpusV2EvalV3PaidAuthorizationError("historical_authorization_id_mutated");
  }
  if (
    !(OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS as readonly string[]).includes(
      OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
    )
  ) {
    throw new OpusV2EvalV3PaidAuthorizationError("historical_authorization_id_mutated");
  }
  if (
    (OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS as readonly string[]).includes(
      OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID,
    )
  ) {
    throw new OpusV2EvalV3PaidAuthorizationError("new_authorization_reused_historical_id");
  }
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION.status !== "prepared") {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_20260925_prepared_object_mutated");
  }
  if (OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorization_id !== OPUS_V2_EVAL_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV3PaidAuthorizationError("historical_explicit_authorization_mutated");
  }
}

export function assertCanonicalV3PaidAuthorizationPrepared(): void {
  assertHistoricalConsumedAuthorizationUnchanged();
  const auth = OPUS_V2_EVAL_V3_PAID_AUTHORIZATION;
  if (auth.status !== "prepared") {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_status_must_remain_prepared");
  }
  if (auth.bound_workflow_id !== null) {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_must_not_prebind_workflow");
  }
  if (auth.spend_authorized !== false || OPUS_V2_EVAL_V3_SPEND_AUTHORIZED !== false) {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_spend_must_remain_false");
  }
  if (auth.ceiling_authorized_for_spend !== false || OPUS_V2_EVAL_V3_CEILING_AUTHORIZED !== false) {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_ceiling_spend_must_remain_false");
  }
  if (auth.authorized_to_run !== false) {
    throw new OpusV2EvalV3PaidAuthorizationError("canonical_run_must_remain_false");
  }
}

export function assertOpusV2EvalV3PaidAuthorizationGate(
  request: OpusV2EvalV3PaidGateRequest,
): void {
  if (isArchivistLiveExecutionAllowed() !== false || ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new OpusV2EvalV3PaidAuthorizationError("public_live_must_remain_fail_closed");
  }
  if (archivistRuntimeDefinition().enabled || ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new OpusV2EvalV3PaidAuthorizationError("runtime_and_studio_must_remain_closed");
  }
  if ((OPUS_V2_EVAL_V3_CONSUMED_AUTHORIZATION_IDS as readonly string[]).includes(request.authorization_id)) {
    throw new OpusV2EvalV3PaidAuthorizationError("historical_authorization_reuse_forbidden");
  }
  if (request.authorization_id !== OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV3PaidAuthorizationError("authorization_id_mismatch");
  }
  const auth = request.authorization ?? OPUS_V2_EVAL_V3_PAID_AUTHORIZATION;
  assertValidV3AuthorizationState(auth);
  if (auth.authorization_id !== OPUS_V2_EVAL_V3_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV3PaidAuthorizationError("authorization_id_mismatch");
  }
  if (request.manuscript_id !== auth.manuscript_id) {
    throw new OpusV2EvalV3PaidAuthorizationError("manuscript_id_mismatch");
  }
  if (request.manuscript_version_id !== auth.manuscript_version_id) {
    throw new OpusV2EvalV3PaidAuthorizationError("manuscript_version_id_mismatch");
  }
  if (request.content_hash !== auth.content_hash) {
    throw new OpusV2EvalV3PaidAuthorizationError("content_hash_mismatch");
  }
  if (request.plan_fingerprint !== auth.plan_fingerprint) {
    throw new OpusV2EvalV3PaidAuthorizationError("plan_fingerprint_mismatch");
  }
  if (request.execution_fingerprint !== auth.execution_fingerprint) {
    throw new OpusV2EvalV3PaidAuthorizationError("execution_fingerprint_mismatch");
  }
  if (request.prompt_version !== auth.prompt_version) {
    throw new OpusV2EvalV3PaidAuthorizationError("prompt_version_mismatch");
  }
  if (request.schema_version !== auth.schema_version) {
    throw new OpusV2EvalV3PaidAuthorizationError("schema_version_mismatch");
  }
  if (request.provider !== auth.provider) {
    throw new OpusV2EvalV3PaidAuthorizationError("provider_mismatch");
  }
  const lowered = request.model.toLowerCase();
  if (lowered.includes("haiku")) {
    throw new OpusV2EvalV3PaidAuthorizationError("haiku_forbidden");
  }
  if (lowered.includes("sonnet")) {
    throw new OpusV2EvalV3PaidAuthorizationError("sonnet_forbidden");
  }
  if (request.model !== auth.model) {
    throw new OpusV2EvalV3PaidAuthorizationError("model_mismatch");
  }
  if (request.effort !== auth.effort) {
    throw new OpusV2EvalV3PaidAuthorizationError("effort_mismatch");
  }
  if (request.max_tokens !== auth.max_tokens) {
    throw new OpusV2EvalV3PaidAuthorizationError("max_tokens_mismatch");
  }
  if (request.cache !== "off" || request.fallback !== "none") {
    throw new OpusV2EvalV3PaidAuthorizationError("cache_or_fallback_forbidden");
  }
  if (request.workflow_kind !== auth.workflow_kind) {
    throw new OpusV2EvalV3PaidAuthorizationError("workflow_kind_mismatch");
  }
  if (request.runner_id !== auth.runner_id || request.runner_version !== auth.runner_version) {
    throw new OpusV2EvalV3PaidAuthorizationError("runner_mismatch");
  }
  if (request.staging_supabase_project_ref === OPUS_V2_EVAL_V3_PRODUCTION_PROJECT_REF) {
    throw new OpusV2EvalV3PaidAuthorizationError("production_project_forbidden");
  }
  if (request.staging_supabase_project_ref !== auth.staging_supabase_project_ref) {
    throw new OpusV2EvalV3PaidAuthorizationError("staging_project_mismatch");
  }
  const candidateWorkflow = request.workflow_id ?? request.resume_workflow_id;
  if (
    candidateWorkflow &&
    (OPUS_V2_EVAL_V3_FORBIDDEN_WORKFLOW_IDS as readonly string[]).includes(candidateWorkflow)
  ) {
    throw new OpusV2EvalV3PaidAuthorizationError("historical_workflow_reuse_forbidden");
  }
  if (auth.status === "revoked") {
    throw new OpusV2EvalV3PaidAuthorizationError("revoked_no_provider_calls");
  }
  if (auth.status === "prepared") {
    if (request.action === "construct_provider") {
      throw new OpusV2EvalV3PaidAuthorizationError("prepared_cannot_construct_provider");
    }
    if (request.action === "start_workflow") {
      throw new OpusV2EvalV3PaidAuthorizationError("prepared_cannot_start_workflow");
    }
    throw new OpusV2EvalV3PaidAuthorizationError("prepared_cannot_resume_workflow");
  }
  if (request.action === "construct_provider") {
    throw new OpusV2EvalV3PaidAuthorizationError("provider_construction_is_not_invoked_here");
  }
  if (request.action === "start_workflow") {
    if (auth.status === "consumed") {
      throw new OpusV2EvalV3PaidAuthorizationError("second_workflow_rejected");
    }
    if (auth.status !== "explicitly_authorized") {
      throw new OpusV2EvalV3PaidAuthorizationError("start_requires_explicitly_authorized");
    }
    return;
  }
  if (request.action === "resume_workflow") {
    const resumeId = request.resume_workflow_id ?? request.workflow_id;
    if (auth.status !== "consumed" || !auth.bound_workflow_id) {
      throw new OpusV2EvalV3PaidAuthorizationError("resume_requires_bound_workflow");
    }
    if (!resumeId || resumeId !== auth.bound_workflow_id) {
      throw new OpusV2EvalV3PaidAuthorizationError("consumed_wrong_workflow_resume");
    }
    return;
  }
}

export function assertOpusV2EvalV3PaidCostGate(args: {
  accrued_usd: number;
  next_call_high_usd: number;
}): void {
  if (args.accrued_usd + args.next_call_high_usd > OPUS_V2_EVAL_V3_RECOMMENDED_HARD_CEILING_USD) {
    throw new OpusV2EvalV3PaidAuthorizationError("cost_gate");
  }
}

export function fenceOpusV2EvalV3PaidProvider(
  request: OpusV2EvalV3PaidGateRequest = matchingOpusV2EvalV3PaidGateRequest(),
): number {
  const before = opusV2EvalV3ProviderConstructCount();
  try {
    assertOpusV2EvalV3PaidAuthorizationGate(request);
    constructOpusV2EvalV3Provider();
  } catch (error) {
    if (error instanceof OpusV2EvalV3PaidAuthorizationError) {
      return opusV2EvalV3ProviderConstructCount() - before;
    }
    throw error;
  }
  return opusV2EvalV3ProviderConstructCount() - before;
}

export function assertOpusV2EvalV3CandidateOnlySafety(
  auth: typeof OPUS_V2_EVAL_V3_PAID_AUTHORIZATION = OPUS_V2_EVAL_V3_PAID_AUTHORIZATION,
): void {
  if (
    auth.accepted_canon_writes_allowed ||
    auth.series_bible_writes_allowed ||
    auth.retcon_writes_allowed ||
    auth.supersession_writes_allowed ||
    auth.disposition_writes_allowed
  ) {
    throw new OpusV2EvalV3PaidAuthorizationError("candidate_only_safety_violated");
  }
}

export const OPUS_V2_EVAL_V3_PAID_SUCCESS_BAR = OPUS_V2_EVAL_V3_SUCCESS_BAR;

export const OPUS_V2_EVAL_V3_PAID_PERSISTENCE_FORBIDDEN = [
  "accepted_canon",
  "series_bible",
  "retcon",
  "supersession",
  "author_disposition",
] as const;
