"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getSupabaseAdmin, MANUSCRIPTS_BUCKET } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { applyEditsToDocx } from "@/lib/docx-edit";
import { proposeEdits as proposeOpenAI } from "@/lib/ai/openai";
import { proposeEdits as proposeClaude } from "@/lib/ai/anthropic";
import type { EditPair } from "@/lib/ai/shared";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ProposeEditsResult {
  ok: boolean;
  edits?: EditPair[];
  note?: string;
  error?: string;
}

export interface ApplyEditsResult {
  ok: boolean;
  appliedCount?: number;
  failed?: EditPair[];
  error?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Ask the suggestion's model to turn it into concrete find/replace edits. */
export async function proposeEditsForSuggestion(
  suggestionId: string,
  manuscriptId: string,
): Promise<ProposeEditsResult> {
  const supabase = getSupabaseAdmin();
  const { data: suggestion, error } = await supabase
    .from("suggestions")
    .select("id, provider, content, issue_id, comment_id")
    .eq("id", suggestionId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!suggestion) return { ok: false, error: "Suggestion not found." };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) return { ok: false, error: "Manuscript has no text." };

  // A suggestion hangs off either a review issue or an uploaded editorial comment.
  let issueTitle = "this issue";
  if (suggestion.issue_id) {
    const { data: issue } = await supabase
      .from("issues")
      .select("title")
      .eq("id", suggestion.issue_id)
      .maybeSingle();
    issueTitle = issue?.title ?? issueTitle;
  } else if (suggestion.comment_id) {
    const { data: comment } = await supabase
      .from("editorial_comments")
      .select("comment")
      .eq("id", suggestion.comment_id)
      .maybeSingle();
    issueTitle = comment?.comment ?? issueTitle;
  }

  try {
    const fn = suggestion.provider === "openai" ? proposeOpenAI : proposeClaude;
    const result = await fn(issueTitle, suggestion.content, text);
    return { ok: true, edits: result.edits, note: result.note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Apply approved edits to the manuscript's .docx, save a new version, mark applied. */
export async function applyEditsToManuscript(
  manuscriptId: string,
  suggestionId: string,
  edits: EditPair[],
): Promise<ApplyEditsResult> {
  const clean = edits.filter((e) => e.find?.trim() && typeof e.replace === "string");
  if (clean.length === 0) return { ok: false, error: "No edits to apply." };

  const supabase = getSupabaseAdmin();
  const { data: manuscript, error: mErr } = await supabase
    .from("manuscripts")
    .select("storage_path, original_filename")
    .eq("id", manuscriptId)
    .maybeSingle();
  if (mErr) return { ok: false, error: mErr.message };
  if (!manuscript) return { ok: false, error: "Manuscript not found." };

  const { data: blob, error: dlErr } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .download(manuscript.storage_path);
  if (dlErr || !blob) {
    return { ok: false, error: `Could not load the .docx: ${dlErr?.message ?? "missing file"}` };
  }

  const input = Buffer.from(await blob.arrayBuffer());

  let applied, failed, edited;
  try {
    ({ buffer: edited, applied, failed } = await applyEditsToDocx(input, clean));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (applied.length === 0) {
    return {
      ok: false,
      failed,
      error:
        "None of the edits could be located in the document. The find text must match the manuscript exactly — tweak it and try again.",
    };
  }

  // Save as a new version (the previous file is kept in storage).
  const newPath = `${manuscriptId}/edited-${crypto.randomUUID()}-${sanitizeFilename(manuscript.original_filename)}`;
  const { error: upErr } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .upload(newPath, edited, { contentType: DOCX_MIME, upsert: false });
  if (upErr) return { ok: false, error: `Saving the edited file failed: ${upErr.message}` };

  const newText = (await mammoth.extractRawText({ buffer: edited })).value ?? "";

  const { error: updErr } = await supabase
    .from("manuscripts")
    .update({
      storage_path: newPath,
      extracted_text: newText,
      word_count: countWords(newText),
      file_size: edited.byteLength,
    })
    .eq("id", manuscriptId);
  if (updErr) return { ok: false, error: `Updating the manuscript failed: ${updErr.message}` };

  await supabase.from("suggestions").update({ applied: true }).eq("id", suggestionId);

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true, appliedCount: applied.length, failed };
}
