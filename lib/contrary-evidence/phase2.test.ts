import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeDuplicateDeductions,
  applyDuplicateDeductionRemovals,
  buildContraryEvidenceGatePromptBlock,
  computeDeductionAdjustment,
  createDeterministicSemanticAssessor,
  createFixtureAssessor,
  enforceScoringGate,
  parseSemanticAssessmentJson,
  runContraryEvidenceGate,
  statusZeroesDeduction,
  validatePostScoringRubric,
} from "./index.ts";
import { makeStackedAuditRubric, sumRubricScore } from "./fixtures/stacked-audit.ts";
import { holdFastTestFixture } from "./fixtures/hold-fast.ts";
import { romanceImprovedFixture } from "./fixtures/romance.ts";
import { composeConcernAssessment, buildSemanticAssessorInput } from "./assess.ts";
import { extractPriorConcerns } from "./extract-prior-concerns.ts";
import { executeSearch } from "./search-execute.ts";
import { buildSearchPlan } from "./search-plan.ts";
import type { ConcernAssessment, PriorReviewBundle } from "./types.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function runScenario(fixture: {
  genre: import("./types.ts").GenreProfile;
  priorText: string;
  currentText: string;
  priorReview: PriorReviewBundle;
}) {
  return runContraryEvidenceGate({
    priorReview: fixture.priorReview,
    priorText: fixture.priorText,
    currentText: fixture.currentText,
    genre: fixture.genre,
    semanticAssessor: createDeterministicSemanticAssessor(),
  });
}

describe("Phase 2 — gate pipeline integration", () => {
  it("gate runs when prior review exists", async () => {
    const result = await runScenario(romanceImprovedFixture);
    assert.ok(result.assessments.length > 0);
    assert.equal(result.scoring_gate.valid, true);
  });

  it("gate skips only when no prior review exists (no bundle)", async () => {
    const empty: PriorReviewBundle = {
      review_id: "none",
      manuscript_version_id: null,
      rubric_breakdown: null,
      memo_content: "",
      editorial_issues: [],
      revision_candidates: [],
    };
    const { concerns } = extractPriorConcerns(empty);
    assert.equal(concerns.length, 0);
  });
});

describe("Phase 2 — semantic assessor schema", () => {
  it("validates assessor JSON output", () => {
    const parsed = parseSemanticAssessmentJson({
      status: "RESOLVED",
      confidence: "high",
      original_basis_still_present: false,
      narrowed_current_finding: null,
      revision_that_addresses_it: "Revised scene",
      explanation: "Basis removed.",
    });
    assert.ok(parsed);
    assert.equal(parsed!.status, "RESOLVED");
  });

  it("rejects invalid status", () => {
    assert.equal(parseSemanticAssessmentJson({ status: "MAYBE", confidence: "high" }), null);
  });
});

describe("Phase 2 — deduction contracts", () => {
  it("RESOLVED deducts zero", () => {
    const adj = computeDeductionAdjustment(4, "RESOLVED");
    assert.equal(adj.remaining_deduction, 0);
  });

  it("STALE_CRITIQUE deducts zero", () => {
    const adj = computeDeductionAdjustment(3, "STALE_CRITIQUE");
    assert.equal(adj.remaining_deduction, 0);
  });

  it("SUBSTANTIALLY_IMPROVED restores points", () => {
    const adj = computeDeductionAdjustment(4, "SUBSTANTIALLY_IMPROVED");
    assert.ok(adj.points_restored > 0);
    assert.ok(adj.remaining_deduction < 4);
  });

  it("PARTIALLY_IMPROVED narrows criticism via fixture override", async () => {
    const concern = extractPriorConcerns(romanceImprovedFixture.priorReview).concerns[0];
    const plan = buildSearchPlan(concern, romanceImprovedFixture.genre);
    const search = executeSearch({
      plan,
      currentText: romanceImprovedFixture.currentText,
      priorText: romanceImprovedFixture.priorText,
    });
    const semantic = createFixtureAssessor({
      [concern.concern_id]: {
        status: "PARTIALLY_IMPROVED",
        narrowed_current_finding: "Narrow residual in Ch. 4",
      },
    }).assess(buildSemanticAssessorInput(concern, search, romanceImprovedFixture.genre));
    const composed = composeConcernAssessment(concern, search, await Promise.resolve(semantic));
    assert.ok(composed.narrowed_current_finding);
  });
});

describe("Phase 2 — duplicate root issues", () => {
  it("caps repeated root issues across categories", () => {
    const payload = makeStackedAuditRubric();
    const analysis = analyzeDuplicateDeductions(payload);
    assert.ok(analysis.duplicate_deduction_count > 0);
    const adjusted = applyDuplicateDeductionRemovals(payload, analysis);
    const after = analyzeDuplicateDeductions(adjusted);
    assert.ok(after.points_to_remove.length === 0 || after.violations.length <= analysis.violations.length);
  });

  it("repeated evidence cannot support multiple full deductions after cap", () => {
    const payload = makeStackedAuditRubric();
    const analysis = analyzeDuplicateDeductions(payload);
    const adjusted = applyDuplicateDeductionRemovals(payload, analysis);
    const totalDeduction = [...adjusted.craft_categories, ...adjusted.acquisition_categories].reduce(
      (s, c) => s + c.deduction,
      0,
    );
    assert.ok(totalDeduction < 30, `expected deduplicated total < 30, got ${totalDeduction}`);
  });
});

describe("Phase 2 — post-scoring validation", () => {
  it("recomputes totals after deduplication", () => {
    const payload = makeStackedAuditRubric();
    const result = validatePostScoringRubric({
      payload,
      preGateAssessments: [],
      preScoringGate: {
        valid: true,
        errors: [],
        assessments: [],
        adjusted_deductions: [],
        total_points_restored: 0,
      },
      gateRequired: false,
      gateRan: false,
      priorReviewId: null,
      canonicalWordCount: 100_000,
      fullTextSupplied: true,
    });
    assert.ok(result.manuscriptScore > 70, `expected score > 70 after dedup, got ${result.manuscriptScore}`);
  });

  it("gate-required-but-missing blocks validation", () => {
    const payload = makeStackedAuditRubric();
    const result = validatePostScoringRubric({
      payload,
      preGateAssessments: [],
      preScoringGate: { valid: true, errors: [], assessments: [], adjusted_deductions: [], total_points_restored: 0 },
      gateRequired: true,
      gateRan: false,
      priorReviewId: "prior-1",
      canonicalWordCount: 100_000,
      fullTextSupplied: true,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("required but did not run")));
  });

  it("resolved concern is zeroed by normalization before validation", () => {
    const payload = makeStackedAuditRubric();
    const assessments: ConcernAssessment[] = [
      {
        comparison_mode: "REVISION_COMPARISON",
        concern_id: "back-third-1",
        root_issue: "back third sags in denouement",
        rubric_category: "pacing_narrative_tension",
        prior_criticism: "Back third sags",
        prior_evidence: [],
        current_supporting_evidence: [],
        current_contrary_evidence: [],
        revision_that_addresses_it: null,
        original_basis_still_present: false,
        status: "RESOLVED",
        confidence: "high",
        prior_deduction: 3,
        points_restored: 3,
        points_invalidated: 0,
        duplicate_points_removed: 0,
        overbreadth_points_removed: 0,
        remaining_deduction: 0,
        narrowed_current_finding: null,
        explanation: "Resolved",
        contrary_evidence_analysis: "reviewed",
      },
    ];
    const result = validatePostScoringRubric({
      payload,
      preGateAssessments: assessments,
      preScoringGate: enforceScoringGate({ assessments }),
      gateRequired: true,
      gateRan: true,
      priorReviewId: "prior-1",
      canonicalWordCount: 100_000,
      fullTextSupplied: true,
    });
    assert.ok(result.normalization.dispositions.some((d) => d.disposition === "REMOVED_RESOLVED"));
  });
});

describe("Phase 2 — Hold Fast regression (fixtures only)", () => {
  it("considers institutional and cost evidence via search", async () => {
    const result = await runContraryEvidenceGate({
      priorReview: holdFastTestFixture.priorReview,
      priorText: holdFastTestFixture.priorText,
      currentText: holdFastTestFixture.currentText,
      genre: holdFastTestFixture.genre,
    });
    assert.ok(result.assessments.length > 0);
  });

  it("stacked audit rubric score moves above 70 after stale/duplicate removal", () => {
    const payload = makeStackedAuditRubric();
    const rawScore = sumRubricScore(payload);
    assert.ok(rawScore <= 72, `raw stacked score should be ~70, got ${rawScore}`);
    const analysis = analyzeDuplicateDeductions(payload);
    const adjusted = applyDuplicateDeductionRemovals(payload, analysis);
    assert.ok(sumRubricScore(adjusted) > 70, `expected corrected score > 70`);
  });
});

describe("Phase 2 — CLI/UI parity", () => {
  it("CLI and UI enter through the same editorial generation module", () => {
    const root = join(import.meta.dirname, "../..");
    const cli = readFileSync(join(root, "scripts/run-literary-agent-review.mjs"), "utf8");
    const action = readFileSync(join(root, "app/actions/agent-revisions.ts"), "utf8");
    const corePath = "lib/editorial-generation/run-fresh-editorial-generation";
    assert.ok(cli.includes(corePath), "CLI must import editorial generation core");
    assert.ok(action.includes(corePath), "UI action must delegate to editorial generation core");
    assert.ok(action.includes("runFreshEditorialGenerationCore"), "UI must call core function");
  });
});

describe("Phase 2 — Call B pre-scoring contract prompt", () => {
  it("includes RESOLVED zero-deduction contract", () => {
    const block = buildContraryEvidenceGatePromptBlock([
      {
        comparison_mode: "REVISION_COMPARISON",
        concern_id: "c1",
        root_issue: "wish fulfillment",
        rubric_category: "stakes_emotional_impact",
        prior_criticism: "Frictionless wins throughout",
        prior_evidence: [],
        current_supporting_evidence: [],
        current_contrary_evidence: [],
        revision_that_addresses_it: null,
        original_basis_still_present: false,
        status: "RESOLVED",
        confidence: "high",
        prior_deduction: 3,
        points_restored: 3,
        points_invalidated: 0,
        duplicate_points_removed: 0,
        overbreadth_points_removed: 0,
        remaining_deduction: 0,
        narrowed_current_finding: null,
        explanation: "Resolved",
        contrary_evidence_analysis: "Institutional cost added",
      },
    ]).block;
    assert.ok(block.includes("RESOLVED"));
    assert.ok(block.includes("deduction MUST be 0"));
  });
});

describe("Phase 2 — status helpers", () => {
  it("statusZeroesDeduction covers RESOLVED and STALE", () => {
    assert.equal(statusZeroesDeduction("RESOLVED"), true);
    assert.equal(statusZeroesDeduction("STALE_CRITIQUE"), true);
    assert.equal(statusZeroesDeduction("UNCHANGED"), false);
  });
});
