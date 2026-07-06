"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { bookSource, seriesSource } from "@/lib/source";
import { getManuscriptMeta } from "@/lib/reviews";
import { getMarketabilityContext } from "@/lib/marketability";
import { generatePitchDeck as deckOpenAI } from "@/lib/ai/openai";
import { generatePitchDeck as deckClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface DeckResult {
  ok: boolean;
  error?: string;
}

export async function generateManuscriptDeck(
  manuscriptId: string,
  provider: Provider,
): Promise<DeckResult> {
  const source = await bookSource(manuscriptId);
  if (!source) {
    return { ok: false, error: "Nothing to build from — generate a treatment first (or upload the manuscript)." };
  }
  const meta = await getManuscriptMeta(manuscriptId);
  const marketability = await getMarketabilityContext(manuscriptId);

  let result;
  try {
    const fn = provider === "openai" ? deckOpenAI : deckClaude;
    result = await fn({ kind: "manuscript", source, marketability });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pitch_decks").insert({
    manuscript_id: manuscriptId,
    scope: "manuscript",
    provider,
    model: result.model,
    title: meta?.title ?? null,
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving the deck failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function generateSeriesDeck(seriesId: string, provider: Provider): Promise<DeckResult> {
  const src = await seriesSource(seriesId);
  if (!src) return { ok: false, error: "Add at least one book to this series first." };

  let result;
  try {
    const fn = provider === "openai" ? deckOpenAI : deckClaude;
    result = await fn({
      kind: "series",
      seriesTitle: src.seriesTitle,
      bookCount: src.bookCount,
      source: src.source,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pitch_decks").insert({
    series_id: seriesId,
    scope: "series",
    provider,
    model: result.model,
    title: src.seriesTitle,
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving the deck failed: ${error.message}` };

  revalidatePath(`/series/${seriesId}`);
  return { ok: true };
}

export async function deletePitchDeck(
  id: string,
  opts: { manuscriptId?: string; seriesId?: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pitch_decks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (opts.manuscriptId) revalidatePath(`/manuscripts/${opts.manuscriptId}`);
  if (opts.seriesId) revalidatePath(`/series/${opts.seriesId}`);
}
