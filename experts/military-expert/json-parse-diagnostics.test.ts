import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidGenerationJson, FIXTURE_CORRELATION_ID, baseRawResponse, FIXTURE_VALID_COMPLETE_JSON, FIXTURE_VALID_FENCED_JSON, FIXTURE_TRAILING_PROSE } from "./generation-fixtures.ts";
import {
  analyzeJsonTextTermination,
  buildMilitaryExpertJsonParseDiagnostics,
  isLikelyProviderOutputTruncation,
} from "./json-parse-diagnostics.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";

const VALID_JSON = buildValidGenerationJson();

function truncatedRaw(responseText: string, outputTokens = 4096) {
  return baseRawResponse(responseText, FIXTURE_CORRELATION_ID, {
    finishStatus: "truncated",
    outputTokens,
    inputTokens: 90000,
  });
}

function completeRaw(responseText: string) {
  return baseRawResponse(responseText, FIXTURE_CORRELATION_ID, {
    finishStatus: "complete",
    outputTokens: 1200,
    inputTokens: 90000,
  });
}

describe("Military Expert JSON truncation handling", () => {
  it("1. accepts complete valid JSON", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_COMPLETE_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
      maxOutputTokens: 8192,
    });
    assert.equal(parsed.ok, true);
  });

  it("2. rejects JSON truncated inside a string", () => {
    const broken = VALID_JSON.slice(0, 120) + '"unfinished evidence excerpt';
    const parsed = parseMilitaryExpertGenerationResponse(truncatedRaw(broken), {
      maxOutputTokens: 4096,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "provider_output_truncated");
  });

  it("3. rejects JSON truncated after a property name", () => {
    const broken = '{"summary":"ok","findings":';
    const parsed = parseMilitaryExpertGenerationResponse(truncatedRaw(broken), {
      maxOutputTokens: 4096,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "provider_output_truncated");
  });

  it("4. rejects JSON truncated before final brace", () => {
    const broken = VALID_JSON.slice(0, -2);
    const parsed = parseMilitaryExpertGenerationResponse(truncatedRaw(broken), {
      maxOutputTokens: 4096,
    });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "provider_output_truncated");
  });

  it("5. rejects provider stop reason max_tokens via finishStatus", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      truncatedRaw(VALID_JSON.slice(0, 200)),
      { maxOutputTokens: 4096 },
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.code, "provider_output_truncated");
      assert.equal(parsed.diagnostics?.finishStatus, "truncated");
    }
  });

  it("6. rejects malformed but non-truncated JSON as malformed_json", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      completeRaw('{"summary":"ok","findings":[}'),
      { maxOutputTokens: 8192 },
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "malformed_json");
  });

  it("7. trailing fence handling remains valid", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_VALID_FENCED_JSON, {
      expectedCorrelationId: FIXTURE_CORRELATION_ID,
    });
    assert.equal(parsed.ok, true);
  });

  it("8. harmless trailing prose is normalized", () => {
    const parsed = parseMilitaryExpertGenerationResponse(FIXTURE_TRAILING_PROSE);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.trailingCommentaryNormalization?.normalization_succeeded, true);
    }
  });

  it("9. schema-invalid JSON remains rejected", () => {
    const parsed = parseMilitaryExpertGenerationResponse(
      completeRaw(JSON.stringify({ summary: "only summary field" })),
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.notEqual(parsed.code, "provider_output_truncated");
  });

  it("10. diagnostics capture safe metadata without full response", () => {
    const broken = '{"summary":"ok","findings":[{"title":"y","observation":"cut off';
    const raw = truncatedRaw(broken, 4096);
    const diagnostics = buildMilitaryExpertJsonParseDiagnostics({
      raw,
      jsonText: broken,
      parseErrorMessage: "Unterminated string in JSON at position 17441",
      maxOutputTokens: 4096,
    });
    assert.equal(diagnostics.responseLength > 0, true);
    assert.equal(diagnostics.outputTokens, 4096);
    assert.equal(diagnostics.maxOutputTokens, 4096);
    assert.equal(diagnostics.terminationState, "inside_string");
    assert.equal(diagnostics.parserErrorPosition, 17441);
    assert.ok(diagnostics.sanitizedPrefix.length <= 101);
    assert.ok(diagnostics.sanitizedSuffix.length <= 101);
  });

  it("11. heuristics detect near-max output token truncation", () => {
    const raw = baseRawResponse('{"summary":"x","findings":[{"title":"y","observation":"z', FIXTURE_CORRELATION_ID, {
      finishStatus: "complete",
      outputTokens: 4088,
      inputTokens: 1000,
    });
    assert.equal(
      isLikelyProviderOutputTruncation({
        raw,
        jsonText: raw.responseText,
        parseErrorMessage: "Unterminated string in JSON at position 55",
        maxOutputTokens: 4096,
      }),
      true,
    );
  });

  it("12. analyzeJsonTextTermination detects closed object", () => {
    assert.equal(analyzeJsonTextTermination('{"a":1}'), "closed_object");
  });
});
