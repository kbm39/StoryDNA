/**
 * Localhost/dev dry-run UI fence.
 * Production Node and Vercel production fail closed.
 * Does not enable live Archivist execution.
 */

export function isArchivistDryRunUiAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.STORYDNA_ENV === "production") return false;
  if (env.NODE_ENV === "production") return false;
  return true;
}
