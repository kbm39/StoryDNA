import { isArchivistDryRunUiAllowed } from "@/lib/archivist-dry-run/allow.ts";

/** Localhost/dev read-only candidate review. Production remains closed. */
export function isArchivistCandidateReviewUiAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isArchivistDryRunUiAllowed(env);
}
