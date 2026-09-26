/**
 * Isolated prepared one-shot authorization for a future Opus eval @v2 rerun.
 * Status is prepared only. Spend is not authorized. No workflow is bound.
 * Does not mutate the consumed 20260925 authorization. No 0027. No migration.
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
import {
  OPUS_V2_EVAL_V2_CACHE,
  OPUS_V2_EVAL_V2_CEILING_AUTHORIZED,
  OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID,
  OPUS_V2_EVAL_V2_EFFORT,
  OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
  OPUS_V2_EVAL_V2_FALLBACK,
  OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MAX,
  OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MIN,
  OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MAX,
  OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MIN,
  OPUS_V2_EVAL_V2_FUTURE_LOW_USD,
  OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_ID,
  OPUS_V2_EVAL_V2_INPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_V2_MAX_TOKENS,
  OPUS_V2_EVAL_V2_MODEL,
  OPUS_V2_EVAL_V2_OUTPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_V2_PROMPT_VERSION,
  OPUS_V2_EVAL_V2_PROVIDER,
  OPUS_V2_EVAL_V2_RAW_ARCHIVE_RELATIVE_DIR,
  OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD,
  OPUS_V2_EVAL_V2_SCHEMA_VERSION,
  OPUS_V2_EVAL_V2_SOURCE_PIN,
  OPUS_V2_EVAL_V2_SPEND_AUTHORIZED,
  OPUS_V2_EVAL_V2_STAGING_PROJECT_REF,
  OPUS_V2_EVAL_V2_SUCCESS_BAR,
  OPUS_V2_EVAL_V2_VERSION,
  OPUS_V2_EVAL_V2_WORKFLOW_KIND,
} from "./lock.ts";

export const OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID =
  "reckoning-revised-13-opus-v2-full-eval-v2-20260926" as const;

export const OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STATUSES = [
  "prepared",
  "explicitly_authorized",
  "consumed",
  "revoked",
] as const;

export const OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF = "tumcpxklduhiigxjwlrp" as const;
export const OPUS_V2_EVAL_V2_REQUIRED_FREEZE_HEAD =
  "02c94bb706fefd5c663894de301a2c1373d52a50" as const;

export const OPUS_V2_EVAL_V2_DEFAULT_REPAIR_ALLOWANCE = 0 as const;
export const OPUS_V2_EVAL_V2_EMERGENCY_REPAIR_MAX = 3 as const;
export const OPUS_V2_EVAL_V2_REPAIRS_AUTHORIZED = false;
export const OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_SIZE = RECONCILIATION_MAX_BATCH_SIZE;
export const OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_CAP = 8 as const;

export const OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_STORAGE = {
  kind: "code_bound_prepared_authorization",
  table: null,
  existing_0027_usable: false,
  migration_invented: false,
  db_row_written: false,
  reused_consumed_20260925: false,
  mutated_historical_authorization: false,
} as const;

export class OpusV2EvalV2PaidAuthorizationError extends Error {
  readonly code = "opus_v2_eval_v2_paid_authorization" as const;
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "OpusV2EvalV2PaidAuthorizationError";
    this.reason = reason;
  }
}

const providerConstructCount = 0;

export function opusV2EvalV2ProviderConstructCount(): number {
  return providerConstructCount;
}

export function constructOpusV2EvalV2Provider(): never {
  throw new OpusV2EvalV2PaidAuthorizationError("prepared_cannot_construct_provider");
}

export interface OpusV2EvalV2PreparedAuthorization {
  authorization_id: typeof OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID;
  status: "prepared";
  bound_workflow_id: null;
  spend_authorized: false;
  ceiling_authorized_for_spend: false;
  authorized_to_run: false;
  manuscript_id: typeof OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_id;
  manuscript_version_id: typeof OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_version_id;
  content_hash: typeof OPUS_V2_EVAL_V2_SOURCE_PIN.content_hash;
  analytical_word_count: typeof OPUS_V2_EVAL_V2_SOURCE_PIN.analytical_word_count;
  plan_fingerprint: typeof OPUS_V2_EVAL_V2_SOURCE_PIN.plan_fingerprint;
  expected_unit_count: 30;
  expected_segment_count: 14;
  expected_unique_words: 109887;
  expected_coverage_percentage: 100;
  expected_uncovered_ranges: 0;
  expected_overlap_words: 27582;
  workflow_kind: typeof OPUS_V2_EVAL_V2_WORKFLOW_KIND;
  runner_id: typeof OPUS_V2_EVAL_V2_ID;
  runner_version: typeof OPUS_V2_EVAL_V2_VERSION;
  max_workflows: 1;
  prompt_version: typeof OPUS_V2_EVAL_V2_PROMPT_VERSION;
  schema_version: typeof OPUS_V2_EVAL_V2_SCHEMA_VERSION;
  provider: typeof OPUS_V2_EVAL_V2_PROVIDER;
  model: typeof OPUS_V2_EVAL_V2_MODEL;
  effort: typeof OPUS_V2_EVAL_V2_EFFORT;
  max_tokens: typeof OPUS_V2_EVAL_V2_MAX_TOKENS;
  cache: typeof OPUS_V2_EVAL_V2_CACHE;
  fallback: typeof OPUS_V2_EVAL_V2_FALLBACK;
  execution_fingerprint: typeof OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT;
  staging_supabase_project_ref: typeof OPUS_V2_EVAL_V2_STAGING_PROJECT_REF;
  production_supabase_project_ref: typeof OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF;
  required_freeze_head: typeof OPUS_V2_EVAL_V2_REQUIRED_FREEZE_HEAD;
  hard_cost_ceiling_usd: typeof OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD;
  input_usd_per_mtok: typeof OPUS_V2_EVAL_V2_INPUT_USD_PER_MTOK;
  output_usd_per_mtok: typeof OPUS_V2_EVAL_V2_OUTPUT_USD_PER_MTOK;
  expected_primary_observation_calls: 14;
  default_repair_allowance: typeof OPUS_V2_EVAL_V2_DEFAULT_REPAIR_ALLOWANCE;
  emergency_repair_max: typeof OPUS_V2_EVAL_V2_EMERGENCY_REPAIR_MAX;
  repairs_authorized: false;
  reconciliation_batch_size: typeof OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_SIZE;
  reconciliation_batch_cap: typeof OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_CAP;
  pairing_version: typeof V2_OBSERVATION_COMPARISON_VERSION;
  evidence_version: typeof V2_EVIDENCE_GATE_VERSION;
  prefix_recovery_version: typeof V2_TRUNCATED_PREFIX_RECOVERY_VERSION;
  raw_archive_relative_dir: typeof OPUS_V2_EVAL_V2_RAW_ARCHIVE_RELATIVE_DIR;
  success_bar: typeof OPUS_V2_EVAL_V2_SUCCESS_BAR;
  accepted_canon_writes_allowed: false;
  series_bible_writes_allowed: false;
  retcon_writes_allowed: false;
  supersession_writes_allowed: false;
  disposition_writes_allowed: false;
}

export const OPUS_V2_EVAL_V2_PAID_AUTHORIZATION = {
  authorization_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
  status: "prepared",
  bound_workflow_id: null,
  spend_authorized: false,
  ceiling_authorized_for_spend: false,
  authorized_to_run: false,
  manuscript_id: OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_id,
  manuscript_version_id: OPUS_V2_EVAL_V2_SOURCE_PIN.manuscript_version_id,
  content_hash: OPUS_V2_EVAL_V2_SOURCE_PIN.content_hash,
  analytical_word_count: OPUS_V2_EVAL_V2_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: OPUS_V2_EVAL_V2_SOURCE_PIN.plan_fingerprint,
  expected_unit_count: 30,
  expected_segment_count: 14,
  expected_unique_words: 109887,
  expected_coverage_percentage: 100,
  expected_uncovered_ranges: 0,
  expected_overlap_words: 27582,
  workflow_kind: OPUS_V2_EVAL_V2_WORKFLOW_KIND,
  runner_id: OPUS_V2_EVAL_V2_ID,
  runner_version: OPUS_V2_EVAL_V2_VERSION,
  max_workflows: 1,
  prompt_version: OPUS_V2_EVAL_V2_PROMPT_VERSION,
  schema_version: OPUS_V2_EVAL_V2_SCHEMA_VERSION,
  provider: OPUS_V2_EVAL_V2_PROVIDER,
  model: OPUS_V2_EVAL_V2_MODEL,
  effort: OPUS_V2_EVAL_V2_EFFORT,
  max_tokens: OPUS_V2_EVAL_V2_MAX_TOKENS,
  cache: OPUS_V2_EVAL_V2_CACHE,
  fallback: OPUS_V2_EVAL_V2_FALLBACK,
  execution_fingerprint: OPUS_V2_EVAL_V2_EXECUTION_FINGERPRINT,
  staging_supabase_project_ref: OPUS_V2_EVAL_V2_STAGING_PROJECT_REF,
  production_supabase_project_ref: OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF,
  required_freeze_head: OPUS_V2_EVAL_V2_REQUIRED_FREEZE_HEAD,
  hard_cost_ceiling_usd: OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD,
  input_usd_per_mtok: OPUS_V2_EVAL_V2_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_V2_OUTPUT_USD_PER_MTOK,
  expected_primary_observation_calls: 14,
  default_repair_allowance: OPUS_V2_EVAL_V2_DEFAULT_REPAIR_ALLOWANCE,
  emergency_repair_max: OPUS_V2_EVAL_V2_EMERGENCY_REPAIR_MAX,
  repairs_authorized: false,
  reconciliation_batch_size: OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_SIZE,
  reconciliation_batch_cap: OPUS_V2_EVAL_V2_RECONCILIATION_BATCH_CAP,
  pairing_version: V2_OBSERVATION_COMPARISON_VERSION,
  evidence_version: V2_EVIDENCE_GATE_VERSION,
  prefix_recovery_version: V2_TRUNCATED_PREFIX_RECOVERY_VERSION,
  raw_archive_relative_dir: OPUS_V2_EVAL_V2_RAW_ARCHIVE_RELATIVE_DIR,
  success_bar: OPUS_V2_EVAL_V2_SUCCESS_BAR,
  accepted_canon_writes_allowed: false,
  series_bible_writes_allowed: false,
  retcon_writes_allowed: false,
  supersession_writes_allowed: false,
  disposition_writes_allowed: false,
} as const satisfies OpusV2EvalV2PreparedAuthorization;

export const OPUS_V2_EVAL_V2_PAID_COST_MODEL = {
  input_usd_per_mtok: OPUS_V2_EVAL_V2_INPUT_USD_PER_MTOK,
  output_usd_per_mtok: OPUS_V2_EVAL_V2_OUTPUT_USD_PER_MTOK,
  cache: OPUS_V2_EVAL_V2_CACHE,
  low_usd: OPUS_V2_EVAL_V2_FUTURE_LOW_USD,
  expected_usd_min: OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MIN,
  expected_usd_max: OPUS_V2_EVAL_V2_FUTURE_EXPECTED_USD_MAX,
  high_usd_min: OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MIN,
  high_usd_max: OPUS_V2_EVAL_V2_FUTURE_HIGH_USD_MAX,
  hard_ceiling_usd: OPUS_V2_EVAL_V2_RECOMMENDED_HARD_CEILING_USD,
  ceiling_authorized_for_spend: false,
} as const;

export const OPUS_V2_EVAL_V2_CALL_ORDER = [
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

export const OPUS_V2_EVAL_V2_FORBIDDEN_WORKFLOW_IDS = [
  OPUS_V2_EVAL_V2_COMPLETED_OPUS_WORKFLOW_ID,
  OPUS_V2_EVAL_V2_HISTORICAL_REVISED_13_WORKFLOW_ID,
] as const;

export interface OpusV2EvalV2PaidGateRequest {
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

export function matchingOpusV2EvalV2PaidGateRequest(
  overrides: Partial<OpusV2EvalV2PaidGateRequest> = {},
): OpusV2EvalV2PaidGateRequest {
  return {
    authorization_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID,
    action: "construct_provider",
    manuscript_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.content_hash,
    plan_fingerprint: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.plan_fingerprint,
    execution_fingerprint: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.execution_fingerprint,
    prompt_version: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.prompt_version,
    schema_version: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.schema_version,
    provider: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.provider,
    model: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.model,
    effort: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.effort,
    max_tokens: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.max_tokens,
    cache: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.cache,
    fallback: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.fallback,
    workflow_kind: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.workflow_kind,
    runner_id: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_id,
    runner_version: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.runner_version,
    staging_supabase_project_ref: OPUS_V2_EVAL_V2_PAID_AUTHORIZATION.staging_supabase_project_ref,
    workflow_id: null,
    resume_workflow_id: null,
    ...overrides,
  };
}

export function assertHistoricalConsumedAuthorizationUnchanged(): void {
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION_ID !== OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID) {
    throw new OpusV2EvalV2PaidAuthorizationError("historical_authorization_id_mutated");
  }
  if (
    (OPUS_V2_EVAL_PAID_AUTHORIZATION_ID as string) ===
    (OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID as string)
  ) {
    throw new OpusV2EvalV2PaidAuthorizationError("new_authorization_reused_historical_id");
  }
  if (OPUS_V2_EVAL_PAID_AUTHORIZATION.status !== "prepared") {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_20260925_prepared_object_mutated");
  }
  if (OPUS_V2_EVAL_EXPLICIT_AUTHORIZATION.authorization_id !== OPUS_V2_EVAL_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV2PaidAuthorizationError("historical_explicit_authorization_mutated");
  }
}

export function assertCanonicalV2PaidAuthorizationPrepared(): void {
  assertHistoricalConsumedAuthorizationUnchanged();
  const auth = OPUS_V2_EVAL_V2_PAID_AUTHORIZATION;
  if (auth.status !== "prepared") {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_status_must_remain_prepared");
  }
  if (auth.bound_workflow_id !== null) {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_must_not_prebind_workflow");
  }
  if (auth.spend_authorized !== false || OPUS_V2_EVAL_V2_SPEND_AUTHORIZED !== false) {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_spend_must_remain_false");
  }
  if (auth.ceiling_authorized_for_spend !== false || OPUS_V2_EVAL_V2_CEILING_AUTHORIZED !== false) {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_ceiling_spend_must_remain_false");
  }
  if (auth.authorized_to_run !== false) {
    throw new OpusV2EvalV2PaidAuthorizationError("canonical_run_must_remain_false");
  }
}

export function assertOpusV2EvalV2PaidAuthorizationGate(
  request: OpusV2EvalV2PaidGateRequest,
): void {
  if (isArchivistLiveExecutionAllowed() !== false || ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new OpusV2EvalV2PaidAuthorizationError("public_live_must_remain_fail_closed");
  }
  if (archivistRuntimeDefinition().enabled || ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new OpusV2EvalV2PaidAuthorizationError("runtime_and_studio_must_remain_closed");
  }
  if (request.authorization_id === OPUS_V2_EVAL_V2_CONSUMED_AUTHORIZATION_ID) {
    throw new OpusV2EvalV2PaidAuthorizationError("historical_authorization_reuse_forbidden");
  }
  if (request.authorization_id !== OPUS_V2_EVAL_V2_PAID_AUTHORIZATION_ID) {
    throw new OpusV2EvalV2PaidAuthorizationError("authorization_id_mismatch");
  }
  const auth = OPUS_V2_EVAL_V2_PAID_AUTHORIZATION;
  if (request.manuscript_id !== auth.manuscript_id) {
    throw new OpusV2EvalV2PaidAuthorizationError("manuscript_id_mismatch");
  }
  if (request.manuscript_version_id !== auth.manuscript_version_id) {
    throw new OpusV2EvalV2PaidAuthorizationError("manuscript_version_id_mismatch");
  }
  if (request.content_hash !== auth.content_hash) {
    throw new OpusV2EvalV2PaidAuthorizationError("content_hash_mismatch");
  }
  if (request.plan_fingerprint !== auth.plan_fingerprint) {
    throw new OpusV2EvalV2PaidAuthorizationError("plan_fingerprint_mismatch");
  }
  if (request.execution_fingerprint !== auth.execution_fingerprint) {
    throw new OpusV2EvalV2PaidAuthorizationError("execution_fingerprint_mismatch");
  }
  if (request.prompt_version !== auth.prompt_version) {
    throw new OpusV2EvalV2PaidAuthorizationError("prompt_version_mismatch");
  }
  if (request.schema_version !== auth.schema_version) {
    throw new OpusV2EvalV2PaidAuthorizationError("schema_version_mismatch");
  }
  if (request.provider !== auth.provider) {
    throw new OpusV2EvalV2PaidAuthorizationError("provider_mismatch");
  }
  const lowered = request.model.toLowerCase();
  if (lowered.includes("haiku")) {
    throw new OpusV2EvalV2PaidAuthorizationError("haiku_forbidden");
  }
  if (lowered.includes("sonnet")) {
    throw new OpusV2EvalV2PaidAuthorizationError("sonnet_forbidden");
  }
  if (request.model !== auth.model) {
    throw new OpusV2EvalV2PaidAuthorizationError("model_mismatch");
  }
  if (request.effort !== auth.effort) {
    throw new OpusV2EvalV2PaidAuthorizationError("effort_mismatch");
  }
  if (request.max_tokens !== auth.max_tokens) {
    throw new OpusV2EvalV2PaidAuthorizationError("max_tokens_mismatch");
  }
  if (request.cache !== "off" || request.fallback !== "none") {
    throw new OpusV2EvalV2PaidAuthorizationError("cache_or_fallback_forbidden");
  }
  if (request.workflow_kind !== auth.workflow_kind) {
    throw new OpusV2EvalV2PaidAuthorizationError("workflow_kind_mismatch");
  }
  if (request.runner_id !== auth.runner_id || request.runner_version !== auth.runner_version) {
    throw new OpusV2EvalV2PaidAuthorizationError("runner_mismatch");
  }
  if (request.staging_supabase_project_ref === OPUS_V2_EVAL_V2_PRODUCTION_PROJECT_REF) {
    throw new OpusV2EvalV2PaidAuthorizationError("production_project_forbidden");
  }
  if (request.staging_supabase_project_ref !== auth.staging_supabase_project_ref) {
    throw new OpusV2EvalV2PaidAuthorizationError("staging_project_mismatch");
  }
  const candidateWorkflow = request.workflow_id ?? request.resume_workflow_id;
  if (
    candidateWorkflow &&
    (OPUS_V2_EVAL_V2_FORBIDDEN_WORKFLOW_IDS as readonly string[]).includes(candidateWorkflow)
  ) {
    throw new OpusV2EvalV2PaidAuthorizationError("historical_workflow_reuse_forbidden");
  }
  if (auth.status === "prepared") {
    if (request.action === "construct_provider") {
      throw new OpusV2EvalV2PaidAuthorizationError("prepared_cannot_construct_provider");
    }
    if (request.action === "start_workflow") {
      throw new OpusV2EvalV2PaidAuthorizationError("prepared_cannot_start_workflow");
    }
    throw new OpusV2EvalV2PaidAuthorizationError("prepared_cannot_resume_workflow");
  }
}

export function fenceOpusV2EvalV2PaidProvider(
  request: OpusV2EvalV2PaidGateRequest = matchingOpusV2EvalV2PaidGateRequest(),
): number {
  const before = opusV2EvalV2ProviderConstructCount();
  try {
    assertOpusV2EvalV2PaidAuthorizationGate(request);
    constructOpusV2EvalV2Provider();
  } catch (error) {
    if (error instanceof OpusV2EvalV2PaidAuthorizationError) {
      return opusV2EvalV2ProviderConstructCount() - before;
    }
    throw error;
  }
  return opusV2EvalV2ProviderConstructCount() - before;
}

export function assertOpusV2EvalV2CandidateOnlySafety(
  auth: typeof OPUS_V2_EVAL_V2_PAID_AUTHORIZATION = OPUS_V2_EVAL_V2_PAID_AUTHORIZATION,
): void {
  if (
    auth.accepted_canon_writes_allowed ||
    auth.series_bible_writes_allowed ||
    auth.retcon_writes_allowed ||
    auth.supersession_writes_allowed ||
    auth.disposition_writes_allowed
  ) {
    throw new OpusV2EvalV2PaidAuthorizationError("candidate_only_safety_violated");
  }
}

export const OPUS_V2_EVAL_V2_PAID_SUCCESS_BAR = OPUS_V2_EVAL_V2_SUCCESS_BAR;

export const OPUS_V2_EVAL_V2_PAID_PERSISTENCE_FORBIDDEN = [
  "accepted_canon",
  "series_bible",
  "retcon",
  "supersession",
  "author_disposition",
] as const;
