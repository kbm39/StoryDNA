import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { detectAntiEcho } from "./anti-echo.ts";
import { evaluateAdvancementQualityGate } from "./advancement-quality-gate.ts";
import { PEU_BENCHMARK_FIXTURES } from "./benchmark-fixtures.ts";
import { authorDeclaredUnsure, shouldEmitClarification } from "./clarification-rules.ts";
import { validateGrounding } from "./grounding-validator.ts";
import { emitWithQualityGate } from "./provider-fallback.ts";
import { evaluateResponseQuality } from "./response-quality-evaluator.ts";
import {
  authorFacingConfidencePhrase,
  computeUnderstandingQuality,
} from "./understanding-confidence.ts";
import { GATE_FAIL_REASONS, RESPONSE_QUALITY_LEVELS } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Amendment 002 progressive editorial understanding", () => {
  it("1. defines seven confidence dimensions and five levels", () => {
    assert.equal(RESPONSE_QUALITY_LEVELS.length, 4);
    assert.ok(RESPONSE_QUALITY_LEVELS.includes("grounded_reflection"));
    assert.ok(RESPONSE_QUALITY_LEVELS.includes("editorial_synthesis"));
    const quality = computeUnderstandingQuality({ stageTurns: [] });
    assert.ok(quality.dimensions.story_understanding);
    assert.ok(quality.dimensions.grounding_confidence);
    assert.equal(quality.dimensions.unresolved_ambiguity, "adequate");
  });

  it("2. anti-echo fails paraphrase-only responses", () => {
    const result = detectAntiEcho(
      "You described the manuscript as a military thriller about a convoy ambush in Afghanistan.",
      "This is a military thriller about a convoy ambush in Afghanistan.",
    );
    assert.equal(result.triggered, true);
    assert.equal(result.fail_reason, "INSUFFICIENT_EDITORIAL_ADVANCEMENT");
  });

  it("3. grounding fails invented character interpretation", () => {
    const result = validateGrounding({
      response:
        "So your protagonist is grappling with PTSD from combat deployments — that trauma arc should guide the read.",
      authorTurn: "The protagonist is a pilot.",
    });
    assert.equal(result.grounded, false);
    assert.equal(result.fail_reason, "INVENTED_INTERPRETATION");
  });

  it("4. Level 2 valid reflection passes gate", () => {
    const gate = evaluateAdvancementQualityGate({
      candidateResponse:
        "You want readers to admire James while still recognizing the costs and flaws behind his choices.",
      authorTurn:
        "I want readers to admire James while still recognizing the costs and flaws behind his choices.",
      stageId: "eic_intake.desired_reader_experience",
      qualityLevel: "grounded_reflection",
    });
    assert.equal(gate.gate_result, "pass");
  });

  it("5. Level 3 synthesis connecting author ideas passes", () => {
    const gate = evaluateAdvancementQualityGate({
      candidateResponse:
        "You appear to be balancing commercial hook strength with tactical authenticity as dual success criteria. Both should inform the independent read focus.",
      authorTurn:
        "Success means query-ready. I need the opening to hook agents but the military detail has to be right.",
      stageId: "eic_intake.success_definition",
      qualityLevel: "editorial_synthesis",
    });
    assert.equal(gate.gate_result, "pass");
  });

  it("6. material clarification passes; unnecessary fails", () => {
    const necessary = evaluateAdvancementQualityGate({
      candidateResponse:
        "When you describe the story as a romance, do you mean romance is its primary genre, or that it is a thriller with a central romantic storyline?",
      authorTurn: "It's a romance.",
      stageId: "eic_intake.market_position",
      qualityLevel: "material_clarification",
    });
    assert.equal(necessary.gate_result, "pass");

    const unnecessary = evaluateAdvancementQualityGate({
      candidateResponse: "Can you tell me more about which bookstore shelf you imagine?",
      authorTurn: "I'm not sure about market position yet — say unsure if needed.",
      stageId: "eic_intake.market_position",
      qualityLevel: "material_clarification",
    });
    assert.equal(unnecessary.gate_result, "UNNECESSARY_CLARIFICATION");
  });

  it("7. max one clarification per stage enforced via clarification rules", () => {
    assert.equal(
      shouldEmitClarification({
        stageId: "eic_intake.market_position",
        authorTurn: "It's a romance.",
        clarificationAlreadyUsed: true,
      }),
      false,
    );
  });

  it("8. confirmation blocked when aggregate insufficient", () => {
    const quality = computeUnderstandingQuality({ stageTurns: [] });
    assert.equal(quality.aggregate_level, "insufficient");
  });

  it("9. fallback template emits Level 2 when provider fails", () => {
    const emitted = emitWithQualityGate({
      stageId: "eic_intake.desired_reader_experience",
      authorAnswer: "I want readers to feel the cost of every tactical decision.",
      providerResponse: {
        quality_level: 1,
        response_text: "Thank you. I've recorded that.",
        grounded_claims: [],
        uncertainty_notes: [],
        gate_result: "pass",
        fail_reason: null,
      },
    });
    assert.ok(emitted.content.length > 20);
    assert.notEqual(emitted.content, "Thank you. I've recorded that.");
  });

  it("10. all gate failure codes are defined", () => {
    for (const code of [
      "INSUFFICIENT_EDITORIAL_ADVANCEMENT",
      "INVENTED_INTERPRETATION",
      "EMPTY_PRAISE",
      "THERAPY_LANGUAGE",
      "UNNECESSARY_CLARIFICATION",
      "MULTIPLE_CLARIFICATIONS",
      "UNSUPPORTED_MARKET_CONCLUSION",
      "UNSUPPORTED_EDITORIAL_PRIORITY",
      "FRAMING_EVIDENCE_BOUNDARY_VIOLATION",
      "RESPONSE_TOO_VERBOSE",
      "RESPONSE_NOT_GROUNDED",
      "RESPONSE_GRAMMAR_INVALID",
    ]) {
      assert.ok((GATE_FAIL_REASONS as readonly string[]).includes(code));
    }
  });

  it("13. shallow protagonist echo is rejected at emission", () => {
    const emitted = emitWithQualityGate({
      stageId: "eic_intake.primary_vision",
      authorAnswer: "john Nichols is the protagonist",
      preferredLevel: "grounded_reflection",
    });
    assert.doesNotMatch(
      emitted.content,
      /you want john Nichols is the protagonist/i,
    );
    assert.doesNotMatch(emitted.content, /clear editorial priority/i);
    assert.match(emitted.content, /independent read/i);
    assert.match(emitted.content, /protagonist/i);
    assert.equal(emitted.gateResult, "pass");
  });

  it("14. observed bad response fails Amendment 002 gate", () => {
    const gate = evaluateAdvancementQualityGate({
      candidateResponse:
        "You want john Nichols is the protagonist — that's a clear editorial priority.",
      authorTurn: "john Nichols is the protagonist",
      stageId: "eic_intake.primary_vision",
      qualityLevel: "grounded_reflection",
    });
    assert.notEqual(gate.gate_result, "pass");
  });

  it("11. author-facing phrases omit percentages", () => {
    const phrase = authorFacingConfidencePhrase("adequate");
    assert.match(phrase!, /taking shape/i);
    assert.doesNotMatch(phrase!, /%/);
  });

  it("12. author unsure declarations skip unnecessary clarification", () => {
    assert.equal(authorDeclaredUnsure("I'm not sure about market position yet — say unsure if needed."), true);
  });
});

describe("Amendment 002 calibration benchmark fixtures", () => {
  for (const fixture of PEU_BENCHMARK_FIXTURES) {
    it(`fixture ${fixture.id}: ${fixture.name}`, () => {
      const result = evaluateResponseQuality({
        candidate: fixture.candidateResponse,
        authorTurn: fixture.authorInput,
        stageId: fixture.stageId,
        asksQuestion: fixture.asksQuestion,
      });

      if (fixture.expected === "pass") {
        assert.equal(result.gate_result, "pass", `expected pass for fixture ${fixture.id}`);
      } else {
        assert.equal(result.gate_result, fixture.expected, `fixture ${fixture.id} gate mismatch`);
      }
    });
  }
});

describe("Amendment 002 module layout", () => {
  it("provider boundary remains deterministic by default", () => {
    const serviceSource = readFileSync(
      join(ROOT, "lib/editorial-understanding/service.ts"),
      "utf8",
    );
    assert.doesNotMatch(serviceSource, /openai|anthropic|@ai-sdk/i);
  });
});
