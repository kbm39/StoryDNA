import "server-only";

import { CONTENT_HASH_PATTERN } from "@/experts/archivist/contracts.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { failArchivistDryRun } from "./fail.ts";
import type { ArchivistDryRunSnapshot, ArchivistDryRunUiFailure } from "./types.ts";

export async function loadArchivistDryRunSnapshot(
  manuscriptId: string,
): Promise<ArchivistDryRunSnapshot | ArchivistDryRunUiFailure> {
  const supabase = getSupabaseAdmin();
  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, current_version_id, series_id, series_order, word_count")
    .eq("id", manuscriptId)
    .maybeSingle();
  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) {
    return failArchivistDryRun("manuscript_not_found", "Manuscript not found.");
  }
  if (!manuscript.current_version_id) {
    return failArchivistDryRun(
      "version_not_found",
      "This manuscript has no current version to pin.",
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, content_hash, word_count")
    .eq("id", manuscript.current_version_id)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  if (!version) {
    return failArchivistDryRun(
      "version_not_found",
      "The current manuscript version could not be loaded.",
    );
  }
  if (version.manuscript_id !== manuscript.id) {
    return failArchivistDryRun(
      "version_mismatch",
      "The current version does not belong to this manuscript.",
    );
  }

  const contentHash = typeof version.content_hash === "string" ? version.content_hash.trim() : "";
  if (!CONTENT_HASH_PATTERN.test(contentHash)) {
    return failArchivistDryRun(
      "content_hash_missing",
      "This manuscript version has no valid content hash.",
    );
  }

  const wordCount =
    typeof version.word_count === "number" && Number.isFinite(version.word_count)
      ? version.word_count
      : typeof manuscript.word_count === "number" && Number.isFinite(manuscript.word_count)
        ? manuscript.word_count
        : null;
  if (wordCount == null) {
    return failArchivistDryRun(
      "word_count_missing",
      "Canonical analytical word count is missing for this manuscript.",
    );
  }

  return {
    title: manuscript.title || "Untitled manuscript",
    manuscript_id: manuscript.id,
    manuscript_version_id: version.id,
    version_number: typeof version.version_number === "number" ? version.version_number : null,
    content_hash: contentHash,
    analytical_word_count: wordCount,
    execution_mode: "dry_run",
    series_id: manuscript.series_id ?? null,
    series_order: manuscript.series_order ?? null,
  };
}
