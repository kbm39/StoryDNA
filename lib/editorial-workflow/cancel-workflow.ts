import "server-only";

import {
  getWorkflowById,
  isTerminalStatus,
  markWorkflowCancelled,
  requestWorkflowCancellation,
} from "./workflow-store.ts";
import { ACTIVE_WORKFLOW_STATUSES } from "./types.ts";

export async function cancelLiteraryAgentWorkflow(workflowId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const row = await getWorkflowById(workflowId);
  if (!row) return { ok: false, error: "Workflow not found." };
  if (isTerminalStatus(row.status)) {
    return { ok: false, error: "This Publishing Workflow has already finished." };
  }
  if (!ACTIVE_WORKFLOW_STATUSES.includes(row.status)) {
    return { ok: false, error: "This Publishing Workflow cannot be cancelled." };
  }

  if (row.status === "queued") {
    await markWorkflowCancelled(workflowId);
    return { ok: true };
  }

  await requestWorkflowCancellation(workflowId, "author");
  return { ok: true };
}
