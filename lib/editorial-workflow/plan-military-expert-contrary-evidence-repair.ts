/**
 * Workflow-level contrary-evidence repair planning (testable without provider/DB).
 */

import {
  analyzeContraryEvidenceViolations,
  buildContraryEvidenceSchemaRepairPrompt,
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
  type ContraryEvidenceFindingViolation,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import type { BudgetControllerLimits, BudgetControllerState } from "@/lib/expert-calibration/live/budget-controller.ts";
import {
  buildContraryEvidenceRepairSkippedEventPayload,
  estimateContraryEvidenceRepairCostUsd,
  estimateContraryEvidenceRepairInputTokens,
  evaluateContraryEvidenceRepairAffordability,
  type ContraryEvidenceRepairSkipReason,
  type ContraryEvidenceRepairSkippedEventPayload,
} from "./military-expert-contrary-evidence-repair-budget.ts";

export interface PlanMilitaryExpertContraryEvidenceRepairArgs {
  parsedRoot: unknown | undefined;
  budgetState: BudgetControllerState;
  budgetLimits: BudgetControllerLimits;
  pricingProfileId: string;
  repairAlreadyAttempted: boolean;
  schemaRepairRequired: boolean;
}

export type MilitaryExpertContraryEvidenceRepairPlan =
  | {
      action: "start_repair";
      violations: readonly ContraryEvidenceFindingViolation[];
      repairPrompt: { systemPrompt: string; userPrompt: string };
      estimatedRepairInputTokens: number;
      estimatedRepairCostUsd: number;
    }
  | {
      action: "skip_repair";
      reason: ContraryEvidenceRepairSkipReason;
      violations: readonly ContraryEvidenceFindingViolation[];
      skipEvent: ContraryEvidenceRepairSkippedEventPayload;
    }
  | { action: "not_applicable" };

export function planMilitaryExpertContraryEvidenceRepair(
  args: PlanMilitaryExpertContraryEvidenceRepairArgs,
): MilitaryExpertContraryEvidenceRepairPlan {
  if (!args.schemaRepairRequired) {
    return { action: "not_applicable" };
  }

  const violationAnalysis = args.parsedRoot
    ? analyzeContraryEvidenceViolations(args.parsedRoot)
    : null;
  const violations = violationAnalysis?.violations ?? [];
  const repairPrompt =
    args.parsedRoot && violations.length > 0
      ? buildContraryEvidenceSchemaRepairPrompt({ parsed: args.parsedRoot, violations })
      : null;

  const estimatedRepairInputTokens = repairPrompt
    ? estimateContraryEvidenceRepairInputTokens(repairPrompt)
    : 0;
  const estimatedRepairCostUsd = repairPrompt
    ? estimateContraryEvidenceRepairCostUsd(
        estimatedRepairInputTokens,
        args.pricingProfileId,
      )
    : 0;

  const affordability = evaluateContraryEvidenceRepairAffordability({
    budgetState: args.budgetState,
    budgetLimits: args.budgetLimits,
    estimatedRepairCostUsd,
    estimatedRepairInputTokens,
    repairAlreadyAttempted: args.repairAlreadyAttempted,
    hasRepairPrompt: repairPrompt !== null,
    violationCount: violations.length,
  });

  if (affordability.allowed && repairPrompt) {
    return {
      action: "start_repair",
      violations,
      repairPrompt,
      estimatedRepairInputTokens,
      estimatedRepairCostUsd,
    };
  }

  const reason =
    affordability.reason ??
    (repairPrompt ? "cost_limit_exhausted" : violations.length === 0 ? "no_violations" : "no_repair_prompt");

  return {
    action: "skip_repair",
    reason,
    violations,
    skipEvent: buildContraryEvidenceRepairSkippedEventPayload({
      reason,
      violations,
      budgetState: args.budgetState,
      estimatedRepairCostUsd,
      estimatedRepairInputTokens,
      repairPreviouslyAttempted: args.repairAlreadyAttempted,
    }),
  };
}

export { MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING };
