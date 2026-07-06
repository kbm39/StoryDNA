import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { RevisionCheck } from "@/lib/types";

/** Revision checks for a manuscript, newest first. */
export async function listRevisionChecks(manuscriptId: string): Promise<RevisionCheck[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("revision_checks")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RevisionCheck[];
}
