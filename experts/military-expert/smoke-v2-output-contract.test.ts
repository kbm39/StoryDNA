import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { validateMilitaryExpertGenerationPayload } from "./output-schema.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import {
  SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT,
  SMOKE_V2_FIXTURE_CORRECTED_POSITIVE,
  SMOKE_V2_FIXTURE_CORRECTED_SAFETY,
  SMOKE_V2_FIXTURE_CORRECTED_TRUE_NEGATIVE,
  SMOKE_V2_FIXTURE_EMPTY_CATEGORY_STATUS,
  SMOKE_V2_FIXTURE_EVIDENCE_STRING,
  SMOKE_V2_FIXTURE_MISSING_CONTRARY,
  SMOKE_V2_FIXTURE_NEGATIVE_NO_EVIDENCE,
  SMOKE_V2_FIXTURE_SUMMARY_CONCERNS_ONLY,
  SMOKE_V2_FIXTURE_SUMMARY_OMITS_CONCERN,
  SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL,
  SMOKE_V2_FIXTURE_UNSUPPORTED_CATEGORY_STATUS,
} from "./smoke-v2-remediation-fixtures.ts";
import { buildValidGenerationPayload } from "./generation-fixtures.ts";

const FIXTURE_INPUT = Object.freeze({
  manuscriptVersionId: "mv-smoke-v2",
  reviewScope: "sample" as const,
  manuscriptText: "Synthetic calibration text.",
  canonicalWordCount: 12,
  manuscriptHash: "synthetic-hash-v2",
});

describe("Military Expert smoke v2 output contract", () => {
  it("rejects evidence strings", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_EVIDENCE_STRING);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.message, /must be an object/);
    }
  });

  it("rejects negative finding without evidence", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_NEGATIVE_NO_EVIDENCE);
    assert.equal(parsed.ok, false);
  });

  it("rejects missing contrary-evidence representation", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_MISSING_CONTRARY);
    assert.equal(parsed.ok, false);
  });

  it("rejects empty category status", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_EMPTY_CATEGORY_STATUS);
    assert.equal(parsed.ok, false);
  });

  it("rejects unsupported category status", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_UNSUPPORTED_CATEGORY_STATUS);
    assert.equal(parsed.ok, false);
  });

  it("rejects summary with concerns but no strengths", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_SUMMARY_CONCERNS_ONLY);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.message, /material strengths/);
    }
  });

  it("rejects summary omitting material concern when negative findings exist", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_SUMMARY_OMITS_CONCERN);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.message, /material concerns/);
    }
  });

  it("accepts valid evidence objects", () => {
    const validation = validateMilitaryExpertGenerationPayload(buildValidGenerationPayload());
    assert.equal(validation.ok, true);
  });

  it("parses and validates corrected positive fixture", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: SMOKE_V2_FIXTURE_CORRECTED_POSITIVE.correlationId,
        ...FIXTURE_INPUT,
        rawResponse: SMOKE_V2_FIXTURE_CORRECTED_POSITIVE,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.equal(result.generationStatus, "success");
  });

  it("parses and validates corrected true-negative fixture", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: SMOKE_V2_FIXTURE_CORRECTED_TRUE_NEGATIVE.correlationId,
        ...FIXTURE_INPUT,
        rawResponse: SMOKE_V2_FIXTURE_CORRECTED_TRUE_NEGATIVE,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
  });

  it("parses and validates corrected safety fixture", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: SMOKE_V2_FIXTURE_CORRECTED_SAFETY.correlationId,
        ...FIXTURE_INPUT,
        rawResponse: SMOKE_V2_FIXTURE_CORRECTED_SAFETY,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
  });

  it("persists normalization audit metadata for enum aliases", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT.correlationId,
        ...FIXTURE_INPUT,
        rawResponse: SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, true);
    assert.ok(result.enumNormalizationAudits && result.enumNormalizationAudits.length > 0);
    assert.equal(result.enumNormalizationAudits[0]?.originalValue, "moderate");
    assert.equal(result.enumNormalizationAudits[0]?.normalizedValue, "medium");
  });

  it("rejects unknown structural defects", async () => {
    const result = await runMilitaryExpertGenerationContract(
      {
        correlationId: SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL.correlationId,
        ...FIXTURE_INPUT,
        rawResponse: SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL,
      },
      { bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
  });
});
