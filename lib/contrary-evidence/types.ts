/**
 * Universal Contrary-Evidence Gate — generic types (manuscript/reviewer/genre agnostic).
 */

import type { CommercialRubricPayload } from "../commercial-fiction-rubric.ts";

export type ConcernStatus =
  | "RESOLVED"
  | "SUBSTANTIALLY_IMPROVED"
  | "PARTIALLY_IMPROVED"
  | "UNCHANGED"
  | "WORSENED"
  | "STALE_CRITIQUE"
  | "NOT_ASSESSABLE";

/** Same-manuscript-version reassessment — not revision impact. */
export type SameVersionStatus =
  | "SUPPORTED"
  | "UNSUPPORTED"
  | "OVERBROAD"
  | "DUPLICATED"
  | "NOT_ASSESSABLE";

export type ComparisonMode = "REVISION_COMPARISON" | "SAME_VERSION_REASSESSMENT";

export type UnifiedAssessmentStatus = ConcernStatus | SameVersionStatus;

export type PriorConcernSourceType =
  | "rubric_deduction"
  | "editorial_issue"
  | "revision_candidate"
  | "memo_fallback";

export type ExtractionConfidence = "high" | "medium" | "low";
export type AssessmentConfidence = "high" | "medium" | "low";

export interface GenreProfile {
  primary_genre: string;
  subgenre?: string | null;
  narrative_mode: "fiction" | "narrative_nonfiction" | "other";
  intended_audience?: string | null;
}

export interface EvidenceSnippet {
  text: string;
  location: string | null;
  source: "current_manuscript" | "prior_manuscript" | "revision_note" | "version_diff";
  relevance: "supporting" | "contrary" | "neutral";
}

export interface PriorConcern {
  concern_id: string;
  root_issue: string;
  prior_criticism: string;
  source_type: PriorConcernSourceType;
  source_location: string;
  was_scored: boolean;
  prior_deduction: number;
  rubric_category: string | null;
  prior_evidence: string[];
  extraction_confidence: ExtractionConfidence;
}

export interface EditorialIssueRecord {
  id: string;
  review_id: string | null;
  text: string;
  area: string | null;
  severity: string | null;
  source_section: string | null;
  success_criterion: string | null;
}

export interface RevisionCandidateRecord {
  id: string;
  issue_id: string | null;
  original: string;
  revised: string;
  reason: string | null;
  locator: string | null;
}

export interface PriorReviewBundle {
  review_id: string;
  manuscript_version_id: string | null;
  rubric_breakdown: CommercialRubricPayload | null;
  memo_content: string;
  editorial_issues: EditorialIssueRecord[];
  revision_candidates: RevisionCandidateRecord[];
}

export interface SearchPlan {
  concern_id: string;
  root_issue: string;
  quotation_checks: string[];
  keyword_queries: string[];
  contrary_lexicon: string[];
  resolution_lexicon: string[];
  genre_mode: GenreProfile["narrative_mode"];
}

export interface QuotationLocateResult {
  quote: string;
  found_in_current: boolean;
  found_in_prior: boolean;
  current_context: string | null;
}

export interface VersionDiffEvidence {
  additions: string[];
  removals: string[];
  altered_paragraphs: string[];
}

export interface SearchResult {
  concern_id: string;
  quotation_results: QuotationLocateResult[];
  current_supporting_evidence: EvidenceSnippet[];
  current_contrary_evidence: EvidenceSnippet[];
  revision_changes: string[];
  version_diff: VersionDiffEvidence;
}

export interface SemanticAssessmentResult {
  status: ConcernStatus;
  confidence: AssessmentConfidence;
  original_basis_still_present: boolean;
  narrowed_current_finding: string | null;
  revision_that_addresses_it: string | null;
  explanation: string;
}

/** Input for a future semantic assessor; Phase 1 uses deterministic rules + test fixtures. */
export interface SemanticAssessorInput {
  prior_concern: PriorConcern;
  prior_evidence: string[];
  candidate_supporting: EvidenceSnippet[];
  candidate_contrary: EvidenceSnippet[];
  revision_notes: string[];
  version_diff_evidence: VersionDiffEvidence;
  rubric_category: string | null;
  genre_profile: GenreProfile;
}

export interface SemanticAssessor {
  assess(
    input: SemanticAssessorInput,
  ): SemanticAssessmentResult | Promise<SemanticAssessmentResult>;
}

export type ContraryEvidenceGateStatus =
  | "skipped"
  | "completed"
  | "required_not_run"
  | "failed";

export interface ConcernAssessment {
  comparison_mode: ComparisonMode;
  concern_id: string;
  root_issue: string;
  rubric_category: string | null;
  prior_criticism: string;
  prior_evidence: string[];
  current_supporting_evidence: EvidenceSnippet[];
  current_contrary_evidence: EvidenceSnippet[];
  revision_that_addresses_it: string | null;
  original_basis_still_present: boolean;
  status: UnifiedAssessmentStatus;
  confidence: AssessmentConfidence;
  prior_deduction: number;
  /** Revision comparison only — points restored because of manuscript revision. */
  points_restored: number;
  /** Same-version reassessment — prior deduction invalidated (unsupported). */
  points_invalidated: number;
  duplicate_points_removed: number;
  overbreadth_points_removed: number;
  remaining_deduction: number;
  narrowed_current_finding: string | null;
  explanation: string;
  contrary_evidence_analysis: string;
}

export interface RetainedDeduction {
  concern_id: string;
  root_issue: string;
  rubric_category: string | null;
  deduction_points: number;
  current_supporting_evidence: EvidenceSnippet[];
  contrary_evidence_analysis: string;
  explanation: string;
  narrowed_finding: string | null;
}

export interface ScoringGateResult {
  valid: boolean;
  errors: string[];
  assessments: ConcernAssessment[];
  adjusted_deductions: RetainedDeduction[];
  total_points_restored: number;
}
