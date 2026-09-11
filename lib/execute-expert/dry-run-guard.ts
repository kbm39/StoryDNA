/**
 * Hard fence: dry_run must never reach Anthropic, OpenAI, live adapters, or paid repair.
 * Credentials in process.env are ignored.
 */

import type { ExecuteExpertMode } from "./types.ts";

export class DryRunProviderForbiddenError extends Error {
  readonly code = "dry_run_provider_forbidden" as const;
  constructor(message = "dry_run cannot call a live provider") {
    super(message);
    this.name = "DryRunProviderForbiddenError";
  }
}

export class DryRunCanonWriteForbiddenError extends Error {
  readonly code = "canon_write_forbidden" as const;
  constructor(message = "dry_run cannot write accepted canon") {
    super(message);
    this.name = "DryRunCanonWriteForbiddenError";
  }
}

/** Incremented only if a live provider adapter is actually invoked. */
let liveProviderInvocationCount = 0;

export function resetLiveProviderInvocationCountForTests(): void {
  liveProviderInvocationCount = 0;
}

export function getLiveProviderInvocationCount(): number {
  return liveProviderInvocationCount;
}

/**
 * Live provider adapters MUST call this before any SDK request.
 * Dry-run execution never calls it; tests prove the counter stays 0.
 */
export function noteLiveProviderInvocation(mode: ExecuteExpertMode): never | void {
  if (mode === "dry_run") {
    throw new DryRunProviderForbiddenError();
  }
  liveProviderInvocationCount += 1;
}

export function assertDryRunCannotCallProvider(mode: ExecuteExpertMode): void {
  if (mode === "dry_run") {
    return;
  }
}

export function forbidDryRunProviderCall(mode: ExecuteExpertMode, label: string): void {
  if (mode === "dry_run") {
    throw new DryRunProviderForbiddenError(`dry_run cannot call ${label}`);
  }
}

export function forbidDryRunCanonWrite(mode: ExecuteExpertMode, action: string): void {
  if (mode === "dry_run") {
    throw new DryRunCanonWriteForbiddenError(`dry_run cannot ${action}`);
  }
}

export function providerCredentialsPresent(): {
  anthropic: boolean;
  openai: boolean;
} {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}
