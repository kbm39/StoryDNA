import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION,
  matchConceptsInText,
  matchExpectedFindingsWithAudit,
  scoreSemanticFindingMatch,
} from "./expectation-matching.ts";
import { scoreCalibrationCase } from "./scoring.ts";
import type { CalibrationProjectedFinding, ExpectedFinding } from "./contracts.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function projected(overrides: Partial<CalibrationProjectedFinding> = {}): CalibrationProjectedFinding {
  return {
    finding_key: "model-generated-id",
    category: "command_and_organization",
    title: "Corporal directs operation",
    observation: "Corporal assigns platoons without officer oversight in the chain of command.",
    combined_text:
      "Corporal assigns platoons without officer oversight in the chain of command. Route through an officer.",
    realism_status: "confirmed_error",
    severity: "major",
    confidence: "high",
    has_manuscript_evidence: true,
    evidence_excerpts: ["Corporal Hale assigned platoons"],
    has_contrary_evidence: false,
    contrary_evidence_explicit_none: true,
    escalation_expert: null,
    recommendation_type: "correct",
    preservation_note_present: true,
    operational_impact_present: true,
    story_impact_present: true,
    uncertainty_note_present: false,
    safety_violation: false,
    ...overrides,
  };
}

function expected(overrides: Partial<ExpectedFinding> = {}): ExpectedFinding {
  return {
    finding_key: "rank-authority-error",
    category: "command_and_organization",
    realism_status: "confirmed_error",
    severity_min: "major",
    confidence_min: "high",
    must_include_evidence: true,
    match_mode: "semantic",
    match_concepts: ["corporal", "officer", "chain", "command"],
    weight: 1,
    ...overrides,
  };
}

describe("calibration expectation matching v1 legacy coverage", () => {
  it("does not require hidden corpus IDs in model output", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const score = scoreCalibrationCase(calibrationCase, [
      projected({ finding_key: "different-model-id" }),
    ]);
    assert.equal(score.false_negatives.length, 0);
    assert.equal(score.expectation_matching_policy_version, MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION);
  });

  it("matches structured semantics without exact title equality", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({ title: "Different title text", finding_key: "other-id" }),
    );
    assert.equal(result.score, 1);
    assert.ok(result.matchedConcepts.length > 0);
  });

  it("rejects similar title with wrong semantics", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({
        title: "Corporal chain command rank authority",
        realism_status: "accurate",
        observation: "Everything is accurate.",
      }),
    );
    assert.equal(result.score, 0);
  });

  it("records policy version and matched finding index", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const audit = matchExpectedFindingsWithAudit(calibrationCase, [projected()]);
    assert.equal(audit.policy_version, MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION);
    assert.equal(audit.matches[0]?.matched_finding_index, 0);
    assert.deepEqual(audit.unmatched_expectations, []);
  });

  it("records unmatched expectations and provider findings", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const audit = matchExpectedFindingsWithAudit(calibrationCase, []);
    assert.deepEqual(audit.unmatched_expectations, ["rank-authority-error"]);
    assert.deepEqual(audit.unmatched_provider_findings, []);
  });

  it("handles duplicate provider findings deterministically", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const audit = matchExpectedFindingsWithAudit(calibrationCase, [projected(), projected({ finding_key: "dup" })]);
    assert.equal(audit.matches[0]?.matched_finding_index, 0);
    assert.deepEqual(audit.unmatched_provider_findings, [1]);
  });

  it("does not invoke fuzzy or provider-based matchers", () => {
    const src = readFileSync(join(ROOT, "lib/expert-calibration/expectation-matching.ts"), "utf8");
    assert.doesNotMatch(src, /embedding|levenshtein|similarity\(|anthropic|openai/i);
  });

  it("uses word boundaries for single-token concepts", () => {
    assert.equal(matchConceptsInText("unaccurate depiction", ["accurate"]).matched, false);
    assert.equal(matchConceptsInText("accurate command depiction", ["accurate"]).matched, true);
  });
});
