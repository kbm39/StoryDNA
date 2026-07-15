import type { ComparisonMode } from "./types.ts";

export interface PriorReviewCandidate {
  review_id: string;
  created_at: string;
  manuscript_version_id: string | null;
  version_created_at: string | null;
  content_hash: string | null;
  word_count: number | null;
  lifecycle_status: string;
  manuscript_score: number | null;
}

export interface PriorReviewSelection {
  comparison_mode: ComparisonMode;
  selected: PriorReviewCandidate | null;
  /** Latest review on the current version (grading history), if any. */
  same_version_grading_review_id: string | null;
  candidate_audit: PriorReviewCandidate[];
}

/**
 * Select prior review for the contrary-evidence gate.
 *
 * 1. Prefer newest valid review on a *different* manuscript version (revision comparison).
 * 2. Otherwise use newest review on the current version (same-version reassessment).
 * 3. Never treat same-version comparison as revision improvement.
 */
export function selectPriorReviewCandidate(
  candidates: PriorReviewCandidate[],
  currentVersionId: string | null,
): PriorReviewSelection {
  const audit = [...candidates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const withVersion = audit.filter((c) => c.manuscript_version_id);
  const differing = withVersion.filter(
    (c) => currentVersionId && c.manuscript_version_id !== currentVersionId,
  );

  if (differing.length > 0) {
    return {
      comparison_mode: "REVISION_COMPARISON",
      selected: differing[0],
      same_version_grading_review_id:
        withVersion.find((c) => c.manuscript_version_id === currentVersionId)?.review_id ?? null,
      candidate_audit: audit,
    };
  }

  const sameVersion = withVersion.filter(
    (c) => !currentVersionId || c.manuscript_version_id === currentVersionId,
  );

  if (sameVersion.length > 0) {
    const active = sameVersion.find((c) => c.lifecycle_status === "active");
    const selected = active ?? sameVersion[0];
    return {
      comparison_mode: "SAME_VERSION_REASSESSMENT",
      selected,
      same_version_grading_review_id: selected.review_id,
      candidate_audit: audit,
    };
  }

  return {
    comparison_mode: "REVISION_COMPARISON",
    selected: null,
    same_version_grading_review_id: null,
    candidate_audit: audit,
  };
}
