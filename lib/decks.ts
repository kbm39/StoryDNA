import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PitchDeck } from "@/lib/types";

export async function listManuscriptDecks(manuscriptId: string): Promise<PitchDeck[]> {
  return listDecksBy("manuscript_id", manuscriptId);
}

export async function listSeriesDecks(seriesId: string): Promise<PitchDeck[]> {
  return listDecksBy("series_id", seriesId);
}

async function listDecksBy(column: "manuscript_id" | "series_id", value: string): Promise<PitchDeck[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pitch_decks")
      .select("*")
      .eq(column, value)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as PitchDeck[];
  } catch {
    return [];
  }
}

export async function getPitchDeck(id: string): Promise<PitchDeck | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("pitch_decks").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PitchDeck) ?? null;
}
