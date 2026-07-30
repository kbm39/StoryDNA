import type { CalibrationCaseResult, CostMetrics } from "./contracts.ts";
import { safeDivide } from "./metrics.ts";
import { roundRate } from "./scoring.ts";

/** Default synthetic pricing profile — zero cost in test/replay mode. */
export const CALIBRATION_SYNTHETIC_PRICING_PROFILE = "calibration_synthetic_v1" as const;

/** Historical Haiku 3.5 pricing — replay of prior artifacts only. */
export const CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE =
  "calibration_anthropic_haiku_v1" as const;

/** Active Haiku 4.5 pricing — $1/M input, $5/M output. */
export const CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE =
  "calibration_anthropic_haiku_4_5_v1" as const;

/** Active Opus 4.8 pricing — $15/M input, $75/M output. */
export const CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE =
  "calibration_anthropic_opus_4_8_v1" as const;

const PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  [CALIBRATION_SYNTHETIC_PRICING_PROFILE]: { inputPer1k: 0, outputPer1k: 0 },
  [CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE]: { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  [CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE]: { inputPer1k: 0.001, outputPer1k: 0.005 },
  [CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE]: { inputPer1k: 0.015, outputPer1k: 0.075 },
};

const LIVE_ELIGIBLE_PRICING_PROFILES = new Set<string>([
  CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
  CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE,
]);

export function isHistoricalPricingProfile(pricingProfileId: string): boolean {
  return pricingProfileId === CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE;
}

export function isLiveEligiblePricingProfile(pricingProfileId: string): boolean {
  return LIVE_ELIGIBLE_PRICING_PROFILES.has(pricingProfileId);
}

export function estimateTokenCost(
  inputTokens: number,
  outputTokens: number,
  pricingProfileId: string,
): number {
  const profile = PRICING[pricingProfileId] ?? PRICING[CALIBRATION_SYNTHETIC_PRICING_PROFILE]!;
  const cost =
    (inputTokens / 1000) * profile.inputPer1k + (outputTokens / 1000) * profile.outputPer1k;
  return roundRate(Number.isFinite(cost) ? cost : 0);
}

export function computeCostMetrics(
  caseResults: readonly CalibrationCaseResult[],
  pricingProfileId: string = CALIBRATION_SYNTHETIC_PRICING_PROFILE,
): CostMetrics {
  const total_input_tokens = caseResults.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const total_output_tokens = caseResults.reduce((s, r) => s + (r.output_tokens ?? 0), 0);
  const total_tokens = total_input_tokens + total_output_tokens;
  const estimated_cost_usd = estimateTokenCost(
    total_input_tokens,
    total_output_tokens,
    pricingProfileId,
  );

  return {
    total_input_tokens,
    total_output_tokens,
    total_tokens,
    estimated_cost_usd,
    cost_per_case_mean: safeDivide(estimated_cost_usd, caseResults.length),
    pricing_profile_id: pricingProfileId,
  };
}
