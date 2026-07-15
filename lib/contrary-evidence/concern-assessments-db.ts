import type { ConcernAssessment } from "./types.ts";
import { normalizeRootIssueKey } from "./normalize-root-issue.ts";

export interface ConcernAssessmentRow {
  review_id: string;
  prior_review_id: string | null;
  manuscript_id: string;
  manuscript_version_id: string | null;
  prior_manuscript_version_id: string | null;
  concern_id: string;
  root_issue: string;
  source_type: string;
  rubric_category: string | null;
  prior_criticism: string;
  prior_evidence: unknown;
  current_supporting_evidence: unknown;
  current_contrary_evidence: unknown;
  revision_change: unknown;
  original_basis_still_present: boolean;
  status: string;
  confidence: string;
  prior_deduction: number;
  points_restored: number;
  remaining_deduction: number;
  narrowed_current_finding: string | null;
  explanation: string;
}

export function buildConcernAssessmentRows(args: {
  assessments: ConcernAssessment[];
  reviewId: string;
  priorReviewId: string | null;
  manuscriptId: string;
  manuscriptVersionId: string | null;
  priorManuscriptVersionId: string | null;
  sourceTypes?: Record<string, string>;
}): ConcernAssessmentRow[] {
  return args.assessments.map((a) => ({
    review_id: args.reviewId,
    prior_review_id: args.priorReviewId,
    manuscript_id: args.manuscriptId,
    manuscript_version_id: args.manuscriptVersionId,
    prior_manuscript_version_id: args.priorManuscriptVersionId,
    concern_id: a.concern_id,
    root_issue: a.root_issue || normalizeRootIssueKey(a.prior_criticism),
    source_type: args.sourceTypes?.[a.concern_id] ?? "rubric_deduction",
    rubric_category: a.rubric_category,
    prior_criticism: a.prior_criticism,
    prior_evidence: a.prior_evidence,
    current_supporting_evidence: a.current_supporting_evidence,
    current_contrary_evidence: a.current_contrary_evidence,
    revision_change: a.revision_that_addresses_it
      ? { note: a.revision_that_addresses_it }
      : null,
    original_basis_still_present: a.original_basis_still_present,
    status: a.status,
    confidence: a.confidence,
    prior_deduction: a.prior_deduction,
    points_restored: a.points_restored,
    remaining_deduction: a.remaining_deduction,
    narrowed_current_finding: a.narrowed_current_finding,
    explanation: a.explanation,
  }));
}
