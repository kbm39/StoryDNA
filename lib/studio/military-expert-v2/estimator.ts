import { estimateTokenCost, CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "@/lib/expert-calibration/cost-analysis.ts";
import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";

export const MILITARY_EXPERT_V2_ESTIMATOR_VERSION = "military_expert_v2_estimator@v1" as const;

/** Separate from V1 STUDIO_MILITARY_BUDGET — V2 scene review requires higher ceiling. */
export const STUDIO_MILITARY_V2_SELECTION_BUDGET_USD = 5.0;

const INVENTORY_COST_USD = 0.0;
const SYNTHESIS_RESERVE_USD = 0.15;
const REPAIR_RESERVE_PER_SCENE_USD = 0.02;
const SCENE_BASE_INPUT_TOKENS = 1200;
const SCENE_BASE_OUTPUT_TOKENS = 800;
const TOKENS_PER_1000_CHARS = 250;

export interface SceneCostEstimate {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly runtimeSeconds: number;
}

export interface SelectionCostEstimate {
  readonly estimatorVersion: typeof MILITARY_EXPERT_V2_ESTIMATOR_VERSION;
  readonly inventoryCostUsd: number;
  readonly selectedSceneCostUsd: number;
  readonly synthesisReserveUsd: number;
  readonly repairReserveUsd: number;
  readonly totalCostUsd: number;
  readonly runtimeMinSeconds: number;
  readonly runtimeMaxSeconds: number;
  readonly exceedsBudget: boolean;
  readonly budgetLimitUsd: number;
}

function excerptLength(entry: MilitaryExpertSceneInventoryEntry): number {
  return Math.max(0, entry.locator.internal_end_offset - entry.locator.internal_start_offset);
}

export function estimateSceneReviewCost(
  entry: MilitaryExpertSceneInventoryEntry,
  pricingProfileId: string = CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
): SceneCostEstimate {
  const chars = excerptLength(entry);
  const inputTokens = SCENE_BASE_INPUT_TOKENS + Math.ceil((chars / 1000) * TOKENS_PER_1000_CHARS);
  const outputTokens =
    entry.priority_tier === "major"
      ? SCENE_BASE_OUTPUT_TOKENS + 400
      : SCENE_BASE_OUTPUT_TOKENS;
  const costUsd = estimateTokenCost(
    inputTokens,
    outputTokens,
    pricingProfileId,
  );
  const runtimeSeconds =
    entry.priority_tier === "major"
      ? 90 + Math.ceil(chars / 2000) * 30
      : 45 + Math.ceil(chars / 3000) * 20;

  return Object.freeze({
    inputTokens,
    outputTokens,
    costUsd: Math.round(costUsd * 100) / 100,
    runtimeSeconds,
  });
}

export function estimateSelectionTotals(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  selectedSceneIds: ReadonlySet<string>,
): SelectionCostEstimate {
  const selected = scenes.filter((s) => selectedSceneIds.has(s.scene_id));
  let selectedCost = 0;
  let runtimeSeconds = 0;
  for (const scene of selected) {
    const est = estimateSceneReviewCost(scene);
    selectedCost += est.costUsd;
    runtimeSeconds += est.runtimeSeconds;
  }
  const repairReserve = selected.length * REPAIR_RESERVE_PER_SCENE_USD;
  const total =
    INVENTORY_COST_USD + selectedCost + SYNTHESIS_RESERVE_USD + repairReserve;
  const roundedTotal = Math.round(total * 100) / 100;

  return Object.freeze({
    estimatorVersion: MILITARY_EXPERT_V2_ESTIMATOR_VERSION,
    inventoryCostUsd: INVENTORY_COST_USD,
    selectedSceneCostUsd: Math.round(selectedCost * 100) / 100,
    synthesisReserveUsd: SYNTHESIS_RESERVE_USD,
    repairReserveUsd: Math.round(repairReserve * 100) / 100,
    totalCostUsd: roundedTotal,
    runtimeMinSeconds: Math.max(60, Math.round(runtimeSeconds * 0.8)),
    runtimeMaxSeconds: Math.round(runtimeSeconds * 1.4) + 120,
    exceedsBudget: roundedTotal > STUDIO_MILITARY_V2_SELECTION_BUDGET_USD,
    budgetLimitUsd: STUDIO_MILITARY_V2_SELECTION_BUDGET_USD,
  });
}

export function formatEstimatedCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatEstimatedRuntime(minSeconds: number, maxSeconds: number): string {
  const minMin = Math.max(1, Math.round(minSeconds / 60));
  const maxMin = Math.max(minMin, Math.round(maxSeconds / 60));
  return `approximately ${minMin}–${maxMin} minutes`;
}

export const ESTIMATE_DISCLAIMER_COPY =
  "This is an estimate. Final usage may vary based on scene length and repair requirements.";

export const BUDGET_EXCEEDED_COPY = (limit: number) =>
  `Selection exceeds Studio budget (${formatEstimatedCost(limit)}). Deselect scenes to continue.`;
