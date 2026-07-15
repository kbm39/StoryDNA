import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGradingExplanationDisplay,
  descriptiveBandForScore,
  extractMemoRecommendation,
  formatRecommendationLabel,
  inferComparisonMode,
} from "./grading-explanation-display.ts";
import type { Review } from "./types.ts";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    manuscript_id: "m1",
    provider: "anthropic",
    perspective: "commercial",
    model: "claude",
    content: "Decision\n\n**REVISE & RESUBMIT**\n\nThe manuscript is 111,491 words.",
    metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    lifecycle_status: "active",
    manuscript_score: 76.6,
    manuscript_letter_grade: "C",
    craft_score: 55.6,
    acquisition_readiness_score: 21,
    manuscript_version_id: "v1",
    contrary_evidence_gate_status: "completed",
    scoring_gate_valid: true,
    rubric_breakdown: {
      craft_categories: [
        {
          category_key: "premise_hook",
          category_name: "Premise and hook",
          points_earned: 5.6,
          maximum_points: 7,
          deduction: 1,
          weighted_contribution: 5.6,
          confidence: "medium",
          strengths: ["Strong opening"],
          deductions: ["Familiar setup"],
          deduction_reasons: ["Echoes genre conventions"],
          revision_to_recover: "Sharpen distinctiveness",
          examples: [
            { location: "Ch. 1", text: "Example one from manuscript text here." },
            { location: "Ch. 2", text: "Example two from manuscript text here." },
          ],
        },
      ],
      acquisition_categories: [],
      length_recommendations: [],
    },
    grading_metadata: {
      prior_manuscript_version_id: "v1",
      manuscript_version_id: "v1",
      contrary_evidence_gate: {
        raw_model_score: 70,
        normalized_application_score: 76.6,
        normalization_adjustments: {
          duplicate_removed: 11,
          repeated_evidence_removed: 5,
          valid_deductions_retained_points: 14.5,
          mechanically_recoverable_points: 9,
          evidence_ceiling_reductions: 8.9,
          unsupported_removed: 0,
          root_issue_caps_applied: 0,
          raw_score: 70,
          normalized_score: 76.6,
          lines: ["Duplicate deductions removed: 11 (15.50 pts)"],
        },
      },
    },
    ...overrides,
  };
}

describe("grading explanation display", () => {
  it("extracts REVISE & RESUBMIT recommendation", () => {
    assert.equal(extractMemoRecommendation("**REVISE & RESUBMIT**"), "REVISE & RESUBMIT");
    assert.equal(formatRecommendationLabel("REVISE & RESUBMIT"), "Revise & Resubmit");
  });

  it("uses descriptive band for C-range revise recommendation", () => {
    assert.equal(
      descriptiveBandForScore(76.6, "REVISE & RESUBMIT"),
      "Promising, meaningful revision recommended",
    );
  });

  it("infers same-version reassessment when version ids match", () => {
    assert.equal(inferComparisonMode(makeReview()), "SAME_VERSION_REASSESSMENT");
  });

  it("builds explanation from persisted rubric and metadata", () => {
    const display = buildGradingExplanationDisplay({
      review: makeReview(),
      memoContent: makeReview().content,
      assessments: [],
    });
    assert.ok(display);
    assert.equal(display!.total_score, 76.6);
    assert.equal(display!.adjustments?.raw_model_score, 70);
    assert.equal(display!.adjustments?.normalized_application_score, 76.6);
    assert.equal(display!.comparison_mode, "SAME_VERSION_REASSESSMENT");
  });

  it("returns null for legacy reviews without rubric scores", () => {
    const legacy = makeReview({ manuscript_score: null, rubric_breakdown: null });
    assert.equal(
      buildGradingExplanationDisplay({ review: legacy, memoContent: "" }),
      null,
    );
  });
});
