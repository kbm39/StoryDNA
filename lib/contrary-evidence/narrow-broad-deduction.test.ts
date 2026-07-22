import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  buildPostScoringFailureDiagnostics,
  persistReviewFailureDiagnostics,
} from "../commercial-review-diagnostics.ts";
import { makeStackedAuditRubric } from "./fixtures/stacked-audit.ts";
import { makeRubricDeduction } from "./fixtures/helpers.ts";
import {
  buildDeterministicNarrowedDeduction,
  shouldDeterministicallyNarrowDeduction,
} from "./narrow-broad-deduction.ts";
import { normalizeRubricAgainstGate } from "./normalize-rubric-against-gate.ts";
import { extractRubricDeductionEntries } from "./duplicate-deductions.ts";
import { reconstructConcernId } from "./match-deduction-to-gate.ts";
import { validatePostScoringRubric } from "./post-scoring-validation.ts";
import { isBroadCriticism } from "./scoring-gate.ts";
import type { CommercialRubricPayload, RubricCategoryScore } from "../commercial-fiction-rubric.ts";
import type { ConcernAssessment } from "./types.ts";

const BROAD_PPC_REASON =
  "Manuscript lacks professional polish throughout; bracketed draft conversion notes remain visible in multiple chapters.";

const PPC_EXAMPLES = [
  {
    text: "[AUTHOR: confirm timeline continuity before pub]",
    location: "Ch. 4",
  },
  {
    text: "[DRAFT: tighten transition between checkpoint scenes]",
    location: "Ch. 12",
  },
];

const PPC_REVISION =
  "Remove bracketed conversion notes and align continuity details before submission.";

function makeHoldFastPpcFailureRubric(): CommercialRubricPayload {
  const payload = makeStackedAuditRubric();
  const ppc: RubricCategoryScore = {
    category_key: "professional_polish_continuity",
    category_name: "Professional polish and continuity",
    points_earned: 2,
    maximum_points: 5,
    deduction: 3,
    weighted_contribution: 2,
    confidence: "high",
    strengths: [],
    deductions: ["Bracketed draft notes undermine polish"],
    deduction_reasons: [BROAD_PPC_REASON],
    revision_to_recover: PPC_REVISION,
    examples: PPC_EXAMPLES,
  };
  payload.acquisition_categories = payload.acquisition_categories.map((c) =>
    c.category_key === "professional_polish_continuity" ? ppc : c,
  );
  return payload;
}

function makePpcRubric(args: {
  reason: string;
  examples: string[];
  deductionPoints?: number;
  revision?: string;
}): CommercialRubricPayload {
  const payload = makeStackedAuditRubric();
  payload.acquisition_categories = payload.acquisition_categories.map((c) =>
    c.category_key === "professional_polish_continuity"
      ? {
          ...c,
          points_earned: 5 - (args.deductionPoints ?? 3),
          deduction: args.deductionPoints ?? 3,
          deductions: ["Bracketed draft notes undermine polish"],
          deduction_reasons: [args.reason],
          revision_to_recover: args.revision ?? PPC_REVISION,
          examples: args.examples.map((text) => ({ text, location: null })),
        }
      : c,
  );
  return payload;
}

function makeAssessment(overrides: Partial<ConcernAssessment>): ConcernAssessment {
  return {
    comparison_mode: "SAME_VERSION_REASSESSMENT",
    concern_id: "c1",
    root_issue: "bracketed draft notes remain",
    rubric_category: "professional_polish_continuity",
    prior_criticism: "Draft notes visible",
    prior_evidence: [],
    current_supporting_evidence: [],
    current_contrary_evidence: [],
    revision_that_addresses_it: null,
    original_basis_still_present: false,
    status: "PARTIALLY_IMPROVED",
    confidence: "high",
    prior_deduction: 3,
    points_restored: 0,
    points_invalidated: 0,
    duplicate_points_removed: 0,
    overbreadth_points_removed: 0,
    remaining_deduction: 3,
    narrowed_current_finding: null,
    explanation: "test",
    contrary_evidence_analysis: "",
    ...overrides,
  };
}

function makePpcGateMatchedRubric(args: {
  reason: string;
  examples: string[];
  remainingDeduction?: number;
}): { payload: CommercialRubricPayload; assessment: ConcernAssessment } {
  const payload = makePpcRubric({
    reason: args.reason,
    examples: args.examples,
  });
  const entry = extractRubricDeductionEntries(payload).find(
    (e) => e.category_key === "professional_polish_continuity",
  )!;
  const assessment = makeAssessment({
    concern_id: reconstructConcernId(entry),
    rubric_category: "professional_polish_continuity",
    root_issue: entry.deduction_label,
    prior_criticism: entry.deduction_label,
    status: args.remainingDeduction != null && args.remainingDeduction < 3 ? "UNCHANGED" : "PARTIALLY_IMPROVED",
    remaining_deduction: args.remainingDeduction ?? 2,
    prior_deduction: 3,
  });
  return { payload, assessment };
}

function runPostScoring(
  payload: CommercialRubricPayload,
  assessments: ConcernAssessment[] = [],
) {
  return validatePostScoringRubric({
    payload,
    preGateAssessments: assessments,
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
    canonicalWordCount: 108296,
    fullTextSupplied: true,
    comparison_mode: "SAME_VERSION_REASSESSMENT",
  });
}

describe("deterministic broad deduction narrowing", () => {
  it("1. broad Professional Polish deduction is narrowed deterministically", () => {
    const payload = makeHoldFastPpcFailureRubric();
    const result = runPostScoring(payload);
    const ppcEntry = extractRubricDeductionEntries(result.adjustedPayload).find(
      (e) => e.category_key === "professional_polish_continuity" && e.deduction_points > 0,
    );
    assert.ok(ppcEntry);
    assert.equal(isBroadCriticism(BROAD_PPC_REASON), true);
    assert.equal(isBroadCriticism(ppcEntry!.deduction_reason), false);
    const disp = result.normalization.dispositions.find(
      (d) => d.category_key === "professional_polish_continuity",
    );
    assert.equal(disp?.disposition, "NARROWED_AND_REDUCED");
  });

  it("2. broad deduction without examples fails closed", () => {
    const { payload, assessment } = makePpcGateMatchedRubric({
      reason: BROAD_PPC_REASON,
      examples: [],
    });
    const result = runPostScoring(payload, [assessment]);
    assert.equal(result.valid, false);
    assert.ok(
      result.errors.some(
        (e) =>
          e.includes("professional_polish_continuity") &&
          (e.includes("cannot be narrowed safely") || e.includes("unmatched deduction")),
      ),
    );
  });

  it("3. broad deduction with insufficient evidence fails closed", () => {
    const { payload, assessment } = makePpcGateMatchedRubric({
      reason: BROAD_PPC_REASON,
      examples: [PPC_EXAMPLES[0]!.text],
    });
    const result = runPostScoring(payload, [assessment]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("cannot be narrowed safely")));
  });

  it("4. broad deduction with examples and revision passes validator", () => {
    const result = runPostScoring(makeHoldFastPpcFailureRubric());
    assert.equal(result.valid, true);
    assert.ok(!result.errors.some((e) => e.includes("broad deduction lacks narrowed finding")));
  });

  it("5. already narrow deduction is unchanged", () => {
    const narrowReason =
      'Bracketed note at Ch. 4 ("[AUTHOR: confirm timeline continuity before pub]") breaks polish.';
    const payload = makePpcRubric({
      reason: narrowReason,
      examples: [PPC_EXAMPLES[0]!.text, PPC_EXAMPLES[1]!.text],
      deductionPoints: 2,
    });
    const result = runPostScoring(payload);
    const entry = extractRubricDeductionEntries(result.adjustedPayload).find(
      (e) => e.category_key === "professional_polish_continuity",
    );
    assert.equal(entry?.deduction_reason, narrowReason);
    const disp = result.normalization.dispositions.find(
      (d) => d.category_key === "professional_polish_continuity",
    );
    assert.notEqual(disp?.disposition, "NARROWED_AND_REDUCED");
  });

  it("6. broad deduction with RETAINED disposition (matched gate) is unchanged by narrowing", () => {
    const broadReason = "Dialogue lacks tension throughout the manuscript.";
    const payload = makeStackedAuditRubric();
    const dialogueCat = payload.craft_categories.find(
      (c) => c.category_key === "dialogue_scene_execution",
    )!;
    dialogueCat.deduction_reasons = [broadReason];
    dialogueCat.deductions = ["Diplomatic speechifying replaces drama"];
    dialogueCat.revision_to_recover = "Replace expository speeches with conflict-driven exchanges.";
    const entry = extractRubricDeductionEntries(payload).find(
      (e) => e.category_key === "dialogue_scene_execution",
    )!;
    const assessment = makeAssessment({
      concern_id: reconstructConcernId(entry),
      rubric_category: "dialogue_scene_execution",
      root_issue: entry.deduction_label,
      prior_criticism: entry.deduction_label,
      status: "UNCHANGED",
      remaining_deduction: entry.deduction_points,
      prior_deduction: entry.deduction_points,
    });
    const result = runPostScoring(payload, [assessment]);
    assert.equal(result.valid, true);
    const disp = result.normalization.dispositions.find(
      (d) => d.category_key === "dialogue_scene_execution",
    );
    assert.equal(disp?.disposition, "RETAINED");
    const adjusted = extractRubricDeductionEntries(result.adjustedPayload).find(
      (e) => e.category_key === "dialogue_scene_execution",
    );
    assert.equal(adjusted?.deduction_reason, broadReason);
  });

  it("7. multiple deductions — only the broad retained-new concern is rewritten", () => {
    const narrowReason =
      "Cole froze at the Qalandiya checkpoint while Amit argued with the IDF officer.";
    const payload = makePpcRubric({
      reason: BROAD_PPC_REASON,
      examples: [PPC_EXAMPLES[0]!.text, PPC_EXAMPLES[1]!.text],
    });
    const pacingCat = payload.craft_categories.find(
      (c) => c.category_key === "pacing_narrative_tension",
    )!;
    pacingCat.deduction = 2;
    pacingCat.points_earned = 9;
    pacingCat.deductions = ["Checkpoint passivity undercuts tension"];
    pacingCat.deduction_reasons = [narrowReason];
    pacingCat.examples = [
      { text: narrowReason, location: "Ch. 12" },
      { text: "Amit argued with the IDF officer while Cole waited.", location: "Ch. 12" },
    ];
    pacingCat.revision_to_recover = "Give Cole active choices in checkpoint scenes.";

    const result = runPostScoring(payload);
    const entries = extractRubricDeductionEntries(result.adjustedPayload);
    const pacingEntry = entries.find((e) => e.category_key === "pacing_narrative_tension");
    const ppcEntry = entries.find((e) => e.category_key === "professional_polish_continuity");
    assert.equal(pacingEntry?.deduction_reason, narrowReason);
    assert.equal(isBroadCriticism(ppcEntry!.deduction_reason), false);
    assert.notEqual(ppcEntry?.deduction_reason, BROAD_PPC_REASON);
  });

  it("8. diagnostics persisted for post-scoring failure", () => {
    const { payload, assessment } = makePpcGateMatchedRubric({
      reason: BROAD_PPC_REASON,
      examples: [],
    });
    const postScoring = runPostScoring(payload, [assessment]);
    assert.equal(postScoring.valid, false);

    const diagnostics = buildPostScoringFailureDiagnostics({
      manuscriptId: "ms-test",
      manuscriptVersionId: "ver-test",
      statistics: {
        canonical_word_count: 108296,
        full_text_supplied: true,
      } as import("../review-statistics.ts").ReviewStatistics,
      storedWordCount: 108296,
      recomputedWordCount: 108296,
      memoContent: "Hold Fast memo",
      failureError: postScoring.errors[0] ?? "failed",
      workflowId: "wf-post-scoring-test",
      triggerRunId: "run_test",
      normalization: postScoring.normalization,
      validationErrors: postScoring.errors,
    });

    assert.equal(diagnostics.pipelinePhase, "rubric_validation");
    assert.equal(diagnostics.workflowId, "wf-post-scoring-test");
    assert.equal(diagnostics.triggerRunId, "run_test");
    assert.ok(diagnostics.postScoringFailure);
    assert.equal(diagnostics.postScoringFailure?.category_key, "professional_polish_continuity");
    assert.ok(diagnostics.postScoringFailure!.validator_errors.length > 0);

    rmSync(join(process.cwd(), ".review-failure-diagnostics/post-scoring-failure-wf-post-scoring-test.json"), {
      force: true,
    });
    process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS = "1";
    const persisted = persistReviewFailureDiagnostics({
      diagnostics,
      filename: "post-scoring-failure-wf-post-scoring-test.json",
    });
    assert.ok(persisted.storageKey);
    assert.ok(persisted.localPath);
    const saved = JSON.parse(readFileSync(persisted.localPath!, "utf8"));
    assert.equal(saved.postScoringFailure.category_key, "professional_polish_continuity");
    delete process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS;
  });

  it("9. validator behavior unchanged for broad deductions without NARROWED disposition", () => {
    assert.equal(isBroadCriticism("Manuscript lacks polish throughout."), true);
    assert.equal(
      shouldDeterministicallyNarrowDeduction("Manuscript lacks polish throughout.", "RETAINED", 2),
      false,
    );
    const payload = makeRubricDeduction(
      "voice_prose_execution",
      "Voice and prose execution",
      "Voice lacks distinction throughout the manuscript.",
      ["Line one with concrete detail.", "Line two with concrete detail."],
      2,
    );
    const assessment = makeAssessment({
      concern_id: "voice_flat",
      rubric_category: "voice_prose_execution",
      root_issue: "flat voice",
      status: "UNCHANGED",
      remaining_deduction: 2,
    });
    const result = runPostScoring(payload, [assessment]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("broad deduction lacks narrowed finding")));
  });

  it("10. production Hold Fast reproduction passes after deterministic narrowing", () => {
    const payload = makeHoldFastPpcFailureRubric();
    const normalization = normalizeRubricAgainstGate({
      rawPayload: payload,
      gateAssessments: [],
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      canonicalWordCount: 108296,
      fullTextSupplied: true,
    });
    assert.equal(normalization.valid, true);
    const postScoring = validatePostScoringRubric({
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
      canonicalWordCount: 108296,
      fullTextSupplied: true,
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      normalizationResult: normalization,
    });
    assert.equal(postScoring.valid, true);
    assert.equal(
      buildDeterministicNarrowedDeduction({
        entry: extractRubricDeductionEntries(payload).find(
          (e) => e.category_key === "professional_polish_continuity",
        )!,
        category: payload.acquisition_categories.find(
          (c) => c.category_key === "professional_polish_continuity",
        )!,
        assessment: null,
      }) != null,
      true,
    );
  });
});

describe("buildDeterministicNarrowedDeduction unit", () => {
  it("prefers gate narrowed_current_finding when present", () => {
    const payload = makeHoldFastPpcFailureRubric();
    const entry =
      extractRubricDeductionEntries(payload).find(
        (e) => e.category_key === "professional_polish_continuity",
      )!;
    const category = payload.acquisition_categories.find(
      (c) => c.category_key === "professional_polish_continuity",
    )!;
    const narrowed = buildDeterministicNarrowedDeduction({
      entry,
      category,
      assessment: makeAssessment({
        narrowed_current_finding:
          'Bracketed note at Ch. 4 ("[AUTHOR: confirm timeline continuity before pub]") undermines polish.',
      }),
    });
    assert.ok(narrowed);
    assert.match(narrowed!, /Ch\. 4/);
    assert.equal(isBroadCriticism(narrowed!), false);
  });
});
