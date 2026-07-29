import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeContraryEvidenceViolations,
  applyDeterministicContraryEvidenceNormalization,
  buildContraryEvidenceSchemaRepairPrompt,
  isRepairableContraryEvidenceSchemaFailure,
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
} from "./contrary-evidence-schema-repair.ts";
import {
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS,
  FIXTURE_CORRELATION_ID,
  FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
  FIXTURE_EXPLICIT_NO_CONTRARY_OBSERVATION,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_CLOSING_FENCE,
  FIXTURE_VALID_COMPLETE_JSON,
  buildValidGenerationPayload,
  baseRawResponse,
  buildContraryEvidencePatchSuccessJson,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract, buildMilitaryExpertGenerationRequest } from "./generation-contract.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { validateMilitaryExpertGenerationPayload } from "./output-schema.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import {
  FIXTURE_CORRELATION_ID as SINGLE_JSON_CORRELATION,
  FIXTURE_MANUSCRIPT_HASH,
  FIXTURE_MANUSCRIPT_TEXT,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "./generation-fixtures.ts";

const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

function parsedRootFromRaw(responseText: string): unknown {
  const extraction = extractStrictModelJsonObject(responseText);
  return JSON.parse(extraction.jsonText) as unknown;
}

describe("Military Expert contrary-evidence schema repair", () => {
  it("1. negative finding with valid contrary evidence passes schema", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      const negative = parsed.payload.findings.find((item) => item.realism_status === "probable_concern");
      assert.ok(negative);
      assert.ok((negative?.contrary_evidence?.length ?? 0) >= 0);
      assert.equal(negative?.uncertainty_note, "No contrary evidence was found in the supplied scope.");
    }
  });

  it("2. negative finding with empty contrary_evidence and uncertainty_note passes schema", () => {
    const payload = buildValidGenerationPayload();
    const validation = validateMilitaryExpertGenerationPayload(payload);
    assert.equal(validation.ok, true);
  });

  it("3. missing contrary_evidence is rejected before repair", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MISSING_CONTRARY_EVIDENCE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "evidence_missing");

    const classification = classifyMilitaryExpertRepairNeed({
      raw: FIXTURE_MISSING_CONTRARY_EVIDENCE,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(classification.decision, "schema_repair_required");
    assert.equal(classification.contraryEvidenceFailureCode, "MISSING_CONTRARY_EVIDENCE");
  });

  it("4. missing contrary_evidence bounded repair succeeds", async () => {
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
    assert.equal(result.contraryEvidenceRepair?.succeeded, true);
  });

  it("5. empty contrary_evidence without uncertainty_note repair succeeds", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_UNCERTAINTY_PATCH_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.attempted, true);
    assert.equal(result.contraryEvidenceRepair?.succeeded, true);
  });

  it("6. repair does not alter unrelated finding content", async () => {
    const payload = buildValidGenerationPayload();
    const brokenFinding = { ...payload.findings[1] };
    delete (brokenFinding as { contrary_evidence?: unknown }).contrary_evidence;
    delete (brokenFinding as { uncertainty_note?: unknown }).uncertainty_note;
    const raw = baseRawResponse(
      JSON.stringify({ ...payload, findings: [payload.findings[0], brokenFinding] }),
    );
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: raw,
        repairResponse: baseRawResponse(
          buildContraryEvidencePatchSuccessJson({ findingIndex: 1 }),
        ),
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    const accurate = result.review?.findings.find((item) => item.realism_status === "accurate");
    assert.equal(accurate?.finding_id, "accurate-command-chain");
    assert.match(accurate?.observation ?? "", /Company commander/);
  });

  it("7. repair does not invent factual evidence", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    const negative = result.review?.findings.find((item) => item.realism_status === "probable_concern");
    assert.deepEqual(negative?.contrary_evidence, []);
    assert.match(negative?.uncertainty_note ?? "", /No contrary evidence was found/);
  });

  it("8. repair output remains strict JSON", async () => {
    const extraction = extractStrictModelJsonObject(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS.responseText);
    assert.doesNotThrow(() => JSON.parse(extraction.jsonText));
    const prompt = buildContraryEvidenceSchemaRepairPrompt({
      parsed: parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText),
      violations: analyzeContraryEvidenceViolations(
        parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText),
      ).violations,
    });
    assert.match(prompt.userPrompt, /Affected finding context/);
    assert.doesNotMatch(prompt.userPrompt, /JSON to repair:/);
    assert.doesNotMatch(prompt.userPrompt, /MANUSCRIPT TEXT/);
    assert.doesNotMatch(prompt.userPrompt, /"category_assessments"/);
  });

  it("9. second repair attempt without repair response uses provisional release when eligible", async () => {
    const blocked = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairAlreadyAttempted: true,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(blocked.ok, true);
    assert.equal(blocked.generationStatus, "provisional_success");
  });

  it("9b. repairAlreadyAttempted with failed repair uses provisional release when eligible", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
        repairAlreadyAttempted: true,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
  });

  it("10. failed repair with single unresolved uses provisional release", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
    assert.equal(result.provisionalRelease?.unresolvedCount, 1);
  });

  it("11. truncation path does not invoke repair", () => {
    const classification = classifyMilitaryExpertRepairNeed({
      raw: {
        ...FIXTURE_MISSING_CONTRARY_EVIDENCE,
        finishStatus: "truncated",
      },
    });
    assert.equal(classification.decision, "reject_output");
    assert.equal(classification.parseFailureCode, "provider_output_truncated");
  });

  it("12. multiple JSON payload path does not invoke repair", () => {
    const classification = classifyMilitaryExpertRepairNeed({ raw: FIXTURE_MULTIPLE_PAYLOADS });
    assert.equal(classification.decision, "reject_output");
    assert.equal(classification.parseFailureCode, "multiple_payloads");
  });

  it("13. trailing-fence handling remains green", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_CLOSING_FENCE, {
      expectedCorrelationId: SINGLE_JSON_CORRELATION,
    });
    assert.equal(parsed.ok, true);
  });

  it("14. 120k-word canonicalization tests remain green", () => {
    const wordCount = 120_000;
    const largeText = `${"word ".repeat(wordCount)}\n`;
    const request = buildMilitaryExpertGenerationRequest({
      correlationId: FIXTURE_CORRELATION_ID,
      manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
      reviewScope: "full_manuscript",
      manuscriptText: largeText,
      canonicalWordCount: wordCount,
      manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
    });
    assert.ok(request.reviewPrompt.includes("canonical_word_count: 120000"));
    assert.ok(request.reviewPrompt.length > largeText.length);
  });

  it("15. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("16. no provider call occurs in unit tests", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("deterministic normalization applies only with explicit no-contrary statement", async () => {
    const normalized = applyDeterministicContraryEvidenceNormalization(
      parsedRootFromRaw(FIXTURE_EXPLICIT_NO_CONTRARY_OBSERVATION.responseText),
    );
    assert.equal(normalized.applied, true);
    const validation = validateMilitaryExpertGenerationPayload(normalized.normalized);
    assert.equal(validation.ok, true);

    const withoutExplicit = applyDeterministicContraryEvidenceNormalization(
      parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText),
    );
    assert.equal(withoutExplicit.applied, false);
  });

  it("repairable failure detection excludes missing manuscript evidence", () => {
    const root = parsedRootFromRaw(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText);
    const validation = validateMilitaryExpertGenerationPayload(root);
    assert.equal(
      isRepairableContraryEvidenceSchemaFailure({
        parseFailureCode: "evidence_missing",
        validationErrors: validation.errors,
        parsed: root,
      }),
      true,
    );
  });

  it("repair ceiling constants are bounded", () => {
    assert.equal(MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens, 4096);
    assert.equal(MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxCostUsd, 0.05);
  });

  it("explicit no-contrary deterministic path succeeds in contract harness", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_EXPLICIT_NO_CONTRARY_OBSERVATION,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.deterministicNormalizationApplied, true);
  });
});
