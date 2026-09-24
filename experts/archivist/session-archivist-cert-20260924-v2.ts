/**
 * Frozen evidence inventory for paid synthetic suite archivist-cert-20260924-v2.
 * Official result: 12/15 FAIL. Do not reinterpret as a pass.
 * Do not reuse this session ID.
 */

export const ARCHIVIST_CERT_20260924_V2_SESSION_ID = "archivist-cert-20260924-v2" as const;

export const ARCHIVIST_CERT_20260924_V2_EVIDENCE = {
  session_id: ARCHIVIST_CERT_20260924_V2_SESSION_ID,
  official_result: "12/15 FAIL",
  not_a_pass: true,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.12922,
  total_calls: 17,
  repair_calls: 2,
  extract_method: "fenced",
  official_passes: 12,
  official_failures: 3,
  raw_model_detection: "6/7",
  final_storydna_detection: "4/7",
  false_promotions: 0,
  false_downgrades: 1,
  failed_cases: [
    "injury_continuity",
    "object_possession",
    "relationship_history",
  ],
  failure_moved_to: [
    "negated_second_injury_treated_as_transition",
    "hypothetical_or_negated_lost_treated_as_transfer",
    "prior_event_reference_used_as_canon_delta_fact_type",
  ],
  validation_error:
    'canon_delta[0]: unsupported fact type "prior_event_reference"',
} as const;
