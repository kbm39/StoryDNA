/**
 * Isolated one-shot paid authorization for a future Opus 5.5 V2 full-manuscript eval.
 * Canonical prepared object is immutable. Explicit grant derives authorized state.
 * Isolated from paid-pilot, public live, and the historical REVISED-13 workflow.
 */

import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import {
  assertNotHistoricalRevised13Workflow,
  assertOpusV2EvalPaidExecutionForbidden,
  assertOpusV2EvalPins,
  constructOpusV2EvalProvider,
  opusV2EvalProviderConstructCount,
  OpusV2EvalUnauthorizedError,
} from "./authorization.ts";
import { assertNextCallFitsCeiling } from "./cost.ts";
import {
  OPUS_V2_EVAL_EXPLICIT_GRANT,
  type OpusV2EvalExplicitGrant,
} from "./explicit-grant.ts";
import {
  OPUS_V2_EVAL_CACHE,
  OPUS_V2_EVAL_CEILING_AUTHORIZED,
  OPUS_V2_EVAL_DEFAULT_REPAIR_ALLOWANCE,
  OPUS_V2_EVAL_EFFORT,
  OPUS_V2_EVAL_EMERGENCY_REPAIR_MAX,
  OPUS_V2_EVAL_FALLBACK,
  OPUS_V2_EVAL_FUTURE_EXPECTED_USD,
  OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  OPUS_V2_EVAL_FUTURE_HIGH_USD,
  OPUS_V2_EVAL_FUTURE_LOW_USD,
  OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID,
  OPUS_V2_EVAL_ID,
  OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_MAX_TOKENS,
  OPUS_V2_EVAL_MODEL,
  OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_PROMPT_VERSION,
  OPUS_V2_EVAL_PROVIDER,
  OPUS_V2_EVAL_RECONCILIATION_BATCH_CAP,
  OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE,
  OPUS_V2_EVAL_REPAIRS_AUTHORIZED,
  OPUS_V2_EVAL_SCHEMA_VERSION,
  OPUS_V2_EVAL_SOURCE_PIN,
  OPUS_V2_EVAL_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_VERSION,
  OPUS_V2_EVAL_WORKFLOW_KIND,
} from "./lock.ts";

export const OPUS_V2_EVAL_PAID_AUTHORIZATION_ID =
  "reckoning-revised-13-opus-v2-full-eval-20260925" as const;

export const OPUS_V2_EVAL_PAID_AUTHORIZATION_STATUSES = [
  "prepared",
  "explicitly_authorized",
  "consumed",
  "revoked",
] as const;

export type OpusV2EvalPaidAuthorizationStatus =
  (typeof OPUS_V2_EVAL_PAID_AUTHORIZATION_STATUSES)[number];

export const OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF = "tumcpxklduhiigxjwlrp" as const;
export const OPUS_V2_EVAL_PAID_REQUIRED_RUNNER_FREEZE_HEAD =
  "67b98244c587971f97f2281beafb2be8fc060ee0" as const;

export const OPUS_V2_EVAL_PAID_AUTHORIZATION_STORAGE = {
  kind: "code_bound_prepared_authorization",
  table: null,
  existing_0027_usable: false,
  existing_0027_blockers: [
    "hard_cost_ceiling_usd <= 1 cannot store 6.00",
    "missing workflow_kind",
    "missing runner_id and runner_version",
    "missing prompt_version and schema_version",
    "missing effort, max_tokens, cache, and fallback",
    "missing spend_authorized versus prepared ceiling",
    "row shape is paid-pilot Trigger/Haiku, not this experimental runner",
  ],
  reused_old_authorization: false,
  mutated_revised_11_2: false,
  migration_invented: false,
  db_row_written: false,
} as const;

export class OpusV2EvalPaidAuthorizationError extends Error {
  readonly code = "opus_v2_eval_paid_authorization" as const;
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "OpusV2EvalPaidAuthorizationError";
    this.reason = reason;
  }
}

interface OpusV2EvalPaidAuthorizationPins {
  authorization_id: typeof OPUS_V2_EVAL_PAID_AUTHORIZATION_ID;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  analytical_word_count: number;
  plan_fingerprint: string;
  expected_unit_count: 30;
  expected_segment_count: 14;
  expected_unique_words: 109887;
  expected_coverage_percentage: 100;
  expected_uncovered_ranges: 0;
  expected_overlap_words: 27582;
  workflow_kind: typeof OPUS_V2_EVAL_WORKFLOW_KIND;
  runner_id: typeof OPUS_V2_EVAL_ID;
  runner_version: typeof OPUS_V2_EVAL_VERSION;
  max_workflows: 1;
  prompt_version: typeof OPUS_V2_EVAL_PROMPT_VERSION;
  schema_version: typeof OPUS_V2_EVAL_SCHEMA_VERSION;
  provider: typeof OPUS_V2_EVAL_PROVIDER;
  model: typeof OPUS_V2_EVAL_MODEL;
  effort: typeof OPUS_V2_EVAL_EFFORT;
  max_tokens: typeof OPUS_V2_EVAL_MAX_TOKENS;
  cache: typeof OPUS_V2_EVAL_CACHE;
  fallback: typeof OPUS_V2_EVAL_FALLBACK;
  staging_supabase_project_ref: typeof OPUS_V2_EVAL_STAGING_PROJECT_REF;
  production_supabase_project_ref: typeof OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF;
  required_runner_freeze_head: typeof OPUS_V2_EVAL_PAID_REQUIRED_RUNNER_FREEZE_HEAD;
  hard_cost_ceiling_usd: typeof OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD;
  input_usd_per_mtok: typeof OPUS_V2_EVAL_INPUT_USD_PER_MTOK;
  output_usd_per_mtok: typeof OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK;
  expected_primary_observation_calls: 14;
  default_repair_allowance: typeof OPUS_V2_EVAL_DEFAULT_REPAIR_ALLOWANCE;
  emergency_repair_max: typeof OPUS_V2_EVAL_EMERGENCY_REPAIR_MAX;
  repairs_authorized: false;
  reconciliation_batch_size: typeof OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE;
  reconciliation_batch_cap: typeof OPUS_V2_EVAL_RECONCILIATION_BATCH_CAP;
  accepted_canon_writes_allowed: false;
  series_bible_writes_allowed: false;
}

export interface OpusV2EvalPreparedAuthorization extends OpusV2EvalPaidAuthorizationPins {
  status: "prepared";
  bound_workflow_id: null;
  spend_authorized: false;
  ceiling_authorized_for_spend: false;
  authorized_to_run: false;
}

export interface OpusV2EvalExplicitlyAuthorizedAuthorization extends OpusV2EvalPaidAuthorizationPins {
  status: "explicitly_authorized";
  bound_workflow_id: null;
  spend_authorized: true;
  ceiling_authorized_for_spend: true;
  authorized_to_run: true;
}

export interface OpusV2EvalConsumedAuthorization extends OpusV2EvalPaidAuthorizationPins {
  status: "consumed";
  bound_workflow_id: string;
  spend_authorized: true;
  ceiling_authorized_for_spend: true;
  authorized_to_run: true;
}

export interface OpusV2EvalRevokedAuthorization extends OpusV2EvalPaidAuthorizationPins {
  status: "revoked";
  bound_workflow_id: string | null;
  spend_authorized: boolean;
  ceiling_authorized_for_spend: boolean;
  authorized_to_run: false;
}

export type OpusV2EvalPaidAuthorization =
  | OpusV2EvalPreparedAuthorization
  | OpusV2EvalExplicitlyAuthorizedAuthorization
  | OpusV2EvalConsumedAuthorization
  | OpusV2EvalRevokedAuthorization;

const CANONICAL_PINS = {
  authorization_id: OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
  manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint,
  expected_unit_count: 30 as const,
  expected_segment_count: 14 as const,
  expected_unique_words: 109887 as const,
  expected_coverage_percentage: 100 as const,
  expected_uncovered_ranges: 0 as const,
  expected_overlap_words: 27582 as const,
  workflow_kind: OPUS_V2_EVAL_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_ID,
  runner_version: OPUS_V2_EVAL_VERSION,
  max_workflows: 1 as const,
  prompt_version: OPUS_V2_EVAL_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_PROVIDER,
  model: OPUS_V2_EVAL_MODEL,
  effort: OPUS_V2_EVAL_EFFORT,
  max_tokens: OPUS_V2_EVAL_MAX_TOKENS,
  cache: OPUS_V2_EVAL_CACHE,
  fallback: OPUS_V2_EVAL_FALLBACK,
  staging_supabase_project_ref: OPUS_V2_EVAL_STAGING_PROJECT_REF,
  production_supabase_project_ref: OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
  required_runner_freeze_head: OPUS_V2_EVAL_PAID_REQUIRED_RUNNER_FREEZE_HEAD,
  hard_cost_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  input_usd_per_mtok: OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
  expected_primary_observation_calls: 14 as const,
  default_repair_allowance: OPUS_V2_EVAL_DEFAULT_REPAIR_ALLOWANCE,
  emergency_repair_max: OPUS_V2_EVAL_EMERGENCY_REPAIR_MAX,
  repairs_authorized: false as const,
  reconciliation_batch_size: OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE,
  reconciliation_batch_cap: OPUS_V2_EVAL_RECONCILIATION_BATCH_CAP,
  accepted_canon_writes_allowed: false as const,
  series_bible_writes_allowed: false as const,
} satisfies OpusV2EvalPaidAuthorizationPins;

export const OPUS_V2_EVAL_PAID_AUTHORIZATION = {
  ...CANONICAL_PINS,
  status: "prepared",
  bound_workflow_id: null,
  spend_authorized: false,
  ceiling_authorized_for_spend: false,
  authorized_to_run: false,
} as const satisfies OpusV2EvalPreparedAuthorization;

export const OPUS_V2_EVAL_PAID_COST_MODEL = {
  input_usd_per_mtok: OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
  cache: OPUS_V2_EVAL_CACHE,
  low_usd: OPUS_V2_EVAL_FUTURE_LOW_USD,
  expected_usd: OPUS_V2_EVAL_FUTURE_EXPECTED_USD,
  high_usd: OPUS_V2_EVAL_FUTURE_HIGH_USD,
  high_plus_emergency_repair_usd: { min: 3.58, max: 4.42 },
  hard_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  ceiling_authorized_for_spend: false,
} as const;

export const OPUS_V2_EVAL_PAID_LEDGER_FIELDS = [
  "provider",
  "model",
  "effort",
  "role",
  "segment_or_reconciliation_batch",
  "input_tokens",
  "output_tokens",
  "thinking_tokens",
  "cached_tokens",
  "repair_tokens",
  "finish_reason",
  "runtime",
  "per_call_exact_cost",
  "cumulative_cost",
  "exact_vs_estimated",
] as const;

export const OPUS_V2_EVAL_PAID_SUCCESS_BAR = {
  units: "30/30",
  planned_segments_validated: true,
  unique_coverage: "109887/109887",
  coverage_percentage: 100,
  unexplained_gaps: 0,
  plan_pin_match: true,
  candidate_canon_assembled: true,
  v2_pairing_completes: true,
  continuity_candidate_review_validates: true,
  evidence_safety_passes: true,
  fabricated_evidence: 0,
  accepted_canon_writes: 0,
  complete_cost_ledger: true,
  incomplete_is_fail_closed: true,
} as const;

export const OPUS_V2_EVAL_PAID_PERSISTENCE_ALLOWED = [
  "experimental_workflow",
  "plan",
  "checkpoints",
  "v2_observations",
  "coverage",
  "candidate_canon",
  "candidate_review",
  "cost_ledger",
  "pairing_reconciliation_artifacts",
] as const;

export const OPUS_V2_EVAL_PAID_PERSISTENCE_FORBIDDEN = [
  "accepted_canon",
  "series_bible",
  "retcon",
  "supersession",
  "author_disposition",
] as const;

export type OpusV2EvalPaidAction = "construct_provider" | "start_workflow" | "resume_workflow";
export type OpusV2EvalPaidExecutionContext = "authorization_preflight" | "paid_eval_execution";

export interface OpusV2EvalPaidGateRequest {
  authorization: OpusV2EvalPaidAuthorization;
  action: OpusV2EvalPaidAction;
  execution_context: OpusV2EvalPaidExecutionContext;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  plan_fingerprint: string;
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

const WORKFLOW_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pinMismatch(actual: unknown, expected: unknown, reason: string): void {
  if (actual !== expected) {
    throw new OpusV2EvalPaidAuthorizationError(reason);
  }
}

export function assertValidAuthorizationState(
  authorization: OpusV2EvalPaidAuthorization,
): void {
  pinMismatch(authorization.authorization_id, OPUS_V2_EVAL_PAID_AUTHORIZATION_ID, "authorization_id_mismatch");
  pinMismatch(authorization.hard_cost_ceiling_usd, 6, "ceiling_mismatch");
  pinMismatch(authorization.repairs_authorized, false, "repairs_not_authorized");
  pinMismatch(authorization.accepted_canon_writes_allowed, false, "accepted_canon_forbidden");
  pinMismatch(authorization.series_bible_writes_allowed, false, "series_bible_forbidden");
  if (authorization.status === "prepared") {
    if (
      authorization.spend_authorized !== false ||
      authorization.ceiling_authorized_for_spend !== false ||
      authorization.authorized_to_run !== false ||
      authorization.bound_workflow_id !== null
    ) {
      throw new OpusV2EvalPaidAuthorizationError("prepared_invariant_violation");
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
      throw new OpusV2EvalPaidAuthorizationError("explicitly_authorized_invariant_violation");
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
      throw new OpusV2EvalPaidAuthorizationError("consumed_invariant_violation");
    }
    return;
  }
  if (authorization.status === "revoked") {
    if (authorization.authorized_to_run !== false) {
      throw new OpusV2EvalPaidAuthorizationError("revoked_invariant_violation");
    }
    return;
  }
  throw new OpusV2EvalPaidAuthorizationError("unknown_authorization_status");
}

export function assertGrantMatchesPrepared(
  grant: OpusV2EvalExplicitGrant,
  prepared: OpusV2EvalPreparedAuthorization = OPUS_V2_EVAL_PAID_AUTHORIZATION,
): void {
  pinMismatch(grant.authorization_id, prepared.authorization_id, "authorization_id_mismatch");
  pinMismatch(grant.hard_cost_ceiling_usd, prepared.hard_cost_ceiling_usd, "ceiling_mismatch");
  pinMismatch(grant.manuscript_id, prepared.manuscript_id, "manuscript_id_mismatch");
  pinMismatch(grant.manuscript_version_id, prepared.manuscript_version_id, "manuscript_version_id_mismatch");
  pinMismatch(grant.content_hash, prepared.content_hash, "content_hash_mismatch");
  pinMismatch(grant.analytical_word_count, prepared.analytical_word_count, "word_count_mismatch");
  pinMismatch(grant.plan_fingerprint, prepared.plan_fingerprint, "plan_fingerprint_mismatch");
  pinMismatch(grant.workflow_kind, prepared.workflow_kind, "workflow_kind_mismatch");
  pinMismatch(grant.runner_id, prepared.runner_id, "runner_mismatch");
  pinMismatch(grant.runner_version, prepared.runner_version, "runner_mismatch");
  pinMismatch(grant.prompt_version, prepared.prompt_version, "prompt_version_mismatch");
  pinMismatch(grant.schema_version, prepared.schema_version, "schema_version_mismatch");
  pinMismatch(grant.provider, prepared.provider, "provider_mismatch");
  pinMismatch(grant.model, prepared.model, "model_mismatch");
  pinMismatch(grant.effort, prepared.effort, "effort_mismatch");
  pinMismatch(grant.max_tokens, prepared.max_tokens, "max_tokens_mismatch");
  pinMismatch(grant.cache, prepared.cache, "cache_or_fallback_forbidden");
  pinMismatch(grant.fallback, prepared.fallback, "cache_or_fallback_forbidden");
  pinMismatch(grant.environment, "staging", "staging_project_mismatch");
  pinMismatch(grant.staging_supabase_project_ref, prepared.staging_supabase_project_ref, "staging_project_mismatch");
  pinMismatch(
    grant.production_supabase_project_ref,
    OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF,
    "production_project_forbidden",
  );
}

function withCanonicalPins<T extends object>(overrides: T): OpusV2EvalPaidAuthorizationPins & T {
  return {
    ...CANONICAL_PINS,
    ...overrides,
    authorization_id: OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
    repairs_authorized: false,
    accepted_canon_writes_allowed: false,
    series_bible_writes_allowed: false,
    hard_cost_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  };
}

export function authorizeOpusV2EvalPaidAuthorization(
  prepared: OpusV2EvalPreparedAuthorization,
  grant: OpusV2EvalExplicitGrant,
): OpusV2EvalExplicitlyAuthorizedAuthorization {
  if (prepared.status !== "prepared") {
    throw new OpusV2EvalPaidAuthorizationError("authorize_requires_prepared");
  }
  assertValidAuthorizationState(prepared);
  assertGrantMatchesPrepared(grant, prepared);
  const authorized: OpusV2EvalExplicitlyAuthorizedAuthorization = {
    ...withCanonicalPins({
      manuscript_id: prepared.manuscript_id,
      manuscript_version_id: prepared.manuscript_version_id,
      content_hash: prepared.content_hash,
      analytical_word_count: prepared.analytical_word_count,
      plan_fingerprint: prepared.plan_fingerprint,
      prompt_version: prepared.prompt_version,
      schema_version: prepared.schema_version,
      provider: prepared.provider,
      model: prepared.model,
      effort: prepared.effort,
      max_tokens: prepared.max_tokens,
      cache: prepared.cache,
      fallback: prepared.fallback,
      workflow_kind: prepared.workflow_kind,
      runner_id: prepared.runner_id,
      runner_version: prepared.runner_version,
      staging_supabase_project_ref: prepared.staging_supabase_project_ref,
    }),
    status: "explicitly_authorized",
    bound_workflow_id: null,
    spend_authorized: true,
    ceiling_authorized_for_spend: true,
    authorized_to_run: true,
  };
  assertValidAuthorizationState(authorized);
  return authorized;
}

export const OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION = authorizeOpusV2EvalPaidAuthorization(
  OPUS_V2_EVAL_PAID_AUTHORIZATION,
  OPUS_V2_EVAL_EXPLICIT_GRANT,
);

export const OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION_STORAGE = {
  kind: "code_bound_explicit_authorization",
  derived_from: "OPUS_V2_EVAL_PAID_AUTHORIZATION",
  grant: "OPUS_V2_EVAL_EXPLICIT_GRANT",
  table: null,
  existing_0027_usable: false,
  migration_invented: false,
  db_row_written: false,
  parallel_overlay: false,
} as const;

export function cloneOpusV2EvalPaidAuthorization(
  overrides: Partial<OpusV2EvalPaidAuthorization> = {},
  base: OpusV2EvalPaidAuthorization = OPUS_V2_EVAL_PAID_AUTHORIZATION,
): OpusV2EvalPaidAuthorization {
  if (
    base.status === "prepared" &&
    (overrides.status === "explicitly_authorized" ||
      overrides.status === "consumed" ||
      overrides.spend_authorized === true ||
      overrides.ceiling_authorized_for_spend === true ||
      overrides.authorized_to_run === true)
  ) {
    throw new OpusV2EvalPaidAuthorizationError(
      overrides.status === "consumed" ? "consume_requires_explicitly_authorized" : "authorize_requires_explicit_grant",
    );
  }
  const merged = {
    ...base,
    ...overrides,
    authorization_id: OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
    hard_cost_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
    repairs_authorized: false as const,
    accepted_canon_writes_allowed: false as const,
    series_bible_writes_allowed: false as const,
  };
  const status = merged.status;
  let next: OpusV2EvalPaidAuthorization;
  if (status === "prepared") {
    next = {
      ...merged,
      status: "prepared",
      bound_workflow_id: null,
      spend_authorized: false,
      ceiling_authorized_for_spend: false,
      authorized_to_run: false,
    };
  } else if (status === "explicitly_authorized") {
    next = {
      ...merged,
      status: "explicitly_authorized",
      bound_workflow_id: null,
      spend_authorized: true,
      ceiling_authorized_for_spend: true,
      authorized_to_run: true,
    };
  } else if (status === "consumed") {
    if (!merged.bound_workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("consumed_invariant_violation");
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
  assertValidAuthorizationState(next);
  return next;
}

export function matchingOpusV2EvalPaidGateRequest(
  overrides: Partial<OpusV2EvalPaidGateRequest> = {},
): OpusV2EvalPaidGateRequest {
  return {
    authorization: OPUS_V2_EVAL_PAID_AUTHORIZATION,
    action: "construct_provider",
    execution_context: "authorization_preflight",
    manuscript_id: OPUS_V2_EVAL_PAID_AUTHORIZATION.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_PAID_AUTHORIZATION.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_PAID_AUTHORIZATION.content_hash,
    plan_fingerprint: OPUS_V2_EVAL_PAID_AUTHORIZATION.plan_fingerprint,
    prompt_version: OPUS_V2_EVAL_PAID_AUTHORIZATION.prompt_version,
    schema_version: OPUS_V2_EVAL_PAID_AUTHORIZATION.schema_version,
    provider: OPUS_V2_EVAL_PAID_AUTHORIZATION.provider,
    model: OPUS_V2_EVAL_PAID_AUTHORIZATION.model,
    effort: OPUS_V2_EVAL_PAID_AUTHORIZATION.effort,
    max_tokens: OPUS_V2_EVAL_PAID_AUTHORIZATION.max_tokens,
    cache: OPUS_V2_EVAL_PAID_AUTHORIZATION.cache,
    fallback: OPUS_V2_EVAL_PAID_AUTHORIZATION.fallback,
    workflow_kind: OPUS_V2_EVAL_PAID_AUTHORIZATION.workflow_kind,
    runner_id: OPUS_V2_EVAL_PAID_AUTHORIZATION.runner_id,
    runner_version: OPUS_V2_EVAL_PAID_AUTHORIZATION.runner_version,
    staging_supabase_project_ref: OPUS_V2_EVAL_PAID_AUTHORIZATION.staging_supabase_project_ref,
    workflow_id: null,
    resume_workflow_id: null,
    ...overrides,
  };
}

export function projectOpusV2EvalPaidAuthorization(
  current: OpusV2EvalPaidAuthorization,
  action: "authorize" | "consume" | "revoke",
  args: { workflow_id?: string | null; grant?: OpusV2EvalExplicitGrant } = {},
): OpusV2EvalPaidAuthorization {
  if (current.authorization_id !== OPUS_V2_EVAL_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalPaidAuthorizationError("authorization_id_mismatch");
  }
  if (current === OPUS_V2_EVAL_PAID_AUTHORIZATION) {
    throw new OpusV2EvalPaidAuthorizationError("canonical_prepared_authorization_is_immutable");
  }
  assertValidAuthorizationState(current);
  if (action === "authorize") {
    if (!args.grant) {
      throw new OpusV2EvalPaidAuthorizationError("authorize_requires_explicit_grant");
    }
    if (current.status !== "prepared") {
      throw new OpusV2EvalPaidAuthorizationError("authorize_requires_prepared");
    }
    return authorizeOpusV2EvalPaidAuthorization(current, args.grant);
  }
  if (action === "revoke") {
    if (current.status !== "prepared" && current.status !== "explicitly_authorized") {
      throw new OpusV2EvalPaidAuthorizationError("revoke_requires_prepared_or_authorized");
    }
    return cloneOpusV2EvalPaidAuthorization(
      {
        status: "revoked",
        authorized_to_run: false,
        spend_authorized: current.status === "explicitly_authorized" ? true : false,
        ceiling_authorized_for_spend: current.status === "explicitly_authorized" ? true : false,
        bound_workflow_id: null,
      },
      current,
    );
  }
  if (action === "consume") {
    if (current.status === "consumed") {
      if (!args.workflow_id || args.workflow_id !== current.bound_workflow_id) {
        throw new OpusV2EvalPaidAuthorizationError("second_workflow_rejected");
      }
      return current;
    }
    if (current.status === "revoked") {
      throw new OpusV2EvalPaidAuthorizationError("terminal_does_not_reopen");
    }
    if (current.status !== "explicitly_authorized") {
      throw new OpusV2EvalPaidAuthorizationError("consume_requires_explicitly_authorized");
    }
    if (!args.workflow_id || !WORKFLOW_UUID.test(args.workflow_id)) {
      throw new OpusV2EvalPaidAuthorizationError("consume_requires_workflow_id");
    }
    try {
      assertNotHistoricalRevised13Workflow(args.workflow_id);
    } catch {
      throw new OpusV2EvalPaidAuthorizationError("historical_revised_13_workflow_is_immutable");
    }
    return cloneOpusV2EvalPaidAuthorization(
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
  throw new OpusV2EvalPaidAuthorizationError("unknown_lifecycle_action");
}

function refuseForbiddenModel(model: string): void {
  const lowered = model.toLowerCase();
  if (lowered.includes("haiku")) {
    throw new OpusV2EvalPaidAuthorizationError("haiku_forbidden");
  }
  if (lowered.includes("sonnet")) {
    throw new OpusV2EvalPaidAuthorizationError("sonnet_forbidden");
  }
  if (model !== OPUS_V2_EVAL_MODEL) {
    throw new OpusV2EvalPaidAuthorizationError("model_mismatch");
  }
}

export function assertOpusV2EvalPaidAuthorizationGate(request: OpusV2EvalPaidGateRequest): void {
  assertOpusV2EvalPaidExecutionForbidden();
  if (isArchivistLiveExecutionAllowed() !== false || ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new OpusV2EvalPaidAuthorizationError("public_live_must_remain_fail_closed");
  }
  if (archivistRuntimeDefinition().enabled || ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new OpusV2EvalPaidAuthorizationError("runtime_and_studio_must_remain_closed");
  }
  if (OPUS_V2_EVAL_CEILING_AUTHORIZED !== false || OPUS_V2_EVAL_REPAIRS_AUTHORIZED !== false) {
    throw new OpusV2EvalPaidAuthorizationError("runner_lock_must_remain_fail_closed");
  }
  const authorization = request.authorization;
  assertValidAuthorizationState(authorization);
  try {
    assertOpusV2EvalPins({
      manuscript_id: request.manuscript_id,
      manuscript_version_id: request.manuscript_version_id,
      content_hash: request.content_hash,
      plan_fingerprint: request.plan_fingerprint,
      prompt_version: request.prompt_version,
      schema_version: request.schema_version,
      provider: request.provider,
      model: request.model,
      effort: request.effort,
    });
  } catch (error) {
    const message = error instanceof OpusV2EvalUnauthorizedError ? error.message : "pin_mismatch";
    throw new OpusV2EvalPaidAuthorizationError(message);
  }
  refuseForbiddenModel(request.model);
  if (request.max_tokens !== authorization.max_tokens) {
    throw new OpusV2EvalPaidAuthorizationError("max_tokens_mismatch");
  }
  if (request.cache !== "off" || request.fallback !== "none") {
    throw new OpusV2EvalPaidAuthorizationError("cache_or_fallback_forbidden");
  }
  if (request.workflow_kind !== authorization.workflow_kind) {
    throw new OpusV2EvalPaidAuthorizationError("workflow_kind_mismatch");
  }
  if (request.runner_id !== authorization.runner_id || request.runner_version !== authorization.runner_version) {
    throw new OpusV2EvalPaidAuthorizationError("runner_mismatch");
  }
  if (request.staging_supabase_project_ref === OPUS_V2_EVAL_PAID_PRODUCTION_PROJECT_REF) {
    throw new OpusV2EvalPaidAuthorizationError("production_project_forbidden");
  }
  if (request.staging_supabase_project_ref !== authorization.staging_supabase_project_ref) {
    throw new OpusV2EvalPaidAuthorizationError("staging_project_mismatch");
  }
  const candidateWorkflow = request.workflow_id ?? request.resume_workflow_id ?? authorization.bound_workflow_id;
  if (candidateWorkflow) {
    try {
      assertNotHistoricalRevised13Workflow(candidateWorkflow);
    } catch {
      throw new OpusV2EvalPaidAuthorizationError("historical_revised_13_workflow_is_immutable");
    }
  }
  if (authorization.status === "revoked") {
    throw new OpusV2EvalPaidAuthorizationError("revoked_no_provider_calls");
  }
  if (request.action === "construct_provider") {
    if (authorization.status === "prepared") {
      throw new OpusV2EvalPaidAuthorizationError("prepared_cannot_construct_provider");
    }
    if (request.execution_context !== "paid_eval_execution") {
      throw new OpusV2EvalPaidAuthorizationError("provider_construction_requires_execution_context");
    }
    if (authorization.status !== "explicitly_authorized" && authorization.status !== "consumed") {
      throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
    }
    throw new OpusV2EvalPaidAuthorizationError("provider_construction_is_not_invoked_here");
  }
  if (request.action === "start_workflow") {
    if (authorization.status === "prepared") {
      throw new OpusV2EvalPaidAuthorizationError("prepared_cannot_start_workflow");
    }
    if (authorization.status === "consumed") {
      throw new OpusV2EvalPaidAuthorizationError("second_workflow_rejected");
    }
    if (authorization.status !== "explicitly_authorized") {
      throw new OpusV2EvalPaidAuthorizationError("start_requires_explicitly_authorized");
    }
    if (
      authorization.spend_authorized !== true ||
      authorization.ceiling_authorized_for_spend !== true ||
      authorization.authorized_to_run !== true
    ) {
      throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
    }
    return;
  }
  if (request.action === "resume_workflow") {
    const resumeId = request.resume_workflow_id ?? request.workflow_id;
    if (authorization.status !== "consumed" || !authorization.bound_workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("resume_requires_bound_workflow");
    }
    if (!resumeId || resumeId !== authorization.bound_workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("consumed_wrong_workflow_resume");
    }
    if (
      authorization.spend_authorized !== true ||
      authorization.authorized_to_run !== true
    ) {
      throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
    }
    return;
  }
}

export function reachOpusV2EvalPaidProviderBoundary(
  request: OpusV2EvalPaidGateRequest = matchingOpusV2EvalPaidGateRequest(),
  factory?: () => unknown,
): never {
  assertOpusV2EvalPaidAuthorizationGate(request);
  if (factory) {
    throw new OpusV2EvalPaidAuthorizationError("provider_factory_must_not_run");
  }
  return constructOpusV2EvalProvider();
}

export function fenceOpusV2EvalPaidProvider(
  request: OpusV2EvalPaidGateRequest = matchingOpusV2EvalPaidGateRequest(),
): number {
  const before = opusV2EvalProviderConstructCount();
  try {
    reachOpusV2EvalPaidProviderBoundary(request, () => {
      throw new OpusV2EvalPaidAuthorizationError("provider_factory_must_not_run");
    });
  } catch (error) {
    if (
      error instanceof OpusV2EvalPaidAuthorizationError ||
      error instanceof OpusV2EvalUnauthorizedError
    ) {
      return opusV2EvalProviderConstructCount() - before;
    }
    throw error;
  }
}

export function assertOpusV2EvalPaidCostGate(args: {
  accrued_usd: number;
  next_call_high_usd: number;
}): void {
  assertNextCallFitsCeiling({
    accrued_usd: args.accrued_usd,
    next_call_high_usd: args.next_call_high_usd,
    ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  });
}

export function assertCanonicalPaidAuthorizationPrepared(): void {
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION.status !== "prepared") {
    throw new OpusV2EvalPaidAuthorizationError("canonical_status_must_remain_prepared");
  }
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION.bound_workflow_id !== null) {
    throw new OpusV2EvalPaidAuthorizationError("canonical_must_not_prebind_workflow");
  }
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION.spend_authorized !== false) {
    throw new OpusV2EvalPaidAuthorizationError("canonical_spend_must_remain_false");
  }
  if (OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.status !== "explicitly_authorized") {
    throw new OpusV2EvalPaidAuthorizationError("explicit_authorization_must_remain_authorized");
  }
}

export function historicalRevised13WorkflowId(): string {
  return OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID;
}
