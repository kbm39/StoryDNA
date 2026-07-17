import { isEditorialWorkflowDevSyncFallback, isEditorialWorkflowEnabled } from "./feature-flag.ts";

/** Author-facing copy when Literary Agent sync/workflow is unavailable. */
export const LITERARY_AGENT_UNAVAILABLE_MESSAGE =
  "Literary Agent reviews are temporarily unavailable while Publishing Workflow is being enabled.";

/**
 * Whether the server action `runFreshEditorialGeneration` may run synchronously.
 * Production never allows sync from the browser — use Trigger.dev workflow instead.
 * CLI and workflow execution call lib/editorial-generation directly.
 */
export function isLiteraryAgentSyncFromServerActionAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (isEditorialWorkflowEnabled()) return false;
  return isEditorialWorkflowDevSyncFallback();
}
