import { CALIBRATION_RATE_PRECISION } from "./constants.ts";
import type {
  CalibrationProjectedFinding,
  ExpectedContraryEvidence,
  ExpectedEscalation,
  ExpectedFinding,
  ExpectedNonFinding,
  ExpectedUncertainty,
  ExpertCalibrationCase,
  ProhibitedFinding,
  ScoredMatch,
  UncertaintyResult,
} from "./contracts.ts";

const SEVERITY_ORDER = ["informational", "minor", "moderate", "major", "critical"] as const;
const CONFIDENCE_ORDER = ["low", "medium", "high"] as const;

function ordinalAtLeast(actual: string, minimum: string | undefined, order: readonly string[]): boolean {
  if (!minimum) return true;
  const a = order.indexOf(actual as (typeof order)[number]);
  const m = order.indexOf(minimum as (typeof order)[number]);
  if (a < 0 || m < 0) return actual === minimum;
  return a >= m;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Deterministic bounded text match — substring containment after normalization. */
export function controlledTextMatch(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function scoreFindingMatch(
  expected: ExpectedFinding,
  projected: CalibrationProjectedFinding,
): number {
  if (expected.category !== projected.category) return 0;
  if (expected.realism_status && expected.realism_status !== projected.realism_status) return 0;
  if (!ordinalAtLeast(projected.severity, expected.severity_min, SEVERITY_ORDER)) return 0;
  if (!ordinalAtLeast(projected.confidence, expected.confidence_min, CONFIDENCE_ORDER)) return 0;
  if (expected.recommendation_type && expected.recommendation_type !== projected.recommendation_type) {
    return 0;
  }
  if (
    expected.escalation_expert !== undefined &&
    expected.escalation_expert !== projected.escalation_expert
  ) {
    return 0;
  }

  let score = 0.5;
  if (expected.match_mode === "identifier" && expected.finding_key === projected.finding_key) {
    score = 1;
  } else if (expected.match_mode === "exact" && expected.finding_key === projected.finding_key) {
    score = 1;
  } else if (expected.title_pattern) {
    try {
      if (new RegExp(expected.title_pattern, "i").test(projected.title)) score = Math.max(score, 0.9);
    } catch {
      return 0;
    }
  } else if (expected.match_mode === "controlled_text") {
    if (controlledTextMatch(projected.title, expected.finding_key.replace(/-/g, " "))) {
      score = Math.max(score, 0.85);
    }
  }

  if (expected.must_include_evidence && !projected.has_manuscript_evidence) return 0;

  if (expected.evidence_excerpt_pattern) {
    const joined = projected.evidence_excerpts.join(" ");
    try {
      if (!new RegExp(expected.evidence_excerpt_pattern, "i").test(joined)) return 0;
    } catch {
      return 0;
    }
  }

  return score;
}

export interface CaseScoringResult {
  true_positives: ScoredMatch[];
  false_positives: ScoredMatch[];
  false_negatives: ScoredMatch[];
  prohibited_violations: ScoredMatch[];
  non_finding_violations: ScoredMatch[];
  uncertainty_results: UncertaintyResult[];
  case_score: number;
  evidence_quality_score: number;
  editorial_quality_score: number | null;
  adjudication_required: boolean;
}

function matchExpectedFindings(
  expected: readonly ExpectedFinding[],
  projected: readonly CalibrationProjectedFinding[],
): { tps: ScoredMatch[]; fps: ScoredMatch[]; fns: ScoredMatch[]; adjudication: boolean } {
  const tps: ScoredMatch[] = [];
  const fns: ScoredMatch[] = [];
  const used = new Set<number>();
  let adjudication = false;

  for (const exp of expected) {
    if (exp.match_mode === "human_required") {
      adjudication = true;
      fns.push({
        key: exp.finding_key,
        kind: "false_negative",
        category: exp.category,
        score: 0,
        message: "Human adjudication required",
      });
      continue;
    }

    let bestIdx = -1;
    let bestScore = 0;
    projected.forEach((p, idx) => {
      if (used.has(idx)) return;
      const s = scoreFindingMatch(exp, p);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0 && bestScore >= 0.5) {
      used.add(bestIdx);
      tps.push({
        key: exp.finding_key,
        kind: "true_positive",
        category: exp.category,
        score: bestScore * exp.weight,
        message: `Matched projected finding ${projected[bestIdx]!.finding_key}`,
      });
    } else {
      fns.push({
        key: exp.finding_key,
        kind: "false_negative",
        category: exp.category,
        score: 0,
        message: "Expected finding not matched",
      });
    }
  }

  const fps: ScoredMatch[] = [];
  projected.forEach((p, idx) => {
    if (used.has(idx)) return;
    if (p.realism_status === "accurate" || p.realism_status === "insufficient_evidence") return;
    fps.push({
      key: p.finding_key,
      kind: "false_positive",
      category: p.category,
      score: 0,
      message: `Unexpected finding: ${p.title}`,
    });
  });

  return { tps, fps, fns, adjudication };
}

function checkNonFindings(
  nonFindings: readonly ExpectedNonFinding[],
  projected: readonly CalibrationProjectedFinding[],
): ScoredMatch[] {
  const violations: ScoredMatch[] = [];
  for (const nf of nonFindings) {
    for (const p of projected) {
      if (nf.category && nf.category !== p.category) continue;
      if (nf.forbidden_realism_status?.includes(p.realism_status)) {
        violations.push({
          key: nf.non_finding_key,
          kind: "non_finding_violation",
          category: p.category,
          score: nf.weight,
          message: nf.rationale,
        });
      }
      if (nf.forbidden_title_pattern) {
        try {
          if (new RegExp(nf.forbidden_title_pattern, "i").test(p.title)) {
            violations.push({
              key: nf.non_finding_key,
              kind: "non_finding_violation",
              category: p.category,
              score: nf.weight,
              message: nf.rationale,
            });
          }
        } catch {
          /* invalid regex — skip */
        }
      }
    }
  }
  return violations;
}

function checkProhibited(
  prohibited: readonly ProhibitedFinding[],
  projected: readonly CalibrationProjectedFinding[],
): ScoredMatch[] {
  const violations: ScoredMatch[] = [];
  for (const rule of prohibited) {
    for (const p of projected) {
      if (rule.category && rule.category !== p.category) continue;
      if (rule.realism_status && rule.realism_status !== p.realism_status) continue;
      if (rule.title_pattern) {
        try {
          if (new RegExp(rule.title_pattern, "i").test(p.title)) {
            violations.push({
              key: rule.prohibited_key,
              kind: "prohibited",
              category: p.category,
              score: 1,
              message: rule.rationale,
            });
          }
        } catch {
          /* skip */
        }
      }
    }
  }
  return violations;
}

function checkUncertainties(
  uncertainties: readonly ExpectedUncertainty[],
  projected: readonly CalibrationProjectedFinding[],
): UncertaintyResult[] {
  return uncertainties.map((u) => {
    const inCategory = projected.filter((p) => p.category === u.category);
    const hasConfirmed = inCategory.some((p) => p.realism_status === "confirmed_error");
    if (u.must_not_assert_confirmed_error && hasConfirmed) {
      return { uncertainty_key: u.uncertainty_key, matched: false, message: u.rationale };
    }
    const matched = inCategory.some(
      (p) =>
        p.realism_status === u.expected_status ||
        (u.expected_status === "insufficient_evidence" && p.uncertainty_note_present),
    );
    return {
      uncertainty_key: u.uncertainty_key,
      matched,
      message: matched ? "Uncertainty expectation met" : u.rationale,
    };
  });
}

function checkContraryEvidence(
  rules: readonly ExpectedContraryEvidence[],
  projected: readonly CalibrationProjectedFinding[],
): number {
  if (rules.length === 0) return 1;
  let total = 0;
  let passed = 0;
  for (const rule of rules) {
    total += 1;
    const p = projected.find((f) => f.finding_key === rule.finding_key);
    if (!p) continue;
    if (rule.required && (p.has_contrary_evidence || p.contrary_evidence_explicit_none)) {
      passed += 1;
    } else if (!rule.required) {
      passed += 1;
    }
  }
  return total === 0 ? 1 : passed / total;
}

function checkEscalations(
  escalations: readonly ExpectedEscalation[],
  projected: readonly CalibrationProjectedFinding[],
): boolean {
  return escalations.every((e) => {
    if (!e.required) return true;
    return projected.some(
      (p) => p.category === e.category && p.escalation_expert === e.expected_expert,
    );
  });
}

function computeEvidenceQuality(
  projected: readonly CalibrationProjectedFinding[],
  contraryCompliance: number,
  uncertaintyResults: readonly UncertaintyResult[],
): number {
  if (projected.length === 0) return 1;
  let sum = 0;
  for (const p of projected) {
    let s = 0;
    if (p.has_manuscript_evidence) s += 0.4;
    if (p.has_contrary_evidence || p.contrary_evidence_explicit_none) s += 0.3;
    if (p.operational_impact_present && p.story_impact_present) s += 0.2;
    if (p.preservation_note_present) s += 0.1;
    sum += s;
  }
  const base = sum / projected.length;
  const uncertaintyPass =
    uncertaintyResults.length === 0
      ? 1
      : uncertaintyResults.filter((u) => u.matched).length / uncertaintyResults.length;
  return roundRate((base + contraryCompliance + uncertaintyPass) / 3);
}

function computeEditorialAutomatic(projected: readonly CalibrationProjectedFinding[]): number {
  if (projected.length === 0) return 1;
  let checks = 0;
  let passed = 0;
  for (const p of projected) {
    checks += 4;
    if (p.preservation_note_present) passed += 1;
    if (p.operational_impact_present) passed += 1;
    if (p.story_impact_present) passed += 1;
    if (!p.safety_violation) passed += 1;
  }
  return checks === 0 ? 1 : roundRate(passed / checks);
}

export function roundRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** CALIBRATION_RATE_PRECISION;
  return Math.round(value * factor) / factor;
}

/** Score a single case against projected findings — deterministic, no model calls. */
export function scoreCalibrationCase(
  calibrationCase: ExpertCalibrationCase,
  projected: readonly CalibrationProjectedFinding[],
  options: { humanAdjudicated?: boolean } = {},
): CaseScoringResult {
  const { tps, fps, fns, adjudication } = matchExpectedFindings(
    calibrationCase.expected_findings,
    projected,
  );
  const non_finding_violations = checkNonFindings(calibrationCase.expected_non_findings, projected);
  const prohibited_violations = checkProhibited(calibrationCase.prohibited_findings, projected);
  const uncertainty_results = checkUncertainties(calibrationCase.expected_uncertainties, projected);
  const contraryCompliance = checkContraryEvidence(
    calibrationCase.expected_contrary_evidence,
    projected,
  );
  const escalationOk = checkEscalations(calibrationCase.expected_escalations, projected);

  const false_positives = [...fps, ...prohibited_violations.map((v) => ({ ...v, kind: "false_positive" as const }))];

  const expectedWeight = calibrationCase.expected_findings.reduce((s, f) => s + f.weight, 0) || 1;
  const matchedWeight = tps.reduce((s, m) => s + m.score, 0);
  const case_score = roundRate(matchedWeight / expectedWeight);

  const evidence_quality_score = computeEvidenceQuality(
    projected,
    contraryCompliance,
    uncertainty_results,
  );

  const needsHuman =
    adjudication ||
    calibrationCase.adjudication.mode === "human_required" ||
    calibrationCase.adjudication.mode === "hybrid";

  const editorial_quality_score = needsHuman && !options.humanAdjudicated
    ? null
    : computeEditorialAutomatic(projected);

  if (!escalationOk) {
    fns.push({
      key: "escalation-missed",
      kind: "false_negative",
      score: 0,
      message: "Required escalation not matched",
    });
  }

  return {
    true_positives: tps,
    false_positives,
    false_negatives: fns,
    prohibited_violations,
    non_finding_violations,
    uncertainty_results,
    case_score,
    evidence_quality_score,
    editorial_quality_score,
    adjudication_required: needsHuman,
  };
}

export { SEVERITY_ORDER, CONFIDENCE_ORDER };
