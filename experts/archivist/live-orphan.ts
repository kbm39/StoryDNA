/**
 * Archivist Trigger orphan reconciliation — same foundation as Literary Agent.
 * Does not insert editorial_workflows rows in this phase (DB workflow_type
 * remains literary_agent_review only).
 */

import {
  reconcileOrphanedWorkflowState,
  type ReconcileOrphanDeps,
  type ReconcileOrphanResult,
} from "@/lib/editorial-workflow/reconcile-orphaned-workflow.ts";

export async function reconcileArchivistOrphanedWorkflowState(
  deps: ReconcileOrphanDeps,
): Promise<ReconcileOrphanResult> {
  return reconcileOrphanedWorkflowState(deps);
}
