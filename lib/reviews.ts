import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Manuscript, Review } from "@/lib/types";

/** Manuscript metadata (no extracted_text) for a detail page. */
export async function getManuscriptMeta(
  id: string,
): Promise<Pick<
  Manuscript,
  "id" | "title" | "original_filename" | "word_count" | "series_id" | "series_order" | "created_at"
> | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("manuscripts")
    .select("id, title, original_filename, word_count, series_id, series_order, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Extracted plain text for sending to the AI providers. */
export async function getManuscriptText(id: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("manuscripts")
    .select("extracted_text")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.extracted_text ?? null;
}

export async function getReview(id: string): Promise<Review | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("reviews").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Review) ?? null;
}

export async function listReviews(manuscriptId: string): Promise<Review[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("manuscript_id", manuscriptId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Review[];
}
