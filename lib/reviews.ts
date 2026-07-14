import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Manuscript, Review } from "@/lib/types";
import { countManuscriptWords } from "@/lib/word-count";

export interface ManuscriptReviewContext {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  extractedText: string;
  wordCount: number;
  characterCount: number;
}

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
  const ctx = await getManuscriptReviewContext(id);
  return ctx?.extractedText ?? null;
}

/** Canonical text + counts for review statistics (prefers current manuscript version). */
export async function getManuscriptReviewContext(
  id: string,
): Promise<ManuscriptReviewContext | null> {
  const supabase = getSupabaseAdmin();
  const { data: manuscript, error } = await supabase
    .from("manuscripts")
    .select("id, extracted_text, word_count, current_version_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!manuscript) return null;

  let versionText: string | null = null;
  let versionWordCount: number | null = null;
  let versionCharCount: number | null = null;
  let versionId: string | null = null;

  if (manuscript.current_version_id) {
    const { data: version } = await supabase
      .from("manuscript_versions")
      .select("id, extracted_text, word_count, character_count")
      .eq("id", manuscript.current_version_id)
      .maybeSingle();
    if (version) {
      versionId = version.id;
      versionText = version.extracted_text;
      versionWordCount = version.word_count;
      versionCharCount = version.character_count;
    }
  }

  const text = (versionText ?? manuscript.extracted_text)?.trim() ?? "";
  if (!text) return null;

  const wordCount =
    (versionWordCount != null && versionWordCount > 0
      ? versionWordCount
      : manuscript.word_count) ?? countManuscriptWords(text);
  const characterCount =
    versionCharCount != null && versionCharCount > 0 ? versionCharCount : text.length;

  return {
    manuscriptId: manuscript.id,
    manuscriptVersionId: versionId ?? manuscript.current_version_id,
    extractedText: text,
    wordCount,
    characterCount,
  };
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
