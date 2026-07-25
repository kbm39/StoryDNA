import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import { validateMilitaryExpertGenerationPayload } from "./output-schema.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import {
  SMOKE_V3_FIXTURE_CONCLUSION_CONTRADICTS,
  SMOKE_V3_FIXTURE_CORRECTED_ME_COC_001,
  SMOKE_V3_FIXTURE_CORRECTED_ME_COC_002,
  SMOKE_V3_FIXTURE_CORRECTED_ME_OPS_004,
  SMOKE_V3_FIXTURE_EMPTY_CONCLUSION,
  SMOKE_V3_FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
  SMOKE_V3_FIXTURE_EMPTY_CONTRARY_WITH_UNCERTAINTY,
  SMOKE_V3_FIXTURE_GENERIC_UNCERTAINTY_ELSEWHERE,
  SMOKE_V3_FIXTURE_MALFORMED_CONTRARY,
  SMOKE_V3_FIXTURE_MISSING_CONCLUSION,
  SMOKE_V3_FIXTURE_NULL_CONCLUSION,
  SMOKE_V3_FIXTURE_OMITTED_CONTRARY_FIELD,
  SMOKE_V3_FIXTURE_SUBSTITUTE_CONCLUSION,
  SMOKE_V3_FIXTURE_SUMMARY_WITHOUT_CONCLUSION,
  SMOKE_V3_FIXTURE_VALID_CONTRARY,
  SMOKE_V3_FIXTURE_VALID_POSITIVE_CONCLUSION,
  SMOKE_V3_FIXTURE_VALID_SAFETY_CONCLUSION,
  SMOKE_V3_FIXTURE_VALID_TRUE_NEGATIVE_CONCLUSION,
} from "./smoke-v3-remediation-fixtures.ts";
import {
  SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT,
  SMOKE_V2_FIXTURE_EMPTY_CATEGORY_STATUS,
  SMOKE_V2_FIXTURE_EVIDENCE_STRING,
  SMOKE_V2_FIXTURE_UNSUPPORTED_CATEGORY_STATUS,
  SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL,
} from "./smoke-v2-remediation-fixtures.ts";
import { buildValidGenerationPayload } from "./generation-fixtures.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { militaryExpertRuntimeDefinition } from "./runtime-definition.ts";

const FIXTURE_INPUT = Object.freeze({
  manuscriptVersionId: "mv-smoke-v3",
  reviewScope: "sample" as const,
  manuscriptText: "Synthetic calibration text.",
  canonicalWordCount: 12,
  manuscriptHash: "synthetic-hash-v3",
});

describe("Military Expert smoke v3 output contract", () => {
  describe("conclusion field", () => {
    it("rejects missing conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_MISSING_CONCLUSION);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /overall_realism_assessment\.conclusion is required \(field missing\)/);
      }
    });

    it("rejects empty conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_EMPTY_CONCLUSION);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /overall_realism_assessment\.conclusion must be a non-empty string/);
      }
    });

    it("rejects null conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_NULL_CONCLUSION);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /null is invalid/);
      }
    });

    it("rejects substitute overall_conclusion key", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_SUBSTITUTE_CONCLUSION);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /overall_realism_assessment\.overall_conclusion is invalid — use conclusion instead/);
      }
    });

    it("accepts valid positive conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_VALID_POSITIVE_CONCLUSION);
      assert.equal(parsed.ok, true);
    });

    it("accepts valid true-negative conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_VALID_TRUE_NEGATIVE_CONCLUSION);
      assert.equal(parsed.ok, true);
    });

    it("accepts valid safety conclusion", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_VALID_SAFETY_CONCLUSION);
      assert.equal(parsed.ok, true);
    });

    it("rejects conclusion that contradicts negative findings", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_CONCLUSION_CONTRADICTS);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /must not contradict negative findings/);
      }
    });

    it("does not infer conclusion from summary", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_SUMMARY_WITHOUT_CONCLUSION);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /overall_realism_assessment\.conclusion is required \(field missing\)/);
      }
    });
  });

  describe("contrary evidence", () => {
    it("rejects negative finding without contrary_evidence field", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_OMITTED_CONTRARY_FIELD);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /findings\[0\]\.contrary_evidence: field is required/);
      }
    });

    it("rejects malformed contrary-evidence item", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_MALFORMED_CONTRARY);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /must be an object with excerpt\/locator fields, not a string/);
      }
    });

    it("accepts valid contrary-evidence object", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_VALID_CONTRARY);
      assert.equal(parsed.ok, true);
    });

    it("accepts empty contrary_evidence array with valid uncertainty handling", () => {
      const parsed = parseMilitaryExpertGenerationResponse(
        SMOKE_V3_FIXTURE_EMPTY_CONTRARY_WITH_UNCERTAINTY,
      );
      assert.equal(parsed.ok, true);
    });

    it("rejects empty contrary_evidence without required uncertainty handling", () => {
      const parsed = parseMilitaryExpertGenerationResponse(
        SMOKE_V3_FIXTURE_EMPTY_CONTRARY_NO_UNCERTAINTY,
      );
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /contrary-evidence handling/);
      }
    });

    it("does not require fabricated contrary evidence on true-negative output", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V3_FIXTURE_VALID_TRUE_NEGATIVE_CONCLUSION);
      assert.equal(parsed.ok, true);
      if (parsed.ok) {
        assert.equal(parsed.payload.findings.length, 0);
      }
    });

    it("rejects generic uncertainty elsewhere as contrary-evidence substitute", () => {
      const parsed = parseMilitaryExpertGenerationResponse(
        SMOKE_V3_FIXTURE_GENERIC_UNCERTAINTY_ELSEWHERE,
      );
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /findings\[0\]\.contrary_evidence: field is required/);
      }
    });
  });

  describe("regression", () => {
    it("still rejects evidence strings", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_EVIDENCE_STRING);
      assert.equal(parsed.ok, false);
    });

    it("still rejects empty category status", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_EMPTY_CATEGORY_STATUS);
      assert.equal(parsed.ok, false);
    });

    it("still rejects unsupported enums", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_UNSUPPORTED_CATEGORY_STATUS);
      assert.equal(parsed.ok, false);
    });

    it("still rejects prohibited top-level fields", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V2_FIXTURE_UNKNOWN_STRUCTURAL);
      assert.equal(parsed.ok, false);
    });

    it("keeps normalization limited to the two existing aliases", async () => {
      const result = await runMilitaryExpertGenerationContract(
        {
          correlationId: SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT.correlationId,
          ...FIXTURE_INPUT,
          rawResponse: SMOKE_V2_FIXTURE_ALIAS_WITH_AUDIT,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true);
      assert.equal(result.enumNormalizationAudits?.length, 1);
    });

    it("accepts valid generation payload baseline", () => {
      const validation = validateMilitaryExpertGenerationPayload(buildValidGenerationPayload());
      assert.equal(validation.ok, true);
    });

    it("leaves Literary Agent runtime unchanged", () => {
      assert.equal(
        hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition()),
        "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b",
      );
    });

    it("keeps Military Expert disabled and uncertified", () => {
      const runtime = militaryExpertRuntimeDefinition();
      assert.equal(runtime.enabled, false);
      assert.equal(runtime.expert_version, "v1.0.0-draft");
      const entry = getExpertCatalogEntry("military_expert");
      assert.equal(entry?.selectionEnabled, false);
      assert.equal(entry?.availability, "coming_soon");
    });
  });

  describe("corrected corpus fixtures", () => {
    it("parses corrected me-coc-001 through generation contract", async () => {
      const result = await runMilitaryExpertGenerationContract(
        {
          correlationId: SMOKE_V3_FIXTURE_CORRECTED_ME_COC_001.correlationId,
          ...FIXTURE_INPUT,
          rawResponse: SMOKE_V3_FIXTURE_CORRECTED_ME_COC_001,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true);
      assert.equal(result.generationStatus, "success");
    });

    it("parses corrected me-coc-002 through generation contract", async () => {
      const result = await runMilitaryExpertGenerationContract(
        {
          correlationId: SMOKE_V3_FIXTURE_CORRECTED_ME_COC_002.correlationId,
          ...FIXTURE_INPUT,
          rawResponse: SMOKE_V3_FIXTURE_CORRECTED_ME_COC_002,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true);
    });

    it("parses corrected me-ops-004 through generation contract", async () => {
      const result = await runMilitaryExpertGenerationContract(
        {
          correlationId: SMOKE_V3_FIXTURE_CORRECTED_ME_OPS_004.correlationId,
          ...FIXTURE_INPUT,
          rawResponse: SMOKE_V3_FIXTURE_CORRECTED_ME_OPS_004,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true);
    });
  });
});
