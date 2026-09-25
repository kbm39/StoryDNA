/**
 * Frozen paid bake-off result.
 * Session: archivist-v2-model-bakeoff-20260925-v1
 * Do not recalculate or replace these numbers.
 */

export const V2_MODEL_BAKEOFF_HISTORICAL = {
  session_id: "archivist-v2-model-bakeoff-20260925-v1",
  haiku: {
    detection_sufficient: 0,
    required_correct: 5,
    required_total: 16,
    recall: 0.313,
    evidence_accuracy: 1,
    fabricated: 0,
    stitched: 0,
    critical_quarantines: 0,
    normal_parses: 4,
    prefix_recoveries: 0,
    max_tokens_hits: 0,
    cost_usd: 0.042334,
    synthetic_required_correct: 5,
    r8001_required_correct: 0,
    r8016_required_correct: 0,
    r8011_required_correct: 0,
  },
  opus: {
    detection_sufficient: 1,
    required_correct: 9,
    required_total: 16,
    recall: 0.563,
    evidence_accuracy: 1,
    fabricated: 0,
    stitched: 0,
    critical_quarantines: 0,
    normal_parses: 3,
    prefix_recoveries: 1,
    max_tokens_hits: 1,
    cost_usd: 0.326236,
    synthetic_required_correct: 6,
    r8001_required_correct: 0,
    r8016_required_correct: 2,
    r8011_required_correct: 1,
  },
  combined_cost_usd: 0.36857,
  provider_calls: 8,
  repairs: 0,
  retries: 0,
  verdict_unrewritten: "HYBRID CANDIDATE",
} as const;

/**
 * $0 saved-output replay diagnostic after timestamp/object recovery.
 * Not a paid historical result. Do not replace V2_MODEL_BAKEOFF_HISTORICAL.
 */
export const V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC = {
  haiku: {
    detection_sufficient: 2,
    required_correct: 10,
    required_total: 16,
    recall: 0.625,
    evidence_accuracy: 1,
    fabricated: 0,
    synthetic_required_correct: 8,
    r8001_required_correct: 2,
    r8016_required_correct: 0,
    r8011_required_correct: 0,
    r8011_cole_learned: false,
    r8011_cole_known_numi_numi: false,
  },
  opus: {
    detection_sufficient: 3,
    required_correct: 14,
    required_total: 16,
    recall: 0.875,
    evidence_accuracy: 1,
    fabricated: 0,
    synthetic_required_correct: 9,
    r8001_required_correct: 2,
    r8016_required_correct: 2,
    r8011_required_correct: 1,
    r8011_cole_learned: true,
    r8011_cole_known_numi_numi: false,
  },
  clocks_and_compass_confounds_removed: true,
  label: "replay_diagnostic_not_historical",
} as const;

/**
 * Evaluation hypothesis only. Not a runtime setting.
 * Do not wire into provider selection or the live Archivist model.
 */
export const STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS = "OPUS_FIRST" as const;
export const STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS_WIRED = false as const;
