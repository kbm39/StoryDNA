/**
 * Historical official scores locked by Phase 1. Do not recalculate or replace.
 */

import { RULE8_V1_FROZEN_BASELINE } from "../constants.ts";
import {
  REAL_BREADTH_IMPLEMENTATION_SHA,
  REAL_BREADTH_OFFICIAL_CASES,
  REAL_BREADTH_OFFICIAL_METRICS,
  REAL_BREADTH_PRIOR_REAL_PROSE,
} from "../calibration-real-reckoning-breadth-v1/official.ts";
import { REAL_RECKONING_OFFICIAL_METRICS } from "../calibration-real-reckoning-v1/replay.ts";

export const PHASE1_OFFICIAL_BREADTH = {
  detection_sufficient_cases: 4,
  detection_denominator: 6,
  verdict: "MIXED GENERALIZATION",
  cost_usd: 0.106222,
  provider_calls: 6,
  repairs: 0,
  input_tokens: 16682,
  output_tokens: 17908,
  r8007_true_positives: 0,
  implementation_sha: REAL_BREADTH_IMPLEMENTATION_SHA,
} as const;

export const PHASE1_OFFICIAL_PRIOR_REAL_PROSE = {
  detection_sufficient_cases: 1,
  detection_denominator: 3,
  verdict: "REAL-PROSE V2 NEEDS REMEDIATION",
  cost_usd: 0.048356,
  provider_calls: 3,
  true_positives: 3,
} as const;

export const PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC = {
  sufficient: 5,
  denominator: 9,
} as const;

export const PHASE1_OFFICIAL_SYNTHETIC = {
  v1_true_positives: 10,
  v1_retained: 15,
  v1_verdict_unrewritten: "NEEDS V2 PROMPT/ADAPTER FIX",
  v2_verdict: "C. INCONCLUSIVE",
  v2_cost_usd: 0.026646,
  v3_verdict: "V2/HAIKU NOT READY",
  v3_cost_usd: 0.028909,
  v3_true_positives: 16,
} as const;

export function assertHistoricalOfficialLocks(): {
  breadth: typeof REAL_BREADTH_OFFICIAL_METRICS;
  prior: typeof REAL_BREADTH_PRIOR_REAL_PROSE;
  rule8: typeof RULE8_V1_FROZEN_BASELINE;
} {
  return {
    breadth: REAL_BREADTH_OFFICIAL_METRICS,
    prior: REAL_BREADTH_PRIOR_REAL_PROSE,
    rule8: RULE8_V1_FROZEN_BASELINE,
  };
}

export function officialR8007TruePositives(): 0 {
  const row = REAL_BREADTH_OFFICIAL_CASES.find((item) => item.benchmark_id === "R8-007");
  if (!row) throw new Error("missing official R8-007 row");
  void row;
  return 0;
}

export function officialR8023IdentitiesUnmerged(): boolean {
  const row = REAL_BREADTH_OFFICIAL_CASES.find((item) => item.benchmark_id === "R8-023");
  return Boolean(row?.reason.includes("not merged"));
}

export { REAL_BREADTH_OFFICIAL_METRICS, REAL_RECKONING_OFFICIAL_METRICS, RULE8_V1_FROZEN_BASELINE };
