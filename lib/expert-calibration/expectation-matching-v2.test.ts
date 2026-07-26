import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION,
  MILITARY_SEMANTIC_MATCH_SEARCH_FIELDS,
  matchConceptGroupsInText,
  matchConceptsInText,
  matchExpectedFindingsWithAudit,
  projectedSemanticSearchText,
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
    observation: "A corporal tasking platoons to separate objectives without officer oversight.",
    recommendation: "Route orders through an appropriate officer.",
    operational_impact: "Chain-of-command credibility breaks.",
    story_impact: "Authority relationships become harder to trust.",
    combined_text:
      "A corporal tasking platoons to separate objectives without officer oversight. Route orders through an appropriate officer.",
    semantic_search_text:
      "Corporal directs operation A corporal tasking platoons to separate objectives without officer oversight. Route orders through an appropriate officer. Chain-of-command credibility breaks. Authority relationships become harder to trust.",
    realism_status: "probable_concern",
    severity: "major",
    confidence: "medium",
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
  const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
    (entry) => entry.case_id === "me-coc-001",
  )!;
  return {
    ...calibrationCase.expected_findings[0]!,
    ...overrides,
  };
}

describe("calibration expectation matching v2", () => {
  it("uses v2 policy version", () => {
    assert.equal(MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION, "military_calibration_expectation_matching@v2");
  });

  it("does not require hidden corpus IDs or CMD_001", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const score = scoreCalibrationCase(calibrationCase, [
      projected({ finding_key: "CMD_001", title: "Corporal authority to assign platoons without officer oversight" }),
    ]);
    assert.equal(score.false_negatives.length, 0);
    assert.equal(score.false_positives.length, 0);
    assert.equal(score.expectation_matching_policy_version, MILITARY_CALIBRATION_EXPECTATION_MATCHING_VERSION);
  });

  it("matches v5-style probable_concern and medium confidence", () => {
    const result = scoreSemanticFindingMatch(expected(), projected());
    assert.ok(result.score >= 0.5);
    assert.ok(result.matchedConceptGroup);
    assert.ok(result.requiredGatesPassed.includes("category"));
    assert.ok(result.requiredGatesPassed.includes("realism_status"));
    assert.ok(result.requiredGatesPassed.includes("concept_groups"));
  });

  it("rejects generic command vocabulary without concept groups", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({
        title: "Command leader military scene",
        observation: "Command and leadership are present in the scene.",
        recommendation: "Review command structure.",
        semantic_search_text:
          "Command leader military scene Command and leadership are present in the scene. Review command structure.",
      }),
    );
    assert.equal(result.score, 0);
    assert.ok(result.requiredGatesFailed.includes("concept_groups"));
  });

  it("uses deterministic AND/OR concept groups", () => {
    assert.equal(matchConceptGroupsInText("corporal leads platoon", [["corporal", "platoon"]]).matched, true);
    assert.equal(matchConceptGroupsInText("corporal leads squad", [["corporal", "platoon"]]).matched, false);
    assert.equal(
      matchConceptGroupsInText("rank authority exceeded", [["rank", "authority"], ["corporal", "platoon"]]).matched,
      true,
    );
  });

  it("rejects wrong category even with correct concepts", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({ category: "operations_and_tactics" }),
    );
    assert.equal(result.score, 0);
    assert.ok(result.requiredGatesFailed.includes("category"));
  });

  it("rejects positive realism status on negative expectation", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({ realism_status: "accurate", observation: "A corporal tasking platoons without officer oversight." }),
    );
    assert.equal(result.score, 0);
    assert.ok(result.requiredGatesFailed.includes("realism_status"));
  });

  it("allows compatible recommendation variation", () => {
    const result = scoreSemanticFindingMatch(
      expected(),
      projected({ recommendation_type: "narrow", recommendation: "Assign platoon tasking through an officer." }),
    );
    assert.ok(result.score >= 0.5);
  });

  it("lists searched fields in diagnostics", () => {
    const result = scoreSemanticFindingMatch(expected(), projected());
    assert.deepEqual(result.searchedFields, [...MILITARY_SEMANTIC_MATCH_SEARCH_FIELDS]);
    const audit = matchExpectedFindingsWithAudit(
      MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((entry) => entry.case_id === "me-coc-001")!,
      [projected()],
    );
    assert.deepEqual(audit.matches[0]?.searched_fields, [...MILITARY_SEMANTIC_MATCH_SEARCH_FIELDS]);
    assert.ok(audit.matches[0]?.matched_concept_group);
  });

  it("does not count matched finding as false positive", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const score = scoreCalibrationCase(calibrationCase, [projected({ finding_key: "arbitrary-id" })]);
    assert.equal(score.false_positives.length, 0);
    assert.equal(score.true_positives.length, 1);
  });

  it("handles duplicate findings deterministically", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const audit = matchExpectedFindingsWithAudit(calibrationCase, [projected(), projected({ finding_key: "dup" })]);
    assert.equal(audit.matches[0]?.matched_finding_index, 0);
    assert.deepEqual(audit.unmatched_provider_findings, [1]);
  });

  it("penalizes unrelated findings", () => {
    const calibrationCase = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find(
      (entry) => entry.case_id === "me-coc-001",
    )!;
    const score = scoreCalibrationCase(calibrationCase, [
      projected(),
      projected({
        finding_key: "unrelated",
        category: "logistics_and_timing",
        title: "Overnight resupply impossible",
        observation: "Heavy convoy appears without movement time.",
        semantic_search_text: "Overnight resupply impossible Heavy convoy appears without movement time.",
        realism_status: "confirmed_error",
      }),
    ]);
    assert.equal(score.true_positives.length, 1);
    assert.equal(score.false_positives.length, 1);
  });

  it("uses word boundaries for single-token concepts", () => {
    assert.equal(matchConceptsInText("unaccurate depiction", ["accurate"]).matched, false);
    assert.equal(matchConceptsInText("accurate command depiction", ["accurate"]).matched, true);
  });

  it("searches structured fields excluding evidence excerpts alone", () => {
    const text = projectedSemanticSearchText(
      projected({
        observation: "",
        recommendation: "",
        operational_impact: "",
        story_impact: "",
        title: "Unrelated",
        semantic_search_text: "Unrelated",
      }),
    );
    assert.equal(matchConceptGroupsInText(text, [["corporal", "platoon"]]).matched, false);
  });

  it("does not invoke fuzzy or provider-based matchers", () => {
    const src = readFileSync(join(ROOT, "lib/expert-calibration/expectation-matching.ts"), "utf8");
    assert.doesNotMatch(src, /embedding|levenshtein|similarity\(|anthropic|openai/i);
    assert.doesNotMatch(src, /CMD_001/);
  });
});
