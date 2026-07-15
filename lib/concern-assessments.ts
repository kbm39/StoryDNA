import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ReviewConcernAssessment } from "@/lib/types";

export async function listConcernAssessmentsForReview(
  reviewId: string,
): Promise<ReviewConcernAssessment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("review_concern_assessments")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("review_concern_assessments")) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ReviewConcernAssessment[];
}
