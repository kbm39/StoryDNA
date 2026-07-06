"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { generateTreatment as treatmentOpenAI } from "@/lib/ai/openai";
import { generateTreatment as treatmentClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";
import type { TreatmentFormat } from "@/lib/ai/shared";

export interface TreatmentResult {
  ok: boolean;
  error?: string;
}

export async function generateTreatment(
  manuscriptId: string,
  provider: Provider,
  format: TreatmentFormat,
): Promise<TreatmentResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }

  let result;
  try {
    const fn = provider === "openai" ? treatmentOpenAI : treatmentClaude;
    result = await fn(text, format);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("treatments").insert({
    manuscript_id: manuscriptId,
    provider,
    model: result.model,
    format,
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving the treatment failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function deleteTreatment(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("treatments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
