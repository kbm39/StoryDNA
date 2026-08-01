"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isStudioEicConversationalIntakeEnabled } from "@/lib/author-manuscript-brief/feature-flag.ts";
import { emitManuscriptBriefEvent } from "@/lib/author-manuscript-brief/observability.ts";
import {
  createManuscriptBriefDraft,
  getCurrentManuscriptBrief,
  getSubmittedManuscriptBrief,
  listManuscriptBriefHistory,
  submitManuscriptBrief,
  supersedeSubmittedBrief,
  updateManuscriptBriefDraft,
} from "@/lib/author-manuscript-brief/service.ts";
import type { ManuscriptBriefRecord } from "@/lib/author-manuscript-brief/types.ts";
import { getManuscriptReviewContext } from "@/lib/reviews.ts";

const STUDIO_AUTHOR_ID = "studio-author";

function revalidateBriefRoutes(manuscriptId: string) {
  revalidatePath(`/studio/books/${manuscriptId}/intent`);
  revalidatePath(`/studio/books/${manuscriptId}`);
}

async function guarded<T>(manuscriptId: string, fn: () => Promise<T>): Promise<T> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/intent`);
  return fn();
}

export async function getConversationalIntakePageData(manuscriptId: string): Promise<{
  conversationalEnabled: boolean;
  draftBrief: ManuscriptBriefRecord | null;
  submittedBrief: ManuscriptBriefRecord | null;
  history: readonly ManuscriptBriefRecord[];
  manuscriptVersionId: string | null;
} | null> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx) return null;

    const conversationalEnabled = isStudioEicConversationalIntakeEnabled();
    const versionId = ctx.manuscriptVersionId;

    if (!conversationalEnabled || !versionId) {
      return {
        conversationalEnabled,
        draftBrief: null,
        submittedBrief: null,
        history: [],
        manuscriptVersionId: versionId,
      };
    }

    const [draftBrief, submittedBrief, history] = await Promise.all([
      getCurrentManuscriptBrief({
        manuscriptId,
        manuscriptVersionId: versionId,
        createdBy: STUDIO_AUTHOR_ID,
      }),
      getSubmittedManuscriptBrief({
        manuscriptId,
        manuscriptVersionId: versionId,
      }),
      listManuscriptBriefHistory(manuscriptId),
    ]);

    return {
      conversationalEnabled,
      draftBrief,
      submittedBrief,
      history,
      manuscriptVersionId: versionId,
    };
  });
}

export async function saveManuscriptBriefDraftAction(input: {
  manuscriptId: string;
  briefId?: string;
  elevator_pitch?: string;
  author_motivation?: string;
  desired_reader_experience?: string | null;
  market_position?: string;
  comparison_titles?: string | null;
  success_definition?: string | null;
}): Promise<{ ok: boolean; briefId?: string; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioEicConversationalIntakeEnabled()) {
      return { ok: false, error: "Conversational intake is not enabled." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    if (input.briefId) {
      const result = await updateManuscriptBriefDraft({
        briefId: input.briefId,
        manuscriptId: input.manuscriptId,
        manuscriptVersionId: ctx.manuscriptVersionId,
        createdBy: STUDIO_AUTHOR_ID,
        elevator_pitch: input.elevator_pitch,
        author_motivation: input.author_motivation,
        desired_reader_experience: input.desired_reader_experience,
        market_position: input.market_position,
        comparison_titles: input.comparison_titles,
        success_definition: input.success_definition,
      });
      if (!result.ok) return { ok: false, error: result.error };
      revalidateBriefRoutes(input.manuscriptId);
      return { ok: true, briefId: result.record.brief_id };
    }

    const result = await createManuscriptBriefDraft({
      book_id: input.manuscriptId,
      manuscript_id: input.manuscriptId,
      manuscript_version_id: ctx.manuscriptVersionId,
      created_by: STUDIO_AUTHOR_ID,
      elevator_pitch: input.elevator_pitch,
      author_motivation: input.author_motivation,
      desired_reader_experience: input.desired_reader_experience,
      market_position: input.market_position,
      comparison_titles: input.comparison_titles,
      success_definition: input.success_definition,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateBriefRoutes(input.manuscriptId);
    return { ok: true, briefId: result.record.brief_id };
  });
}

export async function submitManuscriptBriefAction(input: {
  manuscriptId: string;
  briefId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioEicConversationalIntakeEnabled()) {
      return { ok: false, error: "Conversational intake is not enabled." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const result = await submitManuscriptBrief({
      briefId: input.briefId,
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateBriefRoutes(input.manuscriptId);
    return { ok: true };
  });
}

export async function editSubmittedBriefAction(manuscriptId: string): Promise<{
  ok: boolean;
  briefId?: string;
  error?: string;
}> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const submitted = await getSubmittedManuscriptBrief({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
    });
    if (!submitted) return { ok: false, error: "No submitted brief to edit." };

    const result = await supersedeSubmittedBrief({
      submittedBriefId: submitted.brief_id,
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidateBriefRoutes(manuscriptId);
    return { ok: true, briefId: result.draft.brief_id };
  });
}

export async function recordEicAcknowledgmentViewed(manuscriptId: string): Promise<void> {
  await guarded(manuscriptId, async () => {
    emitManuscriptBriefEvent({
      event: "eic_acknowledgment_viewed",
      manuscript_id: manuscriptId,
    });
  });
}
