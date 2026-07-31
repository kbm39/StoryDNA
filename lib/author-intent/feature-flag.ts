/** Private feature flag — safe for unit tests (no server-only). */

export const STUDIO_AUTHOR_INTENT_FLAG_NAME = "STUDIO_AUTHOR_INTENT_ENABLED" as const;

export function isStudioAuthorIntentEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_AUTHOR_INTENT_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
