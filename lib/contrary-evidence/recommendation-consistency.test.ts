import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acquisitionReadinessCap,
  detectMajorRevisionBurden,
  extractMemoRecommendation,
  validateRecommendationConsistency,
} from "./recommendation-consistency.ts";
import { makeStackedAuditRubric } from "./fixtures/stacked-audit.ts";

describe("recommendation consistency", () => {
  it("extracts REVISE & RESUBMIT from memo", () => {
    assert.equal(
      extractMemoRecommendation("Editorial verdict: **REVISE & RESUBMIT** after cuts."),
      "REVISE & RESUBMIT",
    );
  });

  it("REVISE & RESUBMIT cannot coexist with submission-ready A without reconciliation", () => {
    const payload = makeStackedAuditRubric();
    const result = validateRecommendationConsistency({
      memoContent: "**REVISE & RESUBMIT** — major structural revision required.",
      normalizedScore: 92,
      letterGrade: "A-",
      acquisitionScore: 30,
      acquisitionMax: 30,
      payload,
    });
    assert.equal(result.recommendation, "REVISE & RESUBMIT");
    assert.equal(result.recommendation_consistent, false);
    assert.ok(result.blocks_publication);
  });

  it("acquisition 30/30 is blocked when major revision remains", () => {
    const cap = acquisitionReadinessCap({
      acquisitionScore: 30,
      acquisitionMax: 30,
      majorRevisionRecommended: true,
    });
    assert.equal(cap.capped, true);
    assert.equal(cap.cappedScore, 27);
  });

  it("detects major revision from memo and length cuts", () => {
    const payload = makeStackedAuditRubric();
    payload.length_recommendations = [{ recommended_cut_percentage: 15, recommended_cut_words: 15000 }];
    assert.equal(
      detectMajorRevisionBurden("Needs **REVISE & RESUBMIT**.", payload),
      true,
    );
  });
});
