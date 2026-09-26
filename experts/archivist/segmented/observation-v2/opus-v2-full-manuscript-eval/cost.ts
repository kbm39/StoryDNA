/**
 * Future Opus 5.5 cost projection and pre-call gate for the isolated eval.
 * Does not authorize spend. Rehearsal writes no paid ledger rows.
 */

import {
  OPUS_V2_EVAL_FUTURE_EXPECTED_USD,
  OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
  OPUS_V2_EVAL_FUTURE_HIGH_USD,
  OPUS_V2_EVAL_FUTURE_LOW_USD,
  OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
  OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
} from "./lock.ts";

export function projectOpusV2EvalCostBands() {
  return {
    input_usd_per_mtok: OPUS_V2_EVAL_INPUT_USD_PER_MTOK,
    output_usd_per_mtok: OPUS_V2_EVAL_OUTPUT_USD_PER_MTOK,
    cache: "off" as const,
    low_usd: OPUS_V2_EVAL_FUTURE_LOW_USD,
    expected_usd: OPUS_V2_EVAL_FUTURE_EXPECTED_USD,
    high_usd: OPUS_V2_EVAL_FUTURE_HIGH_USD,
    hard_ceiling_usd: OPUS_V2_EVAL_FUTURE_HARD_CEILING_USD,
    ceiling_authorized: false,
  };
}

export function nextCallFitsCeiling(args: {
  accrued_usd: number;
  next_call_high_usd: number;
  ceiling_usd: number;
}): boolean {
  return args.accrued_usd + args.next_call_high_usd <= args.ceiling_usd;
}

export function assertNextCallFitsCeiling(args: {
  accrued_usd: number;
  next_call_high_usd: number;
  ceiling_usd: number;
}): void {
  if (!nextCallFitsCeiling(args)) {
    throw new Error("opus_v2_eval_cost_gate_stop_before_call");
  }
}
