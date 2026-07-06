"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { seriesSource } from "@/lib/source";
import { buildSeriesTreatmentInstructions } from "@/lib/ai/shared";
import { generateSeriesTreatmentDoc as seriesOpenAI } from "@/lib/ai/openai";
import { generateSeriesTreatmentDoc as seriesClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface SeriesActionResult {
  ok: boolean;
  error?: string;
  seriesId?: string;
}

/** Create a new series; optionally attach a book as Book 1. */
export async function createSeries(title: string, firstBookId?: string): Promise<SeriesActionResult> {
  const t = title.trim();
  if (!t) return { ok: false, error: "Give the series a title." };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("series").insert({ title: t }).select("id").single();
  if (error || !data) return { ok: false, error: `Couldn't create the series: ${error?.message}` };
  if (firstBookId) {
    await supabase
      .from("manuscripts")
      .update({ series_id: data.id, series_order: 1 })
      .eq("id", firstBookId);
    revalidatePath(`/manuscripts/${firstBookId}`);
  }
  revalidatePath("/");
  revalidatePath(`/series/${data.id}`);
  return { ok: true, seriesId: data.id };
}

export async function assignBookToSeries(
  manuscriptId: string,
  seriesId: string,
  order: number | null,
): Promise<SeriesActionResult> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("manuscripts")
    .update({ series_id: seriesId, series_order: order })
    .eq("id", manuscriptId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/manuscripts/${manuscriptId}`);
  revalidatePath(`/series/${seriesId}`);
  return { ok: true, seriesId };
}

export async function removeBookFromSeries(manuscriptId: string, seriesId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("manuscripts")
    .update({ series_id: null, series_order: null })
    .eq("id", manuscriptId);
  revalidatePath(`/manuscripts/${manuscriptId}`);
  revalidatePath(`/series/${seriesId}`);
}

export async function setBookOrder(
  manuscriptId: string,
  seriesId: string,
  order: number | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("manuscripts").update({ series_order: order }).eq("id", manuscriptId);
  revalidatePath(`/series/${seriesId}`);
}

export async function generateSeriesTreatment(
  seriesId: string,
  provider: Provider,
): Promise<SeriesActionResult> {
  const src = await seriesSource(seriesId);
  if (!src) return { ok: false, error: "Add at least one book to this series first." };

  let result;
  try {
    const fn = provider === "openai" ? seriesOpenAI : seriesClaude;
    const prompt = `${buildSeriesTreatmentInstructions(src.seriesTitle, src.bookCount)}\n\n---\nSOURCE (each book, in series order):\n\n${src.source}`;
    result = await fn(prompt);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("treatments").insert({
    series_id: seriesId,
    provider,
    model: result.model,
    format: "ongoing_series",
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving the treatment failed: ${error.message}` };

  revalidatePath(`/series/${seriesId}`);
  return { ok: true };
}

export async function deleteSeriesTreatment(id: string, seriesId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("treatments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/series/${seriesId}`);
}

export async function renameSeries(seriesId: string, title: string): Promise<SeriesActionResult> {
  const t = title.trim();
  if (!t) return { ok: false, error: "Title can't be empty." };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("series")
    .update({ title: t, updated_at: new Date().toISOString() })
    .eq("id", seriesId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/series/${seriesId}`);
  revalidatePath("/");
  return { ok: true, seriesId };
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("manuscripts")
    .update({ series_id: null, series_order: null })
    .eq("series_id", seriesId);
  await supabase.from("series").delete().eq("id", seriesId);
  revalidatePath("/");
}
