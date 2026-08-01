"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isStudioConversationalIntelligenceEnabled } from "@/lib/conversational-intelligence/feature-flag.ts";
import {
  confirmEditorialUnderstanding,
  createEditorialUnderstandingDraft,
  getConfirmedEditorialUnderstanding,
  getCurrentEditorialUnderstanding,
  processStageAnswer,
  reopenEditorialUnderstandingForEdit,
  requestUnderstandingCorrection,
} from "@/lib/editorial-understanding/service.ts";
import type { EditorialUnderstandingRecord } from "@/lib/editorial-understanding/types.ts";
import { getManuscriptReviewContext } from "@/lib/reviews.ts";

const STUDIO_AUTHOR_ID = "studio-author";

function revalidateRoutes(manuscriptId: string) {
  revalidatePath(`/studio/books/${manuscriptId}/intent`);
  revalidatePath(`/studio/books/${manuscriptId}`);
}

async function guarded<T>(manuscriptId: string, fn: () => Promise<T>): Promise<T> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/intent`);
  return fn();
}

export async function getConversationalIntelligencePageData(manuscriptId: string): Promise<{
  intelligenceEnabled: boolean;
  understanding: EditorialUnderstandingRecord | null;
  confirmedUnderstanding: EditorialUnderstandingRecord | null;
  manuscriptVersionId: string | null;
} | null> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx) return null;

    const intelligenceEnabled = isStudioConversationalIntelligenceEnabled();
    const versionId = ctx.manuscriptVersionId;

    if (!intelligenceEnabled || !versionId) {
      return {
        intelligenceEnabled,
        understanding: null,
        confirmedUnderstanding: null,
        manuscriptVersionId: versionId,
      };
    }

    const [understanding, confirmedUnderstanding] = await Promise.all([
      getCurrentEditorialUnderstanding({
        manuscriptId,
        manuscriptVersionId: versionId,
        createdBy: STUDIO_AUTHOR_ID,
      }),
      getConfirmedEditorialUnderstanding({
        manuscriptId,
        manuscriptVersionId: versionId,
      }),
    ]);

    return {
      intelligenceEnabled,
      understanding,
      confirmedUnderstanding,
      manuscriptVersionId: versionId,
    };
  });
}

export async function ensureEditorialUnderstandingDraftAction(manuscriptId: string): Promise<{
  ok: boolean;
  understandingId?: string;
  error?: string;
}> {
  return guarded(manuscriptId, async () => {
    if (!isStudioConversationalIntelligenceEnabled()) {
      return { ok: false, error: "Conversational intelligence is not enabled." };
    }

    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const result = await createEditorialUnderstandingDraft({
      book_id: manuscriptId,
      manuscript_id: manuscriptId,
      manuscript_version_id: ctx.manuscriptVersionId,
      created_by: STUDIO_AUTHOR_ID,
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidateRoutes(manuscriptId);
    return { ok: true, understandingId: result.record.understanding_id };
  });
}

export async function submitStageAnswerAction(input: {
  manuscriptId: string;
  understandingId: string;
  promptKey: string;
  authorAnswer: string | null;
  skipped?: boolean;
  isClarificationFollowUp?: boolean;
  clarificationAnswer?: string | null;
}): Promise<{
  ok: boolean;
  eicResponse?: { response_type: string; content: string };
  advanceStage?: boolean;
  awaitingClarification?: boolean;
  status?: string;
  understandingSummary?: string | null;
  error?: string;
}> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioConversationalIntelligenceEnabled()) {
      return { ok: false, error: "Conversational intelligence is not enabled." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const result = await processStageAnswer({
      understandingId: input.understandingId,
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
      promptKey: input.promptKey,
      authorAnswer: input.authorAnswer,
      skipped: Boolean(input.skipped),
      isClarificationFollowUp: input.isClarificationFollowUp,
      clarificationAnswer: input.clarificationAnswer,
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidateRoutes(input.manuscriptId);
    return {
      ok: true,
      eicResponse: result.eicResponse,
      advanceStage: result.advanceStage,
      awaitingClarification: result.awaitingClarification,
      status: result.record.status,
      understandingSummary: result.record.understanding_summary,
    };
  });
}

export async function confirmEditorialUnderstandingAction(input: {
  manuscriptId: string;
  understandingId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioConversationalIntelligenceEnabled()) {
      return { ok: false, error: "Conversational intelligence is not enabled." };
    }

    const result = await confirmEditorialUnderstanding({
      understandingId: input.understandingId,
      manuscriptId: input.manuscriptId,
      createdBy: STUDIO_AUTHOR_ID,
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidateRoutes(input.manuscriptId);
    return { ok: true };
  });
}

export async function editUnderstandingAnswersAction(manuscriptId: string): Promise<{
  ok: boolean;
  understandingId?: string;
  error?: string;
}> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const current = await getCurrentEditorialUnderstanding({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
    });
    const confirmed = await getConfirmedEditorialUnderstanding({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
    });

    const target = current ?? confirmed;
    if (!target) return { ok: false, error: "No editorial understanding to edit." };

    const result = await reopenEditorialUnderstandingForEdit({
      understandingId: target.understanding_id,
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
    });

    if (!result.ok) return { ok: false, error: result.error };
    revalidateRoutes(manuscriptId);
    return { ok: true, understandingId: result.record.understanding_id };
  });
}

export async function requestSummaryCorrectionAction(input: {
  manuscriptId: string;
  understandingId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const result = await requestUnderstandingCorrection({
      understandingId: input.understandingId,
      manuscriptId: input.manuscriptId,
      createdBy: STUDIO_AUTHOR_ID,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateRoutes(input.manuscriptId);
    return { ok: true };
  });
}
