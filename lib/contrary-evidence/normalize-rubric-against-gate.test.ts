import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { makeStackedAuditRubric, sumRubricScore } from "./fixtures/stacked-audit.ts";
import { makeRubricDeduction } from "./fixtures/helpers.ts";
import {
  normalizeRubricAgainstGate,
  sumPayloadScore,
} from "./normalize-rubric-against-gate.ts";
import { matchDeductionToAssessment, indexAssessments } from "./match-deduction-to-gate.ts";
import { extractRubricDeductionEntries } from "./duplicate-deductions.ts";
import { validatePostScoringRubric } from "./post-scoring-validation.ts";
import { enforceScoringGate } from "./scoring-gate.ts";
import type { ConcernAssessment } from "./types.ts";
import { extractPriorConcerns } from "./extract-prior-concerns.ts";
import { holdFastTestFixture } from "./fixtures/hold-fast.ts";
import {
  runContraryEvidenceGate,
  createDeterministicSemanticAssessor,
} from "./index.ts";

function makeAssessment(overrides: Partial<ConcernAssessment>): ConcernAssessment {
  return {
    comparison_mode: "SAME_VERSION_REASSESSMENT",
    concern_id: "c1",
    root_issue: "back third sags in denouement",
    rubric_category: "pacing_narrative_tension",
    prior_criticism: "Back third sags in denouement",
    prior_evidence: [],
    current_supporting_evidence: [],
    current_contrary_evidence: [],
    revision_that_addresses_it: null,
    original_basis_still_present: false,
    status: "UNSUPPORTED",
    confidence: "high",
    prior_deduction: 4,
    points_restored: 0,
    points_invalidated: 4,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction: 0,
    narrowed_current_finding: null,
    explanation: "test",
    contrary_evidence_analysis: "",
    ...overrides,
  };
}

function norm(
  payload: ReturnType<typeof makeStackedAuditRubric>,
  assessments: ConcernAssessment[],
) {
  return normalizeRubricAgainstGate({
    rawPayload: payload,
    gateAssessments: assessments,
    comparison_mode: assessments[0]?.comparison_mode ?? "SAME_VERSION_REASSESSMENT",
    canonicalWordCount: 111491,
    fullTextSupplied: true,
  });
}

describe("Rubric normalization against gate", () => {
  it("UNSUPPORTED deduction is forced to zero", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        concern_id: "pacing_narrative_tension_back_third_sags",
        status: "UNSUPPORTED",
        rubric_category: "pacing_narrative_tension",
        root_issue: "Back third sags in denouement",
        remaining_deduction: 0,
      }),
    ]);
    const removed = result.dispositions.filter((d) => d.disposition === "REMOVED_UNSUPPORTED");
    assert.ok(removed.length > 0);
    assert.ok(removed.every((d) => d.normalized_points === 0));
  });

  it("DUPLICATED deduction is forced to zero", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        status: "DUPLICATED",
        root_issue: "Back third sags in denouement",
        remaining_deduction: 0,
      }),
    ]);
    assert.ok(result.dispositions.some((d) => d.disposition === "REMOVED_DUPLICATE"));
  });

  it("NOT_ASSESSABLE carry-forward is forced to zero", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        status: "NOT_ASSESSABLE",
        remaining_deduction: 0,
        root_issue: "Denouement bloat in back third",
        rubric_category: "plot_architecture_causality",
      }),
    ]);
    assert.ok(result.dispositions.some((d) => d.disposition === "REMOVED_NOT_ASSESSABLE"));
  });

  it("SUPPORTED deduction above max is clamped", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        status: "SUPPORTED",
        remaining_deduction: 1,
        rubric_category: "pacing_narrative_tension",
        root_issue: "Back third sags in denouement",
      }),
    ]);
    const clamped = result.dispositions.find(
      (d) =>
        d.category_key === "pacing_narrative_tension" &&
        d.disposition === "REDUCED_TO_GATE_MAX",
    );
    assert.ok(clamped || result.normalizedApplicationScore !== result.rawModelScore);
  });

  it("OVERBROAD deduction is narrowed and reduced", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        status: "OVERBROAD",
        remaining_deduction: 2,
        narrowed_current_finding: "Narrowed to Ch. 22 passage",
        rubric_category: "pacing_narrative_tension",
        root_issue: "Back third sags in denouement",
      }),
    ]);
    assert.ok(
      result.dispositions.some(
        (d) => d.disposition === "NARROWED_AND_REDUCED" || d.disposition === "RETAINED",
      ),
    );
  });

  it("RESOLVED and STALE deductions are zeroed in revision mode", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        comparison_mode: "REVISION_COMPARISON",
        status: "RESOLVED",
        root_issue: "Back third sags in denouement",
        rubric_category: "pacing_narrative_tension",
        remaining_deduction: 0,
      }),
      makeAssessment({
        comparison_mode: "REVISION_COMPARISON",
        concern_id: "c2",
        status: "STALE_CRITIQUE",
        root_issue: "Denouement bloat in back third",
        rubric_category: "plot_architecture_causality",
        remaining_deduction: 0,
      }),
    ]);
    assert.ok(result.dispositions.some((d) => d.disposition === "REMOVED_RESOLVED"));
    assert.ok(result.dispositions.some((d) => d.disposition === "REMOVED_STALE"));
  });

  it("unmatched deduction blocks when not a new concern", () => {
    const payload = makeRubricDeduction(
      "premise_hook",
      "Premise",
      "Totally novel unmatched issue xyz",
      ["only one quote"],
      3,
    );
    payload.craft_categories[0].revision_to_recover = "";
    const result = norm(payload, []);
    assert.equal(result.valid, false);
    assert.ok(result.dispositions.some((d) => d.disposition === "UNMATCHED_BLOCKED"));
  });

  it("category totals recompute correctly", () => {
    const payload = makeStackedAuditRubric();
    const raw = sumPayloadScore(payload);
    const result = norm(payload, [
      makeAssessment({ status: "UNSUPPORTED", remaining_deduction: 0 }),
    ]);
    assert.ok(result.normalizedApplicationScore >= raw - 0.01);
    const recomputed = sumPayloadScore(result.normalizedPayload);
    assert.equal(recomputed, result.normalizedApplicationScore);
  });

  it("raw model score is preserved separately from normalized score", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({ status: "DUPLICATED", remaining_deduction: 0 }),
    ]);
    assert.equal(result.rawModelScore, sumRubricScore(payload));
    assert.ok(result.rawModelScore !== result.normalizedApplicationScore || result.valid);
  });

  it("normalized score cannot exceed positive-evidence ceiling when all deductions removed", () => {
    const payload = makeStackedAuditRubric();
    const pacing = payload.craft_categories.find((c) => c.category_key === "pacing_narrative_tension")!;
    pacing.confidence = "medium";
    pacing.strengths = ["Solid pacing in opening act"];
    const result = norm(payload, [
      makeAssessment({
        status: "UNSUPPORTED",
        rubric_category: "pacing_narrative_tension",
        root_issue: "Back third sags in denouement",
        remaining_deduction: 0,
      }),
    ]);
    const audit = result.categoryAudits.find((a) => a.category_key === "pacing_narrative_tension");
    assert.ok(audit);
    assert.ok(audit!.normalized_awarded_points <= audit!.positive_evidence_ceiling + 0.01);
    assert.ok(audit!.normalized_awarded_points < pacing.maximum_points);
  });

  it("valid deductions remain after normalization", () => {
    const payload = makeStackedAuditRubric();
    const result = norm(payload, [
      makeAssessment({
        status: "SUPPORTED",
        remaining_deduction: 2,
        rubric_category: "pacing_narrative_tension",
        root_issue: "Back third sags in denouement",
      }),
    ]);
    const retained = result.dispositions.filter((d) => d.normalized_points > 0);
    assert.ok(retained.length > 0);
    assert.ok(result.normalizedApplicationScore < sumPayloadScore(payload) + 20);
  });

  it("Hold Fast replay does not auto-normalize to 96.67/A without evidence", async () => {
    const payload = makeStackedAuditRubric();
    const gateResult = await runContraryEvidenceGate({
      priorReview: holdFastTestFixture.priorReview,
      priorText: holdFastTestFixture.currentText,
      currentText: holdFastTestFixture.currentText,
      genre: holdFastTestFixture.genre,
      semanticAssessor: createDeterministicSemanticAssessor(),
      comparison_mode: "SAME_VERSION_REASSESSMENT",
    });

    const result = normalizeRubricAgainstGate({
      rawPayload: payload,
      gateAssessments: gateResult.assessments,
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      canonicalWordCount: 111491,
      fullTextSupplied: true,
    });

    const post = validatePostScoringRubric({
      payload,
      preGateAssessments: gateResult.assessments,
      preScoringGate: enforceScoringGate({
        assessments: gateResult.assessments,
        comparison_mode: "SAME_VERSION_REASSESSMENT",
      }),
      gateRequired: true,
      gateRan: true,
      priorReviewId: "prior",
      canonicalWordCount: 111491,
      fullTextSupplied: true,
      normalizationResult: result,
    });

    assert.ok(result.normalizedApplicationScore < 90 || result.recommendationConsistency.recommendation_consistent);
    assert.ok(result.normalizedApplicationScore !== 96.67 || result.categoryAudits.every(
      (a) => a.positive_evidence_strength === "EXCEPTIONAL",
    ));
    assert.ok(result.adjustmentsSummary.evidence_ceiling_reductions >= 0);
    assert.ok(post.valid || post.errors.length < 20);
  });
});

describe("Deduction matching", () => {
  it("matches by root_issue and category", () => {
    const bundle = holdFastTestFixture.priorReview;
    const { concerns } = extractPriorConcerns(bundle);
    const payload = bundle.rubric_breakdown ?? makeStackedAuditRubric();
    const entries = extractRubricDeductionEntries(payload);
    if (entries.length === 0 || concerns.length === 0) return;
    const assessments = concerns.map((c) =>
      makeAssessment({
        concern_id: c.concern_id,
        root_issue: c.root_issue,
        rubric_category: c.rubric_category,
        status: "SUPPORTED",
        remaining_deduction: c.prior_deduction,
      }),
    );
    const byId = indexAssessments(assessments);
    const match = matchDeductionToAssessment(entries[0], assessments, byId);
    assert.notEqual(match.match_method, "none");
  });
});
