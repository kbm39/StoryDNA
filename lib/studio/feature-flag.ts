/** Kevin Track feature flag — safe for unit tests (no server-only). */

export function isStudioFeatureEnabled(): boolean {
  const raw = process.env.STUDIO_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return true;
}
