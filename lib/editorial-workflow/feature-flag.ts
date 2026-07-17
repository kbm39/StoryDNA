/** Milestone 1 feature flag — defaults off until production validation. */
export function isEditorialWorkflowEnabled(): boolean {
  const v = process.env.EDITORIAL_WORKFLOW_ENABLED;
  return v === "1" || v === "true";
}

/** Local-only explicit sync path for CLI; never enable on Vercel production. */
export function isEditorialWorkflowDevSyncFallback(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = process.env.EDITORIAL_WORKFLOW_DEV_SYNC_FALLBACK;
  return v === "1" || v === "true";
}
