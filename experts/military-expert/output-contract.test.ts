import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MILITARY_EXPERT_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_RECOMMENDATION_TYPES,
  MILITARY_EXPERT_SEVERITY_LEVELS,
} from "./contracts.ts";
import {
  normalizeMilitaryExpertGenerationEnums,
  MILITARY_EXPERT_CONFIDENCE_ALIASES,
  MILITARY_EXPERT_SEVERITY_ALIASES,
} from "./enum-normalization.ts";
import {
  MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS,
  MILITARY_EXPERT_PROHIBITED_TOP_LEVEL_FIELDS,
  militaryExpertOutputSchemaPromptBlock,
} from "./output-schema.ts";
import { buildMilitaryExpertReviewPrompt, buildMilitaryExpertSystemPrompt } from "./prompts.ts";
import { MILITARY_EXPERT } from "./definition.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";
import {
  SMOKE_FIXTURE_ALIAS_CONFIDENCE,
  SMOKE_FIXTURE_ALIAS_SEVERITY,
  SMOKE_FIXTURE_CLOSING_NOTE,
  SMOKE_FIXTURE_CORRECTED_POSITIVE,
  SMOKE_FIXTURE_CORRECTED_SAFETY,
  SMOKE_FIXTURE_CORRECTED_TRUE_NEGATIVE,
  SMOKE_FIXTURE_MISSING_REQUIRED_TOP_LEVEL,
  SMOKE_FIXTURE_UNKNOWN_ENUM,
  SMOKE_FIXTURE_UNSUPPORTED_COMMENTARY,
} from "./smoke-remediation-fixtures.ts";
import {
  FIXTURE_MANUSCRIPT_HASH,
  FIXTURE_MANUSCRIPT_TEXT,
  FIXTURE_MANUSCRIPT_VERSION_ID,
} from "./generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "./generation-contract.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import { militaryExpertRuntimeDefinition } from "./runtime-definition.ts";

function reviewPromptInput() {
  return {
    def: MILITARY_EXPERT,
    manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
    reviewScope: "sample" as const,
    manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
    canonicalWordCount: 24,
    manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
  };
}

describe("Military Expert Haiku 4.5 output contract remediation", () => {
  describe("prompt contract", () => {
    const block = militaryExpertOutputSchemaPromptBlock();
    const system = buildMilitaryExpertSystemPrompt(MILITARY_EXPERT);
    const review = buildMilitaryExpertReviewPrompt(reviewPromptInput());

    it("names all required top-level fields", () => {
      for (const key of MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS) {
        assert.match(block, new RegExp(key));
      }
    });

    it("names exact enums and prohibits synonyms", () => {
      for (const value of MILITARY_EXPERT_CONFIDENCE_LEVELS) {
        assert.match(block, new RegExp(value));
      }
      for (const value of MILITARY_EXPERT_SEVERITY_LEVELS) {
        assert.match(block, new RegExp(value));
      }
      for (const value of MILITARY_EXPERT_RECOMMENDATION_TYPES) {
        assert.match(block, new RegExp(value));
      }
      assert.match(block, /synonyms are invalid/i);
    });

    it("prohibits undeclared top-level fields", () => {
      for (const field of MILITARY_EXPERT_PROHIBITED_TOP_LEVEL_FIELDS) {
        assert.match(block, new RegExp(field));
      }
      assert.match(block, /Do not add any top-level field outside the required list/i);
    });

    it("requires JSON-only output without markdown wrapper", () => {
      assert.match(block, /No markdown fences/i);
      assert.match(system, /No markdown wrapper/i);
      assert.match(system, /No prose outside the JSON object/i);
    });

    it("includes true-negative shape guidance", () => {
      assert.match(block, /True-negative shape/i);
      assert.match(block, /findings: \[\]/);
    });

    it("preserves safety and contrary-evidence requirements", () => {
      assert.match(review, /contrary evidence/i);
      assert.match(system, /Do not provide step-by-step operational instructions/i);
      assert.match(block, /author_challenge_supported: true/);
    });
  });

  describe("parser and validator", () => {
    it("accepts corrected positive, true-negative, and safety fixtures", () => {
      for (const fixture of [
        SMOKE_FIXTURE_CORRECTED_POSITIVE,
        SMOKE_FIXTURE_CORRECTED_TRUE_NEGATIVE,
        SMOKE_FIXTURE_CORRECTED_SAFETY,
      ]) {
        const parsed = parseMilitaryExpertGenerationResponse(fixture);
        assert.equal(parsed.ok, true, fixture.correlationId);
      }
    });

    it("rejects unsupported top-level commentary fields", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_FIXTURE_UNSUPPORTED_COMMENTARY);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /author_challenge_note|summary|strengths|next_step/i);
      }
    });

    it("rejects missing required top-level fields", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_FIXTURE_MISSING_REQUIRED_TOP_LEVEL);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /summary|strengths|next_step/i);
      }
    });

    it("rejects prohibited closing_note", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_FIXTURE_CLOSING_NOTE);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.match(parsed.message, /closing_note|summary|strengths|next_step|context_required/i);
      }
    });

    it("normalizes approved confidence alias moderate→medium", () => {
      const { normalized, audits } = normalizeMilitaryExpertGenerationEnums(
        JSON.parse(SMOKE_FIXTURE_ALIAS_CONFIDENCE.responseText),
      );
      assert.equal(
        (normalized as { findings: { confidence: string }[] }).findings[0]!.confidence,
        MILITARY_EXPERT_CONFIDENCE_ALIASES.moderate,
      );
      assert.equal(audits.length, 1);
      assert.equal(audits[0]?.originalValue, "moderate");
    });

    it("normalizes approved severity alias medium→moderate", () => {
      const { normalized, audits } = normalizeMilitaryExpertGenerationEnums(
        JSON.parse(SMOKE_FIXTURE_ALIAS_SEVERITY.responseText),
      );
      assert.equal(
        (normalized as { findings: { severity: string }[] }).findings[0]!.severity,
        MILITARY_EXPERT_SEVERITY_ALIASES.medium,
      );
      assert.equal(audits.length, 1);
    });

    it("rejects unknown recommendation types after normalization", () => {
      const parsed = parseMilitaryExpertGenerationResponse(SMOKE_FIXTURE_UNKNOWN_ENUM);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.equal(parsed.code, "unsupported_enum");
      }
    });

    it("rejects ambiguous recommendation aliases context_clarification and context_required", () => {
      for (const value of ["context_clarification", "context_required"]) {
        const payload = JSON.parse(SMOKE_FIXTURE_CORRECTED_POSITIVE.responseText) as {
          findings: { recommendation_type: string }[];
        };
        payload.findings[1]!.recommendation_type = value;
        const parsed = parseMilitaryExpertGenerationResponse({
          ...SMOKE_FIXTURE_CORRECTED_POSITIVE,
          responseText: JSON.stringify(payload),
        });
        assert.equal(parsed.ok, false, value);
      }
    });
  });

  describe("regression guards", () => {
    it("Military Expert catalog entry remains disabled and uncertified", () => {
      const entry = getExpertCatalogEntry("military_expert");
      assert.ok(entry);
      assert.equal(entry!.selectionEnabled, false);
      assert.equal(entry!.availability, "coming_soon");
    });

    it("runtime remains draft and disabled", () => {
      const runtime = militaryExpertRuntimeDefinition();
      assert.equal(runtime.enabled, false);
      assert.equal(runtime.expert_version, "v1.0.0-draft");
    });
  });
});

describe("Military Expert smoke replay (mocked, zero provider calls)", () => {
  it("replays three corrected smoke fixtures through generation contract", async () => {
    const fixtures = [
      SMOKE_FIXTURE_CORRECTED_POSITIVE,
      SMOKE_FIXTURE_CORRECTED_TRUE_NEGATIVE,
      SMOKE_FIXTURE_CORRECTED_SAFETY,
    ];

    for (const fixture of fixtures) {
      const result = await runMilitaryExpertGenerationContract(
        {
          correlationId: fixture.correlationId,
          manuscriptVersionId: FIXTURE_MANUSCRIPT_VERSION_ID,
          reviewScope: "sample",
          manuscriptText: FIXTURE_MANUSCRIPT_TEXT,
          canonicalWordCount: 24,
          manuscriptHash: FIXTURE_MANUSCRIPT_HASH,
          rawResponse: fixture,
        },
        { bypassFeatureFlag: true },
      );
      assert.equal(result.ok, true, fixture.correlationId);
      assert.equal(result.generationStatus, "success");
      if (fixture.correlationId === "me-ops-004-corrected" && result.review) {
        const combined = result.review.findings.map((f) => f.recommendation).join(" ");
        assert.doesNotMatch(combined, /step\s+\d+/i);
      }
    }
  });
});
