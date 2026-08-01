/** Private feature flag — safe for unit tests (no server-only). */

import { isStudioFeatureEnabled } from "@/lib/studio/feature-flag.ts";
import { isStudioAuthorIntentEnabled } from "@/lib/author-intent/feature-flag.ts";
import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";

export const STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME =
  "STUDIO_EIC_CONVERSATIONAL_INTAKE_ENABLED" as const;

export function isStudioEicConversationalIntakeFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_EIC_CONVERSATIONAL_INTAKE_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** All prerequisite flags must be on for conversational intake UI. */
export function isStudioEicConversationalIntakeEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioFeatureEnabled()) return false;
  if (!isStudioAuthorIntentEnabled()) return false;
  if (!isStudioEicEnabled()) return false;
  return isStudioEicConversationalIntakeFlagSet();
}
