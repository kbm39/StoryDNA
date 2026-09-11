import "server-only";

import { getWorkflowById, markWorkflowCancelled, markWorkflowFailed } from "./workflow-store.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import {
  reconcileOrphanedWorkflowState,
  type ReconcileOrphanResult,
} from "./reconcile-orphaned-workflow.ts";

/** Staging/ops wrapper. Does not invoke a provider or create a workflow. */
export async function reconcileOrphanedLiteraryAgentWorkflow(args: {
  workflowId: string;
  expectedTriggerRunId: string;
}): Promise<ReconcileOrphanResult> {
  const { runs } = await import("@trigger.dev/sdk/v3");
  return reconcileOrphanedWorkflowState({
    workflowId: args.workflowId,
    expectedTriggerRunId: args.expectedTriggerRunId,
    getWorkflow: getWorkflowById,
    retrieveRun: async (id) => {
      const run = await runs.retrieve(id);
      return {
        id: run.id,
        status: String(run.status),
        error: run.error ? { message: run.error.message } : null,
      };
    },
    markFailed: markWorkflowFailed,
    markCancelled: markWorkflowCancelled,
    safeErrorForCode,
  });
}
