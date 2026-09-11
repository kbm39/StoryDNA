import type { EditorialWorkflowRow } from "./types.ts";
import { isTerminalWorkflowStatus } from "./types.ts";

export const TRIGGER_ACTIVE_RUN_STATUSES = [
  "PENDING_VERSION",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "WAITING",
  "DELAYED",
  "FROZEN",
] as const;

export const TRIGGER_INFRA_FAILURE_STATUSES = [
  "CANCELED",
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
  "INTERRUPTED",
] as const;

export type ReconcileOrphanAction =
  | "already_terminal"
  | "marked_failed"
  | "marked_cancelled"
  | "refused_active_run"
  | "refused_mismatch"
  | "refused_missing"
  | "refused_not_orphan";

export interface ReconcileTriggerRun {
  id: string;
  status: string;
  error?: { message?: string } | null;
}

export interface ReconcileOrphanResult {
  ok: boolean;
  action: ReconcileOrphanAction;
  workflowId: string;
  triggerRunId?: string | null;
  workflowStatus?: string;
  triggerStatus?: string;
  error?: string;
}

export interface ReconcileOrphanDeps {
  workflowId: string;
  expectedTriggerRunId: string;
  getWorkflow: (id: string) => Promise<EditorialWorkflowRow | null>;
  retrieveRun: (id: string) => Promise<ReconcileTriggerRun>;
  markFailed: (args: {
    workflowId: string;
    errorCode: string;
    safeErrorMessage: string;
    resultSummary?: Record<string, unknown> | null;
  }) => Promise<void>;
  markCancelled: (workflowId: string, extras?: { resultSummary?: Record<string, unknown> }) => Promise<void>;
  safeErrorForCode: (code: string) => string;
}

export function isTriggerRunActive(status: string): boolean {
  return (TRIGGER_ACTIVE_RUN_STATUSES as readonly string[]).includes(status);
}

export function isTriggerInfraFailureStatus(status: string): boolean {
  return (TRIGGER_INFRA_FAILURE_STATUSES as readonly string[]).includes(status);
}

export function orphanFailureDiagnostics(args: {
  triggerRunId: string;
  triggerStatus: string;
  triggerError?: string | null;
  lastPhase: string | null;
}): Record<string, unknown> {
  return {
    failureKind: "trigger_run_stalled",
    triggerRunId: args.triggerRunId,
    triggerStatus: args.triggerStatus,
    triggerError: args.triggerError ?? null,
    lastPhase: args.lastPhase,
  };
}

/**
 * Fail-close a StoryDNA workflow whose Trigger run is already terminal.
 * Never creates a workflow, never invokes a provider, never deletes evidence.
 */
export async function reconcileOrphanedWorkflowState(
  deps: ReconcileOrphanDeps,
): Promise<ReconcileOrphanResult> {
  const workflow = await deps.getWorkflow(deps.workflowId);
  if (!workflow) {
    return {
      ok: false,
      action: "refused_missing",
      workflowId: deps.workflowId,
      error: "Workflow not found.",
    };
  }

  if (isTerminalWorkflowStatus(workflow.status)) {
    return {
      ok: true,
      action: "already_terminal",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      workflowStatus: workflow.status,
    };
  }

  if (!workflow.trigger_run_id) {
    return {
      ok: false,
      action: "refused_mismatch",
      workflowId: workflow.id,
      error: "Workflow has no Trigger run to reconcile.",
    };
  }

  if (workflow.trigger_run_id !== deps.expectedTriggerRunId) {
    return {
      ok: false,
      action: "refused_mismatch",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      error: "Trigger run id does not belong to this workflow.",
    };
  }

  const run = await deps.retrieveRun(workflow.trigger_run_id);
  if (run.id && run.id !== workflow.trigger_run_id) {
    return {
      ok: false,
      action: "refused_mismatch",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      error: "Retrieved Trigger run does not match the workflow.",
    };
  }

  if (isTriggerRunActive(run.status)) {
    return {
      ok: false,
      action: "refused_active_run",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      triggerStatus: run.status,
      workflowStatus: workflow.status,
      error: "Trigger run is still active.",
    };
  }

  if (!isTriggerInfraFailureStatus(run.status)) {
    return {
      ok: false,
      action: "refused_not_orphan",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      triggerStatus: run.status,
      workflowStatus: workflow.status,
      error: "Trigger run is not an infrastructure failure.",
    };
  }

  const diagnostics = orphanFailureDiagnostics({
    triggerRunId: workflow.trigger_run_id,
    triggerStatus: run.status,
    triggerError: run.error?.message ?? null,
    lastPhase: workflow.current_phase,
  });

  if (workflow.cancellation_requested_at) {
    await deps.markCancelled(workflow.id, { resultSummary: diagnostics });
    return {
      ok: true,
      action: "marked_cancelled",
      workflowId: workflow.id,
      triggerRunId: workflow.trigger_run_id,
      triggerStatus: run.status,
      workflowStatus: "cancelled",
    };
  }

  await deps.markFailed({
    workflowId: workflow.id,
    errorCode: "PIPELINE_FAILED",
    safeErrorMessage: deps.safeErrorForCode("PIPELINE_FAILED"),
    resultSummary: diagnostics,
  });

  return {
    ok: true,
    action: "marked_failed",
    workflowId: workflow.id,
    triggerRunId: workflow.trigger_run_id,
    triggerStatus: run.status,
    workflowStatus: "failed",
  };
}
