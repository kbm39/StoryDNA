/**
 * Staging persistence adapter for the pinned manuscript.
 * Tests inject a memory store instead.
 * Does not read Downloads. Does not call model providers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { RECKONING_REVISED_11_SOURCE_PIN } from "../reckoning-revised-11-source-pin.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { RECKONING_REVISED_13_SOURCE_PIN } from "../reckoning-revised-13-source-pin.ts";

function sourceDocxSha256ForManuscript(manuscriptId: string): string {
  if (manuscriptId === RECKONING_REVISED_13_SOURCE_PIN.manuscript_id) {
    return RECKONING_REVISED_13_SOURCE_PIN.source_docx_sha256;
  }
  if (manuscriptId === RECKONING_REVISED_11_2_SOURCE_PIN.manuscript_id) {
    return RECKONING_REVISED_11_2_SOURCE_PIN.source_docx_sha256;
  }
  if (manuscriptId === RECKONING_REVISED_11_SOURCE_PIN.manuscript_id) {
    return RECKONING_REVISED_11_SOURCE_PIN.source_docx_sha256;
  }
  return "";
}
import type { PinnedManuscriptSnapshot, PinnedManuscriptStore } from "./types.ts";

export function createStagingManuscriptStore(client: SupabaseClient): PinnedManuscriptStore {
  return {
    async loadPinnedVersion(args) {
      const supabase = client;
      const { data, error } = await supabase
        .from("manuscript_versions")
        .select(
          "id, manuscript_id, version_number, is_current, content_hash, source_filename, extracted_text, word_count, file_size",
        )
        .eq("id", args.manuscript_version_id)
        .eq("manuscript_id", args.manuscript_id)
        .eq("content_hash", args.content_hash)
        .maybeSingle();
      if (error || !data) return null;
      return {
        manuscript_id: data.manuscript_id,
        manuscript_version_id: data.id,
        version_number: data.version_number,
        is_current: data.is_current,
        content_hash: data.content_hash,
        source_filename: data.source_filename,
        source_docx_sha256: sourceDocxSha256ForManuscript(data.manuscript_id),
        analytical_word_count: data.word_count ?? 0,
        extracted_text: data.extracted_text ?? "",
      } satisfies PinnedManuscriptSnapshot;
    },
  };
}
