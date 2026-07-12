"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AuthorEditDisposition } from "@/lib/types";

export interface SubmitAuthorResponseInput {
  candidateId: string;
  manuscriptId: string;
  disposition: AuthorEditDisposition;
  authorModifiedText?: string | null;
  authorNote?: string | null;
}

export interface SubmitAuthorResponseResult {
  ok: boolean;
  error?: string;
  migrationRequired?: boolean;
}

function validateInput(input: SubmitAuthorResponseInput): string | null {
  if (!input.candidateId || !input.manuscriptId) return "Missing suggestion or manuscript.";
  if (!["accepted", "rejected", "modified", "skipped"].includes(input.disposition)) {
    return "Invalid response type.";
  }
  if (input.disposition === "modified") {
    const text = input.authorModifiedText?.trim();
    if (!text) return "Enter your modified replacement text before submitting.";
  }
  return null;
}

/**
 * Persist the author's response to a revision candidate.
 *
 * Security (pre-production posture):
 * - Uses server-only Supabase service-role client; key never reaches the browser.
 * - RLS is disabled project-wide; all writes are server-mediated.
 * - Candidate must belong to the supplied manuscript_id (cross-pairing rejected).
 * - All fields validated server-side before insert/update.
 *
 * Source of truth: writes `author_edit_responses` only. Does NOT update
 * `revision_candidates.status` — that field is editorial lifecycle state
 * (see lib/author-response-status.ts). Does not alter manuscript text.
 */
export async function submitAuthorResponse(
  input: SubmitAuthorResponseInput,
): Promise<SubmitAuthorResponseResult> {
  const validationError = validateInput(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = getSupabaseAdmin();

  const { data: candidate, error: candErr } = await supabase
    .from("revision_candidates")
    .select("id, manuscript_id, original, revised")
    .eq("id", input.candidateId)
    .eq("manuscript_id", input.manuscriptId)
    .maybeSingle();

  if (candErr) return { ok: false, error: candErr.message };
  if (!candidate) return { ok: false, error: "Suggestion not found." };

  const now = new Date().toISOString();
  const authorModifiedText =
    input.disposition === "modified" ? (input.authorModifiedText?.trim() ?? null) : null;
  const authorNote = input.authorNote?.trim() || null;

  const { data: existing, error: lookupErr } = await supabase
    .from("author_edit_responses")
    .select("id")
    .eq("candidate_id", input.candidateId)
    .maybeSingle();

  if (lookupErr) {
    if (lookupErr.message.includes("author_edit_responses")) {
      return {
        ok: false,
        error:
          "Database migration required. Apply supabase/migrations/0016_author_edit_responses.sql.",
        migrationRequired: true,
      };
    }
    return { ok: false, error: lookupErr.message };
  }

  const row = {
    candidate_id: input.candidateId,
    manuscript_id: input.manuscriptId,
    disposition: input.disposition,
    author_modified_text: authorModifiedText,
    author_note: authorNote,
    updated_at: now,
    ...(existing ? {} : { responded_at: now }),
  };

  const { error: upsertErr } = existing
    ? await supabase.from("author_edit_responses").update(row).eq("id", existing.id)
    : await supabase.from("author_edit_responses").insert(row);

  if (upsertErr) {
    if (upsertErr.message.includes("author_edit_responses")) {
      return {
        ok: false,
        error:
          "Database migration required. Apply supabase/migrations/0016_author_edit_responses.sql.",
        migrationRequired: true,
      };
    }
    return { ok: false, error: upsertErr.message };
  }

  revalidatePath("/suggested-edits");
  revalidatePath(`/manuscripts/${input.manuscriptId}`);
  return { ok: true };
}
