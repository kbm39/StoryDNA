import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildContraryEvidenceRepairProviderDiagnostics,
  MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING,
  normalizeRepairResponseForContract,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import {
  baseRawResponse,
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_FAILED,
  FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
  FIXTURE_CORRELATION_ID,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
} from "@/experts/military-expert/generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "@/experts/military-expert/generation-contract.ts";
import { parseMilitaryExpertGenerationResponse } from "@/experts/military-expert/parsing.ts";

const WORKFLOW_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "execute-military-expert-studio-workflow.ts"),
  "utf8",
);

const REPAIR_CALL_CORRELATION_ID = `${FIXTURE_CORRELATION_ID}-repair`;

function repairResponseWithSuffix(
  fixture: typeof FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
): ReturnType<typeof baseRawResponse> {
  return baseRawResponse(fixture.responseText, REPAIR_CALL_CORRELATION_ID, {
    finishStatus: fixture.finishStatus,
    inputTokens: 900,
    outputTokens: 1_200,
  });
}

describe("Military Expert repair response handoff", () => {
  it("1. first repair response is parsed when repairAlreadyAttempted is true with repairResponse", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
        repairAlreadyAttempted: true,
        repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.contraryEvidenceRepair?.succeeded, true);
    assert.equal(result.contraryEvidenceRepair?.eventPayload?.repair_mode, "patch_only");
    assert.equal(result.contraryEvidenceRepair?.eventPayload?.repair_parse_result, "ok");
  });

  it("2. repairAlreadyAttempted true without repairResponse uses provisional release when eligible", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairAlreadyAttempted: true,
        repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "provisional_success");
  });

  it("3. valid repaired report passes contract", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
  });

  it("4. invalid repaired report uses provisional release when eligible", async () => {
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
    assert.equal(result.provisionalRelease?.used, true);
  });

  it("5. correlation id -repair suffix is normalized and accepted", async () => {
    const repairWithSuffix = repairResponseWithSuffix(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS);
    const normalized = normalizeRepairResponseForContract(repairWithSuffix, FIXTURE_CORRELATION_ID);
    assert.equal(normalized.correlationId, FIXTURE_CORRELATION_ID);

    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: normalized,
        repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(
      result.contraryEvidenceRepair?.eventPayload?.repair_call_correlation_id,
      REPAIR_CALL_CORRELATION_ID,
    );
  });

  it("6. correlation mismatch is reported precisely in diagnostics", async () => {
    const mismatchedRepair = baseRawResponse(
      FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS.responseText,
      "wrong-repair-correlation",
    );
    const parsed = parseMilitaryExpertGenerationResponse(mismatchedRepair, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "correlation_mismatch");

    const repairWithSuffix = repairResponseWithSuffix(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS);
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: repairWithSuffix,
        repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(
      result.contraryEvidenceRepair?.eventPayload?.workflow_correlation_id,
      FIXTURE_CORRELATION_ID,
    );
    assert.equal(
      result.contraryEvidenceRepair?.eventPayload?.repair_call_correlation_id,
      REPAIR_CALL_CORRELATION_ID,
    );
  });

  it("7. repair truncation, malformed JSON, multiple payloads, and unsafe trailing reject repair but may provisionally release primary", async () => {
    const truncated = baseRawResponse(buildValidGenerationJson().slice(0, -20), FIXTURE_CORRELATION_ID, {
      finishStatus: "truncated",
      outputTokens: 4_000,
    });
    const truncatedResult = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: truncated,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(truncatedResult.ok, true);
    assert.equal(truncatedResult.generationStatus, "provisional_success");
    assert.equal(
      truncatedResult.contraryEvidenceRepair?.eventPayload?.repair_parse_result,
      "provider_output_truncated",
    );

    const malformed = baseRawResponse("{summary: broken}", FIXTURE_CORRELATION_ID);
    const malformedResult = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: malformed,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(malformedResult.ok, true);
    assert.equal(malformedResult.generationStatus, "provisional_success");
    assert.equal(malformedResult.contraryEvidenceRepair?.eventPayload?.repair_parse_result, "patch_malformed_json");

    const multiplePayloads = baseRawResponse(
      FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS.responseText +
        "\n" +
        JSON.stringify({ second_payload: true }),
      FIXTURE_CORRELATION_ID,
    );
    const multipleResult = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: multiplePayloads,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(multipleResult.ok, true);
    assert.equal(multipleResult.generationStatus, "provisional_success");
    assert.equal(multipleResult.contraryEvidenceRepair?.eventPayload?.repair_parse_result, "patch_multiple_payloads");

    const unsafeTrailing = baseRawResponse(
      buildValidGenerationJson() + '\n{"summary":"duplicate payload start',
      FIXTURE_CORRELATION_ID,
    );
    const trailingResult = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: unsafeTrailing,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(trailingResult.ok, true);
    assert.equal(trailingResult.generationStatus, "provisional_success");
    assert.ok(
      trailingResult.contraryEvidenceRepair?.eventPayload?.repair_parse_result === "patch_trailing_content" ||
        trailingResult.contraryEvidenceRepair?.eventPayload?.repair_parse_result === "patch_multiple_payloads",
    );
  });

  it("8. repair stop reason and token usage persist in event payload", async () => {
    const repairRaw = baseRawResponse(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS.responseText, FIXTURE_CORRELATION_ID, {
      finishStatus: "complete",
      inputTokens: 880,
      outputTokens: 1_450,
    });
    const providerDiagnostics = buildContraryEvidenceRepairProviderDiagnostics({
      workflowCorrelationId: FIXTURE_CORRELATION_ID,
      repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
      repairRaw,
      repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      repairEstimatedCostUsd: 0.012,
      providerCallCompleted: true,
    });

    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: repairRaw,
        repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
        repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
        repairProviderDiagnostics: providerDiagnostics,
      },
      { bypassFeatureFlag: true },
    );

    assert.equal(result.ok, true);
    const payload = result.contraryEvidenceRepair?.eventPayload;
    assert.equal(payload?.provider_stop_reason, "complete");
    assert.equal(payload?.repair_input_tokens, 880);
    assert.equal(payload?.repair_output_tokens, 1_450);
    assert.equal(payload?.repair_max_output_tokens, 4096);
    assert.equal(payload?.repair_estimated_cost_usd, 0.012);
  });

  it("9. one repair attempt invariant enforced in workflow source", () => {
    assert.match(WORKFLOW_SRC, /normalizeRepairResponseForContract/);
    assert.match(WORKFLOW_SRC, /contrary_evidence_repair_completed/);
    assert.doesNotMatch(WORKFLOW_SRC, /repairAlreadyAttempted:\s*true/);
  });

  it("10. workflow sequence primary fail → repair response → contract re-eval succeeds", async () => {
    const prior = { ...process.env };
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    delete process.env.STUDIO_MILITARY_EXPERT_ENABLED;

    try {
      const primary = FIXTURE_MISSING_CONTRARY_EVIDENCE;
      const primaryEval = await runMilitaryExpertGenerationContract(
        {
          ...buildValidGenerationContractInput(),
          rawResponse: primary,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(primaryEval.ok, false);
      assert.equal(primaryEval.repairDecision, "schema_repair_required");

      const repairRaw = normalizeRepairResponseForContract(
        repairResponseWithSuffix(FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS),
        FIXTURE_CORRELATION_ID,
      );
      const reEval = await runMilitaryExpertGenerationContract(
        {
          ...buildValidGenerationContractInput(),
          rawResponse: primary,
          repairResponse: repairRaw,
          repairCallCorrelationId: REPAIR_CALL_CORRELATION_ID,
          repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(reEval.ok, true);
      assert.equal(reEval.contraryEvidenceRepair?.attempted, true);
    } finally {
      process.env = prior;
    }
  });

  it("11. no real provider calls in repair handoff tests", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        repairResponse: FIXTURE_CONTRARY_EVIDENCE_REPAIR_SUCCESS,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("12. repair parse diagnostics use repair max output tokens not primary allowance", async () => {
    const truncatedRepair = baseRawResponse(buildValidGenerationJson().slice(0, -2), FIXTURE_CORRELATION_ID, {
      finishStatus: "truncated",
      outputTokens: 4_050,
    });
    const parsed = parseMilitaryExpertGenerationResponse(truncatedRepair, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
      maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok && parsed.diagnostics && "maxOutputTokens" in parsed.diagnostics) {
      assert.equal(parsed.diagnostics.maxOutputTokens, 4096);
    }
  });

  it("13. multiple JSON payloads on primary still reject repair path", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MULTIPLE_PAYLOADS);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "multiple_payloads");
  });
});
