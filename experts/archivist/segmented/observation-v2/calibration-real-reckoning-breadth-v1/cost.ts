/**
 * $0 cost projection for a later six-call authorization.
 * Does not call a provider. Uses Haiku list prices and prior real-prose usage.
 */

import { estimateHaikuUsd } from "../../paid-pilot-cost.ts";
import { HAIKU_INPUT_USD_PER_MTOK, HAIKU_OUTPUT_USD_PER_MTOK } from "../../constants.ts";
import { estimateJsonTokens } from "../compactness.ts";
import { buildV2ObservationSystemPrompt, buildV2ObservationUserPrompt } from "../prompt.ts";
import { V2_REAL_BREADTH_CEILING_USD, V2_REAL_BREADTH_MAX_TOKENS } from "./lock.ts";

/** Measured first real-prose session: 3 calls, $0.048356, ~2750 in / ~2700 out. */
export const PRIOR_REAL_PROSE_MEAN_INPUT_TOKENS = 2759;
export const PRIOR_REAL_PROSE_MEAN_OUTPUT_TOKENS = 2672;
export const PRIOR_REAL_PROSE_MEAN_USD = 0.016119;

export function estimateBreadthCallUsd(args: {
  segmentId: string;
  segmentText: string;
  outputTokens?: number;
}): { input_tokens: number; output_tokens: number; estimated_usd: number } {
  const system = buildV2ObservationSystemPrompt();
  const user = buildV2ObservationUserPrompt({
    segmentId: args.segmentId,
    segmentText: args.segmentText,
  });
  const inputTokens = estimateJsonTokens(`${system}\n${user}`);
  const outputTokens = args.outputTokens ?? V2_REAL_BREADTH_MAX_TOKENS;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_usd: Number(estimateHaikuUsd(inputTokens, outputTokens).toFixed(6)),
  };
}

export function projectBreadthSessionCost(wordCounts: readonly number[]): {
  calls: number;
  expected_usd: number;
  max_usd: number;
  ceiling_usd: number;
  within_ceiling: boolean;
  input_usd_per_mtok: number;
  output_usd_per_mtok: number;
  note: string;
} {
  const expected = Number((PRIOR_REAL_PROSE_MEAN_USD * wordCounts.length).toFixed(6));
  const max = Number(
    (
      wordCounts.length *
      estimateHaikuUsd(PRIOR_REAL_PROSE_MEAN_INPUT_TOKENS + 800, V2_REAL_BREADTH_MAX_TOKENS)
    ).toFixed(6),
  );
  return {
    calls: wordCounts.length,
    expected_usd: expected,
    max_usd: max,
    ceiling_usd: V2_REAL_BREADTH_CEILING_USD,
    within_ceiling: max <= V2_REAL_BREADTH_CEILING_USD,
    input_usd_per_mtok: HAIKU_INPUT_USD_PER_MTOK,
    output_usd_per_mtok: HAIKU_OUTPUT_USD_PER_MTOK,
    note:
      "Expected uses the measured first real-prose mean. Max assumes prior-sized input plus 800 tokens and a full 4000-token completion on every call. Repairs remain 0.",
  };
}
