/** Private feature flag — safe for unit tests (no server-only). */

import { isStudioFeatureEnabled } from "@/lib/studio/feature-flag.ts";
import { isStudioAuthorIntentEnabled } from "@/lib/author-intent/feature-flag.ts";
import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";
import { isStudioEicConversationalIntakeEnabled } from "@/lib/author-manuscript-brief/feature-flag.ts";

export const STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME =
  "STUDIO_CONVERSATIONAL_INTELLIGENCE_ENABLED" as const;

export function isStudioConversationalIntelligenceFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_CONVERSATIONAL_INTELLIGENCE_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** All prerequisite flags must be on for conversational intelligence UX. */
export function isStudioConversationalIntelligenceEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioFeatureEnabled()) return false;
  if (!isStudioAuthorIntentEnabled()) return false;
  if (!isStudioEicEnabled()) return false;
  if (!isStudioEicConversationalIntakeEnabled()) return false;
  return isStudioConversationalIntelligenceFlagSet();
}
