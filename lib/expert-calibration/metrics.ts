import type {
  CalibrationCaseResult,
  CalibrationMetrics,
  EditorialQualityMetrics,
  EvidenceMetrics,
} from "./contracts.ts";
import { roundRate } from "./scoring.ts";

/** Safe division — returns 0 when denominator is 0, never NaN/Infinity. */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return 0;
  }
  const value = numerator / denominator;
  return Number.isFinite(value) ? roundRate(value) : 0;
}

/**
 * Aggregate suite metrics.
 * precision = TP / (TP + FP)
 * recall = TP / (TP + FN)
 * hallucination_rate = FP / (TP + FP)
 * missed_finding_rate = FN / (TP + FN)
 */
export function computeCalibrationMetrics(
  caseResults: readonly CalibrationCaseResult[],
): CalibrationMetrics {
  const tp = caseResults.reduce((s, r) => s + r.true_positives.length, 0);
  const fp = caseResults.reduce((s, r) => s + r.false_positives.length, 0);
  const fn = caseResults.reduce((s, r) => s + r.false_negatives.length, 0);

  const precision = safeDivide(tp, tp + fp);
  const recall = safeDivide(tp, tp + fn);
  const f1 = safeDivide(2 * precision * recall, precision + recall);
  const hallucination_rate = safeDivide(fp, tp + fp);
  const missed_finding_rate = safeDivide(fn, tp + fn);

  const unsupported = caseResults.filter((r) =>
    r.false_positives.some((m) => m.message.includes("Unexpected")),
  ).length;

  const attempted = caseResults.length;
  const completed = caseResults.filter((r) => r.parse_status === "success").length;
  const failed = caseResults.filter((r) => !r.ok).length;
  const parser_failures = caseResults.filter((r) => r.parse_status === "parse_failed").length;
  const repair_required_runs = caseResults.filter((r) => r.repair_required).length;

  const cases_passed = caseResults.filter((r) => r.ok && r.case_score >= 0.8).length;
  const cases_needing_human = caseResults.filter((r) => r.human_adjudication_pending).length;

  return {
    cases_total: caseResults.length,
    cases_passed,
    cases_failed: caseResults.length - cases_passed,
    cases_skipped: caseResults.filter((r) => r.parse_status === "skipped").length,
    cases_needing_human,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    precision,
    recall,
    f1,
    hallucination_rate,
    unsupported_finding_rate: safeDivide(unsupported, attempted),
    missed_finding_rate,
    attempted_runs: attempted,
    completed_runs: completed,
    failed_runs: failed,
    parser_failures,
    repair_required_runs,
    parse_success_rate: safeDivide(completed, attempted),
    validation_success_rate: safeDivide(
      caseResults.filter((r) => r.parse_status === "success").length,
      attempted,
    ),
  };
}

export function computeEvidenceMetrics(
  caseResults: readonly CalibrationCaseResult[],
): EvidenceMetrics {
  const n = caseResults.length || 1;
  return {
    mean_evidence_presence: roundRate(
      caseResults.reduce((s, r) => s + r.evidence_quality_score, 0) / n,
    ),
    mean_evidence_support: roundRate(
      caseResults.reduce((s, r) => s + r.evidence_quality_score, 0) / n,
    ),
    mean_contrary_evidence_compliance: roundRate(
      caseResults.reduce((s, r) => s + r.evidence_quality_score, 0) / n,
    ),
    mean_uncertainty_compliance: roundRate(
      caseResults.filter((r) => r.uncertainty_results.every((u) => u.matched)).length / n,
    ),
    mean_confidence_justification: roundRate(
      caseResults.reduce((s, r) => s + r.evidence_quality_score, 0) / n,
    ),
  };
}

export function computeEditorialMetrics(
  caseResults: readonly CalibrationCaseResult[],
): EditorialQualityMetrics {
  const adjudicated = caseResults.filter((r) => r.editorial_quality_score !== null);
  const pending = caseResults.filter((r) => r.human_adjudication_pending).length;
  const mean = (values: number[]) =>
    values.length === 0 ? null : roundRate(values.reduce((a, b) => a + b, 0) / values.length);

  const scores = adjudicated
    .map((r) => r.editorial_quality_score)
    .filter((v): v is number => v !== null);

  return {
    mean_usefulness: mean(scores),
    mean_specificity: mean(scores),
    mean_practicality: mean(scores),
    mean_dramatic_intent_preservation: mean(scores),
    mean_escalation_quality: mean(scores),
    mean_non_finding_discipline: mean(
      caseResults.map((r) => (r.non_finding_violations.length === 0 ? 1 : 0)),
    ),
    human_adjudicated: pending === 0 && caseResults.every((r) => !r.adjudication_required),
    pending_human_count: pending,
  };
}
