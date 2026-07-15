import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuthoritativeReviewDisplay } from "./authoritative-review-display.ts";
import {
  buildLiteraryAgentReviewDocx,
  buildLiteraryAgentReviewDocxText,
} from "./literary-agent-docx.ts";
import type { Review } from "./types.ts";

function makeReview(): Review {
  return {
    id: "04c525db-5091-4179-8086-8242b7c7f169",
    manuscript_id: "9f482ca2-a0f6-4709-8364-18a0ef950eb0",
    provider: "anthropic",
    perspective: "commercial",
    model: "claude",
    content: `Decision\n\n**REVISE & RESUBMIT**\n\nThe manuscript is 111,491 words.`,
    metadata: null,
    created_at: "2026-07-15T00:00:00Z",
    lifecycle_status: "active",
    manuscript_score: 76.6,
    manuscript_letter_grade: "C",
    craft_score: 55.6,
    acquisition_readiness_score: 21,
    manuscript_version_id: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
    canonical_word_count: 111_491,
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
          ],
        },
      ],
      acquisition_categories: [],
      length_recommendations: [],
    },
    grading_metadata: {
      prior_manuscript_version_id: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
      manuscript_version_id: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
      contrary_evidence_gate: {
        raw_model_score: 70,
        normalized_application_score: 76.6,
        normalization_adjustments: {
          duplicate_removed: 11,
          lines: ["Duplicate deductions removed: 11 (15.50 pts)"],
        },
      },
    },
  };
}

describe("literary agent DOCX export", () => {
  it("includes authoritative scores and sections in text snapshot", () => {
    const display = buildAuthoritativeReviewDisplay({
      review: makeReview(),
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    const text = buildLiteraryAgentReviewDocxText(display!);
    assert.match(text, /76\.6 \/ 100/);
    assert.match(text, /Promising, meaningful revision recommended/);
    assert.match(text, /Craft: 55\.6 \/ 70/);
    assert.match(text, /Acquisition readiness: 21 \/ 30/);
    assert.match(text, /Why this manuscript received this assessment/);
    assert.match(text, /Adjustments made by StoryDNA validation/);
    assert.match(text, /Assessment mode: Same-version reassessment/);
    assert.doesNotMatch(text, /Grade:\s*C\+/);
    assert.doesNotMatch(text, /150\s*k/i);
  });

  it("produces a non-empty DOCX buffer", async () => {
    const display = buildAuthoritativeReviewDisplay({
      review: makeReview(),
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    const buffer = await buildLiteraryAgentReviewDocx(display!);
    assert.ok(buffer.byteLength > 1000);
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
  });
});
