import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POSITIVE_EVIDENCE_CEILING_FRACTION,
  assessPositiveEvidenceCeiling,
  computeNormalizedCategoryScore,
} from "./positive-evidence-ceiling.ts";
import type { RubricCategoryScore } from "../commercial-fiction-rubric.ts";

function makeCat(overrides: Partial<RubricCategoryScore> = {}): RubricCategoryScore {
  return {
    category_key: "pacing_narrative_tension",
    category_name: "Pacing",
    maximum_points: 10,
    points_earned: 6,
    deduction: 4,
    deductions: ["Issue A"],
    deduction_reasons: ["Issue A"],
    strengths: ["Strong opening hook maintains tension through Act I"],
    examples: [
      { text: "The train lurched forward and she gripped the railing.", location: "Ch. 1" },
      { text: "By midnight the platform was empty except for him.", location: "Ch. 3" },
    ],
    revision_to_recover: "Tighten denouement.",
    confidence: "medium",
    insufficient_evidence: false,
    weighted_contribution: 6,
    ...overrides,
  };
}

describe("positive evidence ceiling", () => {
  it("maps strength levels to configured fractions", () => {
    assert.equal(POSITIVE_EVIDENCE_CEILING_FRACTION.EXCEPTIONAL, 1.0);
    assert.equal(POSITIVE_EVIDENCE_CEILING_FRACTION.STRONG, 0.9);
    assert.equal(POSITIVE_EVIDENCE_CEILING_FRACTION.MIXED, 0.8);
    assert.equal(POSITIVE_EVIDENCE_CEILING_FRACTION.WEAK, 0.7);
    assert.equal(POSITIVE_EVIDENCE_CEILING_FRACTION.INSUFFICIENT, 0.6);
  });

  it("removing all deductions does not automatically create perfect score", () => {
    const cat = makeCat({ points_earned: 6, deduction: 4, confidence: "medium" });
    const assessment = assessPositiveEvidenceCeiling(cat);
    const result = computeNormalizedCategoryScore({
      cat,
      raw_awarded: 6,
      valid_deductions_retained: 0,
      invalid_deductions_removed: 4,
      ceiling_points: assessment.ceiling_points,
    });
    assert.ok(result.normalized_awarded < cat.maximum_points);
    assert.equal(result.normalized_awarded, assessment.ceiling_points);
  });

  it("normalized score cannot exceed positive-evidence ceiling", () => {
    const cat = makeCat({ points_earned: 9, deduction: 1, confidence: "high" });
    const assessment = assessPositiveEvidenceCeiling(cat);
    const result = computeNormalizedCategoryScore({
      cat,
      raw_awarded: 9,
      valid_deductions_retained: 0,
      invalid_deductions_removed: 1,
      ceiling_points: assessment.ceiling_points,
    });
    assert.ok(result.normalized_awarded <= assessment.ceiling_points + 0.01);
  });

  it("raw score plus removed deductions is capped by supported ceiling", () => {
    const cat = makeCat();
    const ceiling = 8;
    const result = computeNormalizedCategoryScore({
      cat,
      raw_awarded: 6,
      valid_deductions_retained: 0,
      invalid_deductions_removed: 3,
      ceiling_points: ceiling,
    });
    assert.equal(result.normalized_awarded, 8);
    assert.equal(result.recoverable_from_invalid, 2);
  });

  it("full points require exceptional positive evidence", () => {
    const cat = makeCat({
      strengths: [
        "Opening chapters sustain propulsive tension across three POV threads",
        "Midpoint reversal lands with clear causal setup",
      ],
      confidence: "high",
      deduction: 1,
      points_earned: 9,
    });
    const assessment = assessPositiveEvidenceCeiling(cat);
    assert.equal(assessment.strength, "EXCEPTIONAL");
    assert.equal(assessment.ceiling_points, 10);
  });
});
