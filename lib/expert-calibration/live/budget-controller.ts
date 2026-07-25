import type { LiveCalibrationBudgetSnapshot } from "./contracts.ts";
import { LIVE_CALIBRATION_MICRO_USD_SCALE } from "./constants.ts";
import type { LiveCalibrationTokenBudgetLimits } from "./token-budget.ts";

export interface BudgetControllerLimits {
  readonly maxCalls: number;
  readonly maxTotalCostUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly runMaxInputTokens: number;
  readonly runMaxOutputTokens: number;
  readonly providerMaxOutputTokensPerCall: number;
}

export interface BudgetControllerState {
  readonly callsUsed: number;
  readonly totalCostMicroUsd: number;
  readonly inputTokensUsed: number;
  readonly outputTokensUsed: number;
}

function usdToMicroUsd(usd: number): number {
  return Math.round(usd * LIVE_CALIBRATION_MICRO_USD_SCALE);
}

function microUsdToUsd(microUsd: number): number {
  return microUsd / LIVE_CALIBRATION_MICRO_USD_SCALE;
}

/** Deterministic USD normalization for JSON artifacts via micro-USD round-trip. */
export function serializeUsd(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return microUsdToUsd(usdToMicroUsd(usd));
}

export function sumSerializedUsd(amounts: readonly number[]): number {
  const totalMicro = amounts.reduce((sum, usd) => sum + usdToMicroUsd(usd), 0);
  return microUsdToUsd(totalMicro);
}

export function exceedsUsdLimit(amountUsd: number, limitUsd: number): boolean {
  return usdToMicroUsd(amountUsd) > usdToMicroUsd(limitUsd);
}

export function createBudgetControllerFromTokenLimits(input: {
  readonly maxCalls: number;
  readonly maxTotalCostUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly tokenLimits: LiveCalibrationTokenBudgetLimits;
}): ReturnType<typeof createBudgetController> {
  return createBudgetController({
    maxCalls: input.maxCalls,
    maxTotalCostUsd: input.maxTotalCostUsd,
    maxCostPerCallUsd: input.maxCostPerCallUsd,
    runMaxInputTokens: input.tokenLimits.runMaxInputTokens,
    runMaxOutputTokens: input.tokenLimits.runMaxOutputTokens,
    providerMaxOutputTokensPerCall: input.tokenLimits.providerMaxOutputTokensPerCall,
  });
}

export function createBudgetController(limits: BudgetControllerLimits): {
  state: () => BudgetControllerState;
  snapshot: () => LiveCalibrationBudgetSnapshot;
  canAffordCall: (
    authorizedWorstCaseCostUsd: number,
    authorizedInputTokens: number,
    authorizedOutputTokensForCall: number,
  ) => boolean;
  recordCall: (actualCostUsd: number, inputTokens: number, outputTokens: number) => void;
} {
  let callsUsed = 0;
  let totalCostMicroUsd = 0;
  let inputTokensUsed = 0;
  let outputTokensUsed = 0;

  const maxTotalCostMicroUsd = usdToMicroUsd(limits.maxTotalCostUsd);
  const maxCostPerCallMicroUsd = usdToMicroUsd(limits.maxCostPerCallUsd);

  function state(): BudgetControllerState {
    return { callsUsed, totalCostMicroUsd, inputTokensUsed, outputTokensUsed };
  }

  function snapshot(): LiveCalibrationBudgetSnapshot {
    const costRemainingMicroUsd = Math.max(0, maxTotalCostMicroUsd - totalCostMicroUsd);
    return {
      callsUsed,
      callsRemaining: Math.max(0, limits.maxCalls - callsUsed),
      totalCostMicroUsd,
      totalCostUsd: serializeUsd(microUsdToUsd(totalCostMicroUsd)),
      costRemainingMicroUsd,
      costRemainingUsd: serializeUsd(microUsdToUsd(costRemainingMicroUsd)),
      inputTokensUsed,
      outputTokensUsed,
      runMaxInputTokens: limits.runMaxInputTokens,
      runMaxOutputTokens: limits.runMaxOutputTokens,
      providerMaxOutputTokensPerCall: limits.providerMaxOutputTokensPerCall,
      budgetExhausted:
        callsUsed >= limits.maxCalls ||
        totalCostMicroUsd >= maxTotalCostMicroUsd ||
        inputTokensUsed >= limits.runMaxInputTokens ||
        outputTokensUsed >= limits.runMaxOutputTokens,
    };
  }

  function canAffordCall(
    authorizedWorstCaseCostUsd: number,
    authorizedInputTokens: number,
    authorizedOutputTokensForCall: number,
  ): boolean {
    if (callsUsed >= limits.maxCalls) return false;
    const authorizedMicro = usdToMicroUsd(authorizedWorstCaseCostUsd);
    if (authorizedMicro > maxCostPerCallMicroUsd) return false;
    if (totalCostMicroUsd + authorizedMicro > maxTotalCostMicroUsd) return false;
    if (inputTokensUsed + authorizedInputTokens > limits.runMaxInputTokens) return false;
    if (outputTokensUsed + authorizedOutputTokensForCall > limits.runMaxOutputTokens) return false;
    if (authorizedOutputTokensForCall > limits.providerMaxOutputTokensPerCall) return false;
    return true;
  }

  function recordCall(actualCostUsd: number, inputTokens: number, outputTokens: number): void {
    callsUsed += 1;
    totalCostMicroUsd += usdToMicroUsd(actualCostUsd);
    inputTokensUsed += inputTokens;
    outputTokensUsed += outputTokens;
  }

  return { state, snapshot, canAffordCall, recordCall };
}

export { usdToMicroUsd, microUsdToUsd };
