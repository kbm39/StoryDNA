import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Treatment } from "@/lib/types";

export async function listTreatments(manuscriptId: string): Promise<Treatment[]> {
  // Resilient: returns [] if the table doesn't exist yet (migration not run).
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("treatments")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as Treatment[];
  } catch {
    return [];
  }
}

export async function getTreatment(id: string): Promise<Treatment | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Treatment) ?? null;
}
