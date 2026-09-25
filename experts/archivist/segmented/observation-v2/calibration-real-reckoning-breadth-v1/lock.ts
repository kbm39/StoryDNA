/**
 * Official six-case real-prose V2 breadth exam.
 * Session: archivist-v2-real-reckoning-breadth-20260925-v1
 * Official result is MIXED GENERALIZATION, 4/6. Do not rewrite it.
 * Does not authorize another provider call. Does not switch V2 live.
 */

export const V2_REAL_BREADTH_SESSION_ID =
  "archivist-v2-real-reckoning-breadth-20260925-v1" as const;
export const V2_REAL_BREADTH_CONTRACT = "archivist_segment_observation@v2" as const;
export const V2_REAL_BREADTH_PROMPT = "archivist_v2_extraction_prompt@v1" as const;
export const V2_REAL_BREADTH_ADAPTER = "archivist_v2_compact_adapter@v1" as const;
export const V2_REAL_BREADTH_RECOVERY = "archivist_v2_proposition_recovery@v1" as const;
export const V2_REAL_BREADTH_BENCHMARK = "archivist_reckoning_rule8_benchmark@v1" as const;
export const V2_REAL_BREADTH_PROVIDER = "anthropic" as const;
export const V2_REAL_BREADTH_MODEL = "claude-haiku-4-5-20251001" as const;
export const V2_REAL_BREADTH_MAX_PRIMARY_CALLS = 6;
export const V2_REAL_BREADTH_MAX_REPAIR_CALLS = 0;
export const V2_REAL_BREADTH_MAX_TOKENS = 4000;
/** Hard ceiling if a later authorization runs the six calls. Design-only until then. */
export const V2_REAL_BREADTH_CEILING_USD = 0.25;
export const V2_REAL_BREADTH_STATUS = "experimental_candidate" as const;
export const V2_REAL_BREADTH_WIRED_TO_PAID_PATH = false;
export const V2_REAL_BREADTH_AUTHORIZED_TO_RUN = false;
export const V2_REAL_BREADTH_DESIGN_ONLY = true;
export const V2_REAL_BREADTH_MANUSCRIPT_ID = "9478ddf1-4564-4019-96a4-0d1852ee56f9" as const;
export const V2_REAL_BREADTH_MANUSCRIPT_VERSION_ID =
  "19ec5084-3426-4a91-a946-05895bb3e556" as const;
export const V2_REAL_BREADTH_CONTENT_HASH =
  "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f" as const;
export const V2_REAL_BREADTH_BENCHMARK_IDS = [
  "R8-001",
  "R8-007",
  "R8-012",
  "R8-016",
  "R8-023",
  "R8-025",
] as const;
export const V2_REAL_BREADTH_EXCLUDED_PRIOR_IDS = ["R8-010", "R8-011", "R8-029"] as const;
export const V2_REAL_BREADTH_EXCLUDED_NEAR_DUPLICATES = [
  ["R8-004", "R8-027"],
  ["R8-014", "R8-018"],
] as const;

export const V2_REAL_BREADTH_SUCCESS_BAR = {
  fabricated_evidence: 0,
  evidence_accuracy: 1,
  repairs: 0,
  unsafe_authority: false,
  no_benchmark_leakage: true,
  require_certification: false,
  detection_sufficient_cases: 6,
} as const;
