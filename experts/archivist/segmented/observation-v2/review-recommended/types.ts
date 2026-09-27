/**
 * Phase 1 author-review layer for fail-closed Archivist comparisons.
 * Does not change pair diagnosis. Does not write accepted canon or Series Bible.
 */

export const ARCHIVIST_REVIEW_RECOMMENDED_VERSION =
  "archivist_review_recommended@v1" as const;

export const ARCHIVIST_REVIEW_RECOMMENDED_LABEL =
  "Potential continuity issue — review recommended" as const;

export const PHASE1_REVIEW_REASON_ALLOWLIST = ["unspecified_laterality"] as const;
export type Phase1ReviewReason = (typeof PHASE1_REVIEW_REASON_ALLOWLIST)[number];

export const ARCHIVIST_REVIEW_STATES = ["pending", "not_an_issue", "needs_fix"] as const;
export type ArchivistReviewState = (typeof ARCHIVIST_REVIEW_STATES)[number];

export const ARCHIVIST_REVIEW_AUTHOR_ACTIONS = ["not_an_issue", "needs_fix"] as const;
export type ArchivistReviewAuthorAction = (typeof ARCHIVIST_REVIEW_AUTHOR_ACTIONS)[number];

/**
 * Future product path for needs_fix. Phase 1 does not implement it.
 * Phase 2+ may consume needs_fix without changing the original evidence
 * or the meaning of the author decision.
 */
export const ARCHIVIST_NEEDS_FIX_FUTURE_PATH = {
  work_item_kind: "editorial_roadmap_work_item",
  then: "correction_workflow",
  author_may: ["accept_suggestion", "edit_suggestion", "fix_myself"] as const,
  manuscript_correction_requires: "explicit_author_authority",
  after_correction: "archivist_may_verify_updated_manuscript",
  does_not_edit_manuscript: true,
  does_not_confirm_contradiction: true,
  does_not_accept_canon: true,
  does_not_write_series_bible: true,
} as const;

export const ENGINE_ELIGIBILITY_PRESERVED =
  "insufficient_semantic_specificity" as const;

export interface ArchivistReviewEvidenceSide {
  locator: string;
  excerpt: string;
  evidence_identity: string;
  passage_key: string;
  chapter_ordinal: number | null;
  review_state: ArchivistReviewState;
}

export interface ArchivistReviewStatusCounts {
  pending: number;
  needs_fix: number;
  not_an_issue: number;
}

export interface ArchivistReviewCandidate {
  fingerprint: string;
  cluster_key: string;
  manuscript_id: string;
  manuscript_version_id: string;
  source_workflow_id: string | null;
  domain: "injury_state";
  topic_key: string;
  entity_key: string;
  entity_label: string;
  topic_label: string;
  reason: Phase1ReviewReason;
  engine_eligibility: typeof ENGINE_ELIGIBILITY_PRESERVED;
  pair_count: number;
  evidence: ArchivistReviewEvidenceSide[];
  status_counts: ArchivistReviewStatusCounts;
  status_summary: string;
}

export interface ArchivistReviewDecision {
  passage_key: string;
  cluster_fingerprint: string;
  evidence_identity: string;
  review_state: "not_an_issue" | "needs_fix";
  manuscript_id: string;
  manuscript_version_id: string;
  source_workflow_id: string | null;
  author_identity: string;
  author_comment: string | null;
  decided_at: string;
  engine_eligibility: typeof ENGINE_ELIGIBILITY_PRESERVED;
  engine_reason: Phase1ReviewReason;
  future_consumption: typeof ARCHIVIST_NEEDS_FIX_FUTURE_PATH.work_item_kind;
  accepted_canon: false;
  series_bible: false;
}

export interface ArchivistReviewDecisionStore {
  get(passageKey: string): ArchivistReviewDecision | null;
  list(): ArchivistReviewDecision[];
  put(decision: ArchivistReviewDecision): ArchivistReviewDecision;
}

export interface PresentedReviewRecommendedCard {
  fingerprint: string;
  title: string;
  noticed: string;
  why_it_may_matter: string;
  status_summary: string;
  status_counts: ArchivistReviewStatusCounts;
  passages: Array<{
    heading: string;
    locator: string;
    excerpt: string;
    passage_key: string;
    evidence_identity: string;
    review_state: ArchivistReviewState;
  }>;
  analysis_details: {
    engine_eligibility: typeof ENGINE_ELIGIBILITY_PRESERVED;
    engine_reason: Phase1ReviewReason;
    pair_count: number;
    entity_key: string;
    topic_key: string;
    fingerprint: string;
  };
}

export interface PresentedReviewRecommendedModel {
  manuscript_id: string;
  manuscript_version_id: string;
  source_workflow_id: string | null;
  label: typeof ARCHIVIST_REVIEW_RECOMMENDED_LABEL;
  cards: PresentedReviewRecommendedCard[];
}
