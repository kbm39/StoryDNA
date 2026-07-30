/**
 * Kevin Studio-only Military Expert V2 scene-centric feature flag.
 * Default off; never enabled in production.
 */

import { isStudioFeatureEnabled } from "./feature-flag.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "./military-expert-local-policy.ts";

export const MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME =
  "MILITARY_EXPERT_V2_SCENE_CENTRIC" as const;

export function isMilitaryExpertV2SceneCentricEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioFeatureEnabled()) return false;
  const raw = process.env[MILITARY_EXPERT_V2_SCENE_CENTRIC_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/** V2 inventory/selection paths require both local Military Expert override and V2 flag. */
export function isMilitaryExpertV2AvailableInStudio(): boolean {
  return (
    isStudioMilitaryExpertLocalOverrideEnabled() && isMilitaryExpertV2SceneCentricEnabled()
  );
}
