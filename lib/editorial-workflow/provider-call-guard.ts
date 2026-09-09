import { WorkflowCancelledError } from "@/lib/editorial-workflow/types";

export type CancelCheck = () => Promise<boolean>;

/** Fail closed if the workflow was cancelled. Does not invoke the provider. */
export async function assertProviderCallAllowed(
  shouldCancel?: CancelCheck,
): Promise<void> {
  if (shouldCancel && (await shouldCancel())) {
    throw new WorkflowCancelledError();
  }
}

/**
 * Re-check cancellation immediately before a provider invocation.
 * Retries must call this again before each attempt.
 */
export async function invokeIfNotCancelled<T>(
  shouldCancel: CancelCheck | undefined,
  invoke: () => Promise<T>,
): Promise<T> {
  await assertProviderCallAllowed(shouldCancel);
  return invoke();
}

/** Block the publish RPC when cancellation was requested. */
export async function assertPublishAllowed(
  shouldCancel?: CancelCheck,
): Promise<void> {
  await assertProviderCallAllowed(shouldCancel);
}
