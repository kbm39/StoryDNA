/**
 * Military Expert scoring summary — provisional findings excluded from grade/score totals.
 */

import type { MilitaryExpertFinding, MilitaryExpertReview } from "@/experts/military-expert/contracts.ts";

export interface MilitaryExpertScoreSummary {
  readonly confirmedIssueCount: number;
  readonly authorReviewRequiredCount: number;
  readonly scoreDeductionTotal: number;
  readonly gradeEligible: boolean;
  readonly authorReviewRequiredLabel: string;
}

export function isProvisionalFinding(finding: MilitaryExpertFinding): boolean {
  return finding.finding_status === "author_review_required";
}

export function isConfirmedScoringFinding(finding: MilitaryExpertFinding): boolean {
  if (isProvisionalFinding(finding)) return false;
  return (
    finding.realism_status === "confirmed_error" ||
    finding.realism_status === "probable_concern" ||
    finding.realism_status === "context_dependent" ||
    finding.realism_status === "plausible_but_unusual"
  );
}

export function computeMilitaryExpertScoreSummary(
  review: MilitaryExpertReview,
): MilitaryExpertScoreSummary {
  const validatedFindings = review.findings.filter((finding) => !isProvisionalFinding(finding));
  const authorReviewRequiredCount = review.findings.filter(isProvisionalFinding).length;
  const confirmedIssueCount = validatedFindings.filter(isConfirmedScoringFinding).length;

  const scoreDeductionTotal = validatedFindings.reduce((total, finding) => {
    const impact = finding.score_impact ?? 0;
    return impact < 0 ? total + Math.abs(impact) : total;
  }, 0);

  return Object.freeze({
    confirmedIssueCount,
    authorReviewRequiredCount,
    scoreDeductionTotal,
    gradeEligible: authorReviewRequiredCount === 0,
    authorReviewRequiredLabel:
      authorReviewRequiredCount > 0
        ? `Author Review Required: ${authorReviewRequiredCount}`
        : "Author Review Required: 0",
  });
}
