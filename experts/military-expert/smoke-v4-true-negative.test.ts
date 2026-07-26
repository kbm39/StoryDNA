import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreCalibrationCase } from "@/lib/expert-calibration/scoring.ts";
import type { CalibrationProjectedFinding, CalibrationScoringContext } from "@/lib/expert-calibration/contracts.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";
import { validateMilitaryExpertGenerationPayload } from "./output-schema.ts";
import {
  buildCorrectedMeCoc002V4Payload,
  SMOKE_V4_FIXTURE_GENERIC_PRAISE,
} from "./smoke-v4-scoring-fixtures.ts";
import { parseMilitaryExpertGenerationResponse } from "./parsing.ts";

describe("military expert me-coc-002 true-negative scoring", () => {
  const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
    (entry) => entry.case_id === "me-coc-002",
  )!;

  const trueNegativeContext: CalibrationScoringContext = {
    strengths: ["Plausible executive-officer coordination before the fragmentary order"],
    summary:
      "No material inaccuracies were found in the supplied command interaction, though broader period context remains uncertain.",
    conclusion:
      "Company command interaction is credible; no material inaccuracies were found in the supplied scope.",
    category_assessments: [
      {
        category: "command_and_organization",
        status: "credible",
        strength_summary: "Company command interaction reads accurately",
        concern_summary: "No material concerns in scope",
      },
    ],
  };

  it("passes without literal accurate-coc ID via true-negative context", () => {
    const score = scoreCalibrationCase(calibrationCase, [], { context: trueNegativeContext });
    assert.equal(score.false_negatives.length, 0);
    assert.equal(score.true_negative_diagnostic?.passed, true);
    assert.equal(score.expectation_matches[0]?.match_source, "true_negative_context");
  });

  it("passes with semantic finding and different model ID", () => {
    const projected: CalibrationProjectedFinding = {
      finding_key: "command-chain-plausible",
      category: "command_and_organization",
      title: "Company command coordination reads plausibly",
      observation:
        "The company commander coordinating through the executive officer before issuing the fragmentary order reads plausibly.",
      combined_text:
        "The company commander coordinating through the executive officer before issuing the fragmentary order reads plausibly.",
      realism_status: "accurate",
      severity: "informational",
      confidence: "high",
      has_manuscript_evidence: true,
      evidence_excerpts: ["The company commander nodded to the executive officer."],
      has_contrary_evidence: false,
      contrary_evidence_explicit_none: false,
      escalation_expert: null,
      recommendation_type: "preserve",
      preservation_note_present: true,
      operational_impact_present: true,
      story_impact_present: true,
      uncertainty_note_present: false,
      safety_violation: false,
    };
    const score = scoreCalibrationCase(calibrationCase, [projected], { context: trueNegativeContext });
    assert.equal(score.false_negatives.length, 0);
    assert.equal(score.expectation_matches[0]?.match_source, "semantic_finding");
  });

  it("fails on false-positive command criticism", () => {
    const projected: CalibrationProjectedFinding = {
      finding_key: "false-command-error",
      category: "command_and_organization",
      title: "Command chain appears broken",
      observation: "The fragmentary order sequence suggests a rank authority error.",
      combined_text: "The fragmentary order sequence suggests a rank authority error.",
      realism_status: "confirmed_error",
      severity: "major",
      confidence: "medium",
      has_manuscript_evidence: true,
      evidence_excerpts: ["The company commander nodded to the executive officer."],
      has_contrary_evidence: false,
      contrary_evidence_explicit_none: true,
      escalation_expert: null,
      recommendation_type: "correct",
      preservation_note_present: true,
      operational_impact_present: true,
      story_impact_present: true,
      uncertainty_note_present: false,
      safety_violation: false,
    };
    const score = scoreCalibrationCase(calibrationCase, [projected], { context: trueNegativeContext });
    assert.ok(score.non_finding_violations.length > 0);
  });

  it("fails on generic praise without substantive assessment", () => {
    const parsed = parseMilitaryExpertGenerationResponse(SMOKE_V4_FIXTURE_GENERIC_PRAISE);
    assert.equal(parsed.ok, false);
    const validation = validateMilitaryExpertGenerationPayload(
      JSON.parse(SMOKE_V4_FIXTURE_GENERIC_PRAISE.responseText),
    );
    assert.equal(validation.ok, false);
    assert.ok(buildCorrectedMeCoc002V4Payload().findings.length === 0);
  });
});
