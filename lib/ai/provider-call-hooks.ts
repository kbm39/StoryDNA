/** Optional hooks for long-running provider invocations (Literary Agent and future experts). */

export interface ProviderCallHooks {
  /** Called immediately before the SDK request. Must throw to abort the call. */
  onBeforeProviderCall?: () => Promise<void>;
  /** Cooperative keep-alive while waiting on a long provider response. */
  onExecutionHeartbeat?: () => Promise<void>;
  /** Recheck StoryDNA workflow cancellation during the in-flight request. */
  shouldCancel?: () => Promise<boolean>;
  /** Host abort (Trigger `timeout.signal`, tests, or future expert runtime). */
  abortSignal?: AbortSignal;
}
