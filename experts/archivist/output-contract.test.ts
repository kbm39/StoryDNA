import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARCHIVIST_CANON_DELTA_REQUIRED_KEYS,
  ARCHIVIST_ENTITY_AMBIGUITY_REQUIRED_KEYS,
  ARCHIVIST_FINDING_REQUIRED_KEYS,
  ARCHIVIST_MODEL_OUTPUT_TOP_LEVEL_KEYS,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_REVIEW_TOP_LEVEL_KEYS,
} from "./output-schema.ts";
import {
  ARCHIVIST_CLASSIFICATIONS,
  ARCHIVIST_CONFIDENCE_LEVELS,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_SEVERITY_LEVELS,
  ARCHIVIST_VERSION,
} from "./contracts.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { parseArchivistReview } from "./parsing.ts";
import { validateArchivistReview } from "./validation.ts";
import {
  FIXTURE_01_WITHIN_BOOK_EXACT,
  FIXTURE_13_CLEAN_CONTROL,
  FIXTURE_14_CANON_PROMOTION,
} from "./fixtures.ts";

describe("Archivist output contract", () => {
  it("declares typed top-level, finding, delta, and ambiguity keys", () => {
    assert.equal(ARCHIVIST_REVIEW_SCHEMA, "archivist_review@v1");
    assert.deepEqual([...ARCHIVIST_MODEL_OUTPUT_TOP_LEVEL_KEYS], [
      "summary",
      "findings",
      "canon_delta",
      "entity_ambiguities",
    ]);
    assert.ok(ARCHIVIST_REVIEW_TOP_LEVEL_KEYS.includes("findings"));
    assert.ok(ARCHIVIST_REVIEW_TOP_LEVEL_KEYS.includes("canon_delta"));
    assert.ok(ARCHIVIST_REVIEW_TOP_LEVEL_KEYS.includes("entity_ambiguities"));
    assert.ok(ARCHIVIST_FINDING_REQUIRED_KEYS.includes("author_challenge_supported"));
    assert.ok(ARCHIVIST_CANON_DELTA_REQUIRED_KEYS.includes("status"));
    assert.ok(ARCHIVIST_ENTITY_AMBIGUITY_REQUIRED_KEYS.includes("recommended_author_verification"));
  });

  it("uses severity/confidence enums without letter grades", () => {
    assert.deepEqual([...ARCHIVIST_SEVERITY_LEVELS], ["critical", "major", "moderate", "minor"]);
    assert.deepEqual([...ARCHIVIST_CONFIDENCE_LEVELS], ["high", "medium", "low", "insufficient"]);
    assert.deepEqual(
      [...ARCHIVIST_CLASSIFICATIONS],
      ["confirmed_contradiction", "possible_continuity_conflict", "author_verification_needed"],
    );
  });

  it("rejects letter grades and missing author challenge", () => {
    const graded = structuredClone(FIXTURE_13_CLEAN_CONTROL.review);
    graded.summary.narrative = "This manuscript earns a B+ grade.";
    const gradedResult = validateArchivistReview(normalizeArchivistReview(graded));
    assert.equal(gradedResult.ok, false);

    const unchallenged = structuredClone(FIXTURE_13_CLEAN_CONTROL.review);
    (unchallenged as { author_challenge_supported: boolean }).author_challenge_supported = false;
    const challengeResult = validateArchivistReview(unchallenged);
    assert.equal(challengeResult.ok, false);
  });

  it("normalizes enum casing without upgrading confidence", () => {
    const raw = JSON.stringify({
      ...FIXTURE_13_CLEAN_CONTROL.review,
      findings: [
        {
          ...FIXTURE_13_CLEAN_CONTROL.review.findings[0],
          id: "casing",
          issue_type: "AGE",
          classification: "AUTHOR_VERIFICATION_NEEDED",
          severity: "MINOR",
          confidence: "LOW",
          current_location: { locator: " Chapter 1 " },
          current_evidence: [],
          conflicting_evidence: [],
          temporal_analysis: {
            relation: "unknown",
            explanation: "thin",
            current_scope: { kind: "unknown" },
          },
          explanation: "Thin support.",
          suggested_resolution: "Verify with the author.",
          author_action: "pending",
          author_challenge_supported: true,
        },
      ],
    });
    const parsed = parseArchivistReview(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.review.findings[0]?.issue_type, "age");
    assert.equal(parsed.review.findings[0]?.confidence, "low");
    assert.notEqual(parsed.review.findings[0]?.confidence, "high");
  });

  it("does not coerce accepted canon_delta into candidate during normalize", () => {
    const normalized = normalizeArchivistReview(FIXTURE_14_CANON_PROMOTION.review);
    assert.equal(normalized.canon_delta[0]?.status as string, "accepted");
    assert.equal(validateArchivistReview(normalized).ok, false);
  });

  it("within-book exact fixture preserves both locators", () => {
    const review = normalizeArchivistReview(FIXTURE_01_WITHIN_BOOK_EXACT.review);
    const finding = review.findings[0];
    assert.equal(finding?.classification, "confirmed_contradiction");
    assert.ok(finding?.current_location.locator);
    assert.ok(finding?.conflicting_location?.locator);
    assert.ok(finding?.current_evidence.length);
    assert.ok(finding?.conflicting_evidence.length);
    assert.equal(review.expert_key, ARCHIVIST_EXPERT_KEY);
    assert.equal(review.expert_version, ARCHIVIST_VERSION);
  });
});
