import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AgentSubmission } from "@/lib/types";

export async function listSubmissions(manuscriptId: string): Promise<AgentSubmission[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("agent_submissions")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as AgentSubmission[];
  } catch {
    return [];
  }
}
