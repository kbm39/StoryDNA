/**
 * Live calibration budget policy — derives authorized worst-case output bounds from pricing ceilings.
 */

import { estimateTokenCost } from "../cost-analysis.ts";
import { serializeUsd, sumSerializedUsd, exceedsUsdLimit } from "./budget-controller.ts";
import { LiveCalibrationError } from "./errors.ts";

export const LIVE_CALIBRATION_OUTPUT_TOKEN_POLICY_VERSION =
  "live_calibration_output_tokens@v1" as const;

/** Safety margin applied after ceiling-derived token math (basis points). */
export const LIVE_CALIBRATION_OUTPUT_TOKEN_SAFETY_BPS = 500 as const;

export interface DeriveAuthorizedOutputTokensInput {
  readonly maxCostPerCallUsd: number;
  readonly maxTotalCostUsd: number;
  readonly plannedCallCount: number;
  readonly plannedInputTokensPerCall: number;
  readonly pricingProfileId: string;
  readonly cliMaxOutputTokens: number;
}

export interface AuthorizedOutputTokenPolicy {
  readonly policyVersion: typeof LIVE_CALIBRATION_OUTPUT_TOKEN_POLICY_VERSION;
  readonly providerMaxOutputTokens: number;
  readonly authorizedOutputTokensPerCall: number;
  readonly authorizedWorstCaseCostUsd: number;
  readonly derivationNotes: readonly string[];
}

function applySafetyMargin(tokens: number): number {
  const reduced = Math.floor((tokens * (10_000 - LIVE_CALIBRATION_OUTPUT_TOKEN_SAFETY_BPS)) / 10_000);
  return Math.max(512, reduced);
}

/** Derive the maximum provider output tokens that fit per-call and run ceilings. */
export function deriveAuthorizedOutputTokenPolicy(
  input: DeriveAuthorizedOutputTokensInput,
): AuthorizedOutputTokenPolicy {
  const inputCostPerCall = serializeUsd(
    estimateTokenCost(input.plannedInputTokensPerCall, 0, input.pricingProfileId),
  );

  const outputBudgetFromCallCeiling = serializeUsd(
    Math.max(0, input.maxCostPerCallUsd - inputCostPerCall),
  );
  const outputBudgetFromRunCeiling = serializeUsd(
    Math.max(
      0,
      (input.maxTotalCostUsd - input.plannedCallCount * inputCostPerCall) / input.plannedCallCount,
    ),
  );
  const outputBudgetPerCallUsd = Math.min(outputBudgetFromCallCeiling, outputBudgetFromRunCeiling);

  const outputCostPerToken = serializeUsd(
    estimateTokenCost(0, 1000, input.pricingProfileId) / 1000,
  );
  const rawMaxOutputTokens =
    outputCostPerToken > 0
      ? Math.floor(outputBudgetPerCallUsd / outputCostPerToken)
      : input.cliMaxOutputTokens;

  const ceilingDerivedTokens = applySafetyMargin(rawMaxOutputTokens);
  const providerMaxOutputTokens = Math.min(input.cliMaxOutputTokens, ceilingDerivedTokens);

  const authorizedWorstCaseCostUsd = serializeUsd(
    estimateTokenCost(
      input.plannedInputTokensPerCall,
      providerMaxOutputTokens,
      input.pricingProfileId,
    ),
  );

  return Object.freeze({
    policyVersion: LIVE_CALIBRATION_OUTPUT_TOKEN_POLICY_VERSION,
    providerMaxOutputTokens,
    authorizedOutputTokensPerCall: providerMaxOutputTokens,
    authorizedWorstCaseCostUsd,
    derivationNotes: Object.freeze([
      `input_cost_per_call_usd=${inputCostPerCall}`,
      `output_budget_from_call_ceiling_usd=${outputBudgetFromCallCeiling}`,
      `output_budget_from_run_ceiling_usd=${outputBudgetFromRunCeiling}`,
      `safety_bps=${LIVE_CALIBRATION_OUTPUT_TOKEN_SAFETY_BPS}`,
    ]),
  });
}

export interface ValidateAuthorizedTokenPolicyInput {
  readonly policy: AuthorizedOutputTokenPolicy;
  readonly maxCostPerCallUsd: number;
  readonly maxTotalCostUsd: number;
  readonly plannedCallCount: number;
}

/** Fail closed when configured token bounds cannot fit authorized ceilings. */
export function validateAuthorizedTokenPolicy(input: ValidateAuthorizedTokenPolicyInput): void {
  if (input.policy.providerMaxOutputTokens < 512) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      "Authorized provider max output tokens below minimum schema floor (512)",
    );
  }

  if (exceedsUsdLimit(input.policy.authorizedWorstCaseCostUsd, input.maxCostPerCallUsd)) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Authorized worst-case per call ($${input.policy.authorizedWorstCaseCostUsd.toFixed(4)}) exceeds --max-cost-per-call ($${input.maxCostPerCallUsd})`,
    );
  }

  const runWorstCase = sumSerializedUsd(
    Array.from({ length: input.plannedCallCount }, () => input.policy.authorizedWorstCaseCostUsd),
  );
  if (exceedsUsdLimit(runWorstCase, input.maxTotalCostUsd)) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Authorized ${input.plannedCallCount}-call worst case ($${runWorstCase.toFixed(4)}) exceeds --max-total-cost ($${input.maxTotalCostUsd})`,
    );
  }
}

export function computeAuthorizedWorstCaseCostUsd(
  inputTokens: number,
  outputTokens: number,
  pricingProfileId: string,
): number {
  return serializeUsd(estimateTokenCost(inputTokens, outputTokens, pricingProfileId));
}
