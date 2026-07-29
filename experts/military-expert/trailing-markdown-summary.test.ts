import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT } from "./definition.ts";
import {
  buildSafeMarkdownAuthorSummary,
  buildValidGenerationContractInput,
  buildValidGenerationJson,
  FIXTURE_CORRELATION_ID,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_MARKDOWN_CHANGED_RECOMMENDATION,
  FIXTURE_TRAILING_MARKDOWN_CHANGED_SEVERITY,
  FIXTURE_TRAILING_MARKDOWN_CORRECTION,
  FIXTURE_TRAILING_MARKDOWN_FENCED_SECOND_PAYLOAD,
  FIXTURE_TRAILING_MARKDOWN_MALFORMED,
  FIXTURE_TRAILING_MARKDOWN_NEW_EVIDENCE,
  FIXTURE_TRAILING_MARKDOWN_NEW_FINDING,
  FIXTURE_TRAILING_MARKDOWN_SUMMARY,
  FIXTURE_TRAILING_MARKDOWN_SUMMARY_HEADINGS,
  FIXTURE_TRAILING_MARKDOWN_TRUNCATED,
  FIXTURE_TRAILING_PROSE,
  FIXTURE_VALID_COMPLETE_JSON,
  baseRawResponse,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import { militaryExpertOutputSchemaPromptBlock } from "./output-schema.ts";
import {
  evaluateTrailingMarkdownSummaryStripEligibility,
  extractStrictModelJsonObject,
  isRecognizableMarkdownSummaryProse,
} from "./model-json-extraction.ts";
import { buildMilitaryExpertSystemPrompt } from "./prompts.ts";
import { mapMilitaryExpertParseFailureToWorkflowErrorCode } from "./parse-workflow-errors.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { classifyMilitaryExpertRepairNeed } from "./repair-classification.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH } from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";

const VALID_JSON = buildValidGenerationJson();
const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";

describe("Military Expert trailing Markdown summary normalization", () => {
  it("1. valid JSON with no trailing content passes", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingMarkdownSummaryNormalization, undefined);
    }
  });

  it("2. valid JSON followed by a harmless Markdown author summary is removed", () => {
    const raw = FIXTURE_TRAILING_MARKDOWN_SUMMARY;
    const extraction = extractStrictModelJsonObject(raw.responseText);
    assert.equal(isRecognizableMarkdownSummaryProse(extraction.trailingContent), true);
    assert.equal(
      evaluateTrailingMarkdownSummaryStripEligibility(raw.responseText, extraction).eligible,
      true,
    );

    const parsed = parseMilitaryExpertGenerationResponse(raw, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.cleanedText, VALID_JSON);
      assert.equal(parsed.trailingMarkdownSummaryNormalization?.normalization_succeeded, true);
    }
  });

  it("3. valid JSON followed by Markdown headings and bullets that repeat JSON content is removed", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_SUMMARY_HEADINGS, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingMarkdownSummaryNormalization?.normalization_succeeded, true);
    }
  });

  it("4. valid JSON followed by a new finding in Markdown is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_NEW_FINDING);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "trailing_content");
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
          trailingMarkdownSummaryUnsafe: parsed.trailingMarkdownSummaryUnsafe,
        }),
        "PROVIDER_TRAILING_MARKDOWN_UNSAFE",
      );
    }
  });

  it("5. valid JSON followed by a changed severity is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_CHANGED_SEVERITY);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
          trailingMarkdownSummaryUnsafe: parsed.trailingMarkdownSummaryUnsafe,
        }),
        "PROVIDER_TRAILING_MARKDOWN_UNSAFE",
      );
    }
  });

  it("6. valid JSON followed by a changed recommendation is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      FIXTURE_TRAILING_MARKDOWN_CHANGED_RECOMMENDATION,
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
          trailingMarkdownSummaryUnsafe: parsed.trailingMarkdownSummaryUnsafe,
        }),
        "PROVIDER_TRAILING_MARKDOWN_UNSAFE",
      );
    }
  });

  it("7. valid JSON followed by new evidence is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_NEW_EVIDENCE);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
          trailingMarkdownSummaryUnsafe: parsed.trailingMarkdownSummaryUnsafe,
        }),
        "PROVIDER_TRAILING_MARKDOWN_UNSAFE",
      );
    }
  });

  it("8. valid JSON followed by a correction to the JSON is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_CORRECTION);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
          trailingMarkdownSummaryUnsafe: parsed.trailingMarkdownSummaryUnsafe,
        }),
        "PROVIDER_TRAILING_MARKDOWN_UNSAFE",
      );
    }
  });

  it("9. valid JSON followed by another JSON object is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MULTIPLE_PAYLOADS);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "multiple_payloads");
  });

  it("10. valid JSON followed by a JSON array is rejected", () => {
    const raw = baseRawResponse(`${VALID_JSON}\n[{"extra":"payload"}]`);
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "trailing_content");
  });

  it("11. valid JSON followed by a fenced second payload is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      FIXTURE_TRAILING_MARKDOWN_FENCED_SECOND_PAYLOAD,
    );
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

  it("12. malformed JSON plus Markdown is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_MALFORMED);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "malformed_json");
  });

  it("13. truncated JSON plus Markdown is rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_TRUNCATED);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.notEqual(parsed.trailingMarkdownSummaryNormalization?.normalization_succeeded, true);
    }
  });

  it("14. JSON content remains byte-for-byte unchanged after safe removal", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_MARKDOWN_SUMMARY);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.cleanedText, VALID_JSON);
  });

  it("15. full report validation still runs after normalization", () => {
    const invalidJson = JSON.stringify({ summary: "only summary" });
    const raw = baseRawResponse(
      `${invalidJson}\n\n## Summary for Author\n\n- Only a summary field was returned.`,
    );
    const parsed = parseMilitaryExpertGenerationResponse(raw);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "schema_invalid");
  });

  it("16. contrary-evidence repair remains available after normalization", () => {
    const raw = baseRawResponse(
      `${FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText}\n\n${buildSafeMarkdownAuthorSummary()}`,
    );
    const classification = classifyMilitaryExpertRepairNeed({
      raw,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(classification.decision, "schema_repair_required");
  });

  it("17. previous plain-prose trailing-commentary tests remain green", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PROSE);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
    }
  });

  it("18. previous violations-array wiring test remains green", () => {
    const parsedRoot = JSON.parse(
      extractStrictModelJsonObject(FIXTURE_MISSING_CONTRARY_EVIDENCE.responseText).jsonText,
    );
    assert.ok(Array.isArray(parsedRoot.findings));
  });

  it("19. large-manuscript handling remains green", async () => {
    const result = await runMilitaryExpertGenerationContract(buildValidGenerationContractInput(), {
      bypassFeatureFlag: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.modelCalls, 0);
  });

  it("20. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("21. no provider call occurs in unit tests", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        ...buildValidGenerationContractInput(),
        rawResponse: FIXTURE_TRAILING_MARKDOWN_SUMMARY,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
    assert.equal(result.ok, true);
    assert.equal(result.trailingMarkdownSummaryNormalization?.normalization_succeeded, true);
  });
});

describe("Military Expert trailing Markdown summary prompt reinforcement", () => {
  it("strengthened prompt forbids post-JSON Markdown summaries", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /Do not add a Markdown summary for the author after the JSON object/);
    assert.match(prompt, /final character of your entire response must be `\}`/);
    assert.match(prompt, /Any author-facing summary belongs only in the required JSON fields/);

    const schemaBlock = militaryExpertOutputSchemaPromptBlock();
    assert.match(schemaBlock, /Do not add a Markdown summary for the author after the JSON object/);
    assert.match(schemaBlock, /Do not repeat the memo outside the JSON with headings, bullet points/);
  });
});
