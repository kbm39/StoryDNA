import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Series, Manuscript, Treatment } from "@/lib/types";

export async function listSeries(): Promise<Series[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as Series[];
  } catch {
    return [];
  }
}

export async function getSeries(id: string): Promise<Series | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("series").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Series) ?? null;
}

/** Books in a series, ordered by series_order (nulls last), then upload date. */
export async function listSeriesBooks(seriesId: string): Promise<Manuscript[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("manuscripts")
    .select(
      "id, title, original_filename, storage_path, file_size, word_count, status, series_id, series_order, created_at, updated_at",
    )
    .eq("series_id", seriesId)
    .order("series_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ ...row, extracted_text: null })) as Manuscript[];
}

/** Per-series count of linked books, for list views. */
export async function seriesBookCounts(): Promise<Record<string, number>> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("manuscripts").select("series_id");
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const sid = (row as { series_id: string | null }).series_id;
      if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

export async function listSeriesTreatments(seriesId: string): Promise<Treatment[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("treatments")
      .select("*")
      .eq("series_id", seriesId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as Treatment[];
  } catch {
    return [];
  }
}
