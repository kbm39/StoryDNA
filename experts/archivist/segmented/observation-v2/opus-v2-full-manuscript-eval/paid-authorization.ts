/**
 * Prepared one-shot paid authorization for a future Opus 5.5 V2 full-manuscript eval.
 * Status remains prepared. Spend is not authorized. No provider is constructed.
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

export interface OpusV2EvalPaidAuthorization {
  authorization_id: typeof OPUS_V2_EVAL_PAID_AUTHORIZATION_ID;
  status: OpusV2EvalPaidAuthorizationStatus;
  bound_workflow_id: string | null;
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
  ceiling_authorized_for_spend: false;
  spend_authorized: false;
  authorized_to_run: false;
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

export const OPUS_V2_EVAL_PAID_AUTHORIZATION = {
  authorization_id: OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
  status: "prepared",
  bound_workflow_id: null,
  manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_SOURCE_PIN.plan_fingerprint,
  expected_unit_count: 30,
  expected_segment_count: 14,
  expected_unique_words: 109887,
  expected_coverage_percentage: 100,
  expected_uncovered_ranges: 0,
  expected_overlap_words: 27582,
  workflow_kind: OPUS_V2_EVAL_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_ID,
  runner_version: OPUS_V2_EVAL_VERSION,
  max_workflows: 1,
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
  ceiling_authorized_for_spend: false,
  spend_authorized: false,
  authorized_to_run: false,
  input_usd_per_mtok: OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
  expected_primary_observation_calls: 14,
  default_repair_allowance: OPUS_V2_EVAL_DEFAULT_REPAIR_ALLOWANCE,
  emergency_repair_max: OPUS_V2_EVAL_EMERGENCY_REPAIR_MAX,
  repairs_authorized: false,
  reconciliation_batch_size: OPUS_V2_EVAL_RECONCILIATION_BATCH_SIZE,
  reconciliation_batch_cap: OPUS_V2_EVAL_RECONCILIATION_BATCH_CAP,
  accepted_canon_writes_allowed: false,
  series_bible_writes_allowed: false,
} as const satisfies OpusV2EvalPaidAuthorization;

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

export interface OpusV2EvalPaidGateRequest {
  authorization: OpusV2EvalPaidAuthorization;
  action: OpusV2EvalPaidAction;
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

export function cloneOpusV2EvalPaidAuthorization(
  overrides: Partial<OpusV2EvalPaidAuthorization> = {},
): OpusV2EvalPaidAuthorization {
  return {
    ...OPUS_V2_EVAL_PAID_AUTHORIZATION,
    ...overrides,
    authorization_id: OPUS_V2_EVAL_PAID_AUTHORIZATION_ID,
    ceiling_authorized_for_spend: false,
    spend_authorized: false,
    authorized_to_run: false,
    repairs_authorized: false,
    accepted_canon_writes_allowed: false,
    series_bible_writes_allowed: false,
  };
}

export function matchingOpusV2EvalPaidGateRequest(
  overrides: Partial<OpusV2EvalPaidGateRequest> = {},
): OpusV2EvalPaidGateRequest {
  return {
    authorization: OPUS_V2_EVAL_PAID_AUTHORIZATION,
    action: "construct_provider",
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
  args: { workflow_id?: string | null } = {},
): OpusV2EvalPaidAuthorization {
  if (current.authorization_id !== OPUS_V2_EVAL_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalPaidAuthorizationError("authorization_id_mismatch");
  }
  if (current === OPUS_V2_EVAL_PAID_AUTHORIZATION) {
    throw new OpusV2EvalPaidAuthorizationError("canonical_prepared_authorization_is_immutable");
  }
  if (action === "authorize") {
    if (current.status !== "prepared") {
      throw new OpusV2EvalPaidAuthorizationError("authorize_requires_prepared");
    }
    return cloneOpusV2EvalPaidAuthorization({
      ...current,
      status: "explicitly_authorized",
      bound_workflow_id: null,
    });
  }
  if (action === "revoke") {
    if (current.status !== "prepared" && current.status !== "explicitly_authorized") {
      throw new OpusV2EvalPaidAuthorizationError("revoke_requires_prepared_or_authorized");
    }
    return cloneOpusV2EvalPaidAuthorization({ ...current, status: "revoked" });
  }
  if (action === "consume") {
    if (current.status === "consumed") {
      if (!args.workflow_id || args.workflow_id !== current.bound_workflow_id) {
        throw new OpusV2EvalPaidAuthorizationError("second_workflow_rejected");
      }
      return current;
    }
    if (current.status !== "explicitly_authorized") {
      throw new OpusV2EvalPaidAuthorizationError("consume_requires_explicitly_authorized");
    }
    if (!args.workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("consume_requires_workflow_id");
    }
    assertNotHistoricalRevised13Workflow(args.workflow_id);
    return cloneOpusV2EvalPaidAuthorization({
      ...current,
      status: "consumed",
      bound_workflow_id: args.workflow_id,
    });
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
  const authorization = request.authorization;
  if (authorization.authorization_id !== OPUS_V2_EVAL_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalPaidAuthorizationError("authorization_id_mismatch");
  }
  if (authorization.spend_authorized !== false || authorization.ceiling_authorized_for_spend !== false) {
    throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
  }
  if (authorization.authorized_to_run !== false || OPUS_V2_EVAL_CEILING_AUTHORIZED !== false) {
    throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
  }
  if (OPUS_V2_EVAL_REPAIRS_AUTHORIZED !== false || authorization.repairs_authorized !== false) {
    throw new OpusV2EvalPaidAuthorizationError("repairs_not_authorized");
  }
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
    throw new OpusV2EvalPaidAuthorizationError("prepared_cannot_construct_provider");
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
    throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
  }
  if (request.action === "resume_workflow") {
    const resumeId = request.resume_workflow_id ?? request.workflow_id;
    if (authorization.status !== "consumed" || !authorization.bound_workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("resume_requires_bound_workflow");
    }
    if (!resumeId || resumeId !== authorization.bound_workflow_id) {
      throw new OpusV2EvalPaidAuthorizationError("consumed_wrong_workflow_resume");
    }
    throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
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
    throw new OpusV2EvalPaidAuthorizationError("spend_not_authorized");
  }
}

export function historicalRevised13WorkflowId(): string {
  return OPUS_V2_EVAL_HISTORICAL_WORKFLOW_ID;
}
