/**
 * One-shot REVISED-11-2 paid-pilot authorization contract.
 * Status remains prepared. Does not authorize execution.
 * Not a global Archivist-enabled boolean.
 */

import { ARCHIVIST_DRAFT_EXPERT_VERSION_ID } from "@/lib/archivist-dry-run/types.ts";
import { ARCHIVIST_CERTIFIED_CODE_SHA } from "../formal-certification-checkpoint.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "../constitution-hash.ts";
import { ARCHIVIST_VERSION } from "../contracts.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { ARCHIVIST_REGISTRY_DEFINITION_HASH } from "../registry-definition.ts";
import { archivistRuntimeDefinition } from "../runtime-definition.ts";
import {
  CERTIFIED_ARCHIVIST_MODEL,
  CERTIFIED_ARCHIVIST_PROVIDER,
} from "./constants.ts";
import { RECKONING_REVISED_11_2_SEGMENT_PLAN } from "./reckoning-revised-11-2-segment-plan.ts";

export const PAID_PILOT_AUTHORIZATION_STATUSES = [
  "prepared",
  "explicitly_authorized",
  "consumed",
  "revoked",
] as const;

export type PaidPilotAuthorizationStatus = (typeof PAID_PILOT_AUTHORIZATION_STATUSES)[number];

export const RECKONING_PAID_PILOT_AUTHORIZATION_ID =
  "reckoning-revised-11-2-paid-pilot-prep-20260924" as const;

export const RECKONING_PAID_PILOT_FREEZE_HEAD =
  "160eee4a515fe59638904f0c033b7477ee64b92d" as const;

export const STAGING_SUPABASE_PROJECT_REF = "xwkphouojohyouhdvkgh" as const;
export const PRODUCTION_SUPABASE_PROJECT_REF = "tumcpxklduhiigxjwlrp" as const;
export const STAGING_TRIGGER_PROJECT_ID = "proj_ijlzqjkrsswgjlacylsa" as const;
export const STAGING_TRIGGER_ENVIRONMENT = "staging" as const;
export const ARCHIVIST_SEGMENTED_PILOT_TASK_ID = "archivist-segmented-pilot" as const;

export interface ReckoningPaidPilotAuthorization {
  authorization_id: typeof RECKONING_PAID_PILOT_AUTHORIZATION_ID | string;
  status: PaidPilotAuthorizationStatus;
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  content_hash: string;
  source_docx_sha256: string;
  source_filename: string;
  analytical_word_count: number;
  plan_fingerprint: string;
  archivist_version: string;
  archivist_definition_hash: string;
  registry_definition_hash: string;
  runtime_definition_hash: string;
  certified_pipeline_code_sha: string;
  required_freeze_head: string;
  expert_version_id: string;
  provider: typeof CERTIFIED_ARCHIVIST_PROVIDER;
  model: typeof CERTIFIED_ARCHIVIST_MODEL;
  staging_supabase_project_ref: typeof STAGING_SUPABASE_PROJECT_REF;
  production_supabase_project_ref: typeof PRODUCTION_SUPABASE_PROJECT_REF;
  trigger_project_id: typeof STAGING_TRIGGER_PROJECT_ID;
  trigger_environment: typeof STAGING_TRIGGER_ENVIRONMENT;
  trigger_task_id: typeof ARCHIVIST_SEGMENTED_PILOT_TASK_ID;
  max_active_workflows: 1;
  max_representation_repair_per_segment: 1;
  hard_cost_ceiling_usd: 1;
  bound_workflow_id: string | null;
  series_id: null;
  authorized_to_run: false;
}

export const RECKONING_PAID_PILOT_AUTHORIZATION = {
  authorization_id: RECKONING_PAID_PILOT_AUTHORIZATION_ID,
  status: "prepared",
  manuscript_id: RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id,
  manuscript_version_id: RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_version_id,
  version_number: RECKONING_REVISED_11_2_SOURCE_PIN.version_number,
  content_hash: RECKONING_REVISED_11_2_SOURCE_PIN.content_hash,
  source_docx_sha256: RECKONING_REVISED_11_2_SOURCE_PIN.source_docx_sha256,
  source_filename: RECKONING_REVISED_11_2_SOURCE_PIN.source_filename,
  analytical_word_count: RECKONING_REVISED_11_2_SOURCE_PIN.analytical_word_count,
  plan_fingerprint: RECKONING_REVISED_11_2_SEGMENT_PLAN.plan_fingerprint,
  archivist_version: ARCHIVIST_VERSION,
  archivist_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
  registry_definition_hash: ARCHIVIST_REGISTRY_DEFINITION_HASH,
  runtime_definition_hash: archivistRuntimeDefinition().runtime_versions.definition_hash,
  certified_pipeline_code_sha: ARCHIVIST_CERTIFIED_CODE_SHA,
  required_freeze_head: RECKONING_PAID_PILOT_FREEZE_HEAD,
  expert_version_id: ARCHIVIST_DRAFT_EXPERT_VERSION_ID,
  provider: CERTIFIED_ARCHIVIST_PROVIDER,
  model: CERTIFIED_ARCHIVIST_MODEL,
  staging_supabase_project_ref: STAGING_SUPABASE_PROJECT_REF,
  production_supabase_project_ref: PRODUCTION_SUPABASE_PROJECT_REF,
  trigger_project_id: STAGING_TRIGGER_PROJECT_ID,
  trigger_environment: STAGING_TRIGGER_ENVIRONMENT,
  trigger_task_id: ARCHIVIST_SEGMENTED_PILOT_TASK_ID,
  max_active_workflows: 1,
  max_representation_repair_per_segment: 1,
  hard_cost_ceiling_usd: 1,
  bound_workflow_id: null,
  series_id: null,
  authorized_to_run: false,
} as const satisfies ReckoningPaidPilotAuthorization;

export function clonePaidPilotAuthorization(
  overrides: Partial<ReckoningPaidPilotAuthorization> = {},
): ReckoningPaidPilotAuthorization {
  return {
    ...RECKONING_PAID_PILOT_AUTHORIZATION,
    ...overrides,
    authorized_to_run: false,
  };
}
