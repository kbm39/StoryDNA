import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listReviews } from "@/lib/reviews";
import {
  resolveAuthoritativeReviewFromList,
  type ReviewerType,
} from "@/lib/authoritative-review-display";
import type { Review } from "@/lib/types";

export interface ResolvedAuthoritativeReview {
  review: Review;
  manuscriptTitle: string;
  currentVersionId: string | null;
  fallbackWordCount: number | null;
  isHistorical: boolean;
}

/** Load and resolve the authoritative review for UI display or DOCX export. */
export async function resolveAuthoritativeReviewForDisplay(
  manuscriptId: string,
  reviewerType: ReviewerType,
  optionalReviewId?: string | null,
): Promise<ResolvedAuthoritativeReview> {
  const supabase = getSupabaseAdmin();
  const { data: manuscript, error } = await supabase
    .from("manuscripts")
    .select("id, title, current_version_id, word_count, source_document_word_count")
    .eq("id", manuscriptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!manuscript) throw new Error("Manuscript not found");

  const reviews = await listReviews(manuscriptId);
  const resolved = resolveAuthoritativeReviewFromList({
    manuscriptId,
    currentVersionId: manuscript.current_version_id,
    reviews,
    reviewerType,
    explicitReviewId: optionalReviewId,
  });
  if (!resolved.ok) throw new Error(resolved.error);

  return {
    review: resolved.review,
    manuscriptTitle: manuscript.title,
    currentVersionId: manuscript.current_version_id,
    fallbackWordCount:
      manuscript.source_document_word_count ?? manuscript.word_count ?? null,
    isHistorical: resolved.isHistorical,
  };
}
