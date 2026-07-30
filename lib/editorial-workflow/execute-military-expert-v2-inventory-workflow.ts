import "server-only";

import { getManuscriptReviewContext } from "@/lib/reviews";
import {
  getWorkflowById,
  insertWorkflowEvent,
  isTerminalStatus,
  markWorkflowFailed,
  markWorkflowRunning,
  markWorkflowStarted,
  setWorkflowPhase,
  touchWorkflowHeartbeat,
  updateWorkflowRow,
  verifyWorkflowVersionPin,
} from "./workflow-store.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import {
  discoverMilitaryScenes,
  DISCOVERY_PROVIDER_USED_IN_PHASE_1,
} from "@/lib/studio/military-expert-v2/discovery.ts";
import { validateMilitaryExpertInventory } from "@/lib/studio/military-expert-v2/validate-inventory.ts";
import {
  initializeInventorySelections,
  markInventoryReadyForSelection,
  persistMilitaryExpertInventory,
} from "@/lib/studio/military-expert-v2/persistence.ts";

export async function executeMilitaryExpertV2InventoryWorkflow(workflowId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  inventoryId?: string;
}> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    throw new Error("Military Expert V2 scene-centric inventory is not enabled.");
  }

  const workflow = await getWorkflowById(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  if (workflow.workflow_type !== "military_expert_v2_inventory") {
    throw new Error("Unexpected workflow type for Military Expert V2 inventory.");
  }

  if (workflow.status === "completed") {
    const inventoryId =
      typeof workflow.result_summary?.inventory_id === "string"
        ? workflow.result_summary.inventory_id
        : undefined;
    return { ok: true, skipped: true, inventoryId };
  }
  if (isTerminalStatus(workflow.status)) {
    return { ok: false, skipped: true };
  }

  await markWorkflowStarted(workflowId, workflow.attempt_count + 1);
  await markWorkflowRunning(workflowId);
  await setWorkflowPhase(workflowId, "preparing");

  const pin = await verifyWorkflowVersionPin(workflow);
  if (!pin.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: pin.errorCode,
      safeErrorMessage: safeErrorForCode(pin.errorCode),
    });
    return { ok: false };
  }

  const ctx = await getManuscriptReviewContext(workflow.manuscript_id);
  if (!ctx?.extractedText.trim() || !ctx.manuscriptVersionId || !ctx.contentHash) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Manuscript context unavailable."),
    });
    return { ok: false };
  }

  await insertWorkflowEvent({
    workflowId,
    eventType: "v2_inventory_discovery_started",
    phase: "preparing",
    payload: { provider_used: DISCOVERY_PROVIDER_USED_IN_PHASE_1 },
  });
  await touchWorkflowHeartbeat(workflowId);

  const inventoryId =
    typeof workflow.result_summary?.inventory_id === "string"
      ? workflow.result_summary.inventory_id
      : `inv_${workflowId.replace(/-/g, "").slice(0, 32)}`;

  let document = discoverMilitaryScenes({
    inventoryId,
    manuscriptId: workflow.manuscript_id,
    manuscriptVersionId: ctx.manuscriptVersionId,
    workflowId,
    text: ctx.extractedText,
    contentHash: ctx.contentHash,
    mode: "author",
  });

  const validation = validateMilitaryExpertInventory(document, ctx.extractedText.length);
  if (!validation.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "INVENTORY_VALIDATION_FAILED",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        "Military scene inventory could not be validated.",
      ),
    });
    return { ok: false };
  }

  document = Object.freeze({
    ...document,
    inventory_status: "ready_for_selection" as const,
    workflow_id: workflowId,
  });

  const persistResult = await persistMilitaryExpertInventory({
    document,
    contentHash: ctx.contentHash,
    inventoryStatus: "ready_for_selection",
  });
  if (!persistResult.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", persistResult.error),
    });
    return { ok: false };
  }

  const initSelections = await initializeInventorySelections(document);
  if (!initSelections.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", initSelections.error),
    });
    return { ok: false };
  }

  await markInventoryReadyForSelection(inventoryId);

  await updateWorkflowRow(workflowId, {
    result_summary: {
      inventory_id: inventoryId,
      scene_count: document.scene_count,
      major_scene_count: document.major_scene_count,
      provider_used: DISCOVERY_PROVIDER_USED_IN_PHASE_1,
      phase: "ready_for_selection",
    },
    progress_summary: "Military scene inventory ready for author selection",
  });

  const completedAt = new Date().toISOString();
  await updateWorkflowRow(workflowId, {
    status: "completed",
    current_phase: "completed",
    progress_summary: "Military scene inventory ready for author selection",
    result_summary: {
      inventory_id: inventoryId,
      scene_count: document.scene_count,
      major_scene_count: document.major_scene_count,
      provider_used: DISCOVERY_PROVIDER_USED_IN_PHASE_1,
      next_action: "author_selection",
    },
    completed_at: completedAt,
    heartbeat_at: completedAt,
    safe_error_message: null,
    error_code: null,
  });
  await insertWorkflowEvent({
    workflowId,
    eventType: "completed",
    phase: "completed",
    payload: {
      inventory_id: inventoryId,
      scene_count: document.scene_count,
      next_action: "author_selection",
    },
  });

  await insertWorkflowEvent({
    workflowId,
    eventType: "v2_inventory_ready_for_selection",
    phase: "completed",
    payload: {
      inventory_id: inventoryId,
      scene_count: document.scene_count,
    },
  });

  return { ok: true, inventoryId };
}
