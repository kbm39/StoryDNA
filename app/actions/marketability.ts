"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getMarketabilityReport } from "@/lib/marketability";
import { summarizeMarketability as summarizeOpenAI } from "@/lib/ai/openai";
import { summarizeMarketability as summarizeClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface UploadReportState {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface SummarizeResult {
  ok: boolean;
  error?: string;
}

/** Upload (or paste) a marketability report. Extracts text and stores it,
 *  replacing any existing report for this manuscript. */
export async function uploadMarketabilityReport(
  _prev: UploadReportState,
  formData: FormData,
): Promise<UploadReportState> {
  const manuscriptId = formData.get("manuscriptId") as string | null;
  const file = formData.get("file");
  const pasted = (formData.get("text") as string | null)?.trim() || "";
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  let rawText = "";
  let fileName: string | null = null;

  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    const lower = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (lower.endsWith(".docx")) {
      try {
        rawText = (await mammoth.extractRawText({ buffer })).value ?? "";
      } catch {
        return { ok: false, error: "Could not read that file as a Word document." };
      }
    } else if (lower.endsWith(".pdf")) {
      try {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        rawText = Array.isArray(text) ? text.join("\n") : text;
      } catch {
        return { ok: false, error: "Could not read that PDF. If it's a scanned image, paste the text instead." };
      }
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      rawText = buffer.toString("utf8");
    } else {
      return { ok: false, error: "Upload a .pdf, .docx, or .txt file, or paste the report text below." };
    }
  } else if (pasted) {
    rawText = pasted;
    fileName = "Pasted report";
  } else {
    return { ok: false, error: "Choose a .docx/.txt file or paste the report text." };
  }

  rawText = rawText.trim();
  if (rawText.length < 40) {
    return { ok: false, error: "That report looks empty — nothing to summarize." };
  }

  const supabase = getSupabaseAdmin();
  // One report per manuscript: clear any existing, then insert.
  await supabase.from("marketability_reports").delete().eq("manuscript_id", manuscriptId);
  const { error } = await supabase.from("marketability_reports").insert({
    manuscript_id: manuscriptId,
    file_name: fileName,
    raw_text: rawText,
  });
  if (error) return { ok: false, error: `Saving the report failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true, message: "Report saved. Now summarize it with OpenAI or Claude below." };
}

/** Summarize the stored marketability report with a provider; saves the summary. */
export async function summarizeMarketabilityReport(
  manuscriptId: string,
  provider: Provider,
): Promise<SummarizeResult> {
  const report = await getMarketabilityReport(manuscriptId);
  if (!report) return { ok: false, error: "Upload a marketability report first." };

  let result;
  try {
    const fn = provider === "openai" ? summarizeOpenAI : summarizeClaude;
    result = await fn(report.raw_text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("marketability_reports")
    .update({
      summary: result.content,
      provider,
      model: result.model,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.id);
  if (error) return { ok: false, error: `Saving the summary failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function deleteMarketabilityReport(manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("marketability_reports")
    .delete()
    .eq("manuscript_id", manuscriptId);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
