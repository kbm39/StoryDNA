/**
 * Expert Review Engine feature flag contracts (P2-20, P2-21, P2-22, P2-23, P2-24).
 *
 * Not wired into Trigger or UI. Default and malformed values are off.
 */

export const EXPERT_REVIEW_ENGINE_FLAG_NAME = "EXPERT_REVIEW_ENGINE_ENABLED" as const;
export const EXPERT_MODULE_RESOLVER_FLAG_NAME = "EXPERT_MODULE_RESOLVER_ENABLED" as const;
export const EXPERT_PLUGIN_EXECUTOR_FLAG_NAME = "EXPERT_PLUGIN_EXECUTOR_ENABLED" as const;
export const EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME =
  "EXPERT_LITERARY_AGENT_PARITY_ENABLED" as const;
export const EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME =
  "EXPERT_LITERARY_AGENT_REPLAY_ENABLED" as const;
export const EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME =
  "EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED" as const;

const TRUTHY_VALUES = new Set(["true", "1", "yes"]);

/**
 * Read EXPERT_REVIEW_ENGINE_ENABLED from an environment map.
 *
 * - absent → off
 * - empty → off
 * - malformed → off
 * - only explicit truthy tokens enable the flag
 */
export function readExpertReviewEngineEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_REVIEW_ENGINE_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/**
 * Read EXPERT_MODULE_RESOLVER_ENABLED from an environment map.
 *
 * Same truthy contract as EXPERT_REVIEW_ENGINE_ENABLED. Not wired to production callers.
 */
export function readExpertModuleResolverEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_MODULE_RESOLVER_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/**
 * Read EXPERT_PLUGIN_EXECUTOR_ENABLED from an environment map.
 *
 * Same truthy contract as EXPERT_REVIEW_ENGINE_ENABLED. Not wired to production callers.
 */
export function readExpertPluginExecutorEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_PLUGIN_EXECUTOR_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/**
 * Read EXPERT_LITERARY_AGENT_PARITY_ENABLED from an environment map.
 *
 * Same truthy contract as EXPERT_REVIEW_ENGINE_ENABLED. Does not enable production
 * execution, Trigger, UI, or model calls.
 */
export function readExpertLiteraryAgentParityEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_LITERARY_AGENT_PARITY_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/**
 * Read EXPERT_LITERARY_AGENT_REPLAY_ENABLED from an environment map.
 *
 * Same truthy contract as EXPERT_REVIEW_ENGINE_ENABLED. Does not enable production
 * execution, model calls, Trigger, UI, publishing, or file writes.
 */
export function readExpertLiteraryAgentReplayEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/**
 * Read EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED from an environment map.
 *
 * Same truthy contract as EXPERT_REVIEW_ENGINE_ENABLED. Does not enable provider calls,
 * production execution, Trigger, UI, or publishing.
 */
export function readExpertMilitaryGenerationContractEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}
