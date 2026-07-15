import type {
  ConcernAssessment,
  ConcernStatus,
  RetainedDeduction,
  ScoringGateResult,
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
}

/**
 * Application-authoritative scoring gate.
 * Enforces deduction rules regardless of what a future semantic model returns.
 */
export function enforceScoringGate(input: ScoringGateInput): ScoringGateResult {
  const errors: string[] = [];
  const adjusted: RetainedDeduction[] = [];
  let totalRestored = 0;

  for (const assessment of input.assessments) {
    if (assessment.prior_deduction <= 0 && assessment.status !== "NOT_ASSESSABLE") {
      continue;
    }

    const gateErrors = validateAssessment(assessment);
    errors.push(...gateErrors);

    if (gateErrors.length > 0) continue;

    totalRestored += assessment.points_restored;

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

function validateAssessment(a: ConcernAssessment): string[] {
  const errors: string[] = [];

  if (a.status === "RESOLVED" || a.status === "STALE_CRITIQUE") {
    if (a.remaining_deduction !== 0) {
      errors.push(
        `${a.concern_id}: ${a.status} must deduct zero (got ${a.remaining_deduction}).`,
      );
    }
    return errors;
  }

  if (a.remaining_deduction > 0) {
    const supporting = a.current_supporting_evidence.filter((e) => e.relevance === "supporting");
    if (supporting.length === 0) {
      errors.push(
        `${a.concern_id}: retained deduction requires current supporting evidence.`,
      );
    }

    if (!a.contrary_evidence_analysis?.trim()) {
      errors.push(
        `${a.concern_id}: missing contrary-evidence analysis blocks the deduction.`,
      );
    }

    if (isBroadCriticism(a.prior_criticism) && !a.narrowed_current_finding?.trim()) {
      errors.push(
        `${a.concern_id}: broad criticism must be narrowed before retaining a deduction.`,
      );
    }

    if (hasDeletedQuotationWithoutSupport(a)) {
      errors.push(
        `${a.concern_id}: deleted prior quotation cannot support a deduction.`,
      );
    }
  }

  return errors;
}

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

/** Helper for tests — whether status zeroes deduction. */
export function statusZeroesDeduction(status: ConcernStatus): boolean {
  return status === "RESOLVED" || status === "STALE_CRITIQUE";
}
