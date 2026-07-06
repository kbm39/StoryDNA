"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getSupabaseAdmin, MANUSCRIPTS_BUCKET } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { getEditorialAnalysis, listEditorialComments } from "@/lib/editorial";
import { insertCommentsIntoDocx } from "@/lib/docx-comment";
import {
  extractEditorialComments as extractOpenAI,
  assessEditorialComments as assessOpenAI,
  suggestFix as suggestOpenAI,
} from "@/lib/ai/openai";
import {
  extractEditorialComments as extractClaude,
  assessEditorialComments as assessClaude,
  suggestFix as suggestClaude,
} from "@/lib/ai/anthropic";
import type { AssessInput } from "@/lib/ai/shared";
import type { Provider } from "@/lib/types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

export interface UploadAnalysisState {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface AnalyzeResult {
  ok: boolean;
  errors?: string[];
  message?: string;
}

export interface RequestSuggestionsResult {
  ok: boolean;
  errors?: string[];
}

export interface InsertCommentResult {
  ok: boolean;
  error?: string;
}

function revalidate(manuscriptId: string) {
  revalidatePath(`/manuscripts/${manuscriptId}`);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Upload (or paste) an editorial analysis. Replaces any existing one for this manuscript. */
export async function uploadEditorialAnalysis(
  _prev: UploadAnalysisState,
  formData: FormData,
): Promise<UploadAnalysisState> {
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
      return { ok: false, error: "Upload a .pdf, .docx, or .txt file, or paste the analysis below." };
    }
  } else if (pasted) {
    rawText = pasted;
    fileName = "Pasted analysis";
  } else {
    return { ok: false, error: "Choose a .pdf/.docx/.txt file or paste the analysis text." };
  }

  rawText = rawText.trim();
  if (rawText.length < 40) {
    return { ok: false, error: "That analysis looks empty — nothing to work from." };
  }

  const supabase = getSupabaseAdmin();
  // One analysis per manuscript: clear any existing (cascades comments), then insert.
  await supabase.from("editorial_analyses").delete().eq("manuscript_id", manuscriptId);
  const { error } = await supabase.from("editorial_analyses").insert({
    manuscript_id: manuscriptId,
    file_name: fileName,
    raw_text: rawText,
  });
  if (error) return { ok: false, error: `Saving the analysis failed: ${error.message}` };

  revalidate(manuscriptId);
  return { ok: true, message: "Analysis saved. Now run “Analyze comments” to split it and get verdicts." };
}

/** Parse the analysis into comments (if not already) and get each model's verdicts. */
export async function analyzeEditorialAnalysis(
  manuscriptId: string,
  providers: Provider[],
): Promise<AnalyzeResult> {
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const analysis = await getEditorialAnalysis(manuscriptId);
  if (!analysis) return { ok: false, errors: ["Upload an editorial analysis first."] };

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  // 1) Parse into comments once. Prefer OpenAI (JSON mode); fall back to Claude.
  let comments = await listEditorialComments(analysis.id);
  if (comments.length === 0) {
    try {
      const parsed = process.env.OPENAI_API_KEY
        ? await extractOpenAI(analysis.raw_text)
        : await extractClaude(analysis.raw_text);
      if (parsed.length === 0) {
        return { ok: false, errors: ["No distinct comments could be parsed from that analysis."] };
      }
      const rows = parsed.map((c, i) => ({
        analysis_id: analysis.id,
        manuscript_id: manuscriptId,
        ordinal: i,
        quote: c.quote || null,
        comment: c.comment,
        category: c.category || null,
      }));
      const { error } = await supabase.from("editorial_comments").insert(rows);
      if (error) return { ok: false, errors: [`Saving comments failed: ${error.message}`] };
      comments = await listEditorialComments(analysis.id);
    } catch (e) {
      return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
    }
  }

  // 2) Get each model's verdict on every comment (batched: one call per provider).
  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["Manuscript has no text to judge the comments against."] };
  }

  const inputs: AssessInput[] = comments.map((c) => ({
    id: c.id,
    quote: c.quote,
    comment: c.comment,
  }));

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const fn = provider === "openai" ? assessOpenAI : assessClaude;
        const res = await fn(inputs, text);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return { provider, res: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const validIds = new Set(comments.map((c) => c.id));
  for (const r of results) {
    if (r.error || !r.res) {
      errors.push(`${PROVIDER_LABEL[r.provider]} failed: ${r.error}`);
      continue;
    }
    const rows = r.res.assessments
      .filter((a) => validIds.has(a.id))
      .map((a) => ({
        comment_id: a.id,
        provider: r.provider,
        model: r.res!.model,
        stance: a.stance,
        reasoning: a.reasoning || null,
      }));
    if (rows.length === 0) continue;
    // Replace this provider's prior verdicts for these comments.
    await supabase
      .from("comment_assessments")
      .delete()
      .eq("provider", r.provider)
      .in("comment_id", rows.map((row) => row.comment_id));
    const { error } = await supabase.from("comment_assessments").insert(rows);
    if (error) errors.push(`Saving ${PROVIDER_LABEL[r.provider]} verdicts failed: ${error.message}`);
  }

  revalidate(manuscriptId);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, message: `Analyzed ${comments.length} comment${comments.length === 1 ? "" : "s"}.` };
}

/** Request fix suggestions for one editorial comment from the chosen provider(s). */
export async function requestCommentSuggestions(
  commentId: string,
  manuscriptId: string,
  providers: Provider[],
): Promise<RequestSuggestionsResult> {
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const supabase = getSupabaseAdmin();
  const { data: comment, error: cErr } = await supabase
    .from("editorial_comments")
    .select("id, comment, quote")
    .eq("id", commentId)
    .maybeSingle();
  if (cErr) return { ok: false, errors: [cErr.message] };
  if (!comment) return { ok: false, errors: ["Comment not found."] };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["Manuscript has no text to work from."] };
  }

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const fn = provider === "openai" ? suggestOpenAI : suggestClaude;
        const res = await fn(comment.comment, comment.quote, text);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return { provider, res: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const errors: string[] = [];
  const rows = results
    .filter((r) => {
      if (r.error) errors.push(`${PROVIDER_LABEL[r.provider]} failed: ${r.error}`);
      return r.res !== null;
    })
    .map((r) => ({
      comment_id: commentId,
      provider: r.provider,
      model: r.res!.model,
      content: r.res!.content,
      applied: false,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("suggestions").insert(rows);
    if (error) errors.push(`Saving suggestions failed: ${error.message}`);
  }

  revalidate(manuscriptId);
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

/** Insert an editorial comment (and/or a chosen suggestion) into the .docx as a
 *  Word margin comment anchored to a passage. Saves a new manuscript version. */
export async function insertCommentAsWordComment(
  manuscriptId: string,
  anchor: string,
  body: string,
): Promise<InsertCommentResult> {
  if (!anchor.trim()) {
    return { ok: false, error: "Add the passage to attach the comment to." };
  }
  if (!body.trim()) return { ok: false, error: "The comment is empty." };

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

  let applied, edited;
  try {
    ({ buffer: edited, applied } = await insertCommentsIntoDocx(
      input,
      [{ anchor, author: "Editorial review", initials: "ED", body }],
      new Date().toISOString(),
    ));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (applied.length === 0) {
    return {
      ok: false,
      error:
        "Could not locate that passage in the document. The text must match the manuscript exactly — tweak it and try again.",
    };
  }

  const newPath = `${manuscriptId}/commented-${crypto.randomUUID()}-${sanitizeFilename(manuscript.original_filename)}`;
  const { error: upErr } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .upload(newPath, edited, { contentType: DOCX_MIME, upsert: false });
  if (upErr) return { ok: false, error: `Saving the commented file failed: ${upErr.message}` };

  // Comments don't change body text, but re-extract to keep word_count/size honest.
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

  revalidate(manuscriptId);
  return { ok: true };
}

export async function deleteEditorialAnalysis(manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("editorial_analyses")
    .delete()
    .eq("manuscript_id", manuscriptId);
  if (error) throw new Error(error.message);
  revalidate(manuscriptId);
}
