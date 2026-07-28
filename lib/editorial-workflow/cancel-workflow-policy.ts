import type { WorkflowStatus, WorkflowType } from "./types.ts";
import { isTerminalWorkflowStatus } from "./types.ts";

export const STUDIO_CANCELLABLE_WORKFLOW_TYPES = [
  "literary_agent_review",
  "military_expert_review",
] as const satisfies readonly WorkflowType[];

export type StudioCancellableWorkflowType = (typeof STUDIO_CANCELLABLE_WORKFLOW_TYPES)[number];

export type StudioWorkflowCancellationTarget = {
  readonly id: string;
  readonly manuscript_id: string;
  readonly workflow_type: string;
  readonly status: WorkflowStatus;
};

export function isStudioCancellableWorkflowType(
  workflowType: string,
): workflowType is StudioCancellableWorkflowType {
  return (STUDIO_CANCELLABLE_WORKFLOW_TYPES as readonly string[]).includes(workflowType);
}

export function validateStudioWorkflowCancellation(input: {
  readonly workflow: StudioWorkflowCancellationTarget | null;
  readonly workflowId: string;
  readonly manuscriptId: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.workflow || input.workflow.id !== input.workflowId) {
    return { ok: false, error: "No active review to cancel." };
  }
  if (input.workflow.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "No active review to cancel." };
  }
  if (!isStudioCancellableWorkflowType(input.workflow.workflow_type)) {
    return { ok: false, error: "This workflow type cannot be cancelled from Studio." };
  }
  return { ok: true };
}

export function isEditorialWorkflowCancellationIdempotent(status: WorkflowStatus): boolean {
  return isTerminalWorkflowStatus(status);
}
