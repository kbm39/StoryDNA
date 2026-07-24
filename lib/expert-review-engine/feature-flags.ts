/**
 * Expert Review Engine feature flag contract (P2-20).
 *
 * Not wired into Trigger or UI. Default and malformed values are off.
 */

export const EXPERT_REVIEW_ENGINE_FLAG_NAME = "EXPERT_REVIEW_ENGINE_ENABLED" as const;

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
