/** Optional hooks for Literary Agent provider invocations. */

export interface ProviderCallHooks {
  /** Called immediately before the SDK request. Must throw to abort the call. */
  onBeforeProviderCall?: () => Promise<void>;
}
