"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isStudioAuthorIntentEnabled } from "@/lib/author-intent/feature-flag.ts";
import {
  activateAuthorIntent,
  cancelAuthorIntentDraft,
  createAuthorIntentDraft,
  getActiveAuthorIntent,
  listAuthorIntentHistory,
  supersedeAuthorIntent,
} from "@/lib/author-intent/service.ts";
import type { AuthorIntentDraftInput, AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import type { AuthorIntentType, PriorityDomain } from "@/lib/author-intent/contract.ts";
import { isStudioEicEnabled } from "@/lib/eic/feature-flag.ts";
import { createEicPlanFromIntent, previewEicPlan } from "@/lib/eic/service.ts";
import type { EicEditorialPlanV1 } from "@/lib/eic/contract.ts";
import { getManuscriptReviewContext } from "@/lib/reviews.ts";

const STUDIO_AUTHOR_ID = "studio-author";

function revalidateIntentRoutes(manuscriptId: string) {
  revalidatePath(`/studio/books/${manuscriptId}/intent`);
  revalidatePath(`/studio/books/${manuscriptId}/experts`);
  revalidatePath(`/studio/books/${manuscriptId}`);
}

async function guarded<T>(manuscriptId: string, fn: () => Promise<T>): Promise<T> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/intent`);
  return fn();
}

export async function getAuthorIntentPageData(manuscriptId: string): Promise<{
  enabled: boolean;
  eicEnabled: boolean;
  activeIntent: AuthorIntentRecord | null;
  history: readonly AuthorIntentRecord[];
  planPreview: EicEditorialPlanV1 | null;
  manuscriptVersionId: string | null;
  versionLabel: string | null;
} | null> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx) return null;

    const enabled = isStudioAuthorIntentEnabled();
    const eicEnabled = isStudioEicEnabled();

    if (!enabled) {
      return {
        enabled: false,
        eicEnabled: false,
        activeIntent: null,
        history: [],
        planPreview: null,
        manuscriptVersionId: ctx.manuscriptVersionId,
        versionLabel: null,
      };
    }

    const versionId = ctx.manuscriptVersionId;
    if (!versionId) {
      return {
        enabled: true,
        eicEnabled,
        activeIntent: null,
        history: [],
        planPreview: null,
        manuscriptVersionId: null,
        versionLabel: null,
      };
    }

    const [activeIntent, history] = await Promise.all([
      getActiveAuthorIntent({ manuscriptId, manuscriptVersionId: versionId }),
      listAuthorIntentHistory(manuscriptId),
    ]);

    let planPreview: EicEditorialPlanV1 | null = null;
    if (eicEnabled && activeIntent) {
      planPreview = await previewEicPlan({ intent: activeIntent });
    }

    return {
      enabled: true,
      eicEnabled,
      activeIntent,
      history,
      planPreview,
      manuscriptVersionId: versionId,
      versionLabel: null,
    };
  });
}

export async function saveAuthorIntentDraft(input: {
  manuscriptId: string;
  intentType: AuthorIntentType;
  customObjectiveText?: string;
  authorSuccessDefinition: string;
  requestedExperts?: readonly string[];
  declinedExperts?: readonly string[];
  priorityDomains?: readonly PriorityDomain[];
  budgetPreference?: string;
  timePreference?: string;
}): Promise<{ ok: boolean; intentId?: string; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioAuthorIntentEnabled()) {
      return { ok: false, error: "Author Intent is not enabled in this environment." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const draftInput: AuthorIntentDraftInput = {
      manuscript_id: input.manuscriptId,
      manuscript_version_id: ctx.manuscriptVersionId,
      intent_type: input.intentType,
      custom_objective_text: input.customObjectiveText ?? null,
      author_success_definition: input.authorSuccessDefinition,
      requested_experts: input.requestedExperts ?? [],
      declined_experts: input.declinedExperts ?? [],
      priority_domains: input.priorityDomains ?? [],
      budget_preference: input.budgetPreference ?? null,
      time_preference: input.timePreference ?? null,
      created_by: STUDIO_AUTHOR_ID,
    };

    const result = await createAuthorIntentDraft(draftInput);
    if (!result.ok) return { ok: false, error: result.error };
    revalidateIntentRoutes(input.manuscriptId);
    return { ok: true, intentId: result.record.id };
  });
}

export async function activateAuthorIntentAction(input: {
  manuscriptId: string;
  intentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioAuthorIntentEnabled()) {
      return { ok: false, error: "Author Intent is not enabled in this environment." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const result = await activateAuthorIntent({
      intentId: input.intentId,
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      createdBy: STUDIO_AUTHOR_ID,
    });

    if (!result.ok) return { ok: false, error: result.error };

    if (isStudioEicEnabled()) {
      await createEicPlanFromIntent({
        intent: result.record,
        createdBy: STUDIO_AUTHOR_ID,
      });
    }

    revalidateIntentRoutes(input.manuscriptId);
    return { ok: true };
  });
}

export async function supersedeAuthorIntentAction(input: {
  manuscriptId: string;
  currentIntentId: string;
  intentType: AuthorIntentType;
  customObjectiveText?: string;
  authorSuccessDefinition: string;
  requestedExperts?: readonly string[];
  declinedExperts?: readonly string[];
  priorityDomains?: readonly PriorityDomain[];
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (!isStudioAuthorIntentEnabled()) {
      return { ok: false, error: "Author Intent is not enabled in this environment." };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.manuscriptVersionId) {
      return { ok: false, error: "No active manuscript version." };
    }

    const result = await supersedeAuthorIntent({
      currentIntentId: input.currentIntentId,
      newDraft: {
        manuscript_id: input.manuscriptId,
        manuscript_version_id: ctx.manuscriptVersionId,
        intent_type: input.intentType,
        custom_objective_text: input.customObjectiveText ?? null,
        author_success_definition: input.authorSuccessDefinition,
        requested_experts: input.requestedExperts ?? [],
        declined_experts: input.declinedExperts ?? [],
        priority_domains: input.priorityDomains ?? [],
        created_by: STUDIO_AUTHOR_ID,
        supersedes_intent_id: input.currentIntentId,
      },
    });

    if (!result.ok) return { ok: false, error: result.error };

    if (isStudioEicEnabled()) {
      await createEicPlanFromIntent({
        intent: result.record,
        createdBy: STUDIO_AUTHOR_ID,
      });
    }

    revalidateIntentRoutes(input.manuscriptId);
    return { ok: true };
  });
}

export async function cancelAuthorIntentDraftAction(input: {
  manuscriptId: string;
  intentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const result = await cancelAuthorIntentDraft({
      intentId: input.intentId,
      manuscriptId: input.manuscriptId,
      createdBy: STUDIO_AUTHOR_ID,
    });
    if (result.ok) revalidateIntentRoutes(input.manuscriptId);
    return result;
  });
}

export async function createAndActivateAuthorIntent(input: {
  manuscriptId: string;
  intentType: AuthorIntentType;
  customObjectiveText?: string;
  authorSuccessDefinition: string;
  requestedExperts?: readonly string[];
  declinedExperts?: readonly string[];
  priorityDomains?: readonly PriorityDomain[];
  budgetPreference?: string;
  timePreference?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const draft = await saveAuthorIntentDraft(input);
  if (!draft.ok || !draft.intentId) return draft;
  return activateAuthorIntentAction({
    manuscriptId: input.manuscriptId,
    intentId: draft.intentId,
  });
}
