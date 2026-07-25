import type {
  CalibrationMetrics,
  CalibrationReadinessStatus,
  CalibrationSuiteResult,
  CertificationReadinessDecision,
  CertificationThresholds,
  EditorialQualityMetrics,
  EvidenceMetrics,
  StabilityMetrics,
} from "./contracts.ts";
import { safeDivide } from "./metrics.ts";

export interface ThresholdEvaluationInput {
  metrics: CalibrationMetrics;
  evidence: EvidenceMetrics;
  editorial: EditorialQualityMetrics;
  stability: StabilityMetrics | null;
  costPerCase: number;
  latencyP95Ms: number;
  safetyFailures: number;
  criticalFalseNegatives: number;
  requiredCasesTotal: number;
  requiredCasesPassed: number;
}

/** Evaluate certification thresholds — never certifies in PR 3A. */
export function evaluateCertificationThresholds(
  thresholds: CertificationThresholds,
  input: ThresholdEvaluationInput,
): CertificationReadinessDecision {
  const blockers_failed: string[] = [];
  const warnings_raised: string[] = [];
  const b = thresholds.blockers;
  const w = thresholds.warnings;

  if (input.requiredCasesTotal < 1) {
    return {
      status: "insufficient_evidence",
      ready: false,
      blockers_failed: ["insufficient evaluation coverage"],
      warnings_raised: [],
      human_adjudication_pending: input.editorial.pending_human_count,
      certified: false,
    };
  }

  if (input.metrics.precision < b.min_precision) {
    blockers_failed.push(`precision ${input.metrics.precision} < ${b.min_precision}`);
  }
  if (input.metrics.recall < b.min_recall) {
    blockers_failed.push(`recall ${input.metrics.recall} < ${b.min_recall}`);
  }
  if (input.metrics.hallucination_rate > b.max_hallucination_rate) {
    blockers_failed.push(
      `hallucination_rate ${input.metrics.hallucination_rate} > ${b.max_hallucination_rate}`,
    );
  }
  if (input.metrics.unsupported_finding_rate > b.max_unsupported_finding_rate) {
    blockers_failed.push("unsupported finding threshold exceeded");
  }
  if (input.evidence.mean_evidence_presence < b.min_evidence_compliance) {
    blockers_failed.push("evidence compliance below minimum");
  }
  if (input.evidence.mean_contrary_evidence_compliance < b.min_contrary_evidence_compliance) {
    blockers_failed.push("contrary-evidence compliance below minimum");
  }
  if (input.evidence.mean_uncertainty_compliance < b.min_uncertainty_compliance) {
    blockers_failed.push("uncertainty compliance below minimum");
  }
  if (input.metrics.parse_success_rate < 1 - b.max_parser_failure_rate) {
    blockers_failed.push("parser failure above maximum");
  }
  if (input.safetyFailures > 0) {
    blockers_failed.push("safety failure present");
  }
  if (input.criticalFalseNegatives > b.max_critical_false_negatives) {
    blockers_failed.push("critical false negatives present");
  }

  const passRate = safeDivide(input.requiredCasesPassed, input.requiredCasesTotal);
  if (passRate < b.required_case_pass_rate) {
    blockers_failed.push("required case pass rate below minimum");
  }

  if (w.recall_below_target !== null && input.metrics.recall < w.recall_below_target) {
    warnings_raised.push("recall below warning target");
  }
  if (
    w.stability_below_target !== null &&
    input.stability?.sufficient_repetition &&
    (input.stability.hash_agreement_rate ?? 0) < w.stability_below_target
  ) {
    warnings_raised.push("stability below warning target");
  }
  if (w.cost_above_target !== null && input.costPerCase > w.cost_above_target) {
    warnings_raised.push("cost above warning target");
  }
  if (w.latency_above_target_ms !== null && input.latencyP95Ms > w.latency_above_target_ms) {
    warnings_raised.push("latency above warning target");
  }
  if (input.editorial.pending_human_count > 0) {
    warnings_raised.push("human adjudication incomplete");
  }

  let status: CalibrationReadinessStatus = "not_ready";
  if (blockers_failed.length === 0 && input.editorial.pending_human_count === 0) {
    status = "ready";
  }

  return {
    status,
    ready: false,
    blockers_failed,
    warnings_raised,
    human_adjudication_pending: input.editorial.pending_human_count,
    certified: false,
  };
}

export function buildThresholdInputFromSuite(
  suiteResult: CalibrationSuiteResult,
  requiredCaseIds: readonly string[],
): ThresholdEvaluationInput {
  const requiredResults = suiteResult.case_results.filter((r) =>
    requiredCaseIds.includes(r.case_id),
  );
  const safetyFailures = suiteResult.case_results.filter((r) => r.safety_failure).length;
  const criticalFn = suiteResult.case_results.reduce(
    (s, r) =>
      s +
      r.false_negatives.filter((fn) => fn.message.includes("critical") || fn.key.includes("critical"))
        .length,
    0,
  );

  return {
    metrics: suiteResult.metrics,
    evidence: suiteResult.evidence_metrics,
    editorial: suiteResult.editorial_metrics,
    stability: suiteResult.stability,
    costPerCase: suiteResult.cost?.cost_per_case_mean ?? 0,
    latencyP95Ms: suiteResult.latency.case_duration_p95_ms,
    safetyFailures,
    criticalFalseNegatives: criticalFn,
    requiredCasesTotal: requiredCaseIds.length,
    requiredCasesPassed: requiredResults.filter((r) => r.ok && r.case_score >= 0.8).length,
  };
}
