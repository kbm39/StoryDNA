import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { EditorialIssue, RevisionCandidate } from "@/lib/types";

/** Editorial Issues raised for a manuscript (highest severity first). */
export async function getEditorialIssues(manuscriptId: string): Promise<EditorialIssue[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("editorial_issues")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as EditorialIssue[];
  } catch {
    return [];
  }
}

/** All revision candidates for a manuscript. */
export async function getRevisionCandidates(manuscriptId: string): Promise<RevisionCandidate[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("revision_candidates")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as RevisionCandidate[];
  } catch {
    return [];
  }
}

/** Group candidates by their editorial issue. */
export function groupCandidatesByIssue(
  candidates: RevisionCandidate[],
): Map<string, RevisionCandidate[]> {
  const map = new Map<string, RevisionCandidate[]>();
  for (const c of candidates) {
    if (!c.issue_id) continue;
    const list = map.get(c.issue_id);
    if (list) list.push(c);
    else map.set(c.issue_id, [c]);
  }
  return map;
}
