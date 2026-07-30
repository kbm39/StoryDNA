/**
 * Phase 2A scene review budget profile — separate from V1 and Phase 1 selection.
 */

import {
  estimateTokenCost,
  CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
  CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE,
} from "@/lib/expert-calibration/cost-analysis.ts";
import {
  ANTHROPIC_HAIKU_45_ALIAS,
  ANTHROPIC_OPUS_48_ALIAS,
  ANTHROPIC_OPUS_48_MODEL_ID,
} from "@/lib/expert-calibration/live/provider-allowlist.ts";
import type { BudgetControllerLimits } from "@/lib/expert-calibration/live/budget-controller.ts";
import { isMilitaryExpertV2AvailableInStudio } from "../military-expert-v2-feature-flag.ts";
import { estimateSceneReviewCost } from "./estimator.ts";
import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";

/** Haiku fallback budget for non-studio paths and tests without V2 flags. */
export const STUDIO_MILITARY_V2_SCENE_REVIEW_BUDGET_USD = 5.0;

/** Kevin Studio Phase 2A calibration budget — Opus, cost not optimized. */
export const STUDIO_MILITARY_V2_SCENE_REVIEW_OPUS_BUDGET_USD = 75.0;

export const PHASE2A_MAX_CONCURRENT_SCENES = 3;

export const PHASE2A_SCENE_REVIEW_HAIKU_MODEL = "claude-haiku-4-5-20251001" as const;

export const PHASE2A_SCENE_REVIEW_PROVIDER = "anthropic" as const;

const HAIKU_REPAIR_RESERVE_PER_SCENE_USD = 0.03;
const OPUS_REPAIR_RESERVE_PER_SCENE_USD = 0.75;
const MAX_REPAIR_ATTEMPTS_PER_SCENE = 1;
const SCENE_TIMEOUT_MS = 180_000;
const SCENE_MAX_OUTPUT_TOKENS = 4096;

export interface Phase2ASceneReviewModelConfig {
  readonly model: string;
  readonly modelAlias: string;
  readonly pricingProfileId: string;
  readonly budgetLimitUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly repairReservePerSceneUsd: number;
}

export function resolvePhase2ASceneReviewModelConfig(): Phase2ASceneReviewModelConfig {
  if (isMilitaryExpertV2AvailableInStudio()) {
    return Object.freeze({
      model: ANTHROPIC_OPUS_48_MODEL_ID,
      modelAlias: ANTHROPIC_OPUS_48_ALIAS,
      pricingProfileId: CALIBRATION_ANTHROPIC_OPUS_48_V1_PRICING_PROFILE,
      budgetLimitUsd: STUDIO_MILITARY_V2_SCENE_REVIEW_OPUS_BUDGET_USD,
      maxCostPerCallUsd: 8.0,
      repairReservePerSceneUsd: OPUS_REPAIR_RESERVE_PER_SCENE_USD,
    });
  }
  return Object.freeze({
    model: PHASE2A_SCENE_REVIEW_HAIKU_MODEL,
    modelAlias: ANTHROPIC_HAIKU_45_ALIAS,
    pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
    budgetLimitUsd: STUDIO_MILITARY_V2_SCENE_REVIEW_BUDGET_USD,
    maxCostPerCallUsd: 0.75,
    repairReservePerSceneUsd: HAIKU_REPAIR_RESERVE_PER_SCENE_USD,
  });
}

/** @deprecated Use resolvePhase2ASceneReviewModelConfig().model */
export const PHASE2A_SCENE_REVIEW_MODEL = PHASE2A_SCENE_REVIEW_HAIKU_MODEL;

export interface Phase2ASceneReviewBudgetEstimate {
  readonly provider: typeof PHASE2A_SCENE_REVIEW_PROVIDER;
  readonly model: string;
  readonly modelAlias: string;
  readonly selectedSceneCount: number;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly estimatedSceneCostUsd: number;
  readonly repairReserveUsd: number;
  readonly totalReservationUsd: number;
  readonly maxConcurrentScenes: number;
  readonly maxCalls: number;
  readonly maxRepairCalls: number;
  readonly estimatedRuntimeMinSeconds: number;
  readonly estimatedRuntimeMaxSeconds: number;
  readonly exceedsBudget: boolean;
  readonly budgetLimitUsd: number;
}

export function estimatePhase2ASceneReviewBudget(
  selectedSceneCount: number,
  scenes?: readonly MilitaryExpertSceneInventoryEntry[],
): Phase2ASceneReviewBudgetEstimate {
  const modelConfig = resolvePhase2ASceneReviewModelConfig();
  let inputTokens = 0;
  let outputTokens = 0;
  let sceneCost = 0;
  let runtimeSeconds = 0;

  if (scenes && scenes.length > 0) {
    for (const scene of scenes) {
      const est = estimateSceneReviewCost(scene, modelConfig.pricingProfileId);
      inputTokens += est.inputTokens;
      outputTokens += est.outputTokens;
      sceneCost += est.costUsd;
      runtimeSeconds += est.runtimeSeconds;
    }
  } else {
    inputTokens = selectedSceneCount * 2500;
    outputTokens = selectedSceneCount * SCENE_MAX_OUTPUT_TOKENS;
    sceneCost = estimateTokenCost(
      inputTokens,
      outputTokens,
      modelConfig.pricingProfileId,
    );
    runtimeSeconds = selectedSceneCount * 90;
  }

  const repairReserve = selectedSceneCount * modelConfig.repairReservePerSceneUsd;
  const total = sceneCost + repairReserve;
  const maxCalls = selectedSceneCount + selectedSceneCount * MAX_REPAIR_ATTEMPTS_PER_SCENE;

  return Object.freeze({
    provider: PHASE2A_SCENE_REVIEW_PROVIDER,
    model: modelConfig.model,
    modelAlias: modelConfig.modelAlias,
    selectedSceneCount,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedSceneCostUsd: Math.round(sceneCost * 100) / 100,
    repairReserveUsd: Math.round(repairReserve * 100) / 100,
    totalReservationUsd: Math.round(total * 100) / 100,
    maxConcurrentScenes: PHASE2A_MAX_CONCURRENT_SCENES,
    maxCalls,
    maxRepairCalls: selectedSceneCount * MAX_REPAIR_ATTEMPTS_PER_SCENE,
    estimatedRuntimeMinSeconds: Math.max(120, Math.round((runtimeSeconds / PHASE2A_MAX_CONCURRENT_SCENES) * 0.8)),
    estimatedRuntimeMaxSeconds: Math.round((runtimeSeconds / PHASE2A_MAX_CONCURRENT_SCENES) * 1.5) + 180,
    exceedsBudget: total > modelConfig.budgetLimitUsd,
    budgetLimitUsd: modelConfig.budgetLimitUsd,
  });
}

export function buildPhase2ASceneReviewBudgetLimits(
  selectedSceneCount: number,
): BudgetControllerLimits {
  const modelConfig = resolvePhase2ASceneReviewModelConfig();
  const estimate = estimatePhase2ASceneReviewBudget(selectedSceneCount);
  return Object.freeze({
    maxCalls: estimate.maxCalls,
    maxTotalCostUsd: modelConfig.budgetLimitUsd,
    maxCostPerCallUsd: modelConfig.maxCostPerCallUsd,
    runMaxInputTokens: estimate.estimatedInputTokens + 50_000,
    runMaxOutputTokens: estimate.estimatedOutputTokens + 20_000,
    providerMaxOutputTokensPerCall: SCENE_MAX_OUTPUT_TOKENS,
  });
}

export const PHASE2A_SCENE_TIMEOUT_MS = SCENE_TIMEOUT_MS;
export const PHASE2A_SCENE_MAX_OUTPUT_TOKENS = SCENE_MAX_OUTPUT_TOKENS;
export const PHASE2A_MAX_REPAIR_ATTEMPTS = MAX_REPAIR_ATTEMPTS_PER_SCENE;
