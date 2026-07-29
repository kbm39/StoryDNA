import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT } from "@/experts/military-expert/definition.ts";
import {
  FIXTURE_CORRELATION_ID,
  FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
} from "@/experts/military-expert/generation-fixtures.ts";
import { classifyMilitaryExpertRepairNeed } from "@/experts/military-expert/repair-classification.ts";
import { MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING } from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums } from "@/experts/military-expert/enum-normalization.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import {
  ANTHROPIC_HAIKU_45_ALIAS,
  resolveProviderSpec,
} from "@/lib/expert-calibration/live/provider-allowlist.ts";
import {
  estimateContraryEvidenceRepairCostUsd,
  estimateContraryEvidenceRepairInputTokens,
  evaluateContraryEvidenceRepairAffordability,
} from "./military-expert-contrary-evidence-repair-budget.ts";
import { planMilitaryExpertContraryEvidenceRepair } from "./plan-military-expert-contrary-evidence-repair.ts";
import { STUDIO_MILITARY_BUDGET, STUDIO_MILITARY_BUDGET_LIMITS } from "./studio-military-expert-budget.ts";

const STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS =
  MILITARY_EXPERT.maxTokens + MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens;

function parsedRootFromRaw(responseText: string): unknown {
  const extraction = extractStrictModelJsonObject(responseText);
  return normalizeMilitaryExpertGenerationEnums(JSON.parse(extraction.jsonText) as unknown)
    .normalized;
}

function budgetAfterPrimary(inputTokens: number, outputTokens: number) {
  const providerSpec = resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS);
  const budget = createBudgetController(STUDIO_MILITARY_BUDGET_LIMITS);
  budget.recordCall(
    estimateTokenCost(inputTokens, outputTokens, providerSpec.pricingProfileId),
    inputTokens,
    outputTokens,
  );
  return { budget, providerSpec };
}

describe("Military Expert contrary-evidence repair budget gate", () => {
  it("1. primary input above 120k does not block repair via repair-specific gate", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });

    assert.equal(plan.action, "start_repair");
    assert.equal(
      budget.canAffordCall(
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxCostUsd,
        0,
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      ),
      false,
    );
  });

  it("2. repair uses its own input allowance not run input accumulation", () => {
    const { budget } = budgetAfterPrimary(150_000, 16_000);
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
    if (plan.action === "start_repair") {
      assert.ok(
        plan.estimatedRepairInputTokens <= MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxInputTokens,
      );
      assert.ok(plan.estimatedRepairInputTokens < 10_000);
    }
  });

  it("3. repair prompt does not resend manuscript content", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
    if (plan.action === "start_repair") {
      assert.doesNotMatch(plan.repairPrompt.userPrompt, /MANUSCRIPT TEXT/i);
      assert.match(plan.repairPrompt.userPrompt, /Affected finding context/);
      assert.doesNotMatch(plan.repairPrompt.userPrompt, /JSON to repair:/);
    }
  });

  it("4. MISSING_UNCERTAINTY_NOTE starts repair after >120k primary tokens", () => {
    const classification = classifyMilitaryExpertRepairNeed({
      raw: FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(classification.decision, "schema_repair_required");
    assert.equal(classification.contraryEvidenceFailureCode, "MISSING_UNCERTAINTY_NOTE");

    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
  });

  it("5. only one repair attempt is allowed", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: true,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "skip_repair");
    if (plan.action === "skip_repair") {
      assert.equal(plan.reason, "repair_already_attempted");
    }
  });

  it("6. repair remains within maxCalls when primary already consumed one call", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    assert.equal(budget.state().callsUsed, 1);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
    assert.equal(STUDIO_MILITARY_BUDGET.maxCalls, 2);
  });

  it("7. repair cost remains within per-call and total limits after large primary", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
    if (plan.action === "start_repair") {
      assert.ok(plan.estimatedRepairCostUsd <= MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxCostUsd);
      assert.ok(
        budget.state().totalCostMicroUsd / 1_000_000 + plan.estimatedRepairCostUsd <=
          STUDIO_MILITARY_BUDGET.maxTotalCostUsd,
      );
    }
  });

  it("8. repair output remains capped at 4096", () => {
    assert.equal(MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens, 4_096);
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    if (plan.action === "start_repair") {
      assert.equal(
        estimateContraryEvidenceRepairCostUsd(
          plan.estimatedRepairInputTokens,
          providerSpec.pricingProfileId,
        ),
        plan.estimatedRepairCostUsd,
      );
    }
  });

  it("9. cost exhaustion still blocks repair", () => {
    const budget = createBudgetController(STUDIO_MILITARY_BUDGET_LIMITS);
    budget.recordCall(STUDIO_MILITARY_BUDGET.maxTotalCostUsd, 0, 0);
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "skip_repair");
    if (plan.action === "skip_repair") {
      assert.equal(plan.reason, "cost_limit_exhausted");
    }
  });

  it("10. call-count exhaustion still blocks repair", () => {
    const budget = createBudgetController(STUDIO_MILITARY_BUDGET_LIMITS);
    budget.recordCall(0.01, 0, 0);
    budget.recordCall(0.01, 0, 0);
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "skip_repair");
    if (plan.action === "skip_repair") {
      assert.equal(plan.reason, "call_limit_exhausted");
    }
  });

  it("11. oversized repair input still blocks repair", () => {
    const result = evaluateContraryEvidenceRepairAffordability({
      budgetState: { callsUsed: 1, totalCostMicroUsd: 0, inputTokensUsed: 155_000, outputTokensUsed: 16_000 },
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      estimatedRepairCostUsd: 0.01,
      estimatedRepairInputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxInputTokens + 1,
      repairAlreadyAttempted: false,
      hasRepairPrompt: true,
      violationCount: 1,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "repair_input_limit_exceeded");
  });

  it("12. blocked repair emits skip payload with reason", () => {
    const budget = createBudgetController(STUDIO_MILITARY_BUDGET_LIMITS);
    budget.recordCall(STUDIO_MILITARY_BUDGET.maxTotalCostUsd, 155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "skip_repair");
    if (plan.action === "skip_repair") {
      assert.equal(plan.skipEvent.reason, "cost_limit_exhausted");
      assert.ok(Array.isArray(plan.skipEvent.finding_indexes));
      assert.deepEqual(plan.skipEvent.missing_field_names, ["uncertainty_note"]);
      assert.equal(plan.skipEvent.repair_output_token_ceiling, 4_096);
    }
  });

  it("13. no silent fall-through when repair is skipped", () => {
    const budget = createBudgetController(STUDIO_MILITARY_BUDGET_LIMITS);
    budget.recordCall(STUDIO_MILITARY_BUDGET.maxTotalCostUsd, 155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.notEqual(plan.action, "not_applicable");
    assert.notEqual(plan.action, "start_repair");
    assert.equal(plan.action, "skip_repair");
  });

  it("14. run output exhaustion blocks repair", () => {
    const result = evaluateContraryEvidenceRepairAffordability({
      budgetState: {
        callsUsed: 1,
        totalCostMicroUsd: 200_000,
        inputTokensUsed: 155_000,
        outputTokensUsed: STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS,
      },
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      estimatedRepairCostUsd: 0.01,
      estimatedRepairInputTokens: 500,
      repairAlreadyAttempted: false,
      hasRepairPrompt: true,
      violationCount: 1,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "repair_output_limit_exceeded");
  });

  it("15. no violations emits no_violations skip reason", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText),
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.notEqual(plan.action, "skip_repair");
    const emptyPlan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: { findings: [] },
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(emptyPlan.action, "skip_repair");
    if (emptyPlan.action === "skip_repair") {
      assert.equal(emptyPlan.reason, "no_violations");
    }
  });

  it("16. repair input estimate uses prompt size only", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY.responseText);
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: true,
    });
    assert.equal(plan.action, "start_repair");
    if (plan.action === "start_repair") {
      assert.equal(
        plan.estimatedRepairInputTokens,
        estimateContraryEvidenceRepairInputTokens(plan.repairPrompt),
      );
    }
  });

  it("17. not applicable when schema repair not required", () => {
    const { budget, providerSpec } = budgetAfterPrimary(155_000, 16_000);
    const plan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot: undefined,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: false,
      schemaRepairRequired: false,
    });
    assert.equal(plan.action, "not_applicable");
  });
});
