import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeContraryEvidenceViolations,
  buildContraryEvidenceSchemaRepairPrompt,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import {
  buildValidGenerationContractInput,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_CORRELATION_ID,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_CLOSING_FENCE,
  FIXTURE_VALID_COMPLETE_JSON,
} from "@/experts/military-expert/generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "@/experts/military-expert/generation-contract.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums } from "@/experts/military-expert/enum-normalization.ts";
import { classifyMilitaryExpertRepairNeed } from "@/experts/military-expert/repair-classification.ts";
import { parseMilitaryExpertGenerationResponse } from "@/experts/military-expert/parsing.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";

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
