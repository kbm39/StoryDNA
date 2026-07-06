import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { QueryLetter } from "@/lib/types";

export async function listQueryLetters(manuscriptId: string): Promise<QueryLetter[]> {
  // Resilient: returns [] if the table doesn't exist yet (migration not run).
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("query_letters")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as QueryLetter[];
  } catch {
    return [];
  }
}

export async function getQueryLetter(id: string): Promise<QueryLetter | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("query_letters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as QueryLetter) ?? null;
}
