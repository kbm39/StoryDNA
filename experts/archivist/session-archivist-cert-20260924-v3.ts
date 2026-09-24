/**
 * Frozen evidence inventory for paid synthetic suite archivist-cert-20260924-v3.
 * Official result: 13/15 FAIL. Do not reinterpret as a pass after local replay.
 * Do not reuse this session ID.
 */

export const ARCHIVIST_CERT_20260924_V3_SESSION_ID = "archivist-cert-20260924-v3" as const;

export const ARCHIVIST_CERT_20260924_V3_EVIDENCE = {
  session_id: ARCHIVIST_CERT_20260924_V3_SESSION_ID,
  official_result: "13/15 FAIL",
  not_a_pass: true,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.110039,
  total_calls: 15,
  repair_calls: 0,
  extract_method: "fenced",
  official_passes: 13,
  official_failures: 2,
  raw_model_detection: "6/7",
  final_storydna_detection: "5/7",
  false_promotions: 0,
  false_downgrades: 0,
  failed_cases: ["timeline_contradiction", "relationship_history"],
  failure_moved_to: [
    "empty_proposed_fact_value_failed_optional_candidate_validation",
    "model_proposed_prior_volume_canon_on_reference_delta",
  ],
  validation_errors: {
    timeline_contradiction: "canon_delta[0]: proposed_fact_value is required",
    relationship_history: 'canon_delta[1]: model output may not propose authority "prior_volume_canon"',
  },
} as const;
