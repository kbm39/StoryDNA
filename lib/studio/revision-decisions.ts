import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import type { AuthorEditDisposition, AuthorEditResponse, RevisionCandidate } from "@/lib/types.ts";
import {
  isSameAuthorResponse,
  mapStudioDispositionToDb,
  type StudioAuthorDisposition,
} from "./decisions.ts";

export interface RevisionDecisionResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly migrationRequired?: boolean;
  readonly noOp?: boolean;
}

export interface LoadedRevisionCandidate {
  readonly candidate: RevisionCandidate;
  readonly existingResponse: AuthorEditResponse | null;
}

export async function loadRevisionCandidateForManuscript(input: {
  readonly candidateId: string;
  readonly manuscriptId: string;
}): Promise<LoadedRevisionCandidate | null> {
  const supabase = getSupabaseAdmin();
  const { data: candidate, error } = await supabase
    .from("revision_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .maybeSingle();
  if (error || !candidate) return null;
  if ((candidate as RevisionCandidate).manuscript_id !== input.manuscriptId) return null;

  const { data: response } = await supabase
    .from("author_edit_responses")
    .select("*")
    .eq("candidate_id", input.candidateId)
    .maybeSingle();

  return {
    candidate: candidate as RevisionCandidate,
    existingResponse: (response as AuthorEditResponse | null) ?? null,
  };
}

async function upsertAuthorResponse(input: {
  readonly candidateId: string;
  readonly manuscriptId: string;
  readonly disposition: AuthorEditDisposition;
  readonly authorModifiedText?: string | null;
  readonly authorNote?: string | null;
  readonly existingResponse?: AuthorEditResponse | null;
}): Promise<RevisionDecisionResult> {
  const authorModifiedText =
    input.disposition === "modified" ? (input.authorModifiedText?.trim() ?? null) : null;
  const authorNote = input.authorNote?.trim() || null;

  if (
    input.existingResponse &&
    isSameAuthorResponse({
      existing: input.existingResponse,
      disposition: input.disposition,
      authorModifiedText,
      authorNote,
    })
  ) {
    return { ok: true, noOp: true };
  }

  const supabase = getSupabaseAdmin();
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
        error: "Database migration required for author responses.",
        migrationRequired: true,
      };
    }
    if (error.message.includes("CANDIDATE_MANUSCRIPT_MISMATCH")) {
      return { ok: false, error: "Suggestion not found for this manuscript." };
    }
    if (error.message.includes("CANDIDATE_NOT_FOUND")) {
      return { ok: false, error: "Suggestion not found." };
    }
    if (error.message.includes("MANUSCRIPT_NOT_FOUND")) {
      return { ok: false, error: "Manuscript not found." };
    }
    if (error.message.includes("MODIFIED_TEXT_REQUIRED")) {
      return { ok: false, error: "Enter your modified replacement text before submitting." };
    }
    return { ok: false, error: "Unable to save your decision. Please try again." };
  }

  return { ok: true };
}

function validateModifiedText(input: {
  readonly disposition: AuthorEditDisposition;
  readonly authorModifiedText?: string | null;
  readonly rewriteKind?: string;
}): string | null {
  if (input.disposition !== "modified") return null;
  const text = input.authorModifiedText?.trim();
  if (text) return null;
  if (input.rewriteKind === "deletion") return null;
  return "Enter your modified replacement text before submitting.";
}

export async function persistStudioRevisionDecision(input: {
  readonly candidateId: string;
  readonly manuscriptId: string;
  readonly studioDisposition: Exclude<StudioAuthorDisposition, "pending">;
  readonly authorModifiedText?: string | null;
  readonly authorNote?: string | null;
}): Promise<RevisionDecisionResult> {
  if (!input.candidateId || !input.manuscriptId) {
    return { ok: false, error: "Missing suggestion or manuscript." };
  }

  const loaded = await loadRevisionCandidateForManuscript({
    candidateId: input.candidateId,
    manuscriptId: input.manuscriptId,
  });
  if (!loaded) return { ok: false, error: "Suggestion not found for this manuscript." };

  const dbDisposition = mapStudioDispositionToDb(input.studioDisposition);
  const validationError = validateModifiedText({
    disposition: dbDisposition,
    authorModifiedText: input.authorModifiedText,
  });
  if (validationError) return { ok: false, error: validationError };

  return upsertAuthorResponse({
    candidateId: input.candidateId,
    manuscriptId: input.manuscriptId,
    disposition: dbDisposition,
    authorModifiedText: input.authorModifiedText,
    authorNote: input.authorNote,
    existingResponse: loaded.existingResponse,
  });
}

export async function persistStudioAuthorNote(input: {
  readonly candidateId: string;
  readonly manuscriptId: string;
  readonly authorNote: string;
}): Promise<RevisionDecisionResult> {
  const note = input.authorNote.trim();
  if (!note) return { ok: false, error: "Enter a note before saving." };

  const loaded = await loadRevisionCandidateForManuscript({
    candidateId: input.candidateId,
    manuscriptId: input.manuscriptId,
  });
  if (!loaded) return { ok: false, error: "Suggestion not found for this manuscript." };

  const disposition: AuthorEditDisposition =
    loaded.existingResponse?.disposition ?? "skipped";

  return upsertAuthorResponse({
    candidateId: input.candidateId,
    manuscriptId: input.manuscriptId,
    disposition,
    authorModifiedText: loaded.existingResponse?.author_modified_text ?? null,
    authorNote: note,
    existingResponse: loaded.existingResponse,
  });
}

export async function reopenStudioRevisionDecision(input: {
  readonly candidateId: string;
  readonly manuscriptId: string;
}): Promise<RevisionDecisionResult> {
  const loaded = await loadRevisionCandidateForManuscript({
    candidateId: input.candidateId,
    manuscriptId: input.manuscriptId,
  });
  if (!loaded) return { ok: false, error: "Suggestion not found for this manuscript." };
  if (!loaded.existingResponse) return { ok: true, noOp: true };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("author_edit_responses")
    .delete()
    .eq("candidate_id", input.candidateId)
    .eq("manuscript_id", input.manuscriptId);

  if (error) {
    return { ok: false, error: "Unable to reopen this decision. Please try again." };
  }

  return { ok: true };
}

/** Read-only guard — manuscript content must not change via revision decisions. */
export async function assertManuscriptUnchangedForDecision(input: {
  readonly manuscriptId: string;
  readonly before: {
    readonly extractedText: string | null;
    readonly currentVersionId: string | null;
    readonly storagePath: string | null;
  };
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path")
    .eq("id", input.manuscriptId)
    .maybeSingle();
  if (!data) return false;
  return (
    (data.extracted_text as string | null) === input.before.extractedText &&
    (data.current_version_id as string | null) === input.before.currentVersionId &&
    (data.storage_path as string | null) === input.before.storagePath
  );
}

export async function snapshotManuscriptIntegrity(manuscriptId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("manuscripts")
    .select("extracted_text, current_version_id, storage_path")
    .eq("id", manuscriptId)
    .maybeSingle();
  return {
    extractedText: (data?.extracted_text as string | null) ?? null,
    currentVersionId: (data?.current_version_id as string | null) ?? null,
    storagePath: (data?.storage_path as string | null) ?? null,
  };
}
