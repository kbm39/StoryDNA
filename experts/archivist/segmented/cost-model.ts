import {
  HAIKU_INPUT_USD_PER_MTOK,
  HAIKU_OUTPUT_USD_PER_MTOK,
  RECONCILIATION_MAX_BATCH_SIZE,
  SEGMENT_PROMPT_OVERHEAD_TOKENS,
  SEGMENT_REPAIR_ALLOWANCE,
} from "./constants.ts";
import type {
  ContradictionPair,
  FullNovelCoverageReport,
  SegmentPlan,
  SegmentedRunCostProjection,
} from "./types.ts";

function usdFromTokens(input: number, output: number): number {
  return (input / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK +
    (output / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK;
}

export function projectSegmentedRunCost(args: {
  plan: SegmentPlan;
  coverage: FullNovelCoverageReport;
  pairs?: readonly ContradictionPair[];
}): SegmentedRunCostProjection {
  const segmentOutputExpected = 2_500;
  const segmentOutputHigh = 4_000;
  const reconcileOutputExpected = 1_500;
  const pairCount = args.pairs?.length ?? 0;
  const reconciliationCalls = pairCount === 0 ? 0 : Math.ceil(pairCount / RECONCILIATION_MAX_BATCH_SIZE);
  const estimated_input_tokens = args.plan.segments.reduce(
    (sum, segment) => sum + segment.approximate_input_tokens,
    0,
  );
  const expected_segment_output_tokens = args.plan.segment_count * segmentOutputExpected;
  const expectedCalls = args.plan.segment_count + reconciliationCalls;
  const repairAllowance = args.plan.segment_count * SEGMENT_REPAIR_ALLOWANCE +
    (reconciliationCalls > 0 ? 1 : 0);

  const hypothetical_calls = [
    ...args.plan.segments.map((segment) => ({
      role: "segment_observation" as const,
      estimated_input_tokens: segment.approximate_input_tokens,
      estimated_output_tokens: segmentOutputExpected,
    })),
    ...Array.from({ length: reconciliationCalls }, () => ({
      role: "global_reconciliation" as const,
      estimated_input_tokens: 2_500,
      estimated_output_tokens: reconcileOutputExpected,
    })),
  ];

  const expected_usd = usdFromTokens(
    estimated_input_tokens + reconciliationCalls * 2_500,
    expected_segment_output_tokens + reconciliationCalls * reconcileOutputExpected,
  );
  const low_usd = usdFromTokens(
    Math.round(estimated_input_tokens * 0.85),
    Math.round(expected_segment_output_tokens * 0.7),
  );
  const high_usd = usdFromTokens(
    Math.round(estimated_input_tokens * 1.15) + repairAllowance * SEGMENT_PROMPT_OVERHEAD_TOKENS,
    args.plan.segment_count * segmentOutputHigh +
      reconciliationCalls * 2_400 +
      repairAllowance * 1_200,
  );

  return {
    segment_count: args.plan.segment_count,
    unique_manuscript_words: args.coverage.unique_words_covered,
    overlap_words: args.coverage.overlap_words,
    estimated_input_tokens,
    expected_segment_output_tokens,
    reconciliation_pair_count: pairCount,
    expected_reconciliation_calls: reconciliationCalls,
    repair_allowance: repairAllowance,
    expected_provider_calls: expectedCalls,
    low_usd: Number(low_usd.toFixed(4)),
    expected_usd: Number(expected_usd.toFixed(4)),
    high_usd: Number(high_usd.toFixed(4)),
    recommended_hard_ceiling_usd: Number((high_usd * 1.25).toFixed(4)),
    runtime_estimate_minutes: {
      low: Math.max(8, args.plan.segment_count * 1.5),
      expected: args.plan.segment_count * 3 + reconciliationCalls * 2,
      high: args.plan.segment_count * 5 + reconciliationCalls * 3 + 10,
    },
    hypothetical_calls,
  };
}
