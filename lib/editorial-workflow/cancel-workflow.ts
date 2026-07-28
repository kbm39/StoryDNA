import "server-only";

import {
  getWorkflowById,
  isTerminalStatus,
  markWorkflowCancelled,
  requestWorkflowCancellation,
} from "./workflow-store.ts";
import { isEditorialWorkflowCancellationIdempotent } from "./cancel-workflow-policy.ts";
import { ACTIVE_WORKFLOW_STATUSES } from "./types.ts";
import { cancelTriggerRunIfPresent } from "./trigger-client.ts";

export async function cancelEditorialWorkflow(workflowId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const row = await getWorkflowById(workflowId);
  if (!row) return { ok: false, error: "Workflow not found." };

  if (isEditorialWorkflowCancellationIdempotent(row.status)) {
    return { ok: true };
  }

  if (!ACTIVE_WORKFLOW_STATUSES.includes(row.status)) {
    return { ok: false, error: "This workflow cannot be cancelled." };
  }

  await cancelTriggerRunIfPresent(row.trigger_run_id);

  if (row.status === "queued") {
    await markWorkflowCancelled(workflowId);
    return { ok: true };
  }

  await requestWorkflowCancellation(workflowId, "author");
  return { ok: true };
}

/** @deprecated Use cancelEditorialWorkflow */
export async function cancelLiteraryAgentWorkflow(workflowId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  return cancelEditorialWorkflow(workflowId);
}
