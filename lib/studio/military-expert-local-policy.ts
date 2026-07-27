/**
 * Kevin Studio-only Military Expert local testing policy.
 *
 * Does not mutate global expert catalog lifecycle flags (selectionEnabled,
 * executionAllowed, certificationStatus, availability).
 */

import { isStudioFeatureEnabled } from "./feature-flag.ts";

export const STUDIO_MILITARY_EXPERT_LAUNCH_ACK =
  "I-ACKNOWLEDGE-MILITARY-EXPERT-LOCAL-TEST" as const;

export const STUDIO_MILITARY_EXPERT_FLAG_NAME = "STUDIO_MILITARY_EXPERT_ENABLED" as const;

export function isStudioMilitaryExpertLocalOverrideEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioFeatureEnabled()) return false;
  const raw = process.env[STUDIO_MILITARY_EXPERT_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function militaryExpertLocalDeskTierLabel(): string {
  return isStudioMilitaryExpertLocalOverrideEnabled()
    ? "Experimental — Private Local Testing"
    : "Experimental";
}

export function militaryExpertLocalExpectedRuntime(): string {
  return isStudioMilitaryExpertLocalOverrideEnabled() ? "10–20 minutes" : "Not available";
}

export function militaryExpertLocalEstimatedCost(): string | null {
  return isStudioMilitaryExpertLocalOverrideEnabled()
    ? "Varies by manuscript length (local test)"
    : null;
}

export function isMilitaryExpertRecruitableInLocalStudio(): boolean {
  return isStudioMilitaryExpertLocalOverrideEnabled();
}

export function isMilitaryExpertLaunchableInLocalStudio(input: {
  readonly privateUseAcknowledged: boolean;
  readonly launchAcknowledged: boolean;
}): boolean {
  if (!isStudioMilitaryExpertLocalOverrideEnabled()) return false;
  if (!input.privateUseAcknowledged || !input.launchAcknowledged) return false;
  return true;
}

export function validateMilitaryExpertLaunchAckToken(token: string | undefined): boolean {
  return token === STUDIO_MILITARY_EXPERT_LAUNCH_ACK;
}
