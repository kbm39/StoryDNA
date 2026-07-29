import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT } from "./definition.ts";
import {
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  FIXTURE_CORRELATION_ID,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_CLOSING_FENCE,
  FIXTURE_TRAILING_PARTIAL_DUPLICATE,
  FIXTURE_TRAILING_PROSE,
  FIXTURE_TRAILING_WHITESPACE,
  FIXTURE_VALID_COMPLETE_JSON,
  FIXTURE_VALID_FENCED_JSON,
  baseRawResponse,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import {
  evaluateTrailingCommentaryStripEligibility,
  extractStrictModelJsonObject,
  isUnsafeTrailingCommentaryContent,
} from "./model-json-extraction.ts";
import { buildMilitaryExpertSystemPrompt } from "./prompts.ts";
import { mapMilitaryExpertParseFailureToWorkflowErrorCode } from "./parse-workflow-errors.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";

const VALID_JSON = buildValidGenerationJson();
const HARMLESS_TRAILING =
  "This completes the editorial review. Let me know if you need clarification on any finding.";
const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

describe("Military Expert trailing commentary normalization", () => {
  it("1. plain valid JSON with no trailing content passes", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.trailingCommentaryNormalization, undefined);
  });

  it("2. valid JSON followed by harmless explanatory prose is safely normalized", () => {
    const raw = baseRawResponse(`${VALID_JSON}\n${HARMLESS_TRAILING}`);
    const extraction = extractStrictModelJsonObject(raw.responseText);
    assert.equal(extraction.trailingCategory, "explanatory_prose");
    assert.equal(evaluateTrailingCommentaryStripEligibility(raw.responseText, extraction).eligible, true);

    const parsed = parseMilitaryExpertGenerationResponse(raw, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.cleanedText, VALID_JSON);
      assert.equal(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
      assert.equal(
        parsed.trailingCommentaryNormalization?.trailing_character_count,
        HARMLESS_TRAILING.length,
      );
    }
  });

  it("3. valid JSON followed by whitespace passes", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_WHITESPACE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("4. valid JSON inside disallowed markdown fences follows existing policy", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_FENCED_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);

    const closingFence = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_CLOSING_FENCE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(closingFence.ok, true);
  });

  it("5. valid JSON followed by a second JSON object is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MULTIPLE_PAYLOADS);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "multiple_payloads");
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({ parseFailureCode: parsed.code }),
        "PROVIDER_MULTIPLE_JSON_PAYLOADS",
      );
    }
  });

  it("6. valid JSON followed by a JSON array is rejected", () => {
    const raw = baseRawResponse(`${VALID_JSON}\n[{"extra":"payload"}]`);
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "trailing_content");
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
        }),
        "PROVIDER_MULTIPLE_JSON_PAYLOADS",
      );
    }
  });

  it("7. valid JSON followed by report-like structured content is rejected", () => {
    const structuredTrailing = '{"findings":[{"title":"extra finding"}]}';
    const raw = baseRawResponse(`${VALID_JSON}\n${structuredTrailing}`);
    assert.equal(isUnsafeTrailingCommentaryContent(structuredTrailing), true);

    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "multiple_payloads");
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
        }),
        "PROVIDER_MULTIPLE_JSON_PAYLOADS",
      );
    }
  });

  it("8. malformed JSON plus prose is rejected", () => {
    const raw = baseRawResponse("{summary: broken}\nExtra prose.");
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "malformed_json");
  });

  it("9. truncated JSON plus prose is rejected", () => {
    const raw = baseRawResponse(`${VALID_JSON.slice(0, -20)}\nExtra prose.`, undefined, {
      finishStatus: "truncated",
    });
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.notEqual(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
    }
  });

  it("10. multiple-payload protection remains intact", () => {
    const partial = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PARTIAL_DUPLICATE);
    assert.equal(partial.ok, false);
    if (!partial.ok) assert.equal(partial.code, "multiple_payloads");
  });

  it("11. content inside the valid JSON is unchanged byte-for-byte after extraction", () => {
    const raw = baseRawResponse(`${VALID_JSON}\n${HARMLESS_TRAILING}`);
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.cleanedText, VALID_JSON);
  });

  it("12. full schema validation still occurs after normalization", () => {
    const invalidJson = JSON.stringify({ summary: "only summary" });
    const raw = baseRawResponse(`${invalidJson}\n${HARMLESS_TRAILING}`);
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "schema_invalid");
  });

  it("13. contrary-evidence repair remains available after normalization", async () => {
    const raw = baseRawResponse(
      `${FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText}\n${HARMLESS_TRAILING}`,
    );
    const classification = classifyMilitaryExpertRepairNeed({
      raw,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(classification.decision, "schema_repair_required");
  });

  it("14. prior violations-array fix remains green", () => {
    const parsedRoot = JSON.parse(
      extractStrictModelJsonObject(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText).jsonText,
    );
    assert.ok(Array.isArray(parsedRoot.findings));
  });

  it("15. large-manuscript handling remains green", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.modelCalls, 0);
  });

  it("16. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("17. no provider call occurs in unit tests", async () => {
    const raw = baseRawResponse(`${VALID_JSON}\n${HARMLESS_TRAILING}`);
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: raw,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
    assert.equal(result.ok, true);
    assert.equal(result.trailingCommentaryNormalization?.normalization_succeeded, true);
  });
});

describe("Military Expert trailing commentary prompt reinforcement", () => {
  it("strengthened prompt forbids post-JSON commentary", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /exactly ONE strict JSON object/);
    assert.match(prompt, /final character of your entire response must be `\}`/);
    assert.match(prompt, /Do not include a conclusion, notes, apologies/);
    assert.match(prompt, /do not say "Here is the report"/i);
  });
});

describe("Military Expert trailing commentary unsafe prose still fails closed", () => {
  it("legacy trailing prose fixture without safe normalization remains rejected when ambiguous", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PROSE);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
    }
  });
});
