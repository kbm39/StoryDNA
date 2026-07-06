"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getSupabaseAdmin, MANUSCRIPTS_BUCKET } from "@/lib/supabase/server";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface UploadState {
  ok: boolean;
  error?: string;
  message?: string;
  /** Set on success so the client can jump into StoryDNA discovery. */
  id?: string;
}

export interface DeleteState {
  ok: boolean;
  error?: string;
}

/**
 * Delete a manuscript: its DB row (reviews, issues, suggestions, editorial
 * analysis, etc. cascade via FK) plus every stored .docx version for it.
 */
export async function deleteManuscript(id: string): Promise<DeleteState> {
  if (!id) return { ok: false, error: "Missing manuscript id." };
  const supabase = getSupabaseAdmin();

  // Remove all stored files under this manuscript's folder (original + any
  // edited-/commented- versions produced over its life).
  const { data: files, error: listErr } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .list(id);
  if (!listErr && files && files.length > 0) {
    await supabase.storage.from(MANUSCRIPTS_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
  }

  const { error } = await supabase.from("manuscripts").delete().eq("id", id);
  if (error) return { ok: false, error: `Delete failed: ${error.message}` };

  revalidatePath("/");
  return { ok: true };
}

/** Move a manuscript above/below the library divider (current vs. older versions). */
export async function setManuscriptArchived(
  id: string,
  archived: boolean,
): Promise<DeleteState> {
  if (!id) return { ok: false, error: "Missing manuscript id." };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("manuscripts").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Server action: validate a .docx, extract its text, store the file + a row. */
export async function uploadManuscript(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");
  const titleInput = (formData.get("title") as string | null)?.trim();

  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a .docx file to upload." };
  }

  const isDocx =
    file.name.toLowerCase().endsWith(".docx") &&
    (file.type === DOCX_MIME || file.type === "" || file.type === "application/octet-stream");
  if (!isDocx) {
    return { ok: false, error: "Only Word .docx files are supported." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Extract plain text now so later phases (reviews, issues) have it ready.
  let extractedText: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value ?? "";
  } catch {
    return {
      ok: false,
      error: "Could not read that file as a Word document. Is it a valid .docx?",
    };
  }

  const id = crypto.randomUUID();
  const safeName = sanitizeFilename(file.name);
  const storagePath = `${id}/${safeName}`;
  const title = titleInput || file.name.replace(/\.docx$/i, "");

  const supabase = getSupabaseAdmin();

  const { error: uploadError } = await supabase.storage
    .from(MANUSCRIPTS_BUCKET)
    .upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from("manuscripts").insert({
    id,
    title,
    original_filename: file.name,
    storage_path: storagePath,
    file_size: file.size,
    word_count: countWords(extractedText),
    extracted_text: extractedText,
    status: "uploaded",
  });

  if (insertError) {
    // Roll back the stored file so we don't orphan it.
    await supabase.storage.from(MANUSCRIPTS_BUCKET).remove([storagePath]);
    return { ok: false, error: `Saving manuscript failed: ${insertError.message}` };
  }

  revalidatePath("/");
  return { ok: true, message: `Uploaded “${title}”.`, id };
}
