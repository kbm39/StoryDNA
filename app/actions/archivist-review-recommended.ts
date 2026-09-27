"use server";

import { revalidatePath } from "next/cache";
import {
  ARCHIVIST_REVIEW_AUTHOR_ACTIONS,
  recordPassageReviewDecision,
  type ArchivistReviewAuthorAction,
} from "@/experts/archivist/segmented/observation-v2/review-recommended/index.ts";
import { isArchivistCandidateReviewUiAllowed } from "@/lib/archivist-candidate-review/allow.ts";
import { createFileReviewDecisionStore } from "@/lib/archivist-review-recommended/store.ts";

export async function submitArchivistReviewDecision(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId?: string | null;
  clusterFingerprint: string;
  action: ArchivistReviewAuthorAction;
  passages: ReadonlyArray<{ passageKey: string; evidenceIdentity: string }>;
  authorComment?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isArchivistCandidateReviewUiAllowed()) {
    return { ok: false, error: "Review actions are not available." };
  }
  if (!input.manuscriptId.trim() || !input.manuscriptVersionId.trim() || !input.clusterFingerprint.trim()) {
    return { ok: false, error: "Missing review identity." };
  }
  if (!(ARCHIVIST_REVIEW_AUTHOR_ACTIONS as readonly string[]).includes(input.action)) {
    return { ok: false, error: "Unsupported review action." };
  }
  if (!input.passages.length || input.passages.some((row) => !row.passageKey.trim() || !row.evidenceIdentity.trim())) {
    return { ok: false, error: "Missing passage identity." };
  }
  const store = createFileReviewDecisionStore();
  for (const passage of input.passages) {
    const decision = recordPassageReviewDecision({
      store,
      passageKey: passage.passageKey,
      clusterFingerprint: input.clusterFingerprint,
      evidenceIdentity: passage.evidenceIdentity,
      action: input.action,
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: input.manuscriptVersionId,
      sourceWorkflowId: input.sourceWorkflowId,
      authorIdentity: "author",
      authorComment: input.authorComment,
    });
    if (decision.accepted_canon !== false || decision.series_bible !== false) {
      return { ok: false, error: "Review decisions cannot write canon." };
    }
  }
  revalidatePath(`/manuscripts/${input.manuscriptId}`);
  return { ok: true };
}
