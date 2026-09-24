/**
 * Immutable source pin for the Hold Fast Book 1 REVISED-11-2 Archivist staging pilot.
 * This is the intended FUTURE paid-pilot source. Does not authorize execution.
 * Historical REVISED-11 remains in reckoning-revised-11-source-pin.ts.
 */

export const RECKONING_REVISED_11_2_SOURCE_PIN = {
  series_title: "Hold Fast",
  book_title: "The Reckoning",
  book_order: 1,
  source_filename: "HoldFast_BookOne_TheReckoning_REVISED-11-2.docx",
  source_docx_sha256: "78af9f7b62ff0aa1d4d3fb038ccdd9320a5beb50a5923cb4b9fb68f69daf8c6e",
  manuscript_id: "23def5e6-90b7-4305-a842-53637f959190",
  manuscript_version_id: "8e93109b-4572-43bf-88da-c8713d0da00f",
  version_number: 1,
  is_current: true,
  content_hash: "dbdd8284a54d236a481309a7bdd81fdd540b5eff7bafce54c117bc4d681631cd",
  analytical_word_count: 109907,
  extracted_character_count: 612429,
  source_byte_size: 284719,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  series_id: null,
  series_order: null,
  authorized_to_run: false,
} as const;

export interface ReckoningRevised112SourceIdentity {
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  content_hash: string;
  source_filename: string;
  source_docx_sha256: string;
  analytical_word_count: number;
  model: string;
}

export function assertReckoningRevised112SourcePin(
  actual: ReckoningRevised112SourceIdentity,
): void {
  const pin = RECKONING_REVISED_11_2_SOURCE_PIN;
  if (actual.manuscript_id !== pin.manuscript_id) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:manuscript_id");
  }
  if (actual.manuscript_version_id !== pin.manuscript_version_id) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:manuscript_version_id");
  }
  if (actual.version_number !== pin.version_number) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:version_number");
  }
  if (actual.content_hash !== pin.content_hash) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:content_hash");
  }
  if (actual.source_filename !== pin.source_filename) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:source_filename");
  }
  if (actual.source_docx_sha256 !== pin.source_docx_sha256) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:source_docx_sha256");
  }
  if (actual.analytical_word_count !== pin.analytical_word_count) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:analytical_word_count");
  }
  if (actual.model !== pin.model) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:model");
  }
  if (pin.authorized_to_run !== false) {
    throw new Error("RECKONING_PILOT_PIN_MISMATCH:authorized_to_run");
  }
}
