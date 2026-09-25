/**
 * Official historical six-case real-prose V2 breadth result.
 * Artifact: archivist_v2_real_reckoning_breadth_20260925_v1
 * Do not rewrite after seeing Haiku output. Do not recalculate with future code.
 * Does not embed manuscript prose or raw provider payloads.
 */

export const ARCHIVIST_V2_REAL_RECKONING_BREADTH_20260925_V1 =
  "archivist_v2_real_reckoning_breadth_20260925_v1" as const;

export const REAL_BREADTH_IMPLEMENTATION_SHA =
  "c55ffe2389cb457bfc806769872595e855ae061e" as const;

export const REAL_BREADTH_OFFICIAL_METRICS = {
  artifact: ARCHIVIST_V2_REAL_RECKONING_BREADTH_20260925_V1,
  session_id: "archivist-v2-real-reckoning-breadth-20260925-v1",
  implementation_sha: REAL_BREADTH_IMPLEMENTATION_SHA,
  manuscript_id: "9478ddf1-4564-4019-96a4-0d1852ee56f9",
  manuscript_version_id: "19ec5084-3426-4a91-a946-05895bb3e556",
  content_hash: "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
  expected: 13,
  retained: 36,
  true_positives: 6,
  recall: 0.462,
  precision: 0.167,
  evidence_accuracy: 1,
  fabricated_evidence: 0,
  hallucinated: 0,
  quarantined: 31,
  provider_calls: 6,
  repairs: 0,
  input_tokens: 16682,
  output_tokens: 17908,
  cost_usd: 0.106222,
  verdict: "MIXED GENERALIZATION",
  detection_sufficient_cases: 4,
  detection_denominator: 6,
  prior_real_prose_sufficient: 1,
  prior_real_prose_denominator: 3,
  combined_diagnostic_sufficient: 5,
  combined_diagnostic_denominator: 9,
  cases: {
    "R8-001": "INSUFFICIENT",
    "R8-007": "SUFFICIENT",
    "R8-012": "INSUFFICIENT",
    "R8-016": "SUFFICIENT",
    "R8-023": "SUFFICIENT",
    "R8-025": "SUFFICIENT",
  },
} as const;

export const REAL_BREADTH_OFFICIAL_CASES = [
  {
    benchmark_id: "R8-001",
    dimension: "CLOCK_TIME_CONTRADICTION",
    detection: "INSUFFICIENT",
    failure_category: "MODEL_EXTRACTION / OTHER",
    reason: "output verbosity → max_tokens → truncated invalid JSON",
    expected_key_ids: ["r8-001-ts-0210", "r8-001-ts-0214"],
    prose_sha256: "451932e1277213bd12b35e727bc69d9ec7e3807d9e7344b474b8128de4eaa4d0",
    chapters: ["CHAPTER TWELVE", "CHAPTER FIFTEEN"],
    word_count: 411,
    input_tokens: 2780,
    output_tokens: 4000,
    cost_usd: 0.02278,
    finish_reason: "max_tokens",
  },
  {
    benchmark_id: "R8-007",
    dimension: "OBJECT_POSSESSION",
    detection: "SUFFICIENT",
    failure_category: null,
    reason:
      "sufficient verified launch + Zodiac information retained; frozen object_equipment keys did not match emitted kinds; historical observation TP not rewritten",
    expected_key_ids: ["r8-007-obj-launch", "r8-007-obj-zodiac"],
    prose_sha256: "a1226a9ac5b966bb4d3f6590f27227a72f04af96d0bef9409be25a05b85b748f",
    chapters: ["CHAPTER TWENTY-SEVEN", "CHAPTER TWENTY-THREE"],
    word_count: 386,
    input_tokens: 2811,
    output_tokens: 2978,
    cost_usd: 0.017701,
    finish_reason: "end_turn",
  },
  {
    benchmark_id: "R8-012",
    dimension: "RELATIONSHIP_CONTINUITY",
    detection: "INSUFFICIENT",
    failure_category: "EVIDENCE",
    reason:
      "daughter relationship was emitted but its excerpt stitched noncontiguous text and was correctly quarantined; pregnancy side survived",
    expected_key_ids: ["r8-012-rel-daughter", "r8-012-rel-unborn"],
    prose_sha256: "446c2e7ed612e98a770bd26ed4056893bd0f86a72cc155243ecbec1fa7b65540",
    chapters: ["CHAPTER EIGHT", "CHAPTER TWENTY-FOUR"],
    word_count: 398,
    input_tokens: 2756,
    output_tokens: 2791,
    cost_usd: 0.016711,
    finish_reason: "end_turn",
  },
  {
    benchmark_id: "R8-016",
    dimension: "STATEMENT_VS_EVENT",
    detection: "SUFFICIENT",
    failure_category: null,
    reason: "both required sides retained",
    expected_key_ids: ["r8-016-st-galit", "r8-016-st-avi"],
    prose_sha256: "30cc7bcfadad1ea5140203a5e33250c522a2b029bc961728b43c24cdfb3daa3e",
    chapters: ["CHAPTER SIXTEEN", "CHAPTER FIFTEEN"],
    word_count: 392,
    input_tokens: 2785,
    output_tokens: 2450,
    cost_usd: 0.015035,
    finish_reason: "end_turn",
  },
  {
    benchmark_id: "R8-023",
    dimension: "IDENTITY_CONTINUITY",
    detection: "SUFFICIENT",
    failure_category: null,
    reason:
      "Cyrus/Ibrahim identity retained; contractor-at-office survived as an event rather than the frozen location_presence key; identities were not merged",
    expected_key_ids: ["r8-023-loc-contractor", "r8-023-id-ibrahim"],
    prose_sha256: "85e8ca6d9daaa03a5b526457bcf10fd7afe4747e9abba62721fe23f1091aa811",
    chapters: ["CHAPTER EIGHT", "CHAPTER FIFTEEN"],
    word_count: 398,
    input_tokens: 2774,
    output_tokens: 3238,
    cost_usd: 0.018964,
    finish_reason: "end_turn",
  },
  {
    benchmark_id: "R8-025",
    dimension: "TRAVEL_TIME_IMPOSSIBILITY",
    detection: "SUFFICIENT",
    failure_category: null,
    reason: "0447 Istanbul and 0517 Izmir retained; travel_leg was not required for official detection sufficiency",
    expected_key_ids: ["r8-025-ts-0447", "r8-025-ts-0517", "r8-025-tr-sikorsky"],
    prose_sha256: "66ff0b5ef7323d0b32ff56f39d32beade4978a7753bf6ec49061e27b2a24f0cc",
    chapters: ["CHAPTER TWENTY", "CHAPTER TWENTY-ONE"],
    word_count: 382,
    input_tokens: 2776,
    output_tokens: 2451,
    cost_usd: 0.015031,
    finish_reason: "end_turn",
  },
] as const;

export const REAL_BREADTH_PRIOR_REAL_PROSE = {
  session_id: "archivist-v2-real-reckoning-cal-20260925-v1",
  detection_sufficient_cases: 1,
  detection_denominator: 3,
  cases: {
    "R8-010": "INSUFFICIENT",
    "R8-011": "INSUFFICIENT",
    "R8-029": "SUFFICIENT",
  },
  verdict_unrewritten: "REAL-PROSE V2 NEEDS REMEDIATION",
} as const;
