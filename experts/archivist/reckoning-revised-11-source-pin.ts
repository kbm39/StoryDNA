/**
 * Immutable source pin for the Hold Fast Book 1 REVISED-11 Archivist staging pilot.
 * Does not authorize execution. A later run must refuse if identity drifts.
 */

export const RECKONING_REVISED_11_SOURCE_PIN = {
  series_title: "Hold Fast",
  book_title: "The Reckoning",
  book_order: 1,
  source_filename: "HoldFast_BookOne_TheReckoning_REVISED-11.docx",
  source_docx_sha256: "af22f99e7e15e596ba74a1c9687e53c40e7ce3235b4e4b648b8b41887b2c70fa",
  manuscript_id: "4bd68788-6e4e-415f-84f6-b63e87cc2f52",
  manuscript_version_id: "ad064381-b754-4669-8458-74f040d8bab3",
  version_number: 1,
  is_current: true,
  content_hash: "d901d178fa03e526d1f1248f313650b4455f2c9b21dded7904fc40d24714b503",
  analytical_word_count: 110156,
  extracted_character_count: 614002,
  source_byte_size: 285122,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  series_id: null,
  series_order: null,
  authorized_to_run: false,
} as const;

export interface ReckoningRevised11SourceIdentity {
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  content_hash: string;
  source_filename: string;
  source_docx_sha256: string;
  analytical_word_count: number;
  model: string;
}

export function assertReckoningRevised11SourcePin(
  actual: ReckoningRevised11SourceIdentity,
): void {
  const pin = RECKONING_REVISED_11_SOURCE_PIN;
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
