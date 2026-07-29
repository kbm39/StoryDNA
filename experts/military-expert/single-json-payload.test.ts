import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT } from "./definition.ts";
import {
  buildValidGenerationJson,
  FIXTURE_BARE_JSON_TRAILING_FENCE,
  FIXTURE_BARE_JSON_TRAILING_JSON_FENCE,
  FIXTURE_CORRELATION_ID,
  FIXTURE_FENCED_JSON_TRAILING_JSON_FENCE,
  FIXTURE_MULTIPLE_PAYLOADS,
  FIXTURE_TRAILING_PARTIAL_DUPLICATE,
  FIXTURE_TRAILING_PROSE,
  FIXTURE_TRAILING_WHITESPACE,
  FIXTURE_VALID_COMPLETE_JSON,
  FIXTURE_VALID_FENCED_JSON,
  baseRawResponse,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import { buildMilitaryExpertSystemPrompt } from "./prompts.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
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

describe("Military Expert single JSON payload enforcement", () => {
  it("1. accepts plain JSON", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("2. accepts JSON inside a complete markdown fence", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_FENCED_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("3. accepts bare JSON followed only by closing fence", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_BARE_JSON_TRAILING_FENCE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("3b. accepts bare JSON followed only by closing ```json fence", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_BARE_JSON_TRAILING_JSON_FENCE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("3c. accepts fenced JSON with ```json closing tag", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_FENCED_JSON_TRAILING_JSON_FENCE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("4. accepts JSON followed by whitespace", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_WHITESPACE, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("5. accepts JSON followed by harmless explanatory prose after normalization", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PROSE);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
    }
  });

  it("6. rejects JSON followed by a second object", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_MULTIPLE_PAYLOADS);
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

  it("7. rejects JSON followed by duplicate partial payload", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PARTIAL_DUPLICATE);
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

  it("8. accepts structured-output style bare JSON with no wrapper", () => {
    const extraction = extractStrictModelJsonObject(VALID_JSON);
    assert.equal(extraction.trailingContent, "");
    const parsed = parseMilitaryExpertGenerationResponse(
      baseRawResponse(VALID_JSON, FIXTURE_CORRELATION_ID, {
        provenance: { source: "external_caller" },
      }),
      { expectedCorrelationId: FIXTURE_CORRELATION_ID },
    );
    assert.equal(parsed.ok, true);
  });

  it("9. harmless trailing prose does not require provider repair", () => {
    const result = classifyMilitaryExpertRepairNeed({
      raw: FIXTURE_TRAILING_PROSE,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(result.decision, "no_repair_needed");
  });

  it("10. rejects multiple payloads without silent cleanup", () => {
    const result = classifyMilitaryExpertRepairNeed({
      raw: FIXTURE_MULTIPLE_PAYLOADS,
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(result.decision, "reject_output");
    assert.equal(result.parseFailureCode, "multiple_payloads");
  });

  it("11. schema validation remains strict after accepted wrapper cleanup", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      baseRawResponse('{"summary":"only summary"}'),
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "schema_invalid");
  });

  it("12. unit tests do not invoke providers", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: FIXTURE_CORRELATION_ID,
        manuscriptVersionId: "mv-single-json",
        reviewScope: "full_manuscript",
        manuscriptText: "Synthetic scope.",
        canonicalWordCount: 2,
        manuscriptHash: "hash-single-json",
        rawResponse: FIXTURE_VALID_COMPLETE_JSON,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("13. invalid markdown wrapper with prose maps to PROVIDER_MARKDOWN_WRAPPER_INVALID", () => {
    const raw = `${VALID_JSON}\n\`\`\`\nExtra commentary after fence.`;
    const parsed = parseMilitaryExpertGenerationResponse(baseRawResponse(raw));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(
        mapMilitaryExpertParseFailureToWorkflowErrorCode({
          parseFailureCode: parsed.code,
          trailingCategory: parsed.trailingCategory,
        }),
        "PROVIDER_MARKDOWN_WRAPPER_INVALID",
      );
    }
  });

  it("14. Literary Agent behavior remains unchanged", () => {
    assert.equal(
      hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
      EXPECTED_LA_RUNTIME_HASH,
    );
    assert.equal(LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH, EXPECTED_LA_CONSTITUTION_HASH);
  });

  it("15. strengthened prompt requires brace boundaries and no post-JSON commentary", () => {
    const prompt = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    assert.match(prompt, /first non-whitespace character.*`\{`/);
    assert.match(prompt, /final non-whitespace character.*`\}`/);
    assert.match(prompt, /final character of your entire response must be `\}`/);
    assert.match(prompt, /Do not use Markdown fences/);
    assert.match(prompt, /Do not include a conclusion, notes, apologies/);
    assert.match(prompt, /Do not add a Markdown summary for the author after the JSON object/);
  });
});
