import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AuthoritativeResultType,
  EditorialWorkflowRow,
  InternalPhase,
  WaitingReason,
  WorkflowInputSnapshot,
  WorkflowType,
} from "./types.ts";
import type { WorkflowRowMetadata } from "./workflow-definitions.ts";
import { authorPhaseLabel } from "./phase-labels.ts";
import { ACTIVE_WORKFLOW_STATUSES, isTerminalWorkflowStatus } from "./types.ts";

export type { EditorialWorkflowRow };

function rowFromDb(raw: Record<string, unknown>): EditorialWorkflowRow {
  return raw as unknown as EditorialWorkflowRow;
}

export async function getWorkflowById(workflowId: string): Promise<EditorialWorkflowRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("editorial_workflows")
    .select("*")
    .eq("id", workflowId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowFromDb(data) : null;
}

export async function getActiveWorkflowForManuscript(args: {
  manuscriptId: string;
  workflowType: WorkflowType;
}): Promise<EditorialWorkflowRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("editorial_workflows")
    .select("*")
    .eq("manuscript_id", args.manuscriptId)
    .eq("workflow_type", args.workflowType)
    .in("status", [...ACTIVE_WORKFLOW_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowFromDb(data) : null;
}

export async function insertWorkflowEvent(args: {
  workflowId: string;
  eventType: string;
  phase?: InternalPhase | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("editorial_workflow_events").insert({
    workflow_id: args.workflowId,
    event_type: args.eventType,
    phase: args.phase ?? null,
    payload: args.payload ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function createWorkflowRow(args: {
  manuscriptId: string;
  manuscriptVersionId: string;
  contentHash: string;
  workflowType: WorkflowType;
  workflowDefinitionVersion: string;
  idempotencyKey: string;
  inputSnapshot: WorkflowInputSnapshot;
  metadata: WorkflowRowMetadata;
}): Promise<EditorialWorkflowRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("editorial_workflows")
    .insert({
      manuscript_id: args.manuscriptId,
      manuscript_version_id: args.manuscriptVersionId,
      content_hash: args.contentHash,
      workflow_type: args.workflowType,
      workflow_definition_version: args.workflowDefinitionVersion,
      idempotency_key: args.idempotencyKey,
      input_snapshot: args.inputSnapshot,
      department: args.metadata.department,
      owner_type: args.metadata.owner_type,
      owner_label: args.metadata.owner_label,
      purpose: args.metadata.purpose,
      participating_experts: args.metadata.participating_experts,
      next_best_action: args.metadata.next_best_action,
      status: "queued",
      progress_summary: "Publishing Workflow queued",
    })
    .select("*")
    .single();
  if (error) throw error;
  const row = rowFromDb(data);
  await insertWorkflowEvent({
    workflowId: row.id,
    eventType: "queued",
    payload: { workflow_type: args.workflowType },
  });
  return row;
}

export async function updateWorkflowRow(
  workflowId: string,
  patch: Record<string, unknown>,
): Promise<EditorialWorkflowRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("editorial_workflows")
    .update(patch)
    .eq("id", workflowId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowFromDb(data);
}

export async function setWorkflowPhase(
  workflowId: string,
  phase: InternalPhase,
): Promise<void> {
  const summary = authorPhaseLabel(phase);
  await updateWorkflowRow(workflowId, {
    current_phase: phase,
    progress_summary: summary,
    heartbeat_at: new Date().toISOString(),
  });
  await insertWorkflowEvent({
    workflowId,
    eventType: "phase_changed",
    phase,
    payload: { progress_summary: summary },
  });
}

export async function touchWorkflowHeartbeat(workflowId: string): Promise<void> {
  await updateWorkflowRow(workflowId, {
    heartbeat_at: new Date().toISOString(),
  });
}

export async function linkTriggerRun(workflowId: string, triggerRunId: string): Promise<void> {
  await updateWorkflowRow(workflowId, { trigger_run_id: triggerRunId });
  await insertWorkflowEvent({
    workflowId,
    eventType: "trigger_run_linked",
    payload: { trigger_run_id: triggerRunId },
  });
}

export async function markWorkflowStarted(workflowId: string, attemptCount: number): Promise<void> {
  const now = new Date().toISOString();
  await updateWorkflowRow(workflowId, {
    status: "preparing",
    attempt_count: attemptCount,
    started_at: now,
    heartbeat_at: now,
  });
  await insertWorkflowEvent({ workflowId, eventType: "started", payload: { attempt_count: attemptCount } });
}

export async function markWorkflowRunning(workflowId: string): Promise<void> {
  await updateWorkflowRow(workflowId, {
    status: "running",
    heartbeat_at: new Date().toISOString(),
  });
}

export async function markWorkflowWaiting(
  workflowId: string,
  reason: WaitingReason,
  safeMessage: string,
): Promise<void> {
  await updateWorkflowRow(workflowId, {
    status: "waiting",
    waiting_reason: reason,
    safe_error_message: safeMessage,
    heartbeat_at: new Date().toISOString(),
  });
  await insertWorkflowEvent({
    workflowId,
    eventType: "waiting",
    payload: { waiting_reason: reason },
  });
}

export async function markWorkflowCompleted(args: {
  workflowId: string;
  authoritativeResultId: string;
  authoritativeResultType: AuthoritativeResultType;
  resultSummary: Record<string, unknown>;
  nextBestAction?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await updateWorkflowRow(args.workflowId, {
    status: "completed",
    current_phase: "completed",
    progress_summary: authorPhaseLabel("completed"),
    authoritative_result_id: args.authoritativeResultId,
    authoritative_result_type: args.authoritativeResultType,
    result_summary: args.resultSummary,
    next_best_action: args.nextBestAction ?? null,
    completed_at: now,
    heartbeat_at: now,
    safe_error_message: null,
    error_code: null,
  });
  await insertWorkflowEvent({
    workflowId: args.workflowId,
    eventType: "completed",
    phase: "completed",
    payload: args.resultSummary,
  });
  await insertWorkflowEvent({
    workflowId: args.workflowId,
    eventType: "published",
    payload: { authoritative_result_id: args.authoritativeResultId },
  });
}

export async function markWorkflowFailed(args: {
  workflowId: string;
  errorCode: string;
  safeErrorMessage: string;
  diagnosticsStorageKey?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await updateWorkflowRow(args.workflowId, {
    status: "failed",
    error_code: args.errorCode,
    safe_error_message: args.safeErrorMessage,
    diagnostics_storage_key: args.diagnosticsStorageKey ?? null,
    failed_at: now,
    heartbeat_at: now,
  });
  await insertWorkflowEvent({
    workflowId: args.workflowId,
    eventType: "failed",
    payload: { error_code: args.errorCode },
  });
}

export async function requestWorkflowCancellation(
  workflowId: string,
  cancelledBy: "author" | "admin" | "system" = "author",
): Promise<EditorialWorkflowRow> {
  const row = await updateWorkflowRow(workflowId, {
    cancellation_requested_at: new Date().toISOString(),
    cancelled_by: cancelledBy,
  });
  await insertWorkflowEvent({
    workflowId,
    eventType: "cancel_requested",
    payload: { cancelled_by: cancelledBy },
  });
  return row;
}

export async function markWorkflowCancelled(workflowId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateWorkflowRow(workflowId, {
    status: "cancelled",
    cancelled_at: now,
    heartbeat_at: now,
    safe_error_message: "This Publishing Workflow was cancelled before your results were prepared.",
    error_code: "WORKFLOW_CANCELLED",
  });
  await insertWorkflowEvent({ workflowId, eventType: "cancelled" });
}

export async function isCancellationRequested(workflowId: string): Promise<boolean> {
  const row = await getWorkflowById(workflowId);
  return Boolean(row?.cancellation_requested_at && !row.cancelled_at);
}

export async function verifyWorkflowVersionPin(workflow: EditorialWorkflowRow): Promise<{
  ok: true;
} | {
  ok: false;
  errorCode: string;
}> {
  const supabase = getSupabaseAdmin();
  const { data: manuscript, error: mErr } = await supabase
    .from("manuscripts")
    .select("current_version_id")
    .eq("id", workflow.manuscript_id)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (manuscript?.current_version_id !== workflow.manuscript_version_id) {
    return { ok: false, errorCode: "VERSION_PIN_MISMATCH" };
  }
  const { data: version, error: vErr } = await supabase
    .from("manuscript_versions")
    .select("content_hash")
    .eq("id", workflow.manuscript_version_id)
    .eq("manuscript_id", workflow.manuscript_id)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version || version.content_hash !== workflow.content_hash) {
    return { ok: false, errorCode: "VERSION_PIN_MISMATCH" };
  }
  return { ok: true };
}

export function isTerminalStatus(status: import("./types.ts").WorkflowStatus): boolean {
  return isTerminalWorkflowStatus(status);
}
