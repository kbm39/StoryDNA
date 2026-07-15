import type {
  ComparisonMode,
  ConcernAssessment,
  ConcernStatus,
  RetainedDeduction,
  SameVersionStatus,
  ScoringGateResult,
  UnifiedAssessmentStatus,
} from "./types.ts";

const BROAD_CRITICISM_PATTERNS = [
  /\bthroughout\b/i,
  /\boverall\b/i,
  /\bconsistently\b/i,
  /\bnever\b/i,
  /\balways\b/i,
  /\bentire\b/i,
  /\blacks?\b/i,
];

export interface ScoringGateInput {
  assessments: ConcernAssessment[];
  comparison_mode?: ComparisonMode;
}

/**
 * Application-authoritative scoring gate.
 * Enforces deduction rules regardless of what a future semantic model returns.
 */
export function enforceScoringGate(input: ScoringGateInput): ScoringGateResult {
  const errors: string[] = [];
  const adjusted: RetainedDeduction[] = [];
  let totalRestored = 0;
  const mode = input.comparison_mode ?? input.assessments[0]?.comparison_mode ?? "REVISION_COMPARISON";

  for (const assessment of input.assessments) {
    if (assessment.prior_deduction <= 0 && assessment.status !== "NOT_ASSESSABLE") {
      continue;
    }

    const gateErrors = validateAssessment(assessment, mode);
    errors.push(...gateErrors);

    if (gateErrors.length > 0) continue;

    if (mode === "REVISION_COMPARISON") {
      totalRestored += assessment.points_restored;
    }

    if (assessment.remaining_deduction > 0) {
      adjusted.push({
        concern_id: assessment.concern_id,
        root_issue: assessment.root_issue,
        rubric_category: assessment.rubric_category,
        deduction_points: assessment.remaining_deduction,
        current_supporting_evidence: assessment.current_supporting_evidence.filter(
          (e) => e.relevance === "supporting",
        ),
        contrary_evidence_analysis: assessment.contrary_evidence_analysis,
        explanation: assessment.explanation,
        narrowed_finding: assessment.narrowed_current_finding,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    assessments: input.assessments,
    adjusted_deductions: adjusted,
    total_points_restored: totalRestored,
  };
}

function validateAssessment(a: ConcernAssessment, mode: ComparisonMode): string[] {
  const errors: string[] = [];

  if (mode === "SAME_VERSION_REASSESSMENT") {
    if (a.points_restored > 0) {
      errors.push(`${a.concern_id}: same-version mode must not record points_restored.`);
    }
    if (REVISION_ONLY.has(a.status)) {
      errors.push(`${a.concern_id}: ${a.status} is invalid in SAME_VERSION_REASSESSMENT.`);
    }
    if (statusZeroesDeduction(a.status, mode)) {
      if (a.remaining_deduction !== 0) {
        errors.push(`${a.concern_id}: ${a.status} must deduct zero (got ${a.remaining_deduction}).`);
      }
      return errors;
    }
  } else {
    if (SAME_VERSION_ONLY.has(a.status)) {
      errors.push(`${a.concern_id}: ${a.status} is invalid in REVISION_COMPARISON.`);
    }
    if (statusZeroesDeduction(a.status, mode)) {
      if (a.remaining_deduction !== 0) {
        errors.push(`${a.concern_id}: ${a.status} must deduct zero (got ${a.remaining_deduction}).`);
      }
      return errors;
    }
  }

  if (a.remaining_deduction > 0) {
    const supporting = a.current_supporting_evidence.filter((e) => e.relevance === "supporting");
    if (supporting.length === 0) {
      errors.push(`${a.concern_id}: retained deduction requires current supporting evidence.`);
    }

    if (!a.contrary_evidence_analysis?.trim()) {
      errors.push(`${a.concern_id}: missing contrary-evidence analysis blocks the deduction.`);
    }

    if (isBroadCriticism(a.prior_criticism) && !a.narrowed_current_finding?.trim()) {
      errors.push(`${a.concern_id}: broad criticism must be narrowed before retaining a deduction.`);
    }

    if (hasDeletedQuotationWithoutSupport(a)) {
      errors.push(`${a.concern_id}: deleted prior quotation cannot support a deduction.`);
    }
  }

  return errors;
}

const REVISION_ONLY = new Set<string>([
  "RESOLVED",
  "SUBSTANTIALLY_IMPROVED",
  "PARTIALLY_IMPROVED",
  "UNCHANGED",
  "WORSENED",
  "STALE_CRITIQUE",
]);

const SAME_VERSION_ONLY = new Set<string>(["SUPPORTED", "UNSUPPORTED", "OVERBROAD", "DUPLICATED"]);

export function isBroadCriticism(text: string): boolean {
  return BROAD_CRITICISM_PATTERNS.some((p) => p.test(text));
}

function hasDeletedQuotationWithoutSupport(a: ConcernAssessment): boolean {
  const deleted = a.current_contrary_evidence.some((c) => c.location === "quotation_deleted");
  const supportingQuotes = a.current_supporting_evidence.some(
    (s) => s.location === "prior_quotation_located",
  );
  return deleted && !supportingQuotes && a.prior_evidence.length > 0;
}

/** Whether status zeroes deduction for the given comparison mode. */
export function statusZeroesDeduction(
  status: UnifiedAssessmentStatus,
  mode: ComparisonMode = "REVISION_COMPARISON",
): boolean {
  if (mode === "SAME_VERSION_REASSESSMENT") {
    return (
      status === "UNSUPPORTED" ||
      status === "NOT_ASSESSABLE" ||
      status === "DUPLICATED"
    );
  }
  return status === "RESOLVED" || status === "STALE_CRITIQUE";
}

/** @deprecated use statusZeroesDeduction with mode */
export function isRevisionStatusZeroDeduction(status: ConcernStatus): boolean {
  return status === "RESOLVED" || status === "STALE_CRITIQUE";
}

export function isSameVersionStatusZeroDeduction(status: SameVersionStatus): boolean {
  return status === "UNSUPPORTED" || status === "NOT_ASSESSABLE" || status === "DUPLICATED";
}
