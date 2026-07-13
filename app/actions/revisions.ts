"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getSupabaseAdmin, MANUSCRIPTS_BUCKET } from "@/lib/supabase/server";
import { countManuscriptWords } from "@/lib/word-count";
import { getManuscriptText } from "@/lib/reviews";
import { listIssues } from "@/lib/issues";
import { recheckIssues as recheckOpenAI } from "@/lib/ai/openai";
import { recheckIssues as recheckClaude } from "@/lib/ai/anthropic";
import type { IssueVerdict, Provider } from "@/lib/types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface UploadRevisionState {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface RecheckResult {
  ok: boolean;
  errors?: string[];
  message?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

/** Replace a manuscript's text/file with a revised .docx (issues stay attached). */
export async function uploadRevision(
  _prev: UploadRevisionState,
  formData: FormData,
): Promise<UploadRevisionState> {
  const manuscriptId = formData.get("manuscriptId") as string | null;
  const file = formData.get("file");
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a revised .docx file." };
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { ok: false, error: "Only Word .docx files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText: string;
  try {
    extractedText = (await mammoth.extractRawText({ buffer })).value ?? "";
  } catch {
    return { ok: false, error: "Could not read that file as a Word document." };
  }

  const supabase = getSupabaseAdmin();
  const storagePath = `${manuscriptId}/rev-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  const { error: updateError } = await supabase
    .from("manuscripts")
    .update({
      original_filename: file.name,
      storage_path: storagePath,
      file_size: file.size,
      word_count: countManuscriptWords(extractedText),
      extracted_text: extractedText,
    })
    .eq("id", manuscriptId);
  if (updateError) {
    await supabase.storage.from(MANUSCRIPTS_BUCKET).remove([storagePath]);
    return { ok: false, error: `Saving revision failed: ${updateError.message}` };
  }

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true, message: "Revision uploaded. Re-check the issues to re-score." };
}

/**
 * Re-check outstanding issues against the current (revised) text + re-score.
 * Pass `issueIds` to re-check only that subset (e.g. just the chapters you
 * revised); omit/empty to re-check every outstanding issue.
 */
export async function recheckRevision(
  manuscriptId: string,
  provider: Provider,
  issueIds: string[] = [],
): Promise<RecheckResult> {
  if (!manuscriptId) return { ok: false, errors: ["Missing manuscript id."] };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["This manuscript has no text to check."] };
  }

  const allIssues = await listIssues(manuscriptId);
  let outstanding = allIssues.filter((i) => i.status === "outstanding");
  if (issueIds.length > 0) {
    const selected = new Set(issueIds);
    outstanding = outstanding.filter((i) => selected.has(i.id));
    if (outstanding.length === 0) {
      return { ok: false, errors: ["None of the selected issues are still outstanding."] };
    }
  }

  let result;
  try {
    const fn = provider === "openai" ? recheckOpenAI : recheckClaude;
    result = await fn(
      outstanding.map((i) => ({ id: i.id, title: i.title, description: i.description })),
      text,
    );
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }

  const supabase = getSupabaseAdmin();
  const outstandingIds = new Set(outstanding.map((i) => i.id));
  const titleById = new Map(outstanding.map((i) => [i.id, i.title]));

  // Mark issues the revision resolved.
  const resolvedIds = result.verdicts
    .filter((v) => v.status === "resolved" && outstandingIds.has(v.id))
    .map((v) => v.id);

  const errors: string[] = [];
  if (resolvedIds.length > 0) {
    const { error } = await supabase
      .from("issues")
      .update({ status: "resolved" })
      .in("id", resolvedIds);
    if (error) errors.push(`Updating issues failed: ${error.message}`);
  }

  const verdicts: IssueVerdict[] = result.verdicts
    .filter((v) => outstandingIds.has(v.id))
    .map((v) => ({ id: v.id, title: titleById.get(v.id), status: v.status, note: v.note }));

  const resolvedCount = resolvedIds.length;
  const outstandingCount = outstanding.length - resolvedCount;

  const { error: insertError } = await supabase.from("revision_checks").insert({
    manuscript_id: manuscriptId,
    provider,
    model: result.model,
    grade: result.grade || null,
    summary: result.summary || null,
    resolved_count: resolvedCount,
    outstanding_count: outstandingCount,
    issue_verdicts: verdicts,
  });
  if (insertError) errors.push(`Saving the re-check failed: ${insertError.message}`);

  revalidatePath(`/manuscripts/${manuscriptId}`);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    message: `Re-scored ${result.grade ? `(${result.grade})` : ""} — ${resolvedCount} resolved, ${outstandingCount} still outstanding.`,
  };
}
