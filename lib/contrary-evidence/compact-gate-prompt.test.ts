import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GATE_PROMPT_MAX_CHARS } from "./constants.ts";
import { buildContraryEvidenceGatePromptBlock } from "./gate-context.ts";
import { gateStatusDeductionContract, sameVersionStatusDeductionContract } from "./post-scoring-validation.ts";
import type { ConcernAssessment } from "./types.ts";

function makeAssessment(
  id: string,
  status: ConcernAssessment["status"],
  overrides: Partial<ConcernAssessment> = {},
): ConcernAssessment {
  const mode =
    overrides.comparison_mode ??
    (["SUPPORTED", "UNSUPPORTED", "OVERBROAD", "DUPLICATED"].includes(String(status))
      ? "SAME_VERSION_REASSESSMENT"
      : "REVISION_COMPARISON");
  return {
    comparison_mode: mode,
    concern_id: id,
    root_issue: overrides.root_issue ?? `issue-${id}`,
    rubric_category: overrides.rubric_category ?? "pacing_narrative_tension",
    prior_criticism: overrides.prior_criticism ?? `Criticism for ${id}`,
    prior_evidence: overrides.prior_evidence ?? [],
    current_supporting_evidence: overrides.current_supporting_evidence ?? [
      {
        text: `Supporting excerpt for ${id} in chapter 3 with enough detail to cite.`,
        location: "ch3",
        source: "current_manuscript",
        relevance: "supporting",
      },
    ],
    current_contrary_evidence: overrides.current_contrary_evidence ?? [
      {
        text: `Contrary note for ${id}.`,
        location: "ch4",
        source: "current_manuscript",
        relevance: "contrary",
      },
    ],
    revision_that_addresses_it: null,
    original_basis_still_present: true,
    status,
    confidence: "medium",
    prior_deduction: overrides.prior_deduction ?? 3,
    points_restored: overrides.points_restored ?? 0,
    points_invalidated: overrides.points_invalidated ?? 0,
    duplicate_points_removed: overrides.duplicate_points_removed ?? 0,
    overbreadth_points_removed: overrides.overbreadth_points_removed ?? 0,
    remaining_deduction: overrides.remaining_deduction ?? (status === "SUPPORTED" ? 3 : 0),
    narrowed_current_finding: overrides.narrowed_current_finding ?? null,
    explanation: overrides.explanation ?? "test",
    contrary_evidence_analysis: overrides.contrary_evidence_analysis ?? "reviewed",
    ...overrides,
  };
}

describe("Compact gate prompt block", () => {
  it("stays under configured character limit", () => {
    const assessments = Array.from({ length: 60 }, (_, i) =>
      makeAssessment(`concern-${i}`, i % 3 === 0 ? "UNSUPPORTED" : i % 3 === 1 ? "RESOLVED" : "SUPPORTED"),
    );
    const result = buildContraryEvidenceGatePromptBlock(assessments);
    assert.ok(
      result.charCount <= GATE_PROMPT_MAX_CHARS,
      `expected <= ${GATE_PROMPT_MAX_CHARS}, got ${result.charCount}`,
    );
  });

  it("all prohibited concerns remain represented", () => {
    const assessments = [
      makeAssessment("p1", "UNSUPPORTED", { comparison_mode: "SAME_VERSION_REASSESSMENT" }),
      makeAssessment("p2", "RESOLVED", { comparison_mode: "REVISION_COMPARISON", points_restored: 3 }),
      makeAssessment("r1", "SUPPORTED", { comparison_mode: "SAME_VERSION_REASSESSMENT" }),
    ];
    const result = buildContraryEvidenceGatePromptBlock(assessments);
    assert.ok(result.block.includes("p1"));
    assert.ok(result.block.includes("p2"));
    assert.ok(result.block.includes("PROHIBITED"));
    assert.deepEqual(result.representedConcernIds.sort(), ["p1", "p2", "r1"].sort());
  });

  it("no concern is silently lost during compaction", () => {
    const ids = Array.from({ length: 80 }, (_, i) => `c-${i}`);
    const assessments = ids.map((id, i) =>
      makeAssessment(id, i % 2 === 0 ? "UNSUPPORTED" : "SUPPORTED", {
        comparison_mode: "SAME_VERSION_REASSESSMENT",
      }),
    );
    const result = buildContraryEvidenceGatePromptBlock(assessments);
    assert.equal(result.concernCount, 80);
    assert.equal(result.representedConcernIds.length, 80);
    for (const id of ids) {
      assert.ok(result.block.includes(id), `missing concern ${id}`);
    }
  });

  it("uses compact references not full passage blocks", () => {
    const longText = "word ".repeat(500);
    const assessments = [
      makeAssessment("long-1", "SUPPORTED", {
        current_supporting_evidence: [
          { text: longText, location: "ch1", source: "current_manuscript", relevance: "supporting" },
        ],
      }),
    ];
    const result = buildContraryEvidenceGatePromptBlock(assessments);
    assert.ok(result.block.length < longText.length);
    assert.ok(result.block.includes("ch1"));
  });

  it("groups duplicated root issues in prohibited list", () => {
    const assessments = [
      makeAssessment("d1", "DUPLICATED", {
        root_issue: "wish fulfillment",
        comparison_mode: "SAME_VERSION_REASSESSMENT",
      }),
      makeAssessment("d2", "DUPLICATED", {
        root_issue: "wish fulfillment throughout",
        comparison_mode: "SAME_VERSION_REASSESSMENT",
      }),
    ];
    const result = buildContraryEvidenceGatePromptBlock(assessments);
    assert.ok(result.block.includes("d1"));
    assert.ok(result.block.includes("d2"));
    assert.ok(result.block.includes(sameVersionStatusDeductionContract("DUPLICATED")));
  });

  it("includes revision and same-version contracts", () => {
    assert.ok(gateStatusDeductionContract("RESOLVED", 3).includes("0"));
    assert.ok(sameVersionStatusDeductionContract("UNSUPPORTED").includes("0"));
  });

  it("summarizes deterministically when over budget with many retained concerns", () => {
    const assessments = Array.from({ length: 120 }, (_, i) =>
      makeAssessment(`retained-${i}`, "SUPPORTED", {
        comparison_mode: "SAME_VERSION_REASSESSMENT",
        remaining_deduction: 2,
        root_issue: `unique root issue number ${i}`,
      }),
    );
    const result = buildContraryEvidenceGatePromptBlock(assessments, { maxChars: 4000 });
    assert.ok(result.summarized);
    assert.ok(result.charCount <= 4000);
    assert.equal(result.representedConcernIds.length, 120);
  });
});
