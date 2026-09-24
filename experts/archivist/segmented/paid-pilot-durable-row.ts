/**
 * Durable prepared-row payload for the REVISED-11-2 paid-pilot authorization.
 * Create/read helpers always emit status prepared.
 * Lifecycle projections are in-memory only and do not write or authorize.
 */

import {
  RECKONING_PAID_PILOT_AUTHORIZATION,
  type PaidPilotAuthorizationStatus,
  type ReckoningPaidPilotAuthorization,
} from "./paid-pilot-authorization.ts";

export interface PaidPilotDurableRow {
  authorization_id: string;
  status: "prepared";
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  source_docx_sha256: string;
  analytical_word_count: number;
  plan_fingerprint: string;
  archivist_definition_hash: string;
  certified_pipeline_code_sha: string;
  required_freeze_head: string;
  provider: string;
  model: string;
  staging_supabase_project_ref: string;
  trigger_project_id: string;
  trigger_environment: string;
  hard_cost_ceiling_usd: number;
  max_active_workflows: 1;
  bound_workflow_id: null;
}

export interface PaidPilotDurableState extends Omit<PaidPilotDurableRow, "status" | "bound_workflow_id"> {
  status: PaidPilotAuthorizationStatus;
  bound_workflow_id: string | null;
}

export const PAID_PILOT_CODE_BINDINGS_NOT_IN_0027 = {
  version_number: RECKONING_PAID_PILOT_AUTHORIZATION.version_number,
  source_filename: RECKONING_PAID_PILOT_AUTHORIZATION.source_filename,
  archivist_version: RECKONING_PAID_PILOT_AUTHORIZATION.archivist_version,
  registry_definition_hash: RECKONING_PAID_PILOT_AUTHORIZATION.registry_definition_hash,
  runtime_definition_hash: RECKONING_PAID_PILOT_AUTHORIZATION.runtime_definition_hash,
  expert_version_id: RECKONING_PAID_PILOT_AUTHORIZATION.expert_version_id,
  trigger_task_id: RECKONING_PAID_PILOT_AUTHORIZATION.trigger_task_id,
  max_representation_repair_per_segment:
    RECKONING_PAID_PILOT_AUTHORIZATION.max_representation_repair_per_segment,
  series_id: RECKONING_PAID_PILOT_AUTHORIZATION.series_id,
  authorized_to_run: false,
} as const;

export function preparedPaidPilotDurableRow(
  authorization: ReckoningPaidPilotAuthorization = RECKONING_PAID_PILOT_AUTHORIZATION,
): PaidPilotDurableRow {
  if (authorization.authorization_id !== RECKONING_PAID_PILOT_AUTHORIZATION.authorization_id) {
    throw new Error("durable row may only persist the bound Reckoning authorization");
  }
  return {
    authorization_id: authorization.authorization_id,
    status: "prepared",
    manuscript_id: authorization.manuscript_id,
    manuscript_version_id: authorization.manuscript_version_id,
    content_hash: authorization.content_hash,
    source_docx_sha256: authorization.source_docx_sha256,
    analytical_word_count: authorization.analytical_word_count,
    plan_fingerprint: authorization.plan_fingerprint,
    archivist_definition_hash: authorization.archivist_definition_hash,
    certified_pipeline_code_sha: authorization.certified_pipeline_code_sha,
    required_freeze_head: authorization.required_freeze_head,
    provider: authorization.provider,
    model: authorization.model,
    staging_supabase_project_ref: authorization.staging_supabase_project_ref,
    trigger_project_id: authorization.trigger_project_id,
    trigger_environment: authorization.trigger_environment,
    hard_cost_ceiling_usd: authorization.hard_cost_ceiling_usd,
    max_active_workflows: 1,
    bound_workflow_id: null,
  };
}

export function authorizationFromDurableRow(
  row: PaidPilotDurableRow,
): ReckoningPaidPilotAuthorization {
  return {
    ...RECKONING_PAID_PILOT_AUTHORIZATION,
    ...PAID_PILOT_CODE_BINDINGS_NOT_IN_0027,
    authorization_id: row.authorization_id,
    status: row.status,
    manuscript_id: row.manuscript_id,
    manuscript_version_id: row.manuscript_version_id,
    content_hash: row.content_hash,
    source_docx_sha256: row.source_docx_sha256,
    analytical_word_count: row.analytical_word_count,
    plan_fingerprint: row.plan_fingerprint,
    archivist_definition_hash: row.archivist_definition_hash,
    certified_pipeline_code_sha: row.certified_pipeline_code_sha,
    required_freeze_head: row.required_freeze_head,
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    staging_supabase_project_ref: "xwkphouojohyouhdvkgh",
    production_supabase_project_ref: "tumcpxklduhiigxjwlrp",
    trigger_project_id: "proj_ijlzqjkrsswgjlacylsa",
    trigger_environment: "staging",
    trigger_task_id: "archivist-segmented-pilot",
    max_active_workflows: 1,
    max_representation_repair_per_segment: 1,
    hard_cost_ceiling_usd: 1,
    bound_workflow_id: row.bound_workflow_id,
    series_id: null,
    authorized_to_run: false,
  };
}

export function assertDurableRowBindings(row: PaidPilotDurableState): void {
  const expected = preparedPaidPilotDurableRow();
  const fields: Array<keyof PaidPilotDurableRow> = [
    "authorization_id",
    "manuscript_id",
    "manuscript_version_id",
    "content_hash",
    "source_docx_sha256",
    "analytical_word_count",
    "plan_fingerprint",
    "archivist_definition_hash",
    "certified_pipeline_code_sha",
    "required_freeze_head",
    "provider",
    "model",
    "staging_supabase_project_ref",
    "trigger_project_id",
    "trigger_environment",
    "hard_cost_ceiling_usd",
    "max_active_workflows",
  ];
  for (const field of fields) {
    if (String(row[field]) !== String(expected[field])) {
      throw new Error(`durable_binding_mismatch:${field}`);
    }
  }
}

export function projectDurableAuthorization(
  current: PaidPilotDurableState,
  action: "authorize" | "consume" | "revoke",
  args: { workflow_id?: string | null } = {},
): PaidPilotDurableState {
  assertDurableRowBindings(current);
  if (action === "authorize") {
    if (current.status !== "prepared") {
      throw new Error("durable_transition_forbidden:authorize");
    }
    return { ...current, status: "explicitly_authorized", bound_workflow_id: null };
  }
  if (action === "revoke") {
    if (current.status !== "prepared" && current.status !== "explicitly_authorized") {
      throw new Error("durable_transition_forbidden:revoke");
    }
    return { ...current, status: "revoked" };
  }
  if (action === "consume") {
    if (current.status === "consumed") {
      if (!args.workflow_id || args.workflow_id !== current.bound_workflow_id) {
        throw new Error("durable_transition_forbidden:second_workflow");
      }
      return current;
    }
    if (current.status !== "explicitly_authorized") {
      throw new Error("durable_transition_forbidden:consume");
    }
    if (!args.workflow_id) {
      throw new Error("durable_transition_forbidden:missing_workflow");
    }
    return { ...current, status: "consumed", bound_workflow_id: args.workflow_id };
  }
  throw new Error("durable_transition_forbidden:unknown");
}
