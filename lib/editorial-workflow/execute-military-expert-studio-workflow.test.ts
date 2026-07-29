import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  analyzeContraryEvidenceViolations,
  buildContraryEvidenceSchemaRepairPrompt,
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import { MILITARY_EXPERT } from "@/experts/military-expert/definition.ts";
import {
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_CORRELATION_ID,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_CLOSING_FENCE,
  FIXTURE_VALID_COMPLETE_JSON,
  baseRawResponse,
} from "@/experts/military-expert/generation-fixtures.ts";
import {
  buildMilitaryExpertGenerationRequest,
  runMilitaryExpertGenerationContract,
} from "@/experts/military-expert/generation-contract.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums } from "@/experts/military-expert/enum-normalization.ts";
import { classifyMilitaryExpertRepairNeed } from "@/experts/military-expert/repair-classification.ts";
import { parseMilitaryExpertGenerationResponse } from "@/experts/military-expert/parsing.ts";
import { militaryExpertStudioOutputBudgetBlock } from "@/experts/military-expert/studio-output-limits.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import {
  ANTHROPIC_HAIKU_45_ALIAS,
  resolveProviderSpec,
} from "@/lib/expert-calibration/live/provider-allowlist.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";

const WORKFLOW_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "execute-military-expert-studio-workflow.ts"),
  "utf8",
);
const STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS = MILITARY_EXPERT.maxTokens;
const STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS =
  MILITARY_EXPERT.maxTokens + MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens;

const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

function parsedRootFromRaw(responseText: string): unknown {
  const extraction = extractStrictModelJsonObject(responseText);
  return normalizeMilitaryExpertGenerationEnums(JSON.parse(extraction.jsonText) as unknown)
    .normalized;
}

/** Mirrors execute-military-expert-studio-workflow contrary-evidence repair wiring. */
function planContraryEvidenceRepair(parsedRoot: unknown | undefined) {
  const violationAnalysis = parsedRoot ? analyzeContraryEvidenceViolations(parsedRoot) : null;
  const violations = violationAnalysis?.violations ?? [];
  const repairPrompt =
    parsedRoot && violations.length > 0
      ? buildContraryEvidenceSchemaRepairPrompt({ parsed: parsedRoot, violations })
      : null;
  return { violationAnalysis, violations, repairPrompt };
}

describe("executeMilitaryExpertStudioWorkflow contrary-evidence repair wiring", () => {
  it("1. passes violations array to repair prompt builder", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const { violations, repairPrompt } = planContraryEvidenceRepair(parsedRoot);

    assert.ok(Array.isArray(violations));
    assert.ok(repairPrompt);
    assert.match(repairPrompt!.userPrompt, /findings\[\d+\]/);
    assert.doesNotThrow(() =>
      buildContraryEvidenceSchemaRepairPrompt({ parsed: parsedRoot, violations }),
    );
  });

  it("2. missing contrary evidence reaches repair path without throwing", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const classification = classifyMilitaryExpertRepairNeed({
      raw: FIXTURE_MISSING_CONTRARY_EVIDENCE,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });

    assert.equal(classification.decision, "schema_repair_required");

    const { violations, repairPrompt } = planContraryEvidenceRepair(parsedRoot);
    assert.ok(violations.length > 0);
    assert.ok(repairPrompt);
    assert.doesNotThrow(() => violations.map((item) => item.findingIndex));
  });

  it("3. empty violations does not invoke repair", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_VALID_COMPLETE_JSON.responseText);
    const { violations, repairPrompt } = planContraryEvidenceRepair(parsedRoot);

    assert.equal(violations.length, 0);
    assert.equal(repairPrompt, null);
  });

  it("4. analysis object cannot recur as violations.map target", () => {
    const parsedRoot = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const analysis = analyzeContraryEvidenceViolations(parsedRoot);

    assert.throws(
      () => buildContraryEvidenceSchemaRepairPrompt({ parsed: parsedRoot, violations: analysis as never }),
      /map is not a function|violations\.map/,
    );

    const { violations } = planContraryEvidenceRepair(parsedRoot);
    assert.doesNotThrow(() => violations.map((item) => item.findingIndex));
  });

  it("5. one repair attempt limit", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
        repairAlreadyAttempted: true,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    assert.equal(result.parseFailureCode, "CONTRARY_EVIDENCE_REPAIR_FAILED");
  });

  it("6. truncation path does not invoke repair", () => {
    const classification = classifyMilitaryExpertRepairNeed({
      raw: {
        ...FIXTURE_MISSING_CONTRARY_EVIDENCE,
        finishStatus: "truncated",
      },
    });
    assert.equal(classification.decision, "reject_output");
    assert.equal(classification.parseFailureCode, "provider_output_truncated");
  });

  it("7. multiple JSON payloads do not invoke repair", () => {
    const classification = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_MULTIPLE_PAYLOADS });
    assert.equal(classification.decision, "reject_output");
    assert.equal(classification.parseFailureCode, "multiple_payloads");
  });

  it("8. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("9. no provider calls in contract harness tests", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("repair wiring preserves trailing-fence parse path", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_CLOSING_FENCE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("successful contract repair path remains available to workflow", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.attempted, true);
  });
});

describe("executeMilitaryExpertStudioWorkflow output allowance", () => {
  it("10. workflow source derives provider allowance from MILITARY_EXPERT.maxTokens", () => {
    assert.equal(STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS, 16_000);
    assert.doesNotMatch(WORKFLOW_SRC, /8_?192/);
    assert.match(WORKFLOW_SRC, /MILITARY_EXPERT\.maxTokens/);
    assert.match(WORKFLOW_SRC, /maxOutputTokens: STUDIO_MILITARY_BUDGET\.providerMaxOutputTokens/);
  });

  it("11. generation request uses authoritative 16000 provider allowance", () => {
    const request = buildMilitaryExpertGenerationRequest({
      ...buildValidGenerationContractInput(),
      maxOutputTokens: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
      includeStudioOutputBudget: true,
    });
    assert.equal(request.maxOutputTokens, 16_000);
  });

  it("12. contractInput maxOutputTokens flows into parse diagnostics", async () => {
    const broken = buildValidGenerationJson().slice(0, -2);
    const raw = baseRawResponse(broken, FIXTURE_CORRELATION_ID, {
      finishStatus: "truncated",
      outputTokens: 15_900,
      inputTokens: 1_000,
    });
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        maxOutputTokens: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
        rawResponse: raw,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    assert.equal(result.parseFailureCode, "provider_output_truncated");
    assert.equal(result.parseDiagnostics?.maxOutputTokens, 16_000);
  });

  it("13. contract without explicit maxOutputTokens still reports 16000 diagnostics", async () => {
    const broken = '{"summary":"ok","findings":';
    const raw = baseRawResponse(broken, FIXTURE_CORRELATION_ID, {
      finishStatus: "truncated",
      outputTokens: 15_900,
      inputTokens: 1_000,
    });
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: raw,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
    assert.equal(result.parseDiagnostics?.maxOutputTokens, 16_000);
  });

  it("14. run output budget accommodates primary plus repair ceilings", () => {
    assert.equal(STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS, 20_096);
    const budget = createBudgetController({
      maxCalls: 2,
      maxTotalCostUsd: 0.3,
      maxCostPerCallUsd: 0.25,
      runMaxInputTokens: 120_000,
      runMaxOutputTokens: STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS,
      providerMaxOutputTokensPerCall: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
    });
    assert.equal(
      budget.canAffordCall(0.01, 0, STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS),
      true,
    );
    budget.recordCall(0.01, 0, STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS);
    assert.equal(
      budget.canAffordCall(
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxCostUsd,
        0,
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      ),
      true,
    );
  });

  it("15. cost budget allows 16k primary call plus repair ceiling", () => {
    const providerSpec = resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS);
    const primaryCost = estimateTokenCost(
      120_000,
      STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
      providerSpec.pricingProfileId,
    );
    const budget = createBudgetController({
      maxCalls: 2,
      maxTotalCostUsd: 0.3,
      maxCostPerCallUsd: 0.25,
      runMaxInputTokens: 120_000,
      runMaxOutputTokens: STUDIO_MILITARY_RUN_MAX_OUTPUT_TOKENS,
      providerMaxOutputTokensPerCall: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
    });
    assert.equal(primaryCost, 0.2);
    assert.equal(
      budget.canAffordCall(primaryCost, 120_000, STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS),
      true,
    );
    budget.recordCall(primaryCost, 120_000, STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS);
    assert.equal(
      budget.canAffordCall(
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxCostUsd,
        0,
        MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      ),
      true,
    );
  });

  it("16. truncation path still rejects output at 16000 allowance", () => {
    const broken = buildValidGenerationJson().slice(0, -2);
    const parsed = parseMilitaryExpertGenerationResponse(
      baseRawResponse(broken, FIXTURE_CORRELATION_ID, {
        finishStatus: "truncated",
        outputTokens: 15_900,
        inputTokens: 1_000,
      }),
      {
        expectedCorrelationId: FIXTURE_CORRELATION_ID,
        maxOutputTokens: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
      },
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "provider_output_truncated");
      assert.equal(parsed.diagnostics?.maxOutputTokens, 16_000);
    }
  });

  it("17. studio output budget prompt preserves report-length discipline", () => {
    const block = militaryExpertStudioOutputBudgetBlock();
    assert.match(block, /findings: at most 10 total/);
    assert.match(
      block,
      /Additional token capacity exists to ensure completion, not to increase findings or repeat information/,
    );
  });

  it("18. no provider calls in output allowance contract harness tests", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        maxOutputTokens: STUDIO_MILITARY_PROVIDER_MAX_OUTPUT_TOKENS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
    assert.equal(result.ok, true);
  });
});
