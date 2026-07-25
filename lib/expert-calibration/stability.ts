import { hashCanonicalOutput } from "@/lib/expert-review-engine/canonical-output.ts";
import type { CalibrationCaseResult, StabilityMetrics } from "./contracts.ts";
import { safeDivide } from "./metrics.ts";
import { roundRate } from "./scoring.ts";

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const v of a) {
    if (b.has(v)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return safeDivide(intersection, union);
}

function variance(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return roundRate(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function fieldStability(
  groups: Map<string, CalibrationCaseResult[]>,
  selector: (r: CalibrationCaseResult) => string,
): number | null {
  const scores: number[] = [];
  for (const runs of groups.values()) {
    if (runs.length < 2) continue;
    const values = runs.map(selector);
    scores.push(values.every((v) => v === values[0]) ? 1 : 0);
  }
  return scores.length === 0 ? null : roundRate(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Stability across repeated runs grouped by case_id. */
export function computeStabilityMetrics(
  caseResults: readonly CalibrationCaseResult[],
  repeatCount: number,
): StabilityMetrics {
  const sufficient = repeatCount > 1;
  const byCase = new Map<string, CalibrationCaseResult[]>();
  for (const r of caseResults) {
    const list = byCase.get(r.case_id) ?? [];
    list.push(r);
    byCase.set(r.case_id, list);
  }

  if (!sufficient) {
    return {
      repeat_count: repeatCount,
      sufficient_repetition: false,
      hash_agreement_rate: null,
      finding_set_jaccard_mean: null,
      severity_stability: null,
      confidence_stability: null,
      recommendation_stability: null,
      uncertainty_stability: null,
      escalation_stability: null,
      score_variance: null,
    };
  }

  let hashAgreements = 0;
  let hashComparisons = 0;
  const jaccards: number[] = [];
  const scores: number[] = [];

  for (const runs of byCase.values()) {
    if (runs.length < 2) continue;
    scores.push(...runs.map((r) => r.case_score));
    const hashes = runs.map((r) => r.parsed_output_hash ?? "");
    for (let i = 1; i < hashes.length; i++) {
      hashComparisons += 1;
      if (hashes[i] === hashes[0] && hashes[0] !== "") hashAgreements += 1;
    }
    for (let i = 1; i < runs.length; i++) {
      const a = new Set(runs[i - 1]!.true_positives.map((m) => m.key));
      const b = new Set(runs[i]!.true_positives.map((m) => m.key));
      jaccards.push(jaccard(a, b));
    }
  }

  return {
    repeat_count: repeatCount,
    sufficient_repetition: true,
    hash_agreement_rate: safeDivide(hashAgreements, hashComparisons),
    finding_set_jaccard_mean:
      jaccards.length === 0 ? null : roundRate(jaccards.reduce((a, b) => a + b, 0) / jaccards.length),
    severity_stability: fieldStability(byCase, (r) => String(r.case_score)),
    confidence_stability: fieldStability(byCase, (r) => String(r.evidence_quality_score)),
    recommendation_stability: fieldStability(byCase, (r) => r.parsed_output_hash ?? ""),
    uncertainty_stability: fieldStability(
      byCase,
      (r) => r.uncertainty_results.map((u) => `${u.uncertainty_key}:${u.matched}`).join("|"),
    ),
    escalation_stability: fieldStability(byCase, (r) => String(r.ok)),
    score_variance: scores.length <= 1 ? 0 : variance(scores),
  };
}

export function hashCaseResultProjection(result: CalibrationCaseResult): string {
  return hashCanonicalOutput({
    case_id: result.case_id,
    run_index: result.run_index,
    case_score: result.case_score,
    tp: result.true_positives.map((m) => m.key).sort(),
    fp: result.false_positives.map((m) => m.key).sort(),
    fn: result.false_negatives.map((m) => m.key).sort(),
  });
}
