import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

/** Issues for a manuscript, outstanding first, then newest. */
export async function listIssues(manuscriptId: string): Promise<Issue[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("status", { ascending: true }) // 'outstanding' < 'resolved'
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Issue[];
}
