import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Suggestion } from "@/lib/types";

/** Suggestions for a set of issues, oldest first. */
export async function listSuggestionsForIssues(issueIds: string[]): Promise<Suggestion[]> {
  if (issueIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("suggestions")
    .select("*")
    .in("issue_id", issueIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Suggestion[];
}

/** Group suggestions by their issue_id. */
export function groupByIssue(suggestions: Suggestion[]): Map<string, Suggestion[]> {
  const map = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    if (!s.issue_id) continue;
    const list = map.get(s.issue_id);
    if (list) list.push(s);
    else map.set(s.issue_id, [s]);
  }
  return map;
}
