/**
 * Frozen evidence inventory for paid synthetic suite archivist-cert-20260924-v4.
 * Official result: 15/15 PASS. Do not reuse this session ID.
 * Do not reinterpret earlier sessions using this result.
 */

export const ARCHIVIST_CERT_20260924_V4_SESSION_ID = "archivist-cert-20260924-v4" as const;

export const ARCHIVIST_CERT_20260924_V4_EVIDENCE = {
  session_id: ARCHIVIST_CERT_20260924_V4_SESSION_ID,
  official_result: "15/15 PASS",
  not_a_pass: false,
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  code_sha: "7a90ea6a7815948ce2d5e0f3351f66f3826b3a94",
  hold_fast_used: false,
  canon_written: false,
  live_model_certified_during_session: false,
  execution_wired: false,
  runtime_enabled: false,
  studio_selectable: false,
  total_cost_usd: 0.110109,
  total_calls: 15,
  repair_calls: 0,
  extract_method: "fenced",
  official_passes: 15,
  official_failures: 0,
  raw_model_detection: "5/7",
  raw_model_detection_rate: 0.714,
  final_storydna_detection: "7/7",
  final_storydna_detection_rate: 1,
  model_confirmed_findings: 5,
  final_confirmed_findings: 7,
  deterministic_promotions: 2,
  deterministic_downgrades: 0,
  unchanged_findings: 8,
  false_promotions: 0,
  false_downgrades: 0,
  structured_output_valid: "15/15",
  confirmed_evidence_compliance: 1,
  canon_writes: 0,
  promotions: [
    "knowledge_before_acquisition",
    "object_possession",
  ],
  official_case_results: {
    within_book_exact_contradiction: "PASS",
    explained_apparent_conflict: "PASS",
    series_age_contradiction: "PASS",
    timeline_contradiction: "PASS",
    injury_continuity: "PASS",
    knowledge_before_acquisition: "PASS",
    relationship_history: "PASS",
    object_possession: "PASS",
    alive_dead_temporal_control: "PASS",
    intentional_retcon: "PASS",
    ambiguous_alias: "PASS",
    uncertain_evidence: "PASS",
    no_false_positive_control: "PASS",
    accepted_canon_safety: "PASS",
    one_sided_confirmed_evidence: "PASS",
  },
} as const;
