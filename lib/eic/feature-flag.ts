/** Private feature flag — safe for unit tests (no server-only). */

export const STUDIO_EIC_FLAG_NAME = "STUDIO_EIC_ENABLED" as const;

export function isStudioEicEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = process.env[STUDIO_EIC_FLAG_NAME]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Both flags must be on for the EIC plan gate to enforce intent requirements. */
export function isEicPlanGateActive(): boolean {
  // Lazy import avoided — callers may import both flags independently in tests.
  const authorIntentRaw = process.env.STUDIO_AUTHOR_INTENT_ENABLED?.trim().toLowerCase();
  const authorIntentOn =
    process.env.NODE_ENV !== "production" &&
    (authorIntentRaw === "1" || authorIntentRaw === "true" || authorIntentRaw === "yes");
  return authorIntentOn && isStudioEicEnabled();
}
