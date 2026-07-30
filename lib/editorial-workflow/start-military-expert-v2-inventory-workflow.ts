import "server-only";

import { randomUUID } from "node:crypto";
import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import {
  createWorkflowRow,
  getActiveWorkflowForManuscript,
  linkTriggerRun,
  markWorkflowFailed,
} from "./workflow-store.ts";
import { newWorkflowIdempotencyKey, isUniqueViolation } from "./idempotency.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { triggerMilitaryExpertV2InventoryTask } from "./trigger-client.ts";
import { workflowMetadataForType } from "./workflow-definitions.ts";
import type { WorkflowInputSnapshot } from "./types.ts";
import { MILITARY_EXPERT_V2_INVENTORY_DEFINITION_VERSION } from "./types.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";

export interface StartMilitaryExpertV2InventoryResult {
  ok: boolean;
  workflowId?: string;
  inventoryId?: string;
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
    workflowPurpose: "military_expert_v2_inventory",
    participatingExperts: ["Military Expert"],
    reviewerDefinitionId: "military_expert",
    editorialDecisionLogEnabled: false,
    authorGuidancePauseSupported: false,
    nextBestActionOnCompletion: true,
  };
}

export async function startMilitaryExpertV2InventoryWorkflow(
  manuscriptId: string,
): Promise<StartMilitaryExpertV2InventoryResult> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return {
      ok: false,
      error: "Military Expert V2 scene-centric inventory is not enabled.",
    };
  }
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const existing = await getActiveWorkflowForManuscript({
    manuscriptId,
    workflowType: "military_expert_v2_inventory",
  });
  if (existing) {
    const inventoryId =
      typeof existing.result_summary?.inventory_id === "string"
        ? existing.result_summary.inventory_id
        : undefined;
    return { ok: true, workflowId: existing.id, inventoryId, existing: true };
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
  const inventoryId = `inv_${randomUUID()}`;

  let workflow;
  try {
    workflow = await createWorkflowRow({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      contentHash: ctx.contentHash,
      workflowType: "military_expert_v2_inventory",
      workflowDefinitionVersion: MILITARY_EXPERT_V2_INVENTORY_DEFINITION_VERSION,
      idempotencyKey,
      inputSnapshot: buildInputSnapshot({
        title: meta?.title ?? "Manuscript",
        wordCount: ctx.wordCount,
        characterCount: ctx.characterCount,
      }),
      metadata: workflowMetadataForType("military_expert_v2_inventory"),
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const active = await getActiveWorkflowForManuscript({
        manuscriptId,
        workflowType: "military_expert_v2_inventory",
      });
      if (active) {
        const inventoryId =
          typeof active.result_summary?.inventory_id === "string"
            ? active.result_summary.inventory_id
            : undefined;
        return { ok: true, workflowId: active.id, inventoryId, existing: true };
      }
    }
    throw e;
  }

  const triggerResult = await triggerMilitaryExpertV2InventoryTask(workflow.id);
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

  return { ok: true, workflowId: workflow.id, inventoryId, existing: false };
}
