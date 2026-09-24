/**
 * Frozen evidence inventory for paid synthetic suite archivist-cert-20260924-v1.
 * Official result: 12/15 FAIL. Do not reinterpret as a pass.
 * Do not reuse this session ID.
 */

export const ARCHIVIST_CERT_20260924_V1_SESSION_ID = "archivist-cert-20260924-v1" as const;

export const ARCHIVIST_CERT_20260924_V1_EVIDENCE = {
  session_id: ARCHIVIST_CERT_20260924_V1_SESSION_ID,
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
  total_cost_usd: 0.110324,
  total_calls: 15,
  repair_calls: 0,
  extract_method: "fenced",
  official_passes: 12,
  official_failures: 3,
  failed_cases: [
    "injury_continuity",
    "knowledge_before_acquisition",
    "object_possession",
  ],
  failure_moved_to: [
    "injury_laterality_treated_as_compatible_change",
    "model_under_call_despite_incompatible_knowledge",
    "model_under_call_despite_unexplained_unique_object",
  ],
} as const;
