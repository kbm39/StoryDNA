import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReviewProvenance,
  classifyReviewStaleness,
  listCommercialReviewHistory,
  SUPERSEDED_REVIEW_DISCLAIMER,
} from "./review-provenance.ts";
import type { Review } from "./types.ts";

const MANUSCRIPT_ID = "9f482ca2-a0f6-4709-8364-18a0ef950eb0";
const ACTIVE_REVIEW_ID = "04c525db-5091-4179-8086-8242b7c7f169";
const SUPERSEDED_REVIEW_ID = "7822524d-20cb-403b-ab28-a320e0debd60";
const VERSION_ID = "4ba2909f-cdd6-40cb-9dbf-934df71246cd";
const CANONICAL = 111_491;

function holdFastMemo(): string {
  return `Decision\n\n**REVISE & RESUBMIT**\n\nThe manuscript is ${CANONICAL.toLocaleString()} words.`;
}

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: ACTIVE_REVIEW_ID,
    manuscript_id: MANUSCRIPT_ID,
    provider: "anthropic",
    perspective: "commercial",
    model: "claude-opus-4-8",
    content: holdFastMemo(),
    metadata: null,
    created_at: "2026-07-15T14:15:29.905Z",
    lifecycle_status: "active",
    manuscript_version_id: VERSION_ID,
    canonical_word_count: CANONICAL,
    scoring_gate_valid: true,
    manuscript_score: 76.6,
    ...overrides,
  };
}

describe("review provenance", () => {
  it("classifies clean Hold Fast active review as authoritative", () => {
    const review = makeReview();
    const staleness = classifyReviewStaleness({
      review,
      currentVersionId: VERSION_ID,
      fallbackWordCount: CANONICAL,
    });
    assert.equal(staleness.pre_enforcement, false);
    assert.equal(staleness.contradicts_canonical_statistics, false);
    assert.equal(staleness.version_mismatch, false);

    const provenance = buildReviewProvenance({
      review,
      currentVersionId: VERSION_ID,
      fallbackWordCount: CANONICAL,
      authoritativeReviewId: ACTIVE_REVIEW_ID,
    });
    assert.equal(provenance.canonical_word_count, CANONICAL);
    assert.equal(provenance.is_authoritative_active, true);
    assert.equal(provenance.model, "claude-opus-4-8");
  });

  it("flags pre-enforcement review with false 130k language", () => {
    const review = makeReview({
      id: "03aba0ea-7783-4061-a59a-ca099e8f024e",
      canonical_word_count: null,
      scoring_gate_valid: null,
      content: `${holdFastMemo()}\n\nThe draft is comfortably north of 130k.`,
    });
    const staleness = classifyReviewStaleness({
      review,
      currentVersionId: VERSION_ID,
      fallbackWordCount: 108_556,
    });
    assert.equal(staleness.pre_enforcement, true);
    assert.equal(staleness.contradicts_canonical_statistics, true);

    const provenance = buildReviewProvenance({
      review,
      currentVersionId: VERSION_ID,
      fallbackWordCount: 108_556,
    });
    assert.ok(provenance.status_labels.includes("Pre-enforcement"));
    assert.ok(provenance.status_labels.includes("Contradicts canonical statistics"));
  });

  it("lists editorial history with authoritative row marked", () => {
    const active = makeReview();
    const superseded = makeReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
      created_at: "2026-07-15T05:50:54.161Z",
    });
    const history = listCommercialReviewHistory({
      manuscriptId: MANUSCRIPT_ID,
      reviews: [superseded, active],
      currentVersionId: VERSION_ID,
      fallbackWordCount: CANONICAL,
      authoritativeReviewId: ACTIVE_REVIEW_ID,
      manuscriptPagePath: `/manuscripts/${MANUSCRIPT_ID}`,
    });
    assert.equal(history.length, 2);
    assert.equal(history[0]!.review_id, ACTIVE_REVIEW_ID);
    assert.equal(history[0]!.is_authoritative_active, true);
    assert.equal(history[1]!.view_href, `/manuscripts/${MANUSCRIPT_ID}?review=${SUPERSEDED_REVIEW_ID}`);
  });

  it("includes superseded disclaimer for historical reviews", () => {
    const review = makeReview({
      id: SUPERSEDED_REVIEW_ID,
      lifecycle_status: "superseded",
    });
    const provenance = buildReviewProvenance({
      review,
      currentVersionId: VERSION_ID,
      fallbackWordCount: CANONICAL,
      isHistoricalView: true,
    });
    assert.equal(provenance.historical_disclaimer, SUPERSEDED_REVIEW_DISCLAIMER);
    assert.ok(provenance.warnings.includes(SUPERSEDED_REVIEW_DISCLAIMER));
  });
});
