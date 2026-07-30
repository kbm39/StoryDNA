"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import { startMilitaryExpertV2SceneReviewWorkflow } from "@/lib/editorial-workflow/start-military-expert-v2-scene-review-workflow.ts";
import { validatePhase2AHandoff } from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { estimatePhase2ASceneReviewBudget } from "@/lib/studio/military-expert-v2/scene-review-budget.ts";
import { loadInventoryById } from "@/lib/studio/military-expert-v2/persistence.ts";

export async function launchMilitaryExpertV2SceneReview(input: {
  manuscriptId: string;
  selectionSnapshotId: string;
}): Promise<{
  ok: boolean;
  workflowId?: string;
  error?: string;
  budgetEstimate?: ReturnType<typeof estimatePhase2ASceneReviewBudget>;
}> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/experts`);
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

  if (handoff.inventory.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "Manuscript mismatch." };
  }

  const selectedScenes = handoff.inventory.scenes.filter((s) =>
    handoff.selectedSceneIds!.includes(s.scene_id),
  );
  const budgetEstimate = estimatePhase2ASceneReviewBudget(
    selectedScenes.length,
    selectedScenes,
  );

  const result = await startMilitaryExpertV2SceneReviewWorkflow({
    selectionSnapshotId: input.selectionSnapshotId,
  });

  if (result.ok) {
    revalidatePath(
      `/studio/books/${input.manuscriptId}/experts/military-expert/scene-reviews/${input.selectionSnapshotId}`,
    );
    revalidatePath(`/studio/books/${input.manuscriptId}/experts`);
  }

  return { ...result, budgetEstimate };
}

export async function getMilitaryExpertV2SceneReviewBudget(input: {
  selectionSnapshotId: string;
}): Promise<{
  ok: boolean;
  estimate?: ReturnType<typeof estimatePhase2ASceneReviewBudget>;
  error?: string;
}> {
  const handoff = await validatePhase2AHandoff({
    selectionSnapshotId: input.selectionSnapshotId,
    requirePinnedSnapshot: false,
  });
  if (!handoff.ok || !handoff.inventory || !handoff.selectedSceneIds) {
    return { ok: false, error: handoff.errorMessage };
  }

  const selectedScenes = handoff.inventory.scenes.filter((s) =>
    handoff.selectedSceneIds!.includes(s.scene_id),
  );
  return {
    ok: true,
    estimate: estimatePhase2ASceneReviewBudget(selectedScenes.length, selectedScenes),
  };
}

export async function loadSceneReviewLaunchContext(input: {
  inventoryId: string;
}) {
  const inventory = await loadInventoryById(input.inventoryId);
  return inventory;
}
