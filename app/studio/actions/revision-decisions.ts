"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import {
  persistStudioAuthorNote,
  persistStudioRevisionDecision,
  reopenStudioRevisionDecision,
  type RevisionDecisionResult,
} from "@/lib/studio/revision-decisions.ts";

function revalidateStudioRevisionRoutes(manuscriptId: string) {
  revalidatePath("/studio/books");
  revalidatePath(`/studio/books/${manuscriptId}`);
  revalidatePath(`/studio/books/${manuscriptId}/revisions`);
  revalidatePath(`/studio/books/${manuscriptId}/exports`);
}

async function guarded(
  manuscriptId: string,
  fn: () => Promise<RevisionDecisionResult>,
): Promise<RevisionDecisionResult> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/revisions`);
  const result = await fn();
  if (result.ok) revalidateStudioRevisionRoutes(manuscriptId);
  return result;
}

export async function acceptRevisionSuggestion(input: {
  candidateId: string;
  manuscriptId: string;
  authorNote?: string | null;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    persistStudioRevisionDecision({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
      studioDisposition: "accepted",
      authorNote: input.authorNote,
    }),
  );
}

export async function acceptModifiedRevision(input: {
  candidateId: string;
  manuscriptId: string;
  authorFinalText: string;
  authorNote?: string | null;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    persistStudioRevisionDecision({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
      studioDisposition: "accepted_modified",
      authorModifiedText: input.authorFinalText,
      authorNote: input.authorNote,
    }),
  );
}

export async function rejectRevisionSuggestion(input: {
  candidateId: string;
  manuscriptId: string;
  authorNote?: string | null;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    persistStudioRevisionDecision({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
      studioDisposition: "rejected",
      authorNote: input.authorNote,
    }),
  );
}

export async function deferRevisionSuggestion(input: {
  candidateId: string;
  manuscriptId: string;
  authorNote?: string | null;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    persistStudioRevisionDecision({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
      studioDisposition: "deferred",
      authorNote: input.authorNote,
    }),
  );
}

export async function updateRevisionAuthorNote(input: {
  candidateId: string;
  manuscriptId: string;
  authorNote: string;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    persistStudioAuthorNote({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
      authorNote: input.authorNote,
    }),
  );
}

export async function reopenRevisionDecision(input: {
  candidateId: string;
  manuscriptId: string;
}): Promise<RevisionDecisionResult> {
  return guarded(input.manuscriptId, () =>
    reopenStudioRevisionDecision({
      candidateId: input.candidateId,
      manuscriptId: input.manuscriptId,
    }),
  );
}
