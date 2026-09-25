/**
 * Phase 2 V2 extraction prompt lock.
 * Prompt-only. $0. Not authorized to run the future 3-call calibration.
 * Does not change schema, evidence gate, pairing, or official scores.
 */

import { V2_REMEDIATION_PHASE1_HELD_OUT_IDS } from "../remediation-phase-1/lock.ts";

export const V2_PHASE2_ID = "archivist-v2-phase2-prompt-20260925" as const;
export const V2_PHASE2_PROMPT_VERSION = "archivist_v2_extraction_prompt@v2" as const;
export const V2_PHASE2_SCHEMA = "archivist_segment_observation@v2" as const;
export const V2_PHASE2_STATUS = "experimental_candidate" as const;
export const V2_PHASE2_WIRED_TO_PAID_PATH = false;
export const V2_PHASE2_PROVIDER_CALLS = 0 as const;
export const V2_PHASE2_COST_USD = 0 as const;
export const V2_PHASE2_PROMPT_MAX_TOKENS = 4000 as const;
export const V2_PHASE2_FUTURE_CAL_AUTHORIZED_TO_RUN = false;
export const V2_PHASE2_FUTURE_CAL_MAX_PRIMARY_CALLS = 3 as const;
export const V2_PHASE2_FUTURE_CAL_MAX_REPAIR_CALLS = 0 as const;
export const V2_PHASE2_FUTURE_CAL_MODEL = "claude-haiku-4-5-20251001" as const;
export const V2_PHASE2_FUTURE_CAL_EXPECTED_USD_LOW = 0.045 as const;
export const V2_PHASE2_FUTURE_CAL_EXPECTED_USD_HIGH = 0.055 as const;
export const V2_PHASE2_FUTURE_CAL_MAX_USD = 0.071 as const;
export const V2_PHASE2_FUTURE_CAL_CEILING_USD = 0.1 as const;

export const V2_PHASE2_FUTURE_CAL_CALLS = [
  "synthetic_phase2_stress",
  "R8-001",
  "R8-016",
] as const;

export const V2_PHASE2_FUTURE_CAL_REGRESSION_ALTERNATE = "R8-029" as const;

export const V2_PHASE2_HELD_OUT_IDS = V2_REMEDIATION_PHASE1_HELD_OUT_IDS;

export const V2_PHASE2_SUCCESS_BAR = {
  no_max_tokens: true,
  json_parses_without_prefix_recovery: true,
  fabricated_evidence: 0,
  evidence_accuracy: 1,
  median_evidence_words_max: 20,
  no_evidence_over_40_words: true,
  synthetic_known_and_learned: true,
  used_capability_present: true,
  statement_plus_state_dual: true,
  unique_object_second_state: true,
  no_stitched_excerpts: true,
  consumed_window_output_tokens_max: 3200,
  unsafe_authority: false,
  canon_writes: false,
  held_out_unopened: true,
  historical_official_scores_locked: true,
  r8010_pass_is_not_a_criterion: true,
  r8011_pass_is_not_a_criterion: true,
} as const;
