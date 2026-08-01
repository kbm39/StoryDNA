/** Private feature flag — safe for unit tests (no server-only). */

import { isStudioAuthorIntentEnabled } from "@/lib/author-intent/feature-flag.ts";
import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";

export const STUDIO_EDITORIAL_PROFILE_FLAG_NAME = "STUDIO_EDITORIAL_PROFILE_ENABLED" as const;

export function isStudioEditorialProfileFlagSet(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_EDITORIAL_PROFILE_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Master gate for editorial profile runtime.
 * Default off; dev-only; no commercial/specialist/sharing bypass.
 */
export function isStudioEditorialProfileEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isStudioEicEnabled()) return false;
  if (!isStudioAuthorIntentEnabled()) return false;
  return isStudioEditorialProfileFlagSet();
}

/** Profile synthesis requires all prerequisite flags — no bypass paths. */
export function isEditorialProfileSynthesisAllowed(): boolean {
  return isStudioEditorialProfileEnabled();
}

/** Profile does not grant specialist manuscript access at any flag state. */
export function editorialProfileGrantsSpecialistAccess(): boolean {
  return false;
}

/** Profile does not enable commercial expert certification. */
export function editorialProfileEnablesCommercialExperts(): boolean {
  return false;
}
