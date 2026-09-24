/**
 * Frozen evidence inventory for failed paid smoke archivist-smoke-20260922-v2.
 * Official result: 0/3. Do not reinterpret as a pass. Do not reuse this session ID.
 */

export const ARCHIVIST_SMOKE_20260922_V2_SESSION_ID = "archivist-smoke-20260922-v2" as const;

export const ARCHIVIST_SMOKE_20260922_V2_EVIDENCE = {
  session_id: ARCHIVIST_SMOKE_20260922_V2_SESSION_ID,
  official_result: "0/3 failed certification",
  not_a_pass: true,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.026056,
  total_calls: 3,
  repair_calls: 0,
  extract_method: "fenced",
  cost_accounting: {
    complete: true,
    exactness: "exact",
    primary_and_repair_separated: true,
    tokens_persisted: true,
    runtime_persisted: true,
  },
  cases: [
    {
      id: "within_book_exact_contradiction",
      final_error_code: "validation_failed",
      extract_method: "fenced",
      parse_ok: true,
      haiku_detected_blue_green: true,
      both_side_evidence_in_raw: true,
      model_temporal_relation: "disjoint",
      confirmed_after_storydna: 0,
      validation_errors: [
        "canon_delta[0]: resolved entity requires entity_id",
        "canon_delta[1]: resolved entity requires entity_id",
      ],
    },
    {
      id: "explained_apparent_conflict",
      final_error_code: "validation_failed",
      extract_method: "fenced",
      parse_ok: true,
      confirmed_in_raw: false,
      dye_treated_as_explained: true,
      confirmed_after_storydna: 0,
      validation_errors: [
        "canon_delta: resolved entity requires entity_id",
        "ambiguous entity requires at least two candidates",
      ],
    },
    {
      id: "no_false_positive_control",
      final_error_code: "validation_failed",
      extract_method: "fenced",
      parse_ok: true,
      confirmed_in_raw: false,
      unnecessary_author_verification: true,
      confirmed_after_storydna: 0,
      validation_errors: [
        "entity_ambiguities[0]: ambiguous alias requires at least two candidate entities",
      ],
    },
  ],
  failure_moved_to: [
    "entity_resolution_validation",
    "temporal_disjoint_downgrade_of_persistent_eye_color",
  ],
} as const;
