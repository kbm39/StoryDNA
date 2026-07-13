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
 * Concurrency: uses PostgreSQL advisory lock via upsert_author_edit_response RPC
 * (same lock namespace as replace_editorial_generation) so author responses and
 * editorial replacement cannot race.
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
  const authorModifiedText =
    input.disposition === "modified" ? (input.authorModifiedText?.trim() ?? null) : null;
  const authorNote = input.authorNote?.trim() || null;

  const { error } = await supabase.rpc("upsert_author_edit_response", {
    p_candidate_id: input.candidateId,
    p_manuscript_id: input.manuscriptId,
    p_disposition: input.disposition,
    p_author_modified_text: authorModifiedText,
    p_author_note: authorNote,
  });

  if (error) {
    if (
      error.message.includes("author_edit_responses") ||
      error.message.includes("upsert_author_edit_response")
    ) {
      return {
        ok: false,
        error:
          "Database migration required. Apply supabase/migrations/0017_replace_editorial_generation.sql.",
        migrationRequired: true,
      };
    }
    if (error.message.includes("CANDIDATE_MANUSCRIPT_MISMATCH")) {
      return { ok: false, error: "Suggestion not found for this manuscript." };
    }
    if (error.message.includes("CANDIDATE_NOT_FOUND")) {
      return { ok: false, error: "Suggestion not found." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/suggested-edits");
  revalidatePath(`/manuscripts/${input.manuscriptId}`);
  return { ok: true };
}
