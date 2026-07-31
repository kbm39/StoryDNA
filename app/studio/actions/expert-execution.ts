"use server";

import { revalidatePath } from "next/cache";
import {
  isPublishingWorkflowAvailable,
  startLiteraryAgentPublishingWorkflow,
} from "@/app/actions/editorial-workflows.ts";
import { cancelEditorialWorkflow } from "@/lib/editorial-workflow/cancel-workflow.ts";
import { validateStudioWorkflowCancellation } from "@/lib/editorial-workflow/cancel-workflow-policy.ts";
import { getWorkflowById, getWorkflowEventsForClient } from "@/lib/editorial-workflow/workflow-store.ts";
import { getManuscriptReviewContext } from "@/lib/reviews.ts";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { getStudioReviewExecution } from "@/lib/studio/review-dashboard.ts";
import {
  buildWorkflowActivityLog,
  buildWorkflowProgressTimeline,
  formatWorkflowElapsed,
  pickActiveStudioWorkflow,
} from "@/lib/studio/workflow-progress-timeline.ts";
import type { InternalPhase } from "@/lib/editorial-workflow/types.ts";
import type { StudioWorkflowProgressView } from "@/lib/studio/types.ts";
import {
  recruitEditorialTeamMember,
  removeEditorialTeamMember,
  updateEditorialTeamMemberNotes,
} from "@/lib/studio/editorial-team.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import {
  isExpertLaunchableInStudio,
  isMilitaryExpertLaunchableInStudio,
} from "@/lib/studio/expert-classification.ts";
import { validateMilitaryExpertLaunchAckToken } from "@/lib/studio/military-expert-local-policy.ts";
import { startMilitaryExpertStudioWorkflow } from "@/lib/editorial-workflow/start-military-expert-studio-workflow.ts";
import { isEicPlanGateActive } from "@/lib/eic/feature-flag.ts";
import { gateBlocksLaunch } from "@/lib/eic/gate.ts";
import { evaluatePlanGateForLaunch } from "@/lib/eic/service.ts";
import type { StudioLaunchScope } from "@/lib/studio/types.ts";

function revalidateStudioExpertRoutes(manuscriptId: string) {
  revalidatePath("/studio/books");
  revalidatePath(`/studio/books/${manuscriptId}`);
  revalidatePath(`/studio/books/${manuscriptId}/experts`);
  revalidatePath(`/studio/books/${manuscriptId}/revisions`);
  revalidatePath(`/studio/books/${manuscriptId}/exports`);
}

async function guarded<T>(
  manuscriptId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await requireStudioAccess(`/studio/books/${manuscriptId}/experts`);
  return fn();
}

export async function recruitStudioExpert(input: {
  manuscriptId: string;
  expertKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const result = await recruitEditorialTeamMember(input);
    if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
    return result;
  });
}

export async function removeStudioExpert(input: {
  manuscriptId: string;
  expertKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const result = await removeEditorialTeamMember(input);
    if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
    return result;
  });
}

export async function saveStudioExpertNotes(input: {
  manuscriptId: string;
  expertKey: string;
  ownerNotes: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const result = await updateEditorialTeamMemberNotes(input);
    if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
    return result;
  });
}

export async function launchStudioExpertReview(input: {
  manuscriptId: string;
  expertKey: string;
  scope: StudioLaunchScope;
  privateUseAcknowledged: boolean;
  militaryLaunchAckToken?: string;
}): Promise<{ ok: boolean; workflowId?: string; existing?: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    if (isEicPlanGateActive()) {
      const gateCtx = await getManuscriptReviewContext(input.manuscriptId);
      if (!gateCtx?.manuscriptVersionId) {
        return { ok: false, error: "No active manuscript version for EIC plan gate." };
      }
      const gateResult = await evaluatePlanGateForLaunch({
        manuscriptId: input.manuscriptId,
        manuscriptVersionId: gateCtx.manuscriptVersionId,
        expertKeyToLaunch: input.expertKey,
      });
      if (gateBlocksLaunch(gateResult)) {
        return {
          ok: false,
          error: gateResult.allowed ? "EIC plan gate blocked launch." : gateResult.message,
        };
      }
    }

    if (input.expertKey === "military_expert") {
      if (
        !isMilitaryExpertLaunchableInStudio({
          privateUseAcknowledged: input.privateUseAcknowledged,
          launchAcknowledged: validateMilitaryExpertLaunchAckToken(input.militaryLaunchAckToken),
        })
      ) {
        return { ok: false, error: "Military Expert local testing requires explicit confirmation." };
      }

      if (!isStudioMilitaryExpertLocalOverrideEnabled()) {
        return { ok: false, error: "Military Expert is blocked in this environment." };
      }

      if (input.scope !== "full_book") {
        return {
          ok: false,
          error: "Military Expert local testing supports Full Book scope only.",
        };
      }

      const ctx = await getManuscriptReviewContext(input.manuscriptId);
      if (!ctx?.extractedText.trim()) {
        return { ok: false, error: "This manuscript has no extracted text." };
      }

      const result = await startMilitaryExpertStudioWorkflow(input.manuscriptId);
      if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
      return result;
    }

    if (!isExpertLaunchableInStudio(input)) {
      return { ok: false, error: "This expert cannot be launched from Studio yet." };
    }

    if (input.expertKey !== "literary_agent") {
      return { ok: false, error: "Only Literary Agent has a canonical review workflow in K3." };
    }

    if (input.scope !== "full_book") {
      return {
        ok: false,
        error: "Selected chapters and excerpt scopes are not yet supported — use Full Book.",
      };
    }

    const available = await isPublishingWorkflowAvailable();
    if (!available) {
      return {
        ok: false,
        error: "Editorial workflow is not enabled. Set EDITORIAL_WORKFLOW_ENABLED=1.",
      };
    }

    const ctx = await getManuscriptReviewContext(input.manuscriptId);
    if (!ctx?.extractedText.trim()) {
      return { ok: false, error: "This manuscript has no extracted text." };
    }

    const result = await startLiteraryAgentPublishingWorkflow(input.manuscriptId);
    if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
    return result;
  });
}

export async function launchStudioEditorialRound(input: {
  manuscriptId: string;
  expertKeys: readonly string[];
  scope: StudioLaunchScope;
  privateUseAcknowledged: boolean;
}): Promise<{ ok: boolean; workflowId?: string; existing?: boolean; error?: string; launched: readonly string[] }> {
  return guarded(input.manuscriptId, async () => {
    const launchable = input.expertKeys.filter((key) =>
      isExpertLaunchableInStudio({ expertKey: key, privateUseAcknowledged: input.privateUseAcknowledged }),
    );

    if (launchable.length === 0) {
      return {
        ok: false,
        error: "No recruited experts have executable review workflows yet.",
        launched: [],
      };
    }

    const laResult = await launchStudioExpertReview({
      manuscriptId: input.manuscriptId,
      expertKey: "literary_agent",
      scope: input.scope,
      privateUseAcknowledged: input.privateUseAcknowledged,
    });

    return {
      ...laResult,
      launched: laResult.ok ? (["literary_agent"] as const) : [],
    };
  });
}

export async function cancelStudioReview(input: {
  manuscriptId: string;
  workflowId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return guarded(input.manuscriptId, async () => {
    const workflow = await getWorkflowById(input.workflowId);
    const validation = validateStudioWorkflowCancellation({
      workflow,
      workflowId: input.workflowId,
      manuscriptId: input.manuscriptId,
    });
    if (!validation.ok) return validation;

    const result = await cancelEditorialWorkflow(input.workflowId);
    if (result.ok) revalidateStudioExpertRoutes(input.manuscriptId);
    return result;
  });
}

export async function getStudioLaunchContext(manuscriptId: string): Promise<{
  title: string;
  wordCount: number | null;
  versionLabel: string | null;
} | null> {
  return guarded(manuscriptId, async () => {
    const ctx = await getManuscriptReviewContext(manuscriptId);
    if (!ctx) return null;
    const supabase = await import("@/lib/supabase/server.ts").then((m) => m.getSupabaseAdmin());
    const { data } = await supabase
      .from("manuscripts")
      .select("title, current_version_id")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (!data) return null;

    let versionLabel: string | null = null;
    if (data.current_version_id) {
      const { data: version } = await supabase
        .from("manuscript_versions")
        .select("label, version_number")
        .eq("id", data.current_version_id as string)
        .maybeSingle();
      versionLabel =
        (version?.label as string | null) ??
        (version?.version_number ? `v${version.version_number}` : null);
    }

    return {
      title: data.title as string,
      wordCount: ctx.wordCount,
      versionLabel,
    };
  });
}

export async function getStudioWorkflowProgress(
  manuscriptId: string,
): Promise<StudioWorkflowProgressView | null> {
  return guarded(manuscriptId, async () => {
    const [literary, military] = await Promise.all([
      getStudioReviewExecution(manuscriptId, "literary_agent_review"),
      getStudioReviewExecution(manuscriptId, "military_expert_review"),
    ]);
    const base = pickActiveStudioWorkflow(literary, military);
    if (!base) return null;

    const row = await getWorkflowById(base.workflowId);
    if (!row || row.manuscript_id !== manuscriptId) return null;
    const events = await getWorkflowEventsForClient(base.workflowId);
    const endIso = row?.completed_at ?? row?.failed_at ?? row?.cancelled_at ?? null;
    const workflow = Object.freeze({
      ...base,
      elapsed: formatWorkflowElapsed(base.startedAt, endIso),
    });
    const timeline = buildWorkflowProgressTimeline({
      workflowType: base.workflowType,
      status: base.status,
      currentPhase: (base.currentPhase as InternalPhase | null) ?? null,
      isTerminal: base.isTerminal,
      events,
    });
    const activity = buildWorkflowActivityLog(events);

    return Object.freeze({ workflow, timeline, activity });
  });
}
