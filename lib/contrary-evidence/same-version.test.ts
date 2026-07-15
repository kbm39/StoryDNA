import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeSameVersionDeductionAdjustment,
  markSameVersionDuplicates,
  resolveComparisonMode,
  runContraryEvidenceGate,
  selectPriorReviewCandidate,
  statusZeroesDeduction,
} from "./index.ts";
import { enforceScoringGate } from "./scoring-gate.ts";
import type { ConcernAssessment } from "./types.ts";
import { holdFastTestFixture } from "./fixtures/hold-fast.ts";
import { romanceImprovedFixture } from "./fixtures/romance.ts";

function makeSameVersionAssessment(overrides: Partial<ConcernAssessment> = {}): ConcernAssessment {
  return {
    comparison_mode: "SAME_VERSION_REASSESSMENT",
    concern_id: "c1",
    root_issue: "weak stakes",
    rubric_category: "stakes_emotional_impact",
    prior_criticism: "Stakes feel low",
    prior_evidence: [],
    current_supporting_evidence: [],
    current_contrary_evidence: [],
    revision_that_addresses_it: null,
    original_basis_still_present: false,
    status: "UNSUPPORTED",
    confidence: "high",
    prior_deduction: 3,
    points_restored: 0,
    points_invalidated: 3,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction: 0,
    narrowed_current_finding: null,
    explanation: "test",
    contrary_evidence_analysis: "",
    ...overrides,
  };
}

describe("Same-version comparison mode", () => {
  it("identical version IDs trigger SAME_VERSION_REASSESSMENT", () => {
    const mode = resolveComparisonMode({
      priorVersionId: "v1",
      currentVersionId: "v1",
    });
    assert.equal(mode, "SAME_VERSION_REASSESSMENT");
  });

  it("identical content hash triggers SAME_VERSION_REASSESSMENT", () => {
    const mode = resolveComparisonMode({
      priorVersionId: "v1",
      currentVersionId: "v2",
      priorContentHash: "abc",
      currentContentHash: "abc",
    });
    assert.equal(mode, "SAME_VERSION_REASSESSMENT");
  });

  it("differing version IDs trigger REVISION_COMPARISON", () => {
    const mode = resolveComparisonMode({
      priorVersionId: "v1",
      currentVersionId: "v2",
      priorContentHash: "abc",
      currentContentHash: "def",
    });
    assert.equal(mode, "REVISION_COMPARISON");
  });

  it("identical text cannot be labeled substantially improved", async () => {
    const result = await runContraryEvidenceGate({
      priorReview: holdFastTestFixture.priorReview,
      priorText: holdFastTestFixture.currentText,
      currentText: holdFastTestFixture.currentText,
      genre: holdFastTestFixture.genre,
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      prior_version_id: "v1",
      current_version_id: "v1",
    });
    assert.equal(result.comparison_mode, "SAME_VERSION_REASSESSMENT");
    for (const a of result.assessments) {
      assert.ok(
        !["SUBSTANTIALLY_IMPROVED", "PARTIALLY_IMPROVED", "RESOLVED"].includes(a.status),
        `invalid revision status ${a.status} in same-version mode`,
      );
    }
  });

  it("identical text cannot receive revision-restored points", async () => {
    const result = await runContraryEvidenceGate({
      priorReview: holdFastTestFixture.priorReview,
      priorText: holdFastTestFixture.currentText,
      currentText: holdFastTestFixture.currentText,
      genre: holdFastTestFixture.genre,
      comparison_mode: "SAME_VERSION_REASSESSMENT",
    });
    assert.equal(result.scoring_gate.total_points_restored, 0);
    for (const a of result.assessments) {
      assert.equal(a.points_restored, 0);
    }
  });

  it("unsupported same-version deductions are invalidated", () => {
    const adj = computeSameVersionDeductionAdjustment(4, "UNSUPPORTED");
    assert.equal(adj.points_invalidated, 4);
    assert.equal(adj.remaining_deduction, 0);
    assert.equal(adj.points_restored, 0);
  });

  it("duplicate same-version deductions are removed", () => {
    const assessments: ConcernAssessment[] = [
      makeSameVersionAssessment({
        concern_id: "a1",
        root_issue: "pacing sags",
        status: "SUPPORTED",
        remaining_deduction: 3,
        points_invalidated: 0,
      }),
      makeSameVersionAssessment({
        concern_id: "a2",
        root_issue: "pacing sags",
        status: "SUPPORTED",
        prior_deduction: 2,
        remaining_deduction: 2,
        points_invalidated: 0,
      }),
    ];
    const marked = markSameVersionDuplicates(assessments);
    const dup = marked.find((a) => a.concern_id === "a2");
    assert.equal(dup?.status, "DUPLICATED");
    assert.equal(dup?.duplicate_points_removed, 2);
    assert.equal(dup?.remaining_deduction, 0);
  });

  it("scoring gate rejects points_restored in same-version mode", () => {
    const gate = enforceScoringGate({
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      assessments: [
        makeSameVersionAssessment({ points_restored: 2, status: "SUPPORTED", remaining_deduction: 1 }),
      ],
    });
    assert.equal(gate.valid, false);
    assert.ok(gate.errors.some((e) => e.includes("points_restored")));
  });
});

describe("Prior review selection", () => {
  it("selects newest valid differing prior version for revision comparison", () => {
    const selection = selectPriorReviewCandidate(
      [
        {
          review_id: "r-new-same",
          created_at: "2026-03-01T00:00:00Z",
          manuscript_version_id: "v-current",
          version_created_at: null,
          content_hash: "h2",
          word_count: 100,
          lifecycle_status: "active",
          manuscript_score: 70,
        },
        {
          review_id: "r-old-diff",
          created_at: "2026-02-01T00:00:00Z",
          manuscript_version_id: "v-old",
          version_created_at: null,
          content_hash: "h1",
          word_count: 99,
          lifecycle_status: "superseded",
          manuscript_score: 65,
        },
      ],
      "v-current",
    );
    assert.equal(selection.comparison_mode, "REVISION_COMPARISON");
    assert.equal(selection.selected?.review_id, "r-old-diff");
    assert.equal(selection.same_version_grading_review_id, "r-new-same");
  });

  it("falls back to same-version reassessment when no differing version exists", () => {
    const selection = selectPriorReviewCandidate(
      [
        {
          review_id: "r-active",
          created_at: "2026-03-01T00:00:00Z",
          manuscript_version_id: "v1",
          version_created_at: null,
          content_hash: "h1",
          word_count: 100,
          lifecycle_status: "active",
          manuscript_score: 70,
        },
      ],
      "v1",
    );
    assert.equal(selection.comparison_mode, "SAME_VERSION_REASSESSMENT");
    assert.equal(selection.selected?.review_id, "r-active");
  });
});

describe("Status zeroing by mode", () => {
  it("UNSUPPORTED zeroes in same-version mode only", () => {
    assert.equal(statusZeroesDeduction("UNSUPPORTED", "SAME_VERSION_REASSESSMENT"), true);
    assert.equal(statusZeroesDeduction("UNSUPPORTED", "REVISION_COMPARISON"), false);
  });

  it("RESOLVED zeroes in revision mode only", () => {
    assert.equal(statusZeroesDeduction("RESOLVED", "REVISION_COMPARISON"), true);
    assert.equal(statusZeroesDeduction("RESOLVED", "SAME_VERSION_REASSESSMENT"), false);
  });
});

describe("Revision comparison still works", () => {
  it("differing texts use revision comparison path", async () => {
    const result = await runContraryEvidenceGate({
      priorReview: romanceImprovedFixture.priorReview,
      priorText: romanceImprovedFixture.priorText,
      currentText: romanceImprovedFixture.currentText,
      genre: romanceImprovedFixture.genre,
      prior_version_id: "prior-v",
      current_version_id: "current-v",
    });
    assert.equal(result.comparison_mode, "REVISION_COMPARISON");
    assert.ok(result.assessments.some((a) => a.comparison_mode === "REVISION_COMPARISON"));
  });
});
