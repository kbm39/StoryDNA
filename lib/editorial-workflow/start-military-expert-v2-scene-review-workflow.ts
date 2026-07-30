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
import { triggerMilitaryExpertV2SceneReviewTask } from "./trigger-client.ts";
import { workflowMetadataForType } from "./workflow-definitions.ts";
import {
  MILITARY_EXPERT_V2_SCENE_REVIEW_DEFINITION_VERSION,
  type WorkflowInputSnapshot,
} from "./types.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import {
  buildPhase2AWorkflowInputSnapshot,
  validatePhase2AHandoff,
} from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface StartMilitaryExpertV2SceneReviewResult {
  ok: boolean;
  workflowId?: string;
  existing?: boolean;
  error?: string;
}

export async function startMilitaryExpertV2SceneReviewWorkflow(input: {
  selectionSnapshotId: string;
}): Promise<StartMilitaryExpertV2SceneReviewResult> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 scene review is not enabled." };
  }

  const handoff = await validatePhase2AHandoff({
    selectionSnapshotId: input.selectionSnapshotId,
    requirePinnedSnapshot: false,
  });
  if (!handoff.ok || !handoff.inventory || !handoff.selectedSceneIds) {
    return { ok: false, error: handoff.errorMessage ?? "Handoff validation failed." };
  }

  const supabase = getSupabaseAdmin();
  const { data: existingWorkflow } = await supabase
    .from("editorial_workflows")
    .select("*")
    .eq("workflow_type", "military_expert_v2_scene_review")
    .contains("input_snapshot", { phase2a: { selectionSnapshotId: input.selectionSnapshotId } })
    .not("status", "in", '("failed","cancelled")')
    .maybeSingle();

  if (existingWorkflow && existingWorkflow.status !== "completed") {
    return { ok: true, workflowId: existingWorkflow.id, existing: true };
  }

  const manuscriptId = handoff.inventory.manuscript_id;
  const existing = await getActiveWorkflowForManuscript({
    manuscriptId,
    workflowType: "military_expert_v2_scene_review",
  });
  if (existing) {
    const snapId = existing.input_snapshot.phase2a?.selectionSnapshotId;
    if (snapId === input.selectionSnapshotId) {
      return { ok: true, workflowId: existing.id, existing: true };
    }
  }

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim() || !ctx.manuscriptVersionId || !ctx.contentHash) {
    return { ok: false, error: "Manuscript context unavailable." };
  }

  const meta = await getManuscriptMeta(manuscriptId);
  const idempotencyKey = newWorkflowIdempotencyKey();

  const inputSnapshot = buildPhase2AWorkflowInputSnapshot({
    selectionSnapshotId: input.selectionSnapshotId,
    inventoryId: handoff.inventory.inventory_id,
    manuscriptId,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    selectedSceneIds: handoff.selectedSceneIds,
    title: meta?.title ?? "Manuscript",
    wordCount: ctx.wordCount,
    characterCount: ctx.characterCount,
  }) as WorkflowInputSnapshot;

  let workflow;
  try {
    workflow = await createWorkflowRow({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      contentHash: ctx.contentHash,
      workflowType: "military_expert_v2_scene_review",
      workflowDefinitionVersion: MILITARY_EXPERT_V2_SCENE_REVIEW_DEFINITION_VERSION,
      idempotencyKey,
      inputSnapshot,
      metadata: workflowMetadataForType("military_expert_v2_scene_review"),
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const active = await getActiveWorkflowForManuscript({
        manuscriptId,
        workflowType: "military_expert_v2_scene_review",
      });
      if (active) return { ok: true, workflowId: active.id, existing: true };
    }
    throw e;
  }

  const triggerResult = await triggerMilitaryExpertV2SceneReviewTask(workflow.id);
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
