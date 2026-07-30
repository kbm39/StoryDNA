/**
 * Phase 2B synthesis budget profile — Opus only when V2 flags enabled.
 */

import {
  estimateTokenCost,
  CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE,
} from "@/lib/expert-calibration/cost-analysis.ts";
import {
  ANTHROPIC_OPUS_48_ALIAS,
  ANTHROPIC_OPUS_48_MODEL_ID,
} from "@/lib/expert-calibration/live/provider-allowlist.ts";
import type { BudgetControllerLimits } from "@/lib/expert-calibration/live/budget-controller.ts";
import { isMilitaryExpertV2AvailableInStudio } from "../military-expert-v2-feature-flag.ts";
import { resolvePhase2ASceneReviewModelConfig } from "./scene-review-budget.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";

export const STUDIO_MILITARY_V2_SYNTHESIS_OPUS_BUDGET_USD = 25.0;

export const PHASE2B_SYNTHESIS_PROVIDER = "anthropic" as const;

export const PHASE2B_MAX_REPAIR_ATTEMPTS = 2;

export const PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS = 16384;

export const PHASE2B_SYNTHESIS_TIMEOUT_MS = 300_000;

const REPAIR_RESERVE_USD = 4.0;

export interface Phase2BSynthesisModelConfig {
  readonly model: string;
  readonly modelAlias: string;
  readonly pricingProfileId: string;
  readonly budgetLimitUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly repairReserveUsd: number;
}

export function resolvePhase2BSynthesisModelConfig(): Phase2BSynthesisModelConfig {
  if (isMilitaryExpertV2AvailableInStudio()) {
    const sceneConfig = resolvePhase2ASceneReviewModelConfig();
    return Object.freeze({
      model: sceneConfig.model,
      modelAlias: sceneConfig.modelAlias,
      pricingProfileId: sceneConfig.pricingProfileId,
      budgetLimitUsd: STUDIO_MILITARY_V2_SYNTHESIS_OPUS_BUDGET_USD,
      maxCostPerCallUsd: 12.0,
      repairReserveUsd: REPAIR_RESERVE_USD,
    });
  }
  return Object.freeze({
    model: ANTHROPIC_OPUS_48_MODEL_ID,
    modelAlias: ANTHROPIC_OPUS_48_ALIAS,
    pricingProfileId: CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE,
    budgetLimitUsd: 5.0,
    maxCostPerCallUsd: 2.0,
    repairReserveUsd: 0.5,
  });
}

export interface Phase2BSynthesisBudgetEstimate {
  readonly provider: typeof PHASE2B_SYNTHESIS_PROVIDER;
  readonly model: string;
  readonly modelAlias: string;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly estimatedSynthesisCostUsd: number;
  readonly repairReserveUsd: number;
  readonly totalReservationUsd: number;
  readonly maxCalls: number;
  readonly maxRepairCalls: number;
  readonly exceedsBudget: boolean;
  readonly budgetLimitUsd: number;
}

export function estimatePhase2BSynthesisBudget(
  input?: MilitaryExpertV2SynthesisInput,
): Phase2BSynthesisBudgetEstimate {
  const modelConfig = resolvePhase2BSynthesisModelConfig();
  const inputChars = input ? JSON.stringify(input).length : 40_000;
  const inputTokens = Math.ceil(inputChars / 4) + 500;
  const outputTokens = PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS;
  const synthesisCost = estimateTokenCost(
    inputTokens,
    outputTokens,
    modelConfig.pricingProfileId,
  );
  const total = synthesisCost + modelConfig.repairReserveUsd;
  const maxRepairCalls = PHASE2B_MAX_REPAIR_ATTEMPTS;

  return Object.freeze({
    provider: PHASE2B_SYNTHESIS_PROVIDER,
    model: modelConfig.model,
    modelAlias: modelConfig.modelAlias,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedSynthesisCostUsd: Math.round(synthesisCost * 100) / 100,
    repairReserveUsd: modelConfig.repairReserveUsd,
    totalReservationUsd: Math.round(total * 100) / 100,
    maxCalls: 1 + maxRepairCalls,
    maxRepairCalls,
    exceedsBudget: total > modelConfig.budgetLimitUsd,
    budgetLimitUsd: modelConfig.budgetLimitUsd,
  });
}

export function buildPhase2BSynthesisBudgetLimits(
  input?: MilitaryExpertV2SynthesisInput,
): BudgetControllerLimits {
  const modelConfig = resolvePhase2BSynthesisModelConfig();
  const estimate = estimatePhase2BSynthesisBudget(input);
  return Object.freeze({
    maxCalls: estimate.maxCalls,
    maxTotalCostUsd: modelConfig.budgetLimitUsd,
    maxCostPerCallUsd: modelConfig.maxCostPerCallUsd,
    runMaxInputTokens: estimate.estimatedInputTokens + 20_000,
    runMaxOutputTokens: estimate.estimatedOutputTokens + 10_000,
    providerMaxOutputTokensPerCall: PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS,
  });
}
