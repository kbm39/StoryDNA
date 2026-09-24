import type { ArchivistClassification } from "@/experts/archivist/contracts.ts";

export const ARCHIVIST_CANDIDATE_REVIEW_WORKFLOW_ID =
  "293c23d7-2793-4f79-bb97-5eb3ab8ae7fc" as const;

export const ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTIONS = [
  { key: "accept", label: "Accept" },
  { key: "correct", label: "Correct" },
  { key: "reject", label: "Reject" },
  { key: "mark_intentional", label: "Mark Intentional" },
  { key: "comment", label: "Comment" },
] as const;

export const ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTION_NOTE =
  "Author controls coming next" as const;

export type ArchivistCandidateReviewStatus = "candidate_review_validated";

export type PresentedEvidenceSide =
  | { kind: "quoted"; location: string; excerpt: string }
  | { kind: "unverified"; location: string; message: string };

export interface PresentedCandidateFinding {
  id: string;
  subject: string;
  issue_type_label: string;
  classification: ArchivistClassification | string;
  classification_label: string;
  severity: string;
  confidence: string;
  current_location: string;
  conflicting_location: string;
  current_evidence: PresentedEvidenceSide;
  conflicting_evidence: PresentedEvidenceSide;
  explanation: string;
  temporal_analysis: string;
  suggested_resolution: string;
  model_classification: string;
  model_classification_label: string;
  final_classification: string;
  final_classification_label: string;
  confirmation_eligibility: string;
  classification_adjustment_reason: string;
  classification_changed: boolean;
}

export interface PresentedCandidateCanonFact {
  id: string;
  entity: string;
  entity_type: string;
  fact_type: string;
  fact_type_key: string;
  proposed_value: string;
  temporal_scope: string;
  source_location: string;
  evidence: PresentedEvidenceSide;
  confidence: string;
  status: "candidate";
}

export interface PresentedCandidateCanonGroup {
  entity: string;
  facts: PresentedCandidateCanonFact[];
}

export interface PresentedCandidateAmbiguity {
  id: string;
  alias: string;
  candidate_entities: string[];
  context: string;
  confidence: string;
  recommended_author_verification: string;
}

export interface ArchivistCandidateReviewUiModel {
  manuscript_id: string;
  manuscript_version_id: string;
  workflow_id: string;
  source_label: string;
  review_status: ArchivistCandidateReviewStatus;
  historical_workflow_status: "failed" | "completed" | "running" | "pending" | "cancelled";
  coverage: {
    units_completed: number;
    units_total: number;
    segments_completed: number;
    segments_total: number;
    words_covered: number;
    words_total: number;
    percentage: number;
    gaps: number;
  };
  cost: {
    historical_paid_usd: number;
    remediation_usd: 0;
    provider: string;
    model: string;
    paid_calls: number;
  };
  summary: {
    narrative: string;
    confirmed_contradiction_count: number;
    possible_conflict_count: number;
    author_verification_count: number;
  };
  findings: {
    confirmed_contradiction: PresentedCandidateFinding[];
    possible_continuity_conflict: PresentedCandidateFinding[];
    author_verification_needed: PresentedCandidateFinding[];
  };
  candidate_canon: PresentedCandidateCanonGroup[];
  candidate_canon_count: number;
  ambiguities: PresentedCandidateAmbiguity[];
  withheld_graph_ambiguity_count: number;
  model_vs_final: {
    promotions: number;
    downgrades: number;
    changed_findings: number;
  };
  audit: {
    content_hash: string;
    original_workflow_status: string;
    candidate_review_validation_status: "validated";
    fabricated_evidence: 0;
    note: string;
  };
  future_actions: ReadonlyArray<{
    key: string;
    label: string;
    disabled: true;
    note: typeof ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTION_NOTE;
  }>;
}

export type ArchivistCandidateReviewLoadResult =
  | { ok: true; model: ArchivistCandidateReviewUiModel }
  | { ok: false; reason: "missing" | "malformed" | "not_allowed" };
