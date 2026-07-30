/**
 * Phase 2A handoff validation — pins confirmed snapshot and selected scenes.
 */

import "server-only";

import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { parseMilitaryExpertSelectionSnapshot } from "./contracts.ts";
import {
  loadInventoryById,
  loadInventorySelections,
} from "./persistence.ts";
import { estimateSelectionTotals } from "./estimator.ts";
import {
  estimatePhase2ASceneReviewBudget,
} from "./scene-review-budget.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Pinned Phase 2A calibration snapshot — must match exactly. */
export const PHASE2A_PINNED_SELECTION_SNAPSHOT_ID =
  "snap_a5c75c94-be71-4b6c-9582-3d6c0fe34fa1" as const;

export const PHASE2A_PINNED_INVENTORY_ID =
  "inv_bf3a4ec574ba4d828a448d423e73321b" as const;

export const PHASE2A_PINNED_MANUSCRIPT_ID =
  "e63c07fa-634d-4d32-8052-6194ff965d91" as const;

export const PHASE2A_PINNED_MANUSCRIPT_VERSION_ID =
  "9f4c834c-bccd-4932-bd27-24051a90d779" as const;

export const PHASE2A_PINNED_SELECTED_SCENE_IDS: readonly string[] = Object.freeze([
  "ME-S-001",
  "ME-S-002",
  "ME-S-008",
  "ME-S-010",
  "ME-S-011",
  "ME-S-012",
  "ME-S-015",
  "ME-S-016",
  "ME-S-017",
  "ME-S-018",
  "ME-S-019",
  "ME-S-020",
]);

export interface Phase2AHandoffValidationResult {
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly inventory?: MilitaryExpertSceneInventoryDocument;
  readonly selectionSnapshotId?: string;
  readonly selectedSceneIds?: readonly string[];
  readonly estimatedBudgetUsd?: number;
}

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

export function validatePinnedSceneIds(selectedSceneIds: readonly string[]): boolean {
  const expected = sortedIds(PHASE2A_PINNED_SELECTED_SCENE_IDS);
  const actual = sortedIds(selectedSceneIds);
  if (expected.length !== actual.length) return false;
  return expected.every((id, i) => id === actual[i]);
}

export async function loadSnapshotById(snapshotId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_selection_snapshots")
    .select("*")
    .eq("selection_snapshot_id", snapshotId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function validatePhase2AHandoff(input: {
  selectionSnapshotId: string;
  requirePinnedSnapshot?: boolean;
}): Promise<Phase2AHandoffValidationResult> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    return {
      ok: false,
      errorCode: "FEATURE_DISABLED",
      errorMessage: "Military Expert V2 scene review is not enabled.",
    };
  }

  if (input.requirePinnedSnapshot && input.selectionSnapshotId !== PHASE2A_PINNED_SELECTION_SNAPSHOT_ID) {
    return {
      ok: false,
      errorCode: "SNAPSHOT_PIN_MISMATCH",
      errorMessage: `Expected pinned snapshot ${PHASE2A_PINNED_SELECTION_SNAPSHOT_ID}.`,
    };
  }

  const row = await loadSnapshotById(input.selectionSnapshotId);
  if (!row) {
    return {
      ok: false,
      errorCode: "SNAPSHOT_NOT_FOUND",
      errorMessage: "Selection snapshot not found.",
    };
  }

  if (!row.immutable || !row.confirmed_at) {
    return {
      ok: false,
      errorCode: "SNAPSHOT_NOT_IMMUTABLE",
      errorMessage: "Selection snapshot is not confirmed and immutable.",
    };
  }

  const snapshot = parseMilitaryExpertSelectionSnapshot(row.snapshot_payload);
  if (!snapshot) {
    return {
      ok: false,
      errorCode: "SNAPSHOT_PARSE_FAILED",
      errorMessage: "Selection snapshot payload is invalid.",
    };
  }

  const inventoryId = String(row.inventory_id);
  const inventory = await loadInventoryById(inventoryId);
  if (!inventory) {
    return {
      ok: false,
      errorCode: "INVENTORY_NOT_FOUND",
      errorMessage: "Inventory not found.",
    };
  }

  if (inventory.inventory_status === "superseded") {
    return {
      ok: false,
      errorCode: "INVENTORY_SUPERSEDED",
      errorMessage: "Inventory has been superseded.",
    };
  }

  if (inventory.inventory_status !== "ready_for_selection") {
    return {
      ok: false,
      errorCode: "INVENTORY_NOT_READY",
      errorMessage: "Inventory is not ready for scene review.",
    };
  }

  if (String(row.manuscript_id) !== inventory.manuscript_id) {
    return {
      ok: false,
      errorCode: "MANUSCRIPT_MISMATCH",
      errorMessage: "Snapshot manuscript does not match inventory.",
    };
  }

  if (String(row.manuscript_version_id) !== inventory.manuscript_version_id) {
    return {
      ok: false,
      errorCode: "VERSION_MISMATCH",
      errorMessage: "Snapshot manuscript version does not match inventory.",
    };
  }

  const selectedSceneIds = snapshot.selections
    .filter((s) => s.is_selected)
    .map((s) => s.scene_id);

  if (selectedSceneIds.length !== 12) {
    return {
      ok: false,
      errorCode: "SELECTED_COUNT_MISMATCH",
      errorMessage: `Expected 12 selected scenes, found ${selectedSceneIds.length}.`,
    };
  }

  if (input.requirePinnedSnapshot && !validatePinnedSceneIds(selectedSceneIds)) {
    return {
      ok: false,
      errorCode: "SELECTED_SCENES_MISMATCH",
      errorMessage: "Selected scene IDs do not match pinned Phase 2A list.",
    };
  }

  const inventorySceneIds = new Set(inventory.scenes.map((s) => s.scene_id));
  for (const sceneId of selectedSceneIds) {
    if (!inventorySceneIds.has(sceneId)) {
      return {
        ok: false,
        errorCode: "UNKNOWN_SCENE_ID",
        errorMessage: `Scene ${sceneId} is not in inventory.`,
      };
    }
  }

  const selections = await loadInventorySelections(inventoryId);
  const dbSelected = selections.filter((s) => s.is_selected).map((s) => s.scene_id);
  if (!validatePinnedSceneIds(dbSelected) && input.requirePinnedSnapshot) {
    return {
      ok: false,
      errorCode: "DB_SELECTION_MISMATCH",
      errorMessage: "Database selections do not match pinned scene list.",
    };
  }

  const totals = estimateSelectionTotals(inventory.scenes, new Set(selectedSceneIds));
  const phase2Budget = estimatePhase2ASceneReviewBudget(selectedSceneIds.length);
  if (phase2Budget.exceedsBudget) {
    return {
      ok: false,
      errorCode: "BUDGET_EXCEEDED",
      errorMessage: "Estimated scene review cost exceeds Studio budget.",
    };
  }

  if (input.requirePinnedSnapshot) {
    if (inventoryId !== PHASE2A_PINNED_INVENTORY_ID) {
      return {
        ok: false,
        errorCode: "INVENTORY_PIN_MISMATCH",
        errorMessage: "Inventory ID does not match pinned Phase 2A inventory.",
      };
    }
    if (inventory.manuscript_id !== PHASE2A_PINNED_MANUSCRIPT_ID) {
      return {
        ok: false,
        errorCode: "MANUSCRIPT_PIN_MISMATCH",
        errorMessage: "Manuscript ID does not match pinned Phase 2A manuscript.",
      };
    }
    if (inventory.manuscript_version_id !== PHASE2A_PINNED_MANUSCRIPT_VERSION_ID) {
      return {
        ok: false,
        errorCode: "VERSION_PIN_MISMATCH",
        errorMessage: "Manuscript version does not match pinned Phase 2A version.",
      };
    }
  }

  return Object.freeze({
    ok: true,
    inventory,
    selectionSnapshotId: input.selectionSnapshotId,
    selectedSceneIds: Object.freeze([...selectedSceneIds]),
    estimatedBudgetUsd: phase2Budget.totalReservationUsd,
  });
}

export function buildPhase2AWorkflowInputSnapshot(args: {
  selectionSnapshotId: string;
  inventoryId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  selectedSceneIds: readonly string[];
  title: string;
  wordCount: number | null;
  characterCount: number | null;
}) {
  return {
    manuscriptTitle: args.title,
    wordCount: args.wordCount,
    characterCount: args.characterCount,
    workflowOwner: "StoryDNA" as const,
    workflowPurpose: "military_expert_v2_scene_review" as const,
    participatingExperts: ["Military Expert"],
    reviewerDefinitionId: "military_expert",
    editorialDecisionLogEnabled: false,
    authorGuidancePauseSupported: false,
    nextBestActionOnCompletion: true,
    phase2a: {
      selectionSnapshotId: args.selectionSnapshotId,
      inventoryId: args.inventoryId,
      manuscriptId: args.manuscriptId,
      manuscriptVersionId: args.manuscriptVersionId,
      selectedSceneIds: [...args.selectedSceneIds],
    },
  };
}
