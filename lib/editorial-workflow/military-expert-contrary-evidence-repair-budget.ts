/**
 * Repair-specific budget gate for Military Expert contrary-evidence schema repair.
 * Primary full-manuscript input usage must not block the bounded JSON-only repair call.
 */

import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import {
  type BudgetControllerLimits,
  type BudgetControllerState,
  serializeUsd,
  usdToMicroUsd,
  microUsdToUsd,
} from "@/lib/expert-calibration/live/budget-controller.ts";
import {
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
  type ContraryEvidenceFindingViolation,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";

export type ContraryEvidenceRepairSkipReason =
  | "no_repair_prompt"
  | "no_violations"
  | "call_limit_exhausted"
  | "cost_limit_exhausted"
  | "repair_input_limit_exceeded"
  | "repair_output_limit_exceeded"
  | "repair_already_attempted";

export interface ContraryEvidenceRepairSkippedEventPayload {
  reason: ContraryEvidenceRepairSkipReason;
  finding_indexes: number[];
  missing_field_names: string[];
  calls_used: number;
  total_cost_usd: number;
  repair_estimated_cost_usd: number;
  repair_input_token_estimate: number;
  repair_output_token_ceiling: number;
  repair_previously_attempted: boolean;
}

export interface EvaluateContraryEvidenceRepairAffordabilityArgs {
  budgetState: BudgetControllerState;
  budgetLimits: BudgetControllerLimits;
  repairCeiling?: typeof MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING;
  estimatedRepairCostUsd: number;
  estimatedRepairInputTokens: number;
  repairAlreadyAttempted: boolean;
  hasRepairPrompt: boolean;
  violationCount: number;
}

/** Conservative token estimate for JSON-only repair prompts (chars / 4). */
export function estimateContraryEvidenceRepairInputTokens(repairPrompt: {
  systemPrompt: string;
  userPrompt: string;
}): number {
  const chars = repairPrompt.systemPrompt.length + repairPrompt.userPrompt.length;
  return Math.max(1, Math.ceil(chars / 4));
}

export function estimateContraryEvidenceRepairCostUsd(
  estimatedRepairInputTokens: number,
  pricingProfileId: string,
): number {
  return estimateTokenCost(
    estimatedRepairInputTokens,
    MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    pricingProfileId,
  );
}

/**
 * Affordability check for the single bounded repair call.
 * Does not block repair because primary input exceeded the run input ceiling.
 */
export function evaluateContraryEvidenceRepairAffordability(
  args: EvaluateContraryEvidenceRepairAffordabilityArgs,
): { allowed: boolean; reason: ContraryEvidenceRepairSkipReason | null } {
  const ceiling = args.repairCeiling ?? MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING;

  if (args.repairAlreadyAttempted) {
    return { allowed: false, reason: "repair_already_attempted" };
  }
  if (args.violationCount === 0) {
    return { allowed: false, reason: "no_violations" };
  }
  if (!args.hasRepairPrompt) {
    return { allowed: false, reason: "no_repair_prompt" };
  }

  const { callsUsed, totalCostMicroUsd, outputTokensUsed } = args.budgetState;
  const limits = args.budgetLimits;

  if (callsUsed >= limits.maxCalls) {
    return { allowed: false, reason: "call_limit_exhausted" };
  }

  const repairCostMicro = usdToMicroUsd(args.estimatedRepairCostUsd);
  const maxCostPerCallMicro = usdToMicroUsd(limits.maxCostPerCallUsd);
  const maxTotalCostMicro = usdToMicroUsd(limits.maxTotalCostUsd);

  if (repairCostMicro > maxCostPerCallMicro) {
    return { allowed: false, reason: "cost_limit_exhausted" };
  }
  if (totalCostMicroUsd + repairCostMicro > maxTotalCostMicro) {
    return { allowed: false, reason: "cost_limit_exhausted" };
  }

  if (args.estimatedRepairInputTokens > ceiling.maxInputTokens) {
    return { allowed: false, reason: "repair_input_limit_exceeded" };
  }

  if (outputTokensUsed + ceiling.maxOutputTokens > limits.runMaxOutputTokens) {
    return { allowed: false, reason: "repair_output_limit_exceeded" };
  }

  if (ceiling.maxOutputTokens > limits.providerMaxOutputTokensPerCall) {
    return { allowed: false, reason: "repair_output_limit_exceeded" };
  }

  return { allowed: true, reason: null };
}

export function buildContraryEvidenceRepairSkippedEventPayload(args: {
  reason: ContraryEvidenceRepairSkipReason;
  violations: readonly ContraryEvidenceFindingViolation[];
  budgetState: BudgetControllerState;
  estimatedRepairCostUsd: number;
  estimatedRepairInputTokens: number;
  repairOutputTokenCeiling?: number;
  repairPreviouslyAttempted: boolean;
}): ContraryEvidenceRepairSkippedEventPayload {
  const missingFieldNames = [
    ...new Set(args.violations.flatMap((item) => [...item.missingFields])),
  ];

  return {
    reason: args.reason,
    finding_indexes: args.violations.map((item) => item.findingIndex),
    missing_field_names: missingFieldNames,
    calls_used: args.budgetState.callsUsed,
    total_cost_usd: serializeUsd(microUsdToUsd(args.budgetState.totalCostMicroUsd)),
    repair_estimated_cost_usd: serializeUsd(args.estimatedRepairCostUsd),
    repair_input_token_estimate: args.estimatedRepairInputTokens,
    repair_output_token_ceiling:
      args.repairOutputTokenCeiling ?? MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    repair_previously_attempted: args.repairPreviouslyAttempted,
  };
}
