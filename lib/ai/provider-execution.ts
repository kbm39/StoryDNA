import { WorkflowCancelledError } from "@/lib/editorial-workflow/types";

/** Trigger.dev marks TASK_RUN_STALLED_EXECUTING if no execution heartbeat arrives within 5 minutes. */
export const TRIGGER_EXECUTION_STALL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Cooperative keep-alive interval during long provider calls.
 * Must stay comfortably below Trigger's 5-minute stall window.
 */
export const PROVIDER_EXECUTION_HEARTBEAT_INTERVAL_MS = 15_000;

export interface ProviderExecutionHooks {
  /** Trigger supplies `heartbeats.yield()`. No-op outside a task run. */
  onExecutionHeartbeat?: () => Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  abortSignal?: AbortSignal;
  heartbeatIntervalMs?: number;
}

export class ProviderExecutionAbortedError extends Error {
  readonly reason = "aborted" as const;
  costAccounting?: unknown;
  constructor(message = "PROVIDER_EXECUTION_ABORTED") {
    super(message);
    this.name = "ProviderExecutionAbortedError";
  }
}

export function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  if (name === "AbortError" || name === "APIUserAbortError") return true;
  if ("code" in error && error.code === "ABORT_ERR") return true;
  return false;
}

/**
 * Keep Trigger (or any host) receiving execution activity while a long provider
 * call is in flight, and abort the call if cancellation is requested.
 *
 * Does not write to StoryDNA tables — hosts supply heartbeat/cancel themselves.
 */
export async function runWithProviderExecutionKeepAlive<T>(
  work: (ctx: { signal: AbortSignal }) => Promise<T>,
  hooks?: ProviderExecutionHooks,
): Promise<T> {
  const intervalMs = Math.max(
    1,
    hooks?.heartbeatIntervalMs ?? PROVIDER_EXECUTION_HEARTBEAT_INTERVAL_MS,
  );
  const controller = new AbortController();
  const onExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort();
  };
  if (hooks?.abortSignal?.aborted) onExternalAbort();
  else hooks?.abortSignal?.addEventListener("abort", onExternalAbort, { once: true });
  let cancelRequested = false;
  let ticking = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (ticking || controller.signal.aborted) return;
    ticking = true;
    try {
      await hooks?.onExecutionHeartbeat?.();
      if (hooks?.shouldCancel && (await hooks.shouldCancel())) {
        cancelRequested = true;
        if (!controller.signal.aborted) controller.abort();
      }
    } catch {
      // Host heartbeat failures must not kill a valid provider call.
    } finally {
      ticking = false;
    }
  };

  interval = setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();

  try {
    return await work({ signal: controller.signal });
  } catch (error) {
    if (cancelRequested || (error instanceof WorkflowCancelledError)) {
      throw error instanceof WorkflowCancelledError ? error : new WorkflowCancelledError();
    }
    if (controller.signal.aborted || isAbortLikeError(error)) {
      throw error instanceof ProviderExecutionAbortedError
        ? error
        : new ProviderExecutionAbortedError();
    }
    throw error;
  } finally {
    if (interval) clearInterval(interval);
    hooks?.abortSignal?.removeEventListener("abort", onExternalAbort);
  }
}
