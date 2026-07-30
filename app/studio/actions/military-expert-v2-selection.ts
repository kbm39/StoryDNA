"use server";

import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/lib/studio/access.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import {
  getConfirmedSnapshot,
  loadInventoryById,
  loadInventorySelections,
  newSelectionSnapshotId,
  persistConfirmedSnapshot,
  updateInventorySelections,
} from "@/lib/studio/military-expert-v2/persistence.ts";
import {
  applyBulkAction,
  buildSelectionSnapshot,
  canConfirmSelection,
  computeActiveWarnings,
  defaultSelectionSource,
} from "@/lib/studio/military-expert-v2/selection-policy.ts";
import { estimateSceneReviewCost, estimateSelectionTotals } from "@/lib/studio/military-expert-v2/estimator.ts";
import type { MilitaryExpertSceneSelectionEntry } from "@/lib/studio/military-expert-v2/contracts.ts";
import { startMilitaryExpertV2InventoryWorkflow } from "@/lib/editorial-workflow/start-military-expert-v2-inventory-workflow.ts";

function revalidateInventoryRoutes(manuscriptId: string, inventoryId: string) {
  revalidatePath(`/studio/books/${manuscriptId}/experts`);
  revalidatePath(`/studio/books/${manuscriptId}/experts/military-expert/inventory/${inventoryId}`);
}

export async function launchMilitaryExpertV2Inventory(input: {
  manuscriptId: string;
}): Promise<{ ok: boolean; workflowId?: string; inventoryId?: string; error?: string }> {
  await requireStudioAccess(`/studio/books/${input.manuscriptId}/experts`);
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 inventory is not enabled." };
  }
  const result = await startMilitaryExpertV2InventoryWorkflow(input.manuscriptId);
  if (result.ok) revalidatePath(`/studio/books/${input.manuscriptId}/experts`);
  return result;
}

export async function updateMilitaryExpertV2Selection(input: {
  manuscriptId: string;
  inventoryId: string;
  sceneId: string;
  isSelected: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  await requireStudioAccess(
    `/studio/books/${input.manuscriptId}/experts/military-expert/inventory/${input.inventoryId}`,
  );
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 is not enabled." };
  }

  const confirmed = await getConfirmedSnapshot(input.inventoryId);
  if (confirmed?.immutable) {
    return { ok: false, error: "Selection is confirmed and cannot be changed." };
  }

  const inventory = await loadInventoryById(input.inventoryId);
  if (!inventory || inventory.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "Inventory not found." };
  }
  if (inventory.inventory_status !== "ready_for_selection") {
    return { ok: false, error: "Inventory is not ready for selection." };
  }

  const scene = inventory.scenes.find((s) => s.scene_id === input.sceneId);
  if (!scene) return { ok: false, error: "Scene not found." };

  if (inventory.mode === "certification" && scene.priority_tier === "major" && !input.isSelected) {
    return { ok: false, error: "Major scenes are required in Certification Mode." };
  }

  const selections = await loadInventorySelections(input.inventoryId);
  const est = estimateSceneReviewCost(scene);
  const updated: MilitaryExpertSceneSelectionEntry = Object.freeze({
    inventory_id: input.inventoryId,
    scene_id: input.sceneId,
    is_selected: input.isSelected,
    selection_source: defaultSelectionSource(scene, inventory.mode, input.isSelected),
    selected_at: input.isSelected ? new Date().toISOString() : null,
    warning_acknowledged: false,
    estimated_input_tokens: est.inputTokens,
    estimated_output_tokens: est.outputTokens,
    estimated_cost_usd: est.costUsd,
    estimated_runtime_seconds: est.runtimeSeconds,
  });

  const next = selections.map((sel) => (sel.scene_id === input.sceneId ? updated : sel));
  const result = await updateInventorySelections(input.inventoryId, next);
  if (result.ok) revalidateInventoryRoutes(input.manuscriptId, input.inventoryId);
  return result;
}

export async function bulkUpdateMilitaryExpertV2Selection(input: {
  manuscriptId: string;
  inventoryId: string;
  action: "review_all" | "restore_recommended" | "clear_optional";
}): Promise<{ ok: boolean; error?: string }> {
  await requireStudioAccess(
    `/studio/books/${input.manuscriptId}/experts/military-expert/inventory/${input.inventoryId}`,
  );
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 is not enabled." };
  }

  const confirmed = await getConfirmedSnapshot(input.inventoryId);
  if (confirmed?.immutable) {
    return { ok: false, error: "Selection is confirmed and cannot be changed." };
  }

  const inventory = await loadInventoryById(input.inventoryId);
  if (!inventory || inventory.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "Inventory not found." };
  }

  const selections = await loadInventorySelections(input.inventoryId);
  const next = applyBulkAction(inventory.scenes, selections, input.action, inventory.mode);
  const result = await updateInventorySelections(input.inventoryId, next);
  if (result.ok) revalidateInventoryRoutes(input.manuscriptId, input.inventoryId);
  return result;
}

export async function confirmMilitaryExpertV2Selection(input: {
  manuscriptId: string;
  inventoryId: string;
  warningsAcknowledged: boolean;
}): Promise<{ ok: boolean; snapshotId?: string; error?: string }> {
  await requireStudioAccess(
    `/studio/books/${input.manuscriptId}/experts/military-expert/inventory/${input.inventoryId}`,
  );
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return { ok: false, error: "Military Expert V2 is not enabled." };
  }

  const existing = await getConfirmedSnapshot(input.inventoryId);
  if (existing?.immutable) {
    return { ok: false, error: "Selection is already confirmed." };
  }

  const inventory = await loadInventoryById(input.inventoryId);
  if (!inventory || inventory.manuscript_id !== input.manuscriptId) {
    return { ok: false, error: "Inventory not found." };
  }

  const selections = await loadInventorySelections(input.inventoryId);
  const warnings = computeActiveWarnings(inventory.scenes, selections);
  const confirmCheck = canConfirmSelection(selections, warnings, input.warningsAcknowledged);
  if (!confirmCheck.ok) {
    return { ok: false, error: confirmCheck.reason ?? "Cannot confirm selection." };
  }

  const selectedIds = new Set(selections.filter((s) => s.is_selected).map((s) => s.scene_id));
  const totals = estimateSelectionTotals(inventory.scenes, selectedIds);
  if (totals.exceedsBudget) {
    return { ok: false, error: "Selection exceeds Studio budget." };
  }

  const snapshot = buildSelectionSnapshot({
    snapshotId: newSelectionSnapshotId(),
    inventoryId: input.inventoryId,
    manuscriptId: input.manuscriptId,
    manuscriptVersionId: inventory.manuscript_version_id,
    mode: inventory.mode,
    scenes: inventory.scenes,
    selections,
    immutable: true,
    confirmedAt: new Date().toISOString(),
    confirmedBy: inventory.mode === "certification" ? "system_certification" : "author",
  });

  const result = await persistConfirmedSnapshot(snapshot);
  if (!result.ok) return result;
  revalidateInventoryRoutes(input.manuscriptId, input.inventoryId);
  return { ok: true, snapshotId: snapshot.selection_snapshot_id };
}
