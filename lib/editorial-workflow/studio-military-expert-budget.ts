import { MILITARY_EXPERT } from "@/experts/military-expert/definition.ts";
import { MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING } from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import type { BudgetControllerLimits } from "@/lib/expert-calibration/live/budget-controller.ts";

export const STUDIO_MILITARY_BUDGET = Object.freeze({
  maxCalls: 2,
  maxTotalCostUsd: 0.3,
  maxCostPerCallUsd: 0.25,
  maxInputTokens: 120_000,
  maxOutputTokens:
    MILITARY_EXPERT.maxTokens + MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
  providerMaxOutputTokens: MILITARY_EXPERT.maxTokens,
  timeoutMs: 180_000,
});

export const STUDIO_MILITARY_BUDGET_LIMITS: BudgetControllerLimits = Object.freeze({
  maxCalls: STUDIO_MILITARY_BUDGET.maxCalls,
  maxTotalCostUsd: STUDIO_MILITARY_BUDGET.maxTotalCostUsd,
  maxCostPerCallUsd: STUDIO_MILITARY_BUDGET.maxCostPerCallUsd,
  runMaxInputTokens: STUDIO_MILITARY_BUDGET.maxInputTokens,
  runMaxOutputTokens: STUDIO_MILITARY_BUDGET.maxOutputTokens,
  providerMaxOutputTokensPerCall: STUDIO_MILITARY_BUDGET.providerMaxOutputTokens,
});
