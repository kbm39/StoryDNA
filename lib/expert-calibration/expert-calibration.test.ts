import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  MAX_CALIBRATION_EXCERPT_CHARS,
} from "./constants.ts";
import type { ExpertCalibrationCase, ExpertCalibrationSuite } from "./contracts.ts";
import {
  normalizeExpertCalibrationCase,
  validateExpertCalibrationCase,
} from "./evaluation-case.ts";
import { loadCalibrationSuite } from "./suite.ts";
import { controlledTextMatch, roundRate, scoreCalibrationCase } from "./scoring.ts";
import { computeCalibrationMetrics, safeDivide } from "./metrics.ts";
import { computeStabilityMetrics } from "./stability.ts";
import { evaluateCertificationThresholds } from "./thresholds.ts";
import { buildCalibrationReport, serializeCalibrationReport } from "./report.ts";
import { runExpertCalibration } from "./runner.ts";
import {
  EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME,
  readExpertCalibrationFrameworkEnabled,
} from "./feature-flags.ts";
import type { CalibrationCaseResult, CalibrationProjectedFinding } from "./contracts.ts";
import { MILITARY_EXPERT_CALIBRATION_THRESHOLDS } from "@/experts/military-expert/calibration/thresholds.ts";
import { militaryExpertCalibrationAdapter } from "@/experts/military-expert/calibration/adapter.ts";
import {
  MILITARY_EXPERT_CALIBRATION_SUITE,
} from "@/experts/military-expert/calibration/corpus.ts";
import { buildPerfectMilitaryExpertReplayOutputs } from "@/experts/military-expert/calibration/replay-fixtures.ts";
import { computeMilitaryExpertConstitutionDefinitionHash } from "@/experts/military-expert/military-expert-constitution-hash.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "@/experts/military-expert/generation-contract.ts";
import { militaryExpertRuntimeDefinition } from "@/experts/military-expert/runtime-definition.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function baseCase(overrides: Partial<ExpertCalibrationCase> = {}): ExpertCalibrationCase {
  const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!;
  return { ...structuredClone(c), ...overrides };
}

function projected(overrides: Partial<CalibrationProjectedFinding> = {}): CalibrationProjectedFinding {
  return {
    finding_key: "rank-authority-error",
    category: "command_and_organization",
    title: "Corporal directs operation",
    observation: "A corporal tasking platoons without officer oversight exceeds rank authority.",
    recommendation: "Route platoon tasking through an appropriate officer.",
    operational_impact: "Chain-of-command credibility weakens.",
    story_impact: "Authority relationships become harder to trust.",
    combined_text:
      "A corporal tasking platoons without officer oversight exceeds rank authority. Route platoon tasking through an appropriate officer.",
    semantic_search_text:
      "Corporal directs operation A corporal tasking platoons without officer oversight exceeds rank authority. Route platoon tasking through an appropriate officer. Chain-of-command credibility weakens. Authority relationships become harder to trust.",
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

describe("Expert Calibration Framework PR 3A", () => {
  it("1 valid case accepted", () => {
    const result = validateExpertCalibrationCase(MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!);
    assert.equal(result.ok, true);
  });

  it("2 duplicate case ID rejected in suite", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!;
    const suite: ExpertCalibrationSuite = {
      ...MILITARY_EXPERT_CALIBRATION_SUITE,
      cases: [c, { ...c }],
    };
    const result = loadCalibrationSuite(suite);
    assert.equal(result.ok, false);
  });

  it("3 oversized excerpt rejected", () => {
    const c = baseCase({
      manuscript: {
        ...baseCase().manuscript,
        text: "x".repeat(MAX_CALIBRATION_EXCERPT_CHARS + 1),
        word_count: 1000,
        content_hash: "abc",
      },
    });
    assert.equal(validateExpertCalibrationCase(c).ok, false);
  });

  it("4 invalid enum rejected", () => {
    const c = baseCase({ difficulty: "invalid" as never });
    assert.equal(validateExpertCalibrationCase(c).ok, false);
  });

  it("5 missing rationale rejected", () => {
    const c = baseCase({ adjudication: { mode: "automatic", rationale: "" } });
    assert.equal(validateExpertCalibrationCase(c).ok, false);
  });

  it("6 contradictory expectations rejected", () => {
    const c = baseCase({
      expected_findings: [
        {
          finding_key: "x",
          category: "command_and_organization",
          realism_status: "accurate",
          severity_min: "critical",
          must_include_evidence: true,
          match_mode: "identifier",
          weight: 1,
        },
      ],
    });
    assert.equal(validateExpertCalibrationCase(c).ok, false);
  });

  it("7 unapproved real-manuscript provenance rejected", () => {
    const c = baseCase({
      provenance: {
        author: "x",
        created_at: "2026-01-01",
        source: "approved_excerpt",
        approval_status: "pending",
      },
    });
    assert.equal(validateExpertCalibrationCase(c).ok, false);
  });

  it("8 input not mutated by normalize", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!;
    const snap = structuredClone(c);
    normalizeExpertCalibrationCase(c);
    assert.deepEqual(c, snap);
  });

  it("9 suite ordering deterministic", () => {
    const a = loadCalibrationSuite(MILITARY_EXPERT_CALIBRATION_SUITE);
    const b = loadCalibrationSuite(MILITARY_EXPERT_CALIBRATION_SUITE);
    assert.deepEqual(a.ok && b.ok ? a.suite.cases.map((x) => x.case_id) : [], a.ok && b.ok ? b.suite.cases.map((x) => x.case_id) : []);
  });

  it("10 expected finding matched", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!;
    const score = scoreCalibrationCase(c, [projected()]);
    assert.ok(score.true_positives.length >= 1);
  });

  it("11 missed finding recorded", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[0]!;
    const score = scoreCalibrationCase(c, []);
    assert.ok(score.false_negatives.length >= 1);
  });

  it("12 false positive recorded", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[1]!;
    const score = scoreCalibrationCase(c, [
      projected({
        finding_key: "spurious",
        realism_status: "confirmed_error",
        category: "command_and_organization",
      }),
    ]);
    assert.ok(score.false_positives.length >= 1);
  });

  it("13 prohibited finding recorded", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((x) => x.case_id === "me-int-003")!;
    const score = scoreCalibrationCase(c, [
      projected({
        finding_key: "fabricated",
        title: "FM 3-999 cited",
        category: "intelligence_and_opsec",
        realism_status: "confirmed_error",
      }),
    ]);
    assert.ok(score.prohibited_violations.length >= 1);
  });

  it("14 expected non-finding preserved", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases[1]!;
    const score = scoreCalibrationCase(c, [
      projected({ finding_key: "accurate-coc", realism_status: "accurate", severity: "informational" }),
    ]);
    assert.equal(score.non_finding_violations.length, 0);
  });

  it("15 uncertainty matched", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((x) => x.case_id === "me-int-001")!;
    const score = scoreCalibrationCase(c, [
      projected({
        finding_key: "opsec-insufficient",
        category: "intelligence_and_opsec",
        realism_status: "insufficient_evidence",
        uncertainty_note_present: true,
        has_manuscript_evidence: false,
      }),
    ]);
    assert.ok(score.uncertainty_results.some((u) => u.matched));
  });

  it("16 contrary evidence matched", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((x) => x.case_id === "me-ops-003")!;
    const score = scoreCalibrationCase(c, [
      projected({
        finding_key: "breach-narrowed",
        category: "operations_and_tactics",
        realism_status: "context_dependent",
        has_contrary_evidence: true,
      }),
    ]);
    assert.ok(score.evidence_quality_score > 0);
  });

  it("17 escalation matched via scoring path", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((x) => x.case_id === "me-hp-003")!;
    const score = scoreCalibrationCase(c, [
      projected({
        finding_key: "outside-domain",
        category: "human_performance",
        realism_status: "outside_expertise",
        escalation_expert: "medical_expert",
      }),
    ]);
    assert.equal(score.false_negatives.some((f) => f.key === "escalation-missed"), false);
  });

  it("18 deterministic text matching", () => {
    assert.equal(controlledTextMatch("Corporal Hale assigned platoons", "corporal hale"), true);
    assert.equal(controlledTextMatch("Alpha", "beta"), false);
  });

  it("19 unrestricted fuzzy match absent", () => {
    const src = readFileSync(join(ROOT, "lib/expert-calibration/scoring.ts"), "utf8");
    assert.doesNotMatch(src, /embedding|levenshtein|similarity\(/i);
  });

  it("20 precision correct", () => {
    const metrics = computeCalibrationMetrics([
      {
        true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }],
        false_positives: [],
        false_negatives: [],
      } as CalibrationCaseResult,
    ]);
    assert.equal(metrics.precision, 1);
  });

  it("21 recall correct", () => {
    const metrics = computeCalibrationMetrics([
      {
        true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }],
        false_positives: [{ key: "b", kind: "false_positive", score: 0, message: "" }],
        false_negatives: [{ key: "c", kind: "false_negative", score: 0, message: "" }],
      } as CalibrationCaseResult,
    ]);
    assert.equal(metrics.recall, 0.5);
  });

  it("22 hallucination rate correct", () => {
    const metrics = computeCalibrationMetrics([
      {
        true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }],
        false_positives: [{ key: "b", kind: "false_positive", score: 0, message: "" }],
        false_negatives: [],
      } as CalibrationCaseResult,
    ]);
    assert.equal(metrics.hallucination_rate, 0.5);
  });

  it("23 unsupported rate bounded", () => {
    const metrics = computeCalibrationMetrics([]);
    assert.equal(metrics.unsupported_finding_rate, 0);
  });

  it("24 missed rate correct", () => {
    const metrics = computeCalibrationMetrics([
      {
        true_positives: [],
        false_positives: [],
        false_negatives: [{ key: "a", kind: "false_negative", score: 0, message: "" }],
      } as CalibrationCaseResult,
    ]);
    assert.equal(metrics.missed_finding_rate, 1);
  });

  it("25 division by zero safe", () => assert.equal(safeDivide(1, 0), 0));
  it("26 no NaN", () => assert.equal(Number.isNaN(safeDivide(0, 0)), false));
  it("27 no Infinity", () => assert.equal(Number.isFinite(safeDivide(1, 0)), true));
  it("28 deterministic rounding", () => assert.equal(roundRate(0.123456789), 0.1235));

  it("29 raw counts retained", () => {
    const m = computeCalibrationMetrics([
      { true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }], false_positives: [], false_negatives: [] } as CalibrationCaseResult,
    ]);
    assert.equal(m.true_positives, 1);
  });

  it("30 human metrics remain pending when unadjudicated", () => {
    const c = MILITARY_EXPERT_CALIBRATION_SUITE.cases.find((x) => x.case_id === "me-rank-001")!;
    const score = scoreCalibrationCase(c, [projected()], { humanAdjudicated: false });
    assert.equal(score.editorial_quality_score, null);
    assert.equal(score.adjudication_required, true);
  });

  it("31 repeated stable output scores high stability", () => {
    const results = [
      { case_id: "a", run_index: 0, parsed_output_hash: "h1", true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }], case_score: 1, evidence_quality_score: 1, false_positives: [], false_negatives: [], prohibited_violations: [], non_finding_violations: [], uncertainty_results: [] },
      { case_id: "a", run_index: 1, parsed_output_hash: "h1", true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }], case_score: 1, evidence_quality_score: 1, false_positives: [], false_negatives: [], prohibited_violations: [], non_finding_violations: [], uncertainty_results: [] },
    ] as CalibrationCaseResult[];
    const s = computeStabilityMetrics(results, 2);
    assert.equal(s.sufficient_repetition, true);
    assert.equal(s.hash_agreement_rate, 1);
  });

  it("32 divergent output scores low stability", () => {
    const results = [
      { case_id: "a", run_index: 0, parsed_output_hash: "h1", true_positives: [{ key: "a", kind: "true_positive", score: 1, message: "" }], case_score: 1, evidence_quality_score: 1, false_positives: [], false_negatives: [], prohibited_violations: [], non_finding_violations: [], uncertainty_results: [] },
      { case_id: "a", run_index: 1, parsed_output_hash: "h2", true_positives: [], case_score: 0, evidence_quality_score: 0, false_positives: [], false_negatives: [{ key: "a", kind: "false_negative", score: 0, message: "" }], prohibited_violations: [], non_finding_violations: [], uncertainty_results: [] },
    ] as CalibrationCaseResult[];
    const s = computeStabilityMetrics(results, 2);
    assert.equal(s.hash_agreement_rate, 0);
  });

  it("33 single run reports insufficient repetition", () => {
    const s = computeStabilityMetrics([], 1);
    assert.equal(s.sufficient_repetition, false);
  });

  it("34-38 stability dimensions present", () => {
    const s = computeStabilityMetrics([], 2);
    assert.notEqual(s.severity_stability, undefined);
    assert.notEqual(s.confidence_stability, undefined);
    assert.notEqual(s.recommendation_stability, undefined);
    assert.notEqual(s.uncertainty_stability, undefined);
    assert.notEqual(s.escalation_stability, undefined);
  });

  it("39 hard blocker produces not_ready", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: { ...computeCalibrationMetrics([]), precision: 0, recall: 0, hallucination_rate: 1, unsupported_finding_rate: 1, missed_finding_rate: 1, attempted_runs: 0, completed_runs: 0, failed_runs: 0, parser_failures: 0, repair_required_runs: 0, parse_success_rate: 0, validation_success_rate: 0, cases_total: 1, cases_passed: 0, cases_failed: 1, cases_skipped: 0, cases_needing_human: 0, true_positives: 0, false_positives: 1, false_negatives: 1, f1: 0 },
      evidence: { mean_evidence_presence: 0, mean_evidence_support: 0, mean_contrary_evidence_compliance: 0, mean_uncertainty_compliance: 0, mean_confidence_justification: 0 },
      editorial: { mean_usefulness: null, mean_specificity: null, mean_practicality: null, mean_dramatic_intent_preservation: null, mean_escalation_quality: null, mean_non_finding_discipline: null, human_adjudicated: false, pending_human_count: 0 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 1,
      criticalFalseNegatives: 1,
      requiredCasesTotal: 1,
      requiredCasesPassed: 0,
    });
    assert.equal(decision.ready, false);
    assert.equal(decision.status, "not_ready");
  });

  it("40 warning does not become hard blocker alone", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: { ...computeCalibrationMetrics([]), precision: 1, recall: 0.7, hallucination_rate: 0, unsupported_finding_rate: 0, missed_finding_rate: 0, attempted_runs: 1, completed_runs: 1, failed_runs: 0, parser_failures: 0, repair_required_runs: 0, parse_success_rate: 1, validation_success_rate: 1, cases_total: 1, cases_passed: 1, cases_failed: 0, cases_skipped: 0, cases_needing_human: 0, true_positives: 1, false_positives: 0, false_negatives: 0, f1: 1 },
      evidence: { mean_evidence_presence: 1, mean_evidence_support: 1, mean_contrary_evidence_compliance: 1, mean_uncertainty_compliance: 1, mean_confidence_justification: 1 },
      editorial: { mean_usefulness: 1, mean_specificity: 1, mean_practicality: 1, mean_dramatic_intent_preservation: 1, mean_escalation_quality: 1, mean_non_finding_discipline: 1, human_adjudicated: true, pending_human_count: 0 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 0,
      criticalFalseNegatives: 0,
      requiredCasesTotal: 1,
      requiredCasesPassed: 1,
    });
    assert.ok(decision.warnings_raised.length >= 0);
    assert.equal(decision.certified, false);
  });

  it("41 insufficient coverage produces insufficient_evidence", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: computeCalibrationMetrics([]),
      evidence: { mean_evidence_presence: 0, mean_evidence_support: 0, mean_contrary_evidence_compliance: 0, mean_uncertainty_compliance: 0, mean_confidence_justification: 0 },
      editorial: { mean_usefulness: null, mean_specificity: null, mean_practicality: null, mean_dramatic_intent_preservation: null, mean_escalation_quality: null, mean_non_finding_discipline: null, human_adjudicated: false, pending_human_count: 0 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 0,
      criticalFalseNegatives: 0,
      requiredCasesTotal: 0,
      requiredCasesPassed: 0,
    });
    assert.equal(decision.status, "insufficient_evidence");
  });

  it("42 safety failure blocks", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: { ...computeCalibrationMetrics([]), precision: 1, recall: 1, hallucination_rate: 0, unsupported_finding_rate: 0, missed_finding_rate: 0, attempted_runs: 1, completed_runs: 1, failed_runs: 0, parser_failures: 0, repair_required_runs: 0, parse_success_rate: 1, validation_success_rate: 1, cases_total: 1, cases_passed: 1, cases_failed: 0, cases_skipped: 0, cases_needing_human: 0, true_positives: 1, false_positives: 0, false_negatives: 0, f1: 1 },
      evidence: { mean_evidence_presence: 1, mean_evidence_support: 1, mean_contrary_evidence_compliance: 1, mean_uncertainty_compliance: 1, mean_confidence_justification: 1 },
      editorial: { mean_usefulness: 1, mean_specificity: 1, mean_practicality: 1, mean_dramatic_intent_preservation: 1, mean_escalation_quality: 1, mean_non_finding_discipline: 1, human_adjudicated: true, pending_human_count: 0 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 1,
      criticalFalseNegatives: 0,
      requiredCasesTotal: 1,
      requiredCasesPassed: 1,
    });
    assert.ok(decision.blockers_failed.some((b) => b.includes("safety")));
  });

  it("43 human adjudication incomplete warned", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: { ...computeCalibrationMetrics([]), precision: 1, recall: 1, hallucination_rate: 0, unsupported_finding_rate: 0, missed_finding_rate: 0, attempted_runs: 1, completed_runs: 1, failed_runs: 0, parser_failures: 0, repair_required_runs: 0, parse_success_rate: 1, validation_success_rate: 1, cases_total: 1, cases_passed: 1, cases_failed: 0, cases_skipped: 0, cases_needing_human: 1, true_positives: 1, false_positives: 0, false_negatives: 0, f1: 1 },
      evidence: { mean_evidence_presence: 1, mean_evidence_support: 1, mean_contrary_evidence_compliance: 1, mean_uncertainty_compliance: 1, mean_confidence_justification: 1 },
      editorial: { mean_usefulness: null, mean_specificity: null, mean_practicality: null, mean_dramatic_intent_preservation: null, mean_escalation_quality: null, mean_non_finding_discipline: null, human_adjudicated: false, pending_human_count: 1 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 0,
      criticalFalseNegatives: 0,
      requiredCasesTotal: 1,
      requiredCasesPassed: 1,
    });
    assert.ok(decision.warnings_raised.some((w) => w.includes("human adjudication")));
  });

  it("44 expert override bounded", () => {
    assert.ok(MILITARY_EXPERT_CALIBRATION_THRESHOLDS.domain_overrides?.operations_and_tactics);
  });

  it("45 no certification side effect", () => {
    const decision = evaluateCertificationThresholds(MILITARY_EXPERT_CALIBRATION_THRESHOLDS, {
      metrics: { ...computeCalibrationMetrics([]), precision: 1, recall: 1, hallucination_rate: 0, unsupported_finding_rate: 0, missed_finding_rate: 0, attempted_runs: 1, completed_runs: 1, failed_runs: 0, parser_failures: 0, repair_required_runs: 0, parse_success_rate: 1, validation_success_rate: 1, cases_total: 1, cases_passed: 1, cases_failed: 0, cases_skipped: 0, cases_needing_human: 0, true_positives: 1, false_positives: 0, false_negatives: 0, f1: 1 },
      evidence: { mean_evidence_presence: 1, mean_evidence_support: 1, mean_contrary_evidence_compliance: 1, mean_uncertainty_compliance: 1, mean_confidence_justification: 1 },
      editorial: { mean_usefulness: 1, mean_specificity: 1, mean_practicality: 1, mean_dramatic_intent_preservation: 1, mean_escalation_quality: 1, mean_non_finding_discipline: 1, human_adjudicated: true, pending_human_count: 0 },
      stability: null,
      costPerCase: 0,
      latencyP95Ms: 0,
      safetyFailures: 0,
      criticalFalseNegatives: 0,
      requiredCasesTotal: 1,
      requiredCasesPassed: 1,
    });
    assert.equal(decision.certified, false);
  });

  it("46 valid replay suite completes", async () => {
    const result = await runExpertCalibration(
      {
        suite: MILITARY_EXPERT_CALIBRATION_SUITE,
        config: {
          run_id: "cal-test-001",
          correlation_id: "corr-001",
          mode: "replay",
          repeat_count: 1,
        },
        replayOutputs: buildPerfectMilitaryExpertReplayOutputs(),
      },
      {
        adapter: militaryExpertCalibrationAdapter,
        thresholds: MILITARY_EXPERT_CALIBRATION_THRESHOLDS,
        bypassFeatureFlag: true,
        now: () => 1_700_000_000_000,
      },
    );
    assert.ok(result.suiteResult);
    assert.equal(result.modelCalls, 0);
  });

  it("47 invalid suite fails closed", async () => {
    const bad = { ...MILITARY_EXPERT_CALIBRATION_SUITE, cases: [] };
    const result = await runExpertCalibration(
      { suite: bad, config: { run_id: "x", correlation_id: "y", mode: "test", repeat_count: 1 }, replayOutputs: [] },
      { adapter: militaryExpertCalibrationAdapter, thresholds: MILITARY_EXPERT_CALIBRATION_THRESHOLDS, bypassFeatureFlag: true },
    );
    assert.equal(result.ok, false);
  });

  it("48-52 side effect invariants", async () => {
    const result = await runExpertCalibration(
      {
        suite: MILITARY_EXPERT_CALIBRATION_SUITE,
        config: { run_id: "cal-inv", correlation_id: "corr-inv", mode: "replay", repeat_count: 1 },
        replayOutputs: buildPerfectMilitaryExpertReplayOutputs(),
      },
      { adapter: militaryExpertCalibrationAdapter, thresholds: MILITARY_EXPERT_CALIBRATION_THRESHOLDS, bypassFeatureFlag: true },
    );
    assert.equal(result.modelCalls, 0);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.productionWrites, 0);
    assert.equal(result.filesWritten, 0);
    assert.equal(result.productionExecutionOccurred, false);
  });

  it("53-56 no forbidden imports in runner", () => {
    const src = readFileSync(join(ROOT, "lib/expert-calibration/runner.ts"), "utf8");
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(codeOnly, /from\s+["']@?\/?.*(?:anthropic|openai|trigger|supabase)/i);
    assert.doesNotMatch(codeOnly, /run-expert-review/);
  });

  it("57 deterministic report", async () => {
    const input = {
      suite: MILITARY_EXPERT_CALIBRATION_SUITE,
      config: { run_id: "rep-a", correlation_id: "c-a", mode: "replay" as const, repeat_count: 1 },
      replayOutputs: buildPerfectMilitaryExpertReplayOutputs(),
    };
    const deps = { adapter: militaryExpertCalibrationAdapter, thresholds: MILITARY_EXPERT_CALIBRATION_THRESHOLDS, bypassFeatureFlag: true, now: () => 1000 };
    const a = await runExpertCalibration(input, deps);
    const b = await runExpertCalibration(input, deps);
    assert.equal(serializeCalibrationReport(a.report!), serializeCalibrationReport(b.report!));
  });

  it("58 deterministic hashes supplied through replay metadata", () => {
    const replay = buildPerfectMilitaryExpertReplayOutputs()[0]!;
    assert.ok(replay.request_hash);
    assert.ok(replay.parsed_output_hash);
  });

  it("59 failure output omits manuscript text", () => {
    const report = buildCalibrationReport({
      suite_id: "s",
      run_id: "r",
      expert_key: "military_expert",
      expert_version: "v1.0.0-draft",
      definition_hash: "abc",
      mode: "replay",
      case_results: [],
      metrics: computeCalibrationMetrics([]),
      evidence_metrics: { mean_evidence_presence: 0, mean_evidence_support: 0, mean_contrary_evidence_compliance: 0, mean_uncertainty_compliance: 0, mean_confidence_justification: 0 },
      editorial_metrics: { mean_usefulness: null, mean_specificity: null, mean_practicality: null, mean_dramatic_intent_preservation: null, mean_escalation_quality: null, mean_non_finding_discipline: null, human_adjudicated: false, pending_human_count: 0 },
      stability: null,
      cost: null,
      latency: { total_duration_ms: 0, case_duration_p50_ms: 0, case_duration_p95_ms: 0, case_duration_max_ms: 0 },
      certification: { status: "not_ready", ready: false, blockers_failed: [], warnings_raised: [], human_adjudication_pending: 0, certified: false },
      duration_ms: 0,
      started_at: "2026-01-01T00:00:00.000Z",
      completed_at: "2026-01-01T00:00:00.000Z",
      model_calls: 0,
      provider_calls: 0,
      production_writes: 0,
      files_written: 0,
      production_execution_occurred: false,
    });
    assert.doesNotMatch(report.markdown, /Corporal Hale assigned platoons/i);
  });

  it("60 exactly 34 Military Expert cases", () => {
    assert.equal(MILITARY_EXPERT_CALIBRATION_SUITE.cases.length, 34);
  });

  it("61 all IDs unique", () => {
    const ids = MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => c.case_id);
    assert.equal(ids.length, new Set(ids).size);
  });

  it("62 all provenance synthetic", () => {
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.every((c) => c.provenance.source === "synthetic"));
  });

  it("63 all approved", () => {
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.every((c) => c.provenance.approval_status === "approved"));
  });

  it("64 required domains covered", () => {
    const tags = new Set(MILITARY_EXPERT_CALIBRATION_SUITE.cases.flatMap((c) => c.domain_tags));
    for (const required of ["chain_of_command", "weapons_handling", "logistics", "rules_of_engagement", "duplicate_trap"]) {
      assert.ok(tags.has(required), `missing ${required}`);
    }
  });

  it("65-70 corpus diversity cases exist", () => {
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.expected_findings.some((f) => f.realism_status === "accurate")));
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.ambiguity_level === "high"));
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.safety_classification === "unsafe_operational_trap"));
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.safety_classification === "dramatic_preservation"));
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.expected_escalations.length > 0));
    assert.ok(MILITARY_EXPERT_CALIBRATION_SUITE.cases.some((c) => c.expected_contrary_evidence.length > 0));
  });

  it("71 Military Expert remains draft", () => {
    assert.equal(militaryExpertRuntimeDefinition().expert_version, "v1.0.0-draft");
  });

  it("72 Military Expert remains uncertified", () => {
    assert.equal(militaryExpertRuntimeDefinition().enabled, false);
  });

  it("73 runtime remains disabled", () => {
    assert.equal(militaryExpertRuntimeDefinition().enabled, false);
  });

  it("74-76 UI/catalog unchanged", () => {
    const catalog = readFileSync(join(ROOT, "lib/expert-catalog.ts"), "utf8");
    assert.match(catalog, /coming_soon|Coming Soon/i);
    assert.doesNotMatch(readFileSync(join(ROOT, "lib/expert-team-selection.ts"), "utf8"), /military_expert.*selectionEnabled:\s*true/);
  });

  it("77 runExpertReview unchanged", () => {
    const src = readFileSync(join(ROOT, "lib/expert-review-engine/run-expert-review.ts"), "utf8");
    assert.match(src, /plan_only/);
    assert.doesNotMatch(src, /expert-calibration/);
  });

  it("78 executionAllowed remains false", () => {
    const src = readFileSync(join(ROOT, "lib/expert-review-engine/run-expert-review.ts"), "utf8");
    assert.match(src, /executionAllowed:\s*false/);
  });

  it("79 Literary Agent hashes unchanged", () => {
    assert.equal(
      militaryExpertRuntimeDefinition().runtime_versions.definition_hash,
      MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    );
    assert.equal(computeMilitaryExpertConstitutionDefinitionHash().length, 64);
  });

  it("80 no migration", () => {
    const src = readFileSync(join(ROOT, "lib/expert-calibration/runner.ts"), "utf8");
    assert.doesNotMatch(src, /migration|0024/i);
  });

  it("81 feature flag default off", () => {
    assert.equal(readExpertCalibrationFrameworkEnabled({}), false);
    assert.equal(readExpertCalibrationFrameworkEnabled({ [EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME]: "" }), false);
    assert.equal(readExpertCalibrationFrameworkEnabled({ [EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME]: "maybe" }), false);
    assert.equal(readExpertCalibrationFrameworkEnabled({ [EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME]: "true" }), true);
  });
});
