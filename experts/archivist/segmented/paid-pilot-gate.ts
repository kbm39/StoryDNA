/**
 * Complete pre-provider gate for the future REVISED-11-2 paid pilot.
 * Fail before any provider construction or SDK call.
 */

import { WorkflowCancelledError } from "@/lib/editorial-workflow/types.ts";
import { ARCHIVIST_CONSTITUTION } from "../constitution.ts";
import { isArchivistLiveExecutionAllowed, persistAcceptedCanonFromLive } from "../live-flags.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../constitution-hash.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import { assertCertifiedSegmentedModel } from "./certified-model.ts";
import { PaidPilotUnauthorizedError } from "./errors.ts";
import {
  PRODUCTION_SUPABASE_PROJECT_REF,
  RECKONING_PAID_PILOT_AUTHORIZATION,
  STAGING_SUPABASE_PROJECT_REF,
  type ReckoningPaidPilotAuthorization,
} from "./paid-pilot-authorization.ts";

export interface PaidPilotGateRequest {
  authorization?: ReckoningPaidPilotAuthorization;
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  content_hash: string;
  source_docx_sha256: string;
  source_filename: string;
  analytical_word_count: number;
  plan_fingerprint: string;
  provider?: string;
  model?: string;
  staging_supabase_project_ref: string;
  trigger_project_id: string;
  trigger_environment: string;
  freeze_head: string;
  certified_pipeline_code_sha: string;
  archivist_definition_hash?: string;
  coverage_plan_valid: boolean;
  active_workflow_count: number;
  proposed_cost_ceiling_usd: number;
  resume_workflow_id?: string | null;
  cancelled?: boolean;
  signal?: AbortSignal;
}

function bind(authorization: ReckoningPaidPilotAuthorization): ReckoningPaidPilotAuthorization {
  return authorization;
}

export function assertPaidPilotMayConstructProvider(
  request: PaidPilotGateRequest,
): ReckoningPaidPilotAuthorization {
  const authorization = bind(request.authorization ?? RECKONING_PAID_PILOT_AUTHORIZATION);

  if (isArchivistLiveExecutionAllowed() !== false) {
    throw new PaidPilotUnauthorizedError("public_live_must_remain_fail_closed");
  }
  if (ARCHIVIST_CONSTITUTION.execution_wired) {
    throw new PaidPilotUnauthorizedError("execution_wired_must_remain_false");
  }
  if (archivistRuntimeDefinition().enabled) {
    throw new PaidPilotUnauthorizedError("runtime_must_remain_disabled");
  }
  if (ARCHIVIST_CONSTITUTION.studio_selectable) {
    throw new PaidPilotUnauthorizedError("studio_must_remain_false");
  }
  if (authorization.authorized_to_run !== false) {
    throw new PaidPilotUnauthorizedError("source_authorized_to_run_must_remain_false");
  }
  if (request.cancelled || request.signal?.aborted) {
    throw new WorkflowCancelledError();
  }
  if (request.staging_supabase_project_ref === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new PaidPilotUnauthorizedError("production_project_forbidden");
  }
  if (request.staging_supabase_project_ref !== STAGING_SUPABASE_PROJECT_REF) {
    throw new PaidPilotUnauthorizedError("staging_project_mismatch");
  }
  if (request.staging_supabase_project_ref !== authorization.staging_supabase_project_ref) {
    throw new PaidPilotUnauthorizedError("staging_project_mismatch");
  }
  if (request.trigger_project_id !== authorization.trigger_project_id) {
    throw new PaidPilotUnauthorizedError("trigger_project_mismatch");
  }
  if (request.trigger_environment !== authorization.trigger_environment) {
    throw new PaidPilotUnauthorizedError("trigger_environment_mismatch");
  }
  if (request.freeze_head !== authorization.required_freeze_head) {
    throw new PaidPilotUnauthorizedError("freeze_head_mismatch");
  }
  if (request.certified_pipeline_code_sha !== authorization.certified_pipeline_code_sha) {
    throw new PaidPilotUnauthorizedError("certified_pipeline_mismatch");
  }
  if (
    (request.archivist_definition_hash ?? ARCHIVIST_CONSTITUTION_DEFINITION_HASH) !==
    authorization.archivist_definition_hash
  ) {
    throw new PaidPilotUnauthorizedError("archivist_definition_hash_mismatch");
  }
  if (request.manuscript_id !== authorization.manuscript_id) {
    throw new PaidPilotUnauthorizedError("manuscript_id_mismatch");
  }
  if (request.manuscript_version_id !== authorization.manuscript_version_id) {
    throw new PaidPilotUnauthorizedError("manuscript_version_id_mismatch");
  }
  if (request.version_number !== authorization.version_number) {
    throw new PaidPilotUnauthorizedError("version_number_mismatch");
  }
  if (request.content_hash !== authorization.content_hash) {
    throw new PaidPilotUnauthorizedError("content_hash_mismatch");
  }
  if (request.source_docx_sha256 !== authorization.source_docx_sha256) {
    throw new PaidPilotUnauthorizedError("source_sha_mismatch");
  }
  if (request.source_filename !== authorization.source_filename) {
    throw new PaidPilotUnauthorizedError("source_filename_mismatch");
  }
  if (request.analytical_word_count !== authorization.analytical_word_count) {
    throw new PaidPilotUnauthorizedError("analytical_word_count_mismatch");
  }
  if (request.plan_fingerprint !== authorization.plan_fingerprint) {
    throw new PaidPilotUnauthorizedError("plan_fingerprint_mismatch");
  }
  if (!request.coverage_plan_valid) {
    throw new PaidPilotUnauthorizedError("coverage_plan_invalid");
  }
  assertCertifiedSegmentedModel({
    provider: request.provider ?? authorization.provider,
    model: request.model ?? authorization.model,
  });
  if ((request.provider ?? authorization.provider) !== authorization.provider) {
    throw new PaidPilotUnauthorizedError("provider_mismatch");
  }
  if ((request.model ?? authorization.model) !== authorization.model) {
    throw new PaidPilotUnauthorizedError("model_mismatch");
  }
  if (request.proposed_cost_ceiling_usd > authorization.hard_cost_ceiling_usd) {
    throw new PaidPilotUnauthorizedError("cost_ceiling_exceeds_hard_limit");
  }
  if (request.active_workflow_count > authorization.max_active_workflows) {
    throw new PaidPilotUnauthorizedError("duplicate_active_workflow");
  }

  if (authorization.status === "revoked") {
    throw new PaidPilotUnauthorizedError("authorization_revoked");
  }
  if (authorization.status === "prepared") {
    throw new PaidPilotUnauthorizedError("authorization_prepared_not_approved");
  }
  if (authorization.status === "consumed") {
    if (!request.resume_workflow_id || request.resume_workflow_id !== authorization.bound_workflow_id) {
      throw new PaidPilotUnauthorizedError("authorization_consumed");
    }
  }
  if (authorization.status !== "explicitly_authorized" && authorization.status !== "consumed") {
    throw new PaidPilotUnauthorizedError("authorization_not_approved");
  }
  if (authorization.status === "explicitly_authorized" && request.active_workflow_count > 0 && !request.resume_workflow_id) {
    throw new PaidPilotUnauthorizedError("duplicate_active_workflow");
  }
  if (
    authorization.status === "consumed" &&
    request.resume_workflow_id &&
    request.resume_workflow_id === authorization.bound_workflow_id
  ) {
    return authorization;
  }
  if (authorization.status !== "explicitly_authorized") {
    throw new PaidPilotUnauthorizedError("authorization_not_approved");
  }

  try {
    persistAcceptedCanonFromLive();
  } catch {
    // expected: accepted-canon writes stay blocked
  }

  return authorization;
}

export function reachPaidPilotProviderBoundary<T>(
  request: PaidPilotGateRequest,
  construct: () => T,
): T {
  assertPaidPilotMayConstructProvider(request);
  return construct();
}

export function matchingPaidPilotGateRequest(
  overrides: Partial<PaidPilotGateRequest> = {},
): PaidPilotGateRequest {
  const authorization = overrides.authorization ?? RECKONING_PAID_PILOT_AUTHORIZATION;
  const request: PaidPilotGateRequest = {
    authorization,
    manuscript_id: authorization.manuscript_id,
    manuscript_version_id: authorization.manuscript_version_id,
    version_number: authorization.version_number,
    content_hash: authorization.content_hash,
    source_docx_sha256: authorization.source_docx_sha256,
    source_filename: authorization.source_filename,
    analytical_word_count: authorization.analytical_word_count,
    plan_fingerprint: authorization.plan_fingerprint,
    provider: authorization.provider,
    model: authorization.model,
    staging_supabase_project_ref: authorization.staging_supabase_project_ref,
    trigger_project_id: authorization.trigger_project_id,
    trigger_environment: authorization.trigger_environment,
    freeze_head: authorization.required_freeze_head,
    certified_pipeline_code_sha: authorization.certified_pipeline_code_sha,
    archivist_definition_hash: authorization.archivist_definition_hash,
    coverage_plan_valid: true,
    active_workflow_count: 0,
    proposed_cost_ceiling_usd: authorization.hard_cost_ceiling_usd,
    resume_workflow_id: null,
    cancelled: false,
  };
  return { ...request, ...overrides, authorization };
}
