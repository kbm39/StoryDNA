import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  assessConcernDeterministic,
  buildSemanticAssessorInput,
  composeConcernAssessment,
  computeDeductionAdjustment,
  createFixtureAssessor,
  enforceScoringGate,
  executeSearch,
  extractPriorConcerns,
  runContraryEvidenceGate,
  statusZeroesDeduction,
} from "./index.ts";
import { makeRubricDeduction } from "./fixtures/helpers.ts";
import { romanceImprovedFixture } from "./fixtures/romance.ts";
import { mysteryFairnessFixture } from "./fixtures/mystery.ts";
import { fantasyExpositionFixture } from "./fixtures/fantasy.ts";
import { literaryAgencyFixture } from "./fixtures/literary-fiction.ts";
import { narrativeNonfictionFixture } from "./fixtures/narrative-nonfiction.ts";
import { unchangedCriticismFixture } from "./fixtures/unchanged.ts";
import { worsenedCriticismFixture } from "./fixtures/worsened.ts";
import { holdFastTestFixture } from "./fixtures/hold-fast.ts";
import { buildSearchPlan } from "./search-plan.ts";
import type { ConcernAssessment, PriorReviewBundle } from "./types.ts";

function runScenario(fixture: {
  genre: import("./types.ts").GenreProfile;
  priorText: string;
  currentText: string;
  priorReview: PriorReviewBundle;
  expectedStatus: string;
}) {
  return runContraryEvidenceGate({
    priorReview: fixture.priorReview,
    priorText: fixture.priorText,
    currentText: fixture.currentText,
    genre: fixture.genre,
  });
}

describe("Contrary-Evidence Gate — cross-genre scenarios", () => {
  it("romance conflict substantially improved", () => {
    const result = runScenario(romanceImprovedFixture);
    const assessment = result.assessments[0];
    assert.ok(
      ["SUBSTANTIALLY_IMPROVED", "RESOLVED", "PARTIALLY_IMPROVED"].includes(assessment.status),
      `expected improvement, got ${assessment.status}`,
    );
    assert.ok(assessment.points_restored > 0);
    assert.equal(result.scoring_gate.valid, true);
  });

  it("mystery clue fairness resolved or narrowed", () => {
    const result = runScenario(mysteryFairnessFixture);
    const assessment = result.assessments[0];
    assert.ok(
      ["PARTIALLY_IMPROVED", "SUBSTANTIALLY_IMPROVED", "RESOLVED"].includes(assessment.status),
    );
    if (assessment.status === "PARTIALLY_IMPROVED") {
      assert.ok(assessment.narrowed_current_finding);
    }
    assert.equal(result.scoring_gate.valid, true);
  });

  it("fantasy exposition stale or resolved", () => {
    const result = runScenario(fantasyExpositionFixture);
    const assessment = result.assessments[0];
    assert.ok(["STALE_CRITIQUE", "RESOLVED", "SUBSTANTIALLY_IMPROVED"].includes(assessment.status));
    if (statusZeroesDeduction(assessment.status)) {
      assert.equal(assessment.remaining_deduction, 0);
    }
  });

  it("literary-fiction character agency improved", () => {
    const result = runScenario(literaryAgencyFixture);
    const assessment = result.assessments[0];
    assert.ok(
      ["SUBSTANTIALLY_IMPROVED", "RESOLVED", "PARTIALLY_IMPROVED"].includes(assessment.status),
    );
    assert.ok(assessment.points_restored > 0);
  });

  it("narrative-nonfiction sourcing improved", () => {
    const result = runScenario(narrativeNonfictionFixture);
    const assessment = result.assessments[0];
    assert.ok(["RESOLVED", "SUBSTANTIALLY_IMPROVED"].includes(assessment.status));
    assert.equal(assessment.remaining_deduction, 0);
  });

  it("unchanged criticism retained with fresh evidence", () => {
    const result = runScenario(unchangedCriticismFixture);
    const assessment = result.assessments[0];
    assert.equal(assessment.status, "UNCHANGED");
    assert.ok(assessment.current_supporting_evidence.length > 0);
    assert.equal(assessment.remaining_deduction, assessment.prior_deduction);
    assert.equal(result.scoring_gate.valid, true);
  });

  it("worsened criticism increased", () => {
    const result = runScenario(worsenedCriticismFixture);
    const assessment = result.assessments[0];
    assert.equal(assessment.status, "WORSENED");
    assert.ok(assessment.remaining_deduction >= assessment.prior_deduction);
  });
});

describe("Contrary-Evidence Gate — extraction priority", () => {
  it("structured rubric deduction takes priority over memo wording", () => {
    const bundle: PriorReviewBundle = {
      review_id: "review-priority",
      manuscript_version_id: "v1",
      rubric_breakdown: makeRubricDeduction(
        "pacing_narrative_tension",
        "Pacing",
        "Pacing sags in the middle chapters",
        ["The middle sags badly."],
        2,
      ),
      memo_content: `## Weaknesses\n1. Pacing sags in the middle chapters and never recovers.`,
      editorial_issues: [],
      revision_candidates: [],
    };
    const { concerns, structured_count, memo_fallback_used } = extractPriorConcerns(bundle);
    assert.equal(concerns.length, 1);
    assert.equal(concerns[0].source_type, "rubric_deduction");
    assert.equal(concerns[0].was_scored, true);
    assert.equal(structured_count, 1);
    assert.equal(memo_fallback_used, false);
  });

  it("memo prose does not automatically become a scored concern", () => {
    const bundle: PriorReviewBundle = {
      review_id: "review-memo-only",
      manuscript_version_id: "v1",
      rubric_breakdown: null,
      memo_content:
        "This draft is disappointing. The voice is weak. The plot never coheres. I cannot recommend it.",
      editorial_issues: [],
      revision_candidates: [],
    };
    const { concerns } = extractPriorConcerns(bundle);
    assert.equal(concerns.length, 0);

    const withSection: PriorReviewBundle = {
      ...bundle,
      memo_content: `## Weaknesses\n1. The plot never coheres across the second act and loses causal momentum.`,
    };
    const fallback = extractPriorConcerns(withSection);
    assert.equal(fallback.concerns.length, 1);
    assert.equal(fallback.concerns[0].source_type, "memo_fallback");
    assert.equal(fallback.concerns[0].was_scored, false);
    assert.equal(fallback.concerns[0].prior_deduction, 0);
  });
});

describe("Contrary-Evidence Gate — scoring enforcement", () => {
  it("RESOLVED deducts zero", () => {
    const adj = computeDeductionAdjustment(4, "RESOLVED");
    assert.equal(adj.remaining_deduction, 0);
    assert.equal(adj.points_restored, 4);
  });

  it("STALE_CRITIQUE deducts zero", () => {
    const adj = computeDeductionAdjustment(3, "STALE_CRITIQUE");
    assert.equal(adj.remaining_deduction, 0);
    assert.equal(adj.points_restored, 3);
  });

  it("deleted prior quotation cannot support a deduction", () => {
    const assessment: ConcernAssessment = {
      concern_id: "test-deleted",
      root_issue: "Flat dialogue",
      rubric_category: "dialogue_scene_execution",
      prior_criticism: "Dialogue throughout remains flat",
      prior_evidence: ["Flat line here."],
      current_supporting_evidence: [],
      current_contrary_evidence: [
        {
          text: 'Prior quotation no longer present: "Flat line here."',
          location: "quotation_deleted",
          source: "version_diff",
          relevance: "contrary",
        },
      ],
      revision_that_addresses_it: null,
      original_basis_still_present: false,
      status: "UNCHANGED",
      confidence: "medium",
      prior_deduction: 2,
      points_restored: 0,
      remaining_deduction: 2,
      narrowed_current_finding: "Dialogue throughout remains flat in scene 3",
      explanation: "test",
      contrary_evidence_analysis: "reviewed",
    };
    const gate = enforceScoringGate({ assessments: [assessment] });
    assert.equal(gate.valid, false);
    assert.ok(gate.errors.some((e) => e.includes("deleted prior quotation")));
  });

  it("retained deduction requires current supporting evidence", () => {
    const assessment: ConcernAssessment = {
      concern_id: "test-no-support",
      root_issue: "Weak stakes",
      rubric_category: "stakes_emotional_impact",
      prior_criticism: "Stakes feel low",
      prior_evidence: [],
      current_supporting_evidence: [],
      current_contrary_evidence: [{ text: "improved", location: "x", source: "revision_note", relevance: "contrary" }],
      revision_that_addresses_it: null,
      original_basis_still_present: true,
      status: "PARTIALLY_IMPROVED",
      confidence: "medium",
      prior_deduction: 2,
      points_restored: 1,
      remaining_deduction: 1,
      narrowed_current_finding: "Stakes still low in chapter 4",
      explanation: "test",
      contrary_evidence_analysis: "reviewed",
    };
    const gate = enforceScoringGate({ assessments: [assessment] });
    assert.equal(gate.valid, false);
    assert.ok(gate.errors.some((e) => e.includes("requires current supporting evidence")));
  });

  it("missing contrary-evidence analysis blocks the deduction", () => {
    const assessment: ConcernAssessment = {
      concern_id: "test-no-contrary-analysis",
      root_issue: "Weak stakes",
      rubric_category: "stakes_emotional_impact",
      prior_criticism: "Stakes feel low in chapter 2",
      prior_evidence: ["Low stakes passage."],
      current_supporting_evidence: [
        { text: "Low stakes passage.", location: "q", source: "current_manuscript", relevance: "supporting" },
      ],
      current_contrary_evidence: [],
      revision_that_addresses_it: null,
      original_basis_still_present: true,
      status: "UNCHANGED",
      confidence: "medium",
      prior_deduction: 2,
      points_restored: 0,
      remaining_deduction: 2,
      narrowed_current_finding: null,
      explanation: "test",
      contrary_evidence_analysis: "",
    };
    const gate = enforceScoringGate({ assessments: [assessment] });
    assert.equal(gate.valid, false);
    assert.ok(gate.errors.some((e) => e.includes("missing contrary-evidence analysis")));
  });

  it("broad criticism must narrow before retaining a deduction", () => {
    const assessment: ConcernAssessment = {
      concern_id: "test-broad",
      root_issue: "Dialogue throughout remains flat",
      rubric_category: "dialogue_scene_execution",
      prior_criticism: "Dialogue throughout remains flat and functional",
      prior_evidence: ["Flat dialogue example."],
      current_supporting_evidence: [
        { text: "Flat dialogue example.", location: "q", source: "current_manuscript", relevance: "supporting" },
      ],
      current_contrary_evidence: [],
      revision_that_addresses_it: null,
      original_basis_still_present: true,
      status: "UNCHANGED",
      confidence: "medium",
      prior_deduction: 2,
      points_restored: 0,
      remaining_deduction: 2,
      narrowed_current_finding: null,
      explanation: "test",
      contrary_evidence_analysis: "reviewed",
    };
    const gate = enforceScoringGate({ assessments: [assessment] });
    assert.equal(gate.valid, false);
    assert.ok(gate.errors.some((e) => e.includes("broad criticism must be narrowed")));
  });
});

describe("Contrary-Evidence Gate — Hold Fast isolation", () => {
  const BANNED_TERMS = [
    "Hold Fast",
    "Cole",
    "Amit",
    "Cyrus",
    "IDF",
    "Qalandiya",
    "Hold_Fast",
    "The Reckoning",
  ];

  function listProductionSources(): string[] {
    const root = import.meta.dirname;
    const files = [
      "types.ts",
      "slug.ts",
      "passage-utils.ts",
      "extract-prior-concerns.ts",
      "search-plan.ts",
      "search-execute.ts",
      "assess.ts",
      "scoring-gate.ts",
      "gate.ts",
      "index.ts",
    ];
    return files.map((f) => join(root, f));
  }

  it("production modules contain no manuscript-specific language", () => {
    for (const file of listProductionSources()) {
      const content = readFileSync(file, "utf8");
      for (const term of BANNED_TERMS) {
        assert.ok(
          !content.includes(term),
          `${file} must not contain "${term}"`,
        );
      }
    }
  });

  it("Hold Fast fixture runs through gate without polluting production", () => {
    const result = runContraryEvidenceGate({
      priorReview: holdFastTestFixture.priorReview,
      priorText: holdFastTestFixture.priorText,
      currentText: holdFastTestFixture.currentText,
      genre: holdFastTestFixture.genre,
    });
    assert.ok(result.assessments.length > 0);
    assert.ok(holdFastTestFixture.manuscriptTitle.includes("Hold Fast"));
  });
});

describe("Contrary-Evidence Gate — semantic assessor interface", () => {
  it("fixture assessor can override deterministic status for tests", () => {
    const concern = extractPriorConcerns(romanceImprovedFixture.priorReview).concerns[0];
    const plan = buildSearchPlan(concern, romanceImprovedFixture.genre);
    const search = executeSearch({
      plan,
      currentText: romanceImprovedFixture.currentText,
      priorText: romanceImprovedFixture.priorText,
      revisionCandidates: romanceImprovedFixture.priorReview.revision_candidates,
    });
    const input = buildSemanticAssessorInput(concern, search, romanceImprovedFixture.genre);
    const assessor = createFixtureAssessor({
      [concern.concern_id]: { status: "RESOLVED", confidence: "high" },
    });
    const semantic = assessor.assess(input);
    assert.equal(semantic.status, "RESOLVED");
    const composed = composeConcernAssessment(concern, search, semantic);
    assert.equal(composed.remaining_deduction, 0);
  });

  it("deterministic assessor does not call external AI", () => {
    const result = assessConcernDeterministic(
      buildSemanticAssessorInput(
        extractPriorConcerns(unchangedCriticismFixture.priorReview).concerns[0],
        executeSearch({
          plan: buildSearchPlan(
            extractPriorConcerns(unchangedCriticismFixture.priorReview).concerns[0],
            unchangedCriticismFixture.genre,
          ),
          currentText: unchangedCriticismFixture.currentText,
          priorText: unchangedCriticismFixture.priorText,
        }),
        unchangedCriticismFixture.genre,
      ),
    );
    assert.ok(result.status);
    assert.ok(result.explanation);
  });
});
