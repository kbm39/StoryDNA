import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  EditorialAnalysis,
  EditorialComment,
  CommentAssessment,
  Suggestion,
} from "@/lib/types";

/** The current editorial analysis for a manuscript (one per manuscript), or null. */
export async function getEditorialAnalysis(
  manuscriptId: string,
): Promise<EditorialAnalysis | null> {
  // Resilient: returns null if the table doesn't exist yet (migration not run).
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("editorial_analyses")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as EditorialAnalysis) ?? null;
  } catch {
    return null;
  }
}

/** Comments parsed from an analysis, in the order they were extracted. */
export async function listEditorialComments(
  analysisId: string,
): Promise<EditorialComment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("editorial_comments")
    .select("*")
    .eq("analysis_id", analysisId)
    .order("ordinal", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EditorialComment[];
}

/** Model verdicts for a set of comments. */
export async function listAssessmentsForComments(
  commentIds: string[],
): Promise<CommentAssessment[]> {
  if (commentIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("comment_assessments")
    .select("*")
    .in("comment_id", commentIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentAssessment[];
}

/** Suggestions tied to a set of editorial comments, oldest first. */
export async function listSuggestionsForComments(
  commentIds: string[],
): Promise<Suggestion[]> {
  if (commentIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suggestions")
    .select("*")
    .in("comment_id", commentIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Suggestion[];
}

/** Group assessments by their comment_id. */
export function groupAssessmentsByComment(
  assessments: CommentAssessment[],
): Map<string, CommentAssessment[]> {
  const map = new Map<string, CommentAssessment[]>();
  for (const a of assessments) {
    const list = map.get(a.comment_id);
    if (list) list.push(a);
    else map.set(a.comment_id, [a]);
  }
  return map;
}

/** Group comment-sourced suggestions by their comment_id. */
export function groupSuggestionsByComment(
  suggestions: Suggestion[],
): Map<string, Suggestion[]> {
  const map = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    if (!s.comment_id) continue;
    const list = map.get(s.comment_id);
    if (list) list.push(s);
    else map.set(s.comment_id, [s]);
  }
  return map;
}
