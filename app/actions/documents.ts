"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { getMarketabilityContext } from "@/lib/marketability";
import { generateDocument as docOpenAI } from "@/lib/ai/openai";
import { generateDocument as docClaude } from "@/lib/ai/anthropic";
import type { Provider, DocType } from "@/lib/types";

export interface DocActionResult {
  ok: boolean;
  error?: string;
}

export async function generateDocument(
  manuscriptId: string,
  docType: DocType,
  provider: Provider,
): Promise<DocActionResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }

  // Marketing copy is shaped by the marketability report (trusted positioning).
  const marketability =
    docType === "marketing" ? await getMarketabilityContext(manuscriptId) : null;

  let result;
  try {
    const fn = provider === "openai" ? docOpenAI : docClaude;
    result = await fn(docType, text, marketability);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("manuscript_documents").insert({
    manuscript_id: manuscriptId,
    doc_type: docType,
    provider,
    model: result.model,
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function deleteDocument(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("manuscript_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
