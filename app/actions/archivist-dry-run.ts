"use server";

import { runArchivistDryRunForManuscript } from "@/lib/archivist-dry-run/run.ts";
import type { ArchivistDryRunUiResult } from "@/lib/archivist-dry-run/types.ts";

/**
 * Localhost Archivist dry-run only.
 * mode is hard-coded to dry_run; callers cannot request live execution.
 */
export async function runArchivistDryRunAction(
  manuscriptId: string,
  scenario?: string,
): Promise<ArchivistDryRunUiResult> {
  return runArchivistDryRunForManuscript({
    manuscriptId,
    scenario,
  });
}
