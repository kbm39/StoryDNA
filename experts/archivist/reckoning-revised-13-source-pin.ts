/**
 * Immutable source pin for the Hold Fast Book 1 REVISED-13 Archivist staging run.
 * Does not overwrite REVISED-11 or REVISED-11-2. Does not authorize public live.
 */

export const RECKONING_REVISED_13_SOURCE_PIN = {
  series_title: "Hold Fast",
  book_title: "The Reckoning",
  book_order: 1,
  source_filename: "HoldFast_BookOne_TheReckoning_REVISED-13.docx",
  source_docx_sha256: "23c8da397ef249920a419ac079da8c9549c6e6d37fbddbbb666de09a67ce599e",
  manuscript_id: "9478ddf1-4564-4019-96a4-0d1852ee56f9",
  manuscript_version_id: "19ec5084-3426-4a91-a946-05895bb3e556",
  version_number: 1,
  is_current: true,
  content_hash: "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
  analytical_word_count: 109887,
  extracted_character_count: 612176,
  source_byte_size: 282825,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  series_id: null,
  series_order: null,
  authorized_to_run: false,
} as const;

export interface ReckoningRevised13SourceIdentity {
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  content_hash: string;
  source_filename: string;
  source_docx_sha256: string;
  analytical_word_count: number;
  model: string;
}

export function assertReckoningRevised13SourcePin(
  actual: ReckoningRevised13SourceIdentity,
): void {
  const pin = RECKONING_REVISED_13_SOURCE_PIN;
  if (actual.manuscript_id !== pin.manuscript_id) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:manuscript_id");
  }
  if (actual.manuscript_version_id !== pin.manuscript_version_id) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:manuscript_version_id");
  }
  if (actual.version_number !== pin.version_number) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:version_number");
  }
  if (actual.content_hash !== pin.content_hash) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:content_hash");
  }
  if (actual.source_filename !== pin.source_filename) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:source_filename");
  }
  if (actual.source_docx_sha256 !== pin.source_docx_sha256) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:source_sha");
  }
  if (actual.analytical_word_count !== pin.analytical_word_count) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:analytical_word_count");
  }
  if (actual.model !== pin.model) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:model");
  }
  if (pin.authorized_to_run !== false) {
    throw new Error("RECKONING_REVISED_13_PIN_MISMATCH:authorized_to_run");
  }
}
