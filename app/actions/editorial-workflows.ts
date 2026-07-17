"use server";

import { revalidatePath } from "next/cache";
import { isEditorialWorkflowEnabled } from "@/lib/editorial-workflow/feature-flag";
import { LITERARY_AGENT_UNAVAILABLE_MESSAGE } from "@/lib/editorial-workflow/sync-policy";
import {
  startLiteraryAgentWorkflow,
  getWorkflowForClient,
} from "@/lib/editorial-workflow/start-literary-agent-workflow";
import { cancelLiteraryAgentWorkflow } from "@/lib/editorial-workflow/cancel-workflow";
import { getActiveWorkflowForManuscript } from "@/lib/editorial-workflow/workflow-store";

export type WorkflowClientView = NonNullable<Awaited<ReturnType<typeof getWorkflowForClient>>>;

export async function isPublishingWorkflowAvailable(): Promise<boolean> {
  return isEditorialWorkflowEnabled();
}

export async function startLiteraryAgentPublishingWorkflow(manuscriptId: string): Promise<{
  ok: boolean;
  workflowId?: string;
  existing?: boolean;
  error?: string;
}> {
  if (!isEditorialWorkflowEnabled()) {
    return {
      ok: false,
      error: LITERARY_AGENT_UNAVAILABLE_MESSAGE,
    };
  }
  const result = await startLiteraryAgentWorkflow(manuscriptId);
  if (result.ok && result.workflowId) {
    revalidatePath(`/manuscripts/${manuscriptId}`);
  }
  return result;
}

export async function getPublishingWorkflowStatus(
  workflowId: string,
): Promise<WorkflowClientView | null> {
  return getWorkflowForClient(workflowId);
}

export async function getActivePublishingWorkflow(
  manuscriptId: string,
): Promise<WorkflowClientView | null> {
  if (!isEditorialWorkflowEnabled()) return null;

  try {
    const row = await getActiveWorkflowForManuscript({
      manuscriptId,
      workflowType: "literary_agent_review",
    });
    if (!row) return null;
    return getWorkflowForClient(row.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Migration 0023 not applied yet — treat as no active workflow
    if (
      message.includes("editorial_workflows") &&
      (message.includes("does not exist") || message.includes("Could not find"))
    ) {
      return null;
    }
    throw err;
  }
}

export async function cancelPublishingWorkflow(workflowId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const result = await cancelLiteraryAgentWorkflow(workflowId);
  if (result.ok) {
    const row = await getWorkflowForClient(workflowId);
    if (row?.manuscriptId) revalidatePath(`/manuscripts/${row.manuscriptId}`);
  }
  return result;
}
