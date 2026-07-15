import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAuthoritativeReviewDisplay,
  EXPORT_BLOCKED_MESSAGE,
  HISTORICAL_REVIEW_LABEL,
  hasFalseCurrentLengthThousandsLanguage,
  resolveAuthoritativeReviewFromList,
  sanitizeMemoForAuthoritativeExport,
  validateAuthoritativeExport,
} from "./authoritative-review-display.ts";
import { buildGradingExplanationDisplay } from "./grading-explanation-display.ts";
import { buildLiteraryAgentReviewDocxText } from "./literary-agent-docx.ts";
import type { Review } from "./types.ts";

const MANUSCRIPT_ID = "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const ACTIVE_REVIEW_ID = "04c525db-5091-4179-8086-8242b7c7f169";
const SUPERSEDED_REVIEW_ID = "7822524d-20cb-403b-ab28-a320e0debd60";
const VERSION_ID = "4ba2909f-cdd6-40cb-9dbf-934df71246cd";
const CANONICAL = 111_491;

function holdFastMemo(): string {
  return `Decision

**REVISE & RESUBMIT**

The manuscript is ${CANONICAL.toLocaleString()} words.`;
}

function makeHoldFastReview(overrides: Partial<Review> = {}): Review {
  return {
    id: ACTIVE_REVIEW_ID,
    manuscript_id: MANUSCRIPT_ID,
    provider: "anthropic",
    perspective: "commercial",
    model: "claude",
    content: holdFastMemo(),
    metadata: null,
    created_at: "2026-07-15T00:00:00Z",
    lifecycle_status: "active",
    manuscript_score: 76.6,
    manuscript_letter_grade: "C",
    craft_score: 55.6,
    acquisition_readiness_score: 21,
    manuscript_version_id: VERSION_ID,
    canonical_word_count: CANONICAL,
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
      prior_manuscript_version_id: VERSION_ID,
      manuscript_version_id: VERSION_ID,
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

describe("authoritative review resolution", () => {
  it("default export resolves the single active commercial review", () => {
    const active = makeHoldFastReview();
    const superseded = makeHoldFastReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
      created_at: "2026-01-01T00:00:00Z",
    });
    const result = resolveAuthoritativeReviewFromList({
      manuscriptId: MANUSCRIPT_ID,
      currentVersionId: VERSION_ID,
      reviews: [superseded, active],
      reviewerType: "commercial",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.review.id, ACTIVE_REVIEW_ID);
    assert.equal(result.isHistorical, false);
  });

  it("excludes superseded review by default", () => {
    const superseded = makeHoldFastReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
    });
    const result = resolveAuthoritativeReviewFromList({
      manuscriptId: MANUSCRIPT_ID,
      currentVersionId: VERSION_ID,
      reviews: [superseded],
      reviewerType: "commercial",
    });
    assert.equal(result.ok, false);
  });

  it("explicit historical export resolves superseded review", () => {
    const superseded = makeHoldFastReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
    });
    const result = resolveAuthoritativeReviewFromList({
      manuscriptId: MANUSCRIPT_ID,
      currentVersionId: VERSION_ID,
      reviews: [superseded],
      reviewerType: "commercial",
      explicitReviewId: SUPERSEDED_REVIEW_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.isHistorical, true);
  });

  it("multiple active reviews cause a hard error", () => {
    const a = makeHoldFastReview({ id: "a1" });
    const b = makeHoldFastReview({ id: "a2", created_at: "2026-07-16T00:00:00Z" });
    const result = resolveAuthoritativeReviewFromList({
      manuscriptId: MANUSCRIPT_ID,
      currentVersionId: VERSION_ID,
      reviews: [a, b],
      reviewerType: "commercial",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Multiple active/);
  });

  it("does not silently fall back when active review version mismatches", () => {
    const stale = makeHoldFastReview({ manuscript_version_id: "old-version" });
    const result = resolveAuthoritativeReviewFromList({
      manuscriptId: MANUSCRIPT_ID,
      currentVersionId: VERSION_ID,
      reviews: [stale],
      reviewerType: "commercial",
    });
    assert.equal(result.ok, false);
  });
});

describe("authoritative review display", () => {
  it("UI and DOCX use the same display model", () => {
    const review = makeHoldFastReview();
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
      assessments: [],
    });
    assert.ok(display);
    const uiGrading = display!.grading;
    const legacy = buildGradingExplanationDisplay({
      review,
      memoContent: holdFastMemo(),
      assessments: [],
    });
    assert.deepEqual(uiGrading.total_score, legacy?.total_score);
    const docxText = buildLiteraryAgentReviewDocxText(display!);
    assert.match(docxText, /76\.6/);
    assert.match(docxText, /111,491/);
    assert.match(docxText, /Revise & Resubmit/);
  });

  it("selects review 04c525db with canonical 111491 and normalized 76.6", () => {
    const review = makeHoldFastReview();
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    assert.equal(display!.review_id, ACTIVE_REVIEW_ID);
    assert.equal(display!.canonical_word_count, CANONICAL);
    assert.equal(display!.grading.total_score, 76.6);
    assert.equal(display!.grading.craft_score, 55.6);
    assert.equal(display!.grading.acquisition_score, 21);
  });

  it("labels historical superseded export", () => {
    const review = makeHoldFastReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
    });
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
      isHistorical: true,
    });
    assert.equal(display!.historical_label, HISTORICAL_REVIEW_LABEL);
  });

  it("removes raw Grade: lines from sanitized memo", () => {
    const memo = `${holdFastMemo()}\n\n**Grade: C+**\n`;
    const cleaned = sanitizeMemoForAuthoritativeExport(memo);
    assert.doesNotMatch(cleaned, /Grade:\s*C\+/);
  });

  it("blocks export when false 150k language is present", () => {
    const review = makeHoldFastReview({
      content: `${holdFastMemo()}\n\nThe draft reads well past 150k.`,
    });
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    assert.equal(
      hasFalseCurrentLengthThousandsLanguage(display!.memo_content, CANONICAL),
      true,
    );
    const validation = validateAuthoritativeExport(display!);
    assert.equal(validation.ok, false);
  });

  it("removes model Grade: lines from display memo (export proceeds when absent after sanitization)", () => {
    const review = makeHoldFastReview({
      content: `${holdFastMemo()}\nGrade: C+`,
    });
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    assert.doesNotMatch(display!.memo_content, /Grade:\s*C\+/);
    const validation = validateAuthoritativeExport(display!);
    assert.equal(validation.ok, true, validation.errors.join("; "));
  });

  it("passes safety gates for authoritative Hold Fast active review", () => {
    const review = makeHoldFastReview();
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
    });
    assert.ok(display);
    const validation = validateAuthoritativeExport(display!, {
      requireActive: true,
      expectedReviewId: ACTIVE_REVIEW_ID,
      expectedCanonicalWordCount: CANONICAL,
      expectedNormalizedScore: 76.6,
    });
    assert.equal(validation.ok, true, validation.errors.join("; "));
  });

  it("requires explanation sections to be present", () => {
    const review = makeHoldFastReview({
      rubric_breakdown: null,
      manuscript_score: null,
      scoring_gate_valid: false,
    });
    const display = buildAuthoritativeReviewDisplay({
      review,
      manuscriptTitle: "Hold Fast",
    });
    assert.equal(display, null);
  });

  it("uses the canonical export blocked message constant", () => {
    assert.match(EXPORT_BLOCKED_MESSAGE, /authoritative validated assessment/);
  });
});
