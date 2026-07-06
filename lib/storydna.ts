import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { StoryDna, StoryDnaInterviewAnswer } from "@/lib/types";

/** The StoryDNA analysis for a manuscript (one per manuscript), or null. */
export async function getStoryDna(manuscriptId: string): Promise<StoryDna | null> {
  // Resilient: returns null if the table doesn't exist yet (migration not run).
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("story_dna")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .maybeSingle();
    if (error) return null;
    return (data as StoryDna) ?? null;
  } catch {
    return null;
  }
}

/** Persistent StoryDNA interview answers for a manuscript. */
export async function listInterviewAnswers(
  manuscriptId: string,
): Promise<StoryDnaInterviewAnswer[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("story_dna_interview")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as StoryDnaInterviewAnswer[];
  } catch {
    return [];
  }
}
