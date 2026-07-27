import "server-only";

import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import {
  createWorkflowRow,
  getActiveWorkflowForManuscript,
  linkTriggerRun,
  markWorkflowFailed,
} from "./workflow-store.ts";
import { newWorkflowIdempotencyKey, isUniqueViolation } from "./idempotency.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { triggerMilitaryExpertReviewTask } from "./trigger-client.ts";
import { workflowMetadataForType } from "./workflow-definitions.ts";
import {
  MILITARY_EXPERT_STUDIO_DEFINITION_VERSION,
  type WorkflowInputSnapshot,
} from "./types.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";

export interface StartMilitaryExpertWorkflowResult {
  ok: boolean;
  workflowId?: string;
  existing?: boolean;
  error?: string;
}

function buildInputSnapshot(args: {
  title: string;
  wordCount: number | null;
  characterCount: number | null;
}): WorkflowInputSnapshot {
  return {
    manuscriptTitle: args.title,
    wordCount: args.wordCount,
    characterCount: args.characterCount,
    workflowOwner: "StoryDNA",
    workflowPurpose: "military_expert_review",
    participatingExperts: ["Military Expert"],
    reviewerDefinitionId: "military_expert",
    editorialDecisionLogEnabled: false,
    authorGuidancePauseSupported: false,
    nextBestActionOnCompletion: true,
  };
}

export async function startMilitaryExpertStudioWorkflow(
  manuscriptId: string,
): Promise<StartMilitaryExpertWorkflowResult> {
  if (!isStudioMilitaryExpertLocalOverrideEnabled()) {
    return { ok: false, error: "Military Expert local Studio override is not enabled." };
  }
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const existing = await getActiveWorkflowForManuscript({
    manuscriptId,
    workflowType: "military_expert_review",
  });
  if (existing) {
    return { ok: true, workflowId: existing.id, existing: true };
  }

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }
  if (!ctx.manuscriptVersionId || !ctx.contentHash) {
    return { ok: false, error: "This manuscript has no version snapshot for workflow execution." };
  }

  const meta = await getManuscriptMeta(manuscriptId);
  const idempotencyKey = newWorkflowIdempotencyKey();

  let workflow;
  try {
    workflow = await createWorkflowRow({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      contentHash: ctx.contentHash,
      workflowType: "military_expert_review",
      workflowDefinitionVersion: MILITARY_EXPERT_STUDIO_DEFINITION_VERSION,
      idempotencyKey,
      inputSnapshot: buildInputSnapshot({
        title: meta?.title ?? "Manuscript",
        wordCount: ctx.wordCount,
        characterCount: ctx.characterCount,
      }),
      metadata: workflowMetadataForType("military_expert_review"),
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const active = await getActiveWorkflowForManuscript({
        manuscriptId,
        workflowType: "military_expert_review",
      });
      if (active) return { ok: true, workflowId: active.id, existing: true };
    }
    throw e;
  }

  const triggerResult = await triggerMilitaryExpertReviewTask(workflow.id);
  if (!triggerResult.ok) {
    await markWorkflowFailed({
      workflowId: workflow.id,
      errorCode: "TRIGGER_UNAVAILABLE",
      safeErrorMessage: safeErrorForCode("TRIGGER_UNAVAILABLE"),
    });
    return { ok: false, error: safeErrorForCode("TRIGGER_UNAVAILABLE") };
  }

  if (triggerResult.runId) {
    await linkTriggerRun(workflow.id, triggerResult.runId);
  }

  return { ok: true, workflowId: workflow.id, existing: false };
}
