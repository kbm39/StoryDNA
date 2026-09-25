/**
 * Isolated first small real-Reckoning V2 extraction calibration.
 * Session: archivist-v2-real-reckoning-cal-20260925-v1
 * Three Haiku calls on authorized REVISED-13 windows only.
 * Not a manuscript workflow. Not wired to the paid live path.
 * Does not rewrite synthetic v1/v2/v3 official results.
 */

export const V2_REAL_RECKONING_CAL_V1_SESSION_ID =
  "archivist-v2-real-reckoning-cal-20260925-v1" as const;
export const V2_REAL_RECKONING_CAL_V1_CONTRACT = "archivist_segment_observation@v2" as const;
export const V2_REAL_RECKONING_CAL_V1_PROMPT = "archivist_v2_extraction_prompt@v1" as const;
export const V2_REAL_RECKONING_CAL_V1_ADAPTER = "archivist_v2_compact_adapter@v1" as const;
export const V2_REAL_RECKONING_CAL_V1_BENCHMARK = "archivist_reckoning_rule8_benchmark@v1" as const;
export const V2_REAL_RECKONING_CAL_V1_PROVIDER = "anthropic" as const;
export const V2_REAL_RECKONING_CAL_V1_MODEL = "claude-haiku-4-5-20251001" as const;
export const V2_REAL_RECKONING_CAL_V1_MAX_PRIMARY_CALLS = 3;
export const V2_REAL_RECKONING_CAL_V1_MAX_REPAIR_CALLS = 0;
export const V2_REAL_RECKONING_CAL_V1_MAX_TOKENS = 4000;
export const V2_REAL_RECKONING_CAL_V1_CEILING_USD = 0.15;
export const V2_REAL_RECKONING_CAL_V1_STATUS = "experimental_candidate" as const;
export const V2_REAL_RECKONING_CAL_V1_WIRED_TO_PAID_PATH = false;
export const V2_REAL_RECKONING_CAL_V1_AUTHORIZED_TO_RUN = true;
export const V2_REAL_RECKONING_CAL_V1_MANUSCRIPT_ID = "9478ddf1-4564-4019-96a4-0d1852ee56f9" as const;
export const V2_REAL_RECKONING_CAL_V1_MANUSCRIPT_VERSION_ID =
  "19ec5084-3426-4a91-a946-05895bb3e556" as const;
export const V2_REAL_RECKONING_CAL_V1_CONTENT_HASH =
  "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f" as const;
export const V2_REAL_RECKONING_CAL_V1_BENCHMARK_IDS = ["R8-010", "R8-011", "R8-029"] as const;

export const V2_REAL_RECKONING_CAL_V1_SUCCESS_BAR = {
  fabricated_evidence: 0,
  evidence_accuracy: 1,
  repairs: 0,
  unsafe_authority: false,
  all_three_cases_sufficient: true,
  no_benchmark_leakage: true,
  require_certification: false,
} as const;
