import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidGenerationJson } from "./generation-fixtures.ts";
import {
  extractStrictModelJsonObject,
  isAllowedModelJsonTrailing,
  sanitizeModelTextSample,
} from "./model-json-extraction.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { FIXTURE_VALID_COMPLETE_JSON, FIXTURE_VALID_FENCED_JSON } from "./generation-fixtures.ts";

const VALID_JSON = buildValidGenerationJson();

describe("extractStrictModelJsonObject", () => {
  it("accepts bare JSON with surrounding whitespace", () => {
    const result = extractStrictModelJsonObject(`  \n${VALID_JSON}\n  `);
    assert.equal(result.trailingCategory, "none");
    assert.equal(result.trailingContent, "");
    assert.equal(result.multiplePayloads, false);
    assert.doesNotThrow(() => JSON.parse(result.jsonText));
  });

  it("accepts a fully fenced JSON block", () => {
    const result = extractStrictModelJsonObject(`\`\`\`json\n${VALID_JSON}\n\`\`\``);
    assert.equal(result.trailingContent, "");
    assert.equal(isAllowedModelJsonTrailing(result.trailingCategory), true);
  });

  it("accepts opening fence with trailing closing fence only", () => {
    const result = extractStrictModelJsonObject(`\`\`\`json\n${VALID_JSON}\n\`\`\``);
    const parsed = parseMilitaryExpertGenerationResponse({
      ...FIXTURE_VALID_COMPLETE_JSON,
      responseText: `\`\`\`json\n${VALID_JSON}\n\`\`\``,
    });
    assert.equal(result.trailingContent, "");
    assert.equal(parsed.ok, true);
  });

  it("accepts JSON followed by a closing fence without opening fence", () => {
    const raw = `${VALID_JSON}\n\`\`\``;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.trailingContent, "");
    assert.equal(isAllowedModelJsonTrailing(result.trailingCategory), true);

    const parsed = parseMilitaryExpertGenerationResponse({
      ...FIXTURE_VALID_COMPLETE_JSON,
      responseText: raw,
    });
    assert.equal(parsed.ok, true);
  });

  it("accepts JSON followed by a closing ```json fence without opening fence", () => {
    const raw = `${VALID_JSON}\n\`\`\`json`;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.trailingContent, "");
    assert.equal(isAllowedModelJsonTrailing(result.trailingCategory), true);

    const parsed = parseMilitaryExpertGenerationResponse({
      ...FIXTURE_VALID_COMPLETE_JSON,
      responseText: raw,
    });
    assert.equal(parsed.ok, true);
  });

  it("accepts fully fenced JSON with ```json closing tag", () => {
    const raw = `\`\`\`json\n${VALID_JSON}\n\`\`\`json`;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.trailingContent, "");
    const parsed = parseMilitaryExpertGenerationResponse({
      ...FIXTURE_VALID_COMPLETE_JSON,
      responseText: raw,
    });
    assert.equal(parsed.ok, true);
  });

  it("accepts fenced JSON with trailing whitespace after closing fence", () => {
    const raw = `\`\`\`json\n${VALID_JSON}\n\`\`\`   \n`;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.trailingContent, "");
    const parsed = parseMilitaryExpertGenerationResponse({
      ...FIXTURE_VALID_FENCED_JSON,
      responseText: raw,
    });
    assert.equal(parsed.ok, true);
  });

  it("rejects trailing explanatory prose", () => {
    const raw = `${VALID_JSON}\nHope this review helps.`;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.trailingCategory, "explanatory_prose");
    assert.equal(isAllowedModelJsonTrailing(result.trailingCategory), false);
  });

  it("rejects a second JSON object after the first", () => {
    const raw = `${VALID_JSON}\n${JSON.stringify({ second: true })}`;
    const result = extractStrictModelJsonObject(raw);
    assert.equal(result.multiplePayloads, true);
  });

  it("sanitizes diagnostic samples without leaking long strings", () => {
    const sample = sanitizeModelTextSample('{"summary":"' + "x".repeat(200) + '"}');
    assert.match(sample, /\[redacted\]/);
    assert.ok(sample.length <= 101);
  });
});
