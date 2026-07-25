import type { LiveCalibrationBudgetSnapshot } from "./contracts.ts";
import { LIVE_CALIBRATION_MICRO_USD_SCALE } from "./constants.ts";

export interface BudgetControllerLimits {
  readonly maxCalls: number;
  readonly maxTotalCostUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
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

export function createBudgetController(limits: BudgetControllerLimits): {
  state: () => BudgetControllerState;
  snapshot: () => LiveCalibrationBudgetSnapshot;
  canAffordCall: (estimatedCostUsd: number, inputTokens: number, outputTokens: number) => boolean;
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
      totalCostUsd: microUsdToUsd(totalCostMicroUsd),
      costRemainingMicroUsd,
      costRemainingUsd: microUsdToUsd(costRemainingMicroUsd),
      inputTokensUsed,
      outputTokensUsed,
      budgetExhausted:
        callsUsed >= limits.maxCalls ||
        totalCostMicroUsd >= maxTotalCostMicroUsd ||
        inputTokensUsed >= limits.maxInputTokens ||
        outputTokensUsed >= limits.maxOutputTokens,
    };
  }

  function canAffordCall(
    estimatedCostUsd: number,
    inputTokens: number,
    outputTokens: number,
  ): boolean {
    if (callsUsed >= limits.maxCalls) return false;
    const estimatedMicro = usdToMicroUsd(estimatedCostUsd);
    if (estimatedMicro > maxCostPerCallMicroUsd) return false;
    if (totalCostMicroUsd + estimatedMicro > maxTotalCostMicroUsd) return false;
    if (inputTokensUsed + inputTokens > limits.maxInputTokens) return false;
    if (outputTokensUsed + outputTokens > limits.maxOutputTokens) return false;
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
