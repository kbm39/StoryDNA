import type {
  MilitaryExpertSceneInventoryEntry,
  MilitaryExpertSceneSelectionEntry,
  MilitaryExpertSelectionSnapshot,
  MilitaryExpertSelectionSource,
  MilitaryExpertSelectionWarningCode,
} from "./contracts.ts";

export const MILITARY_EXPERT_WARNING_COPY: Readonly<
  Record<MilitaryExpertSelectionWarningCode, string>
> = Object.freeze({
  no_firefights_selected:
    "You have not selected any identified firefights. Your Military Expert report will not assess firefight realism.",
  no_breach_or_entry_selected:
    "You have not selected any breach or room-entry scenes. Your report will not evaluate entry tactics or room-clearing realism.",
  no_major_scenes_selected:
    "You have not selected any major military scenes. The detailed review will not assess your most significant tactical sequences.",
  casualty_under_fire_not_selected:
    "You have not selected any casualty-under-fire scenes. Medical and evacuation realism during contact will not be reviewed.",
  aviation_not_selected:
    "You have not selected any aviation scenes. Insertion, extraction, and air mobility realism will not be reviewed.",
  convoy_contact_not_selected:
    "You have not selected any convoy or vehicle-contact scenes. Movement security and ambush response will not be reviewed.",
  major_scene_deselected:
    "This is a major military scene. If you leave it unselected, StoryDNA will not review its tactical authenticity in detail.",
});

export const MILITARY_EXPERT_WARNING_SUMMARY_COPY =
  "Some important scene types are not selected. You can continue, but those topics will not appear in detailed findings.";

export function defaultSelectedForScene(
  scene: MilitaryExpertSceneInventoryEntry,
  mode: "author" | "certification",
): boolean {
  if (mode === "certification") {
    if (scene.priority_tier === "major") return true;
    if (scene.priority_tier === "moderate") return true;
    return false;
  }
  return scene.priority_tier === "major";
}

export function defaultSelectionSource(
  scene: MilitaryExpertSceneInventoryEntry,
  mode: "author" | "certification",
  isSelected: boolean,
): MilitaryExpertSelectionSource {
  if (mode === "certification" && scene.priority_tier === "major" && isSelected) {
    return "certification_required";
  }
  if (isSelected && defaultSelectedForScene(scene, mode)) {
    return "system_default";
  }
  if (isSelected) return "author_selected";
  return "author_deselected";
}

export function buildInitialSelections(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  mode: "author" | "certification",
  estimateScene: (scene: MilitaryExpertSceneInventoryEntry) => {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    runtimeSeconds: number;
  },
): MilitaryExpertSceneSelectionEntry[] {
  return scenes.map((scene) => {
    const isSelected = defaultSelectedForScene(scene, mode);
    const est = estimateScene(scene);
    return Object.freeze({
      inventory_id: scene.inventory_id,
      scene_id: scene.scene_id,
      is_selected: isSelected,
      selection_source: defaultSelectionSource(scene, mode, isSelected),
      selected_at: isSelected ? new Date().toISOString() : null,
      warning_acknowledged: false,
      estimated_input_tokens: est.inputTokens,
      estimated_output_tokens: est.outputTokens,
      estimated_cost_usd: est.costUsd,
      estimated_runtime_seconds: est.runtimeSeconds,
    });
  });
}

function inventoryHasType(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  types: readonly string[],
): boolean {
  return scenes.some((scene) => scene.scene_types.some((t) => types.includes(t)));
}

function anySelectedWithType(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  selections: readonly MilitaryExpertSceneSelectionEntry[],
  types: readonly string[],
): boolean {
  const selected = new Set(selections.filter((s) => s.is_selected).map((s) => s.scene_id));
  return scenes.some(
    (scene) =>
      selected.has(scene.scene_id) && scene.scene_types.some((t) => types.includes(t)),
  );
}

export function computeActiveWarnings(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  selections: readonly MilitaryExpertSceneSelectionEntry[],
): MilitaryExpertSelectionWarningCode[] {
  const warnings: MilitaryExpertSelectionWarningCode[] = [];
  const selectedIds = new Set(selections.filter((s) => s.is_selected).map((s) => s.scene_id));

  if (inventoryHasType(scenes, ["firefight", "battle"]) && !anySelectedWithType(scenes, selections, ["firefight", "battle"])) {
    warnings.push("no_firefights_selected");
  }
  if (
    inventoryHasType(scenes, ["breach", "room_entry"]) &&
    !anySelectedWithType(scenes, selections, ["breach", "room_entry"])
  ) {
    warnings.push("no_breach_or_entry_selected");
  }
  if (scenes.some((s) => s.priority_tier === "major") && !scenes.some((s) => s.priority_tier === "major" && selectedIds.has(s.scene_id))) {
    warnings.push("no_major_scenes_selected");
  }
  if (
    inventoryHasType(scenes, ["casualty_under_fire"]) &&
    !anySelectedWithType(scenes, selections, ["casualty_under_fire"])
  ) {
    warnings.push("casualty_under_fire_not_selected");
  }
  if (
    inventoryHasType(scenes, ["aviation_insertion", "aviation_extraction"]) &&
    !anySelectedWithType(scenes, selections, ["aviation_insertion", "aviation_extraction"])
  ) {
    warnings.push("aviation_not_selected");
  }
  if (
    inventoryHasType(scenes, ["convoy", "vehicle_contact"]) &&
    !anySelectedWithType(scenes, selections, ["convoy", "vehicle_contact"])
  ) {
    warnings.push("convoy_contact_not_selected");
  }

  return warnings;
}

export function perSceneWarnings(
  scene: MilitaryExpertSceneInventoryEntry,
  isSelected: boolean,
): MilitaryExpertSelectionWarningCode[] {
  if (scene.priority_tier === "major" && !isSelected) {
    return ["major_scene_deselected"];
  }
  return [];
}

export function applyBulkAction(
  scenes: readonly MilitaryExpertSceneInventoryEntry[],
  selections: readonly MilitaryExpertSceneSelectionEntry[],
  action: "review_all" | "restore_recommended" | "clear_optional",
  mode: "author" | "certification",
): MilitaryExpertSceneSelectionEntry[] {
  const sceneById = new Map(scenes.map((s) => [s.scene_id, s]));
  return selections.map((sel) => {
    const scene = sceneById.get(sel.scene_id);
    if (!scene) return sel;

    if (mode === "certification" && scene.priority_tier === "major") {
      return Object.freeze({ ...sel, is_selected: true, selection_source: "certification_required" as const });
    }

    let isSelected = sel.is_selected;
    if (action === "review_all") {
      isSelected = true;
    } else if (action === "restore_recommended") {
      isSelected = defaultSelectedForScene(scene, mode);
    } else if (action === "clear_optional") {
      isSelected = scene.priority_tier === "major";
    }

    return Object.freeze({
      ...sel,
      is_selected: isSelected,
      selection_source: defaultSelectionSource(scene, mode, isSelected),
      selected_at: isSelected ? new Date().toISOString() : null,
    });
  });
}

export function canConfirmSelection(
  selections: readonly MilitaryExpertSceneSelectionEntry[],
  warnings: readonly MilitaryExpertSelectionWarningCode[],
  warningsAcknowledged: boolean,
): { ok: boolean; reason?: string } {
  const selectedCount = selections.filter((s) => s.is_selected).length;
  if (selectedCount < 1) {
    return { ok: false, reason: "Select at least one scene before confirming." };
  }
  if (warnings.length > 0 && !warningsAcknowledged) {
    return { ok: false, reason: "Acknowledge active warnings before confirming." };
  }
  return { ok: true };
}

export function isSceneSelectionLocked(
  scene: MilitaryExpertSceneInventoryEntry,
  mode: "author" | "certification",
  snapshotImmutable: boolean,
): boolean {
  if (snapshotImmutable) return true;
  return mode === "certification" && scene.priority_tier === "major";
}

export function buildSelectionSnapshot(
  args: {
    snapshotId: string;
    inventoryId: string;
    manuscriptId: string;
    manuscriptVersionId: string;
    mode: "author" | "certification";
    scenes: readonly MilitaryExpertSceneInventoryEntry[];
    selections: readonly MilitaryExpertSceneSelectionEntry[];
    immutable?: boolean;
    confirmedAt?: string | null;
    confirmedBy?: "author" | "system_certification";
  },
): MilitaryExpertSelectionSnapshot {
  const selected = args.selections.filter((s) => s.is_selected);
  const warnings = computeActiveWarnings(args.scenes, args.selections);
  const runtimeSeconds = selected.reduce((sum, s) => sum + s.estimated_runtime_seconds, 0);

  return Object.freeze({
    selection_snapshot_id: args.snapshotId,
    inventory_id: args.inventoryId,
    manuscript_id: args.manuscriptId,
    manuscript_version_id: args.manuscriptVersionId,
    mode: args.mode,
    confirmed_at: args.confirmedAt ?? null,
    confirmed_by: args.confirmedBy ?? "author",
    immutable: args.immutable ?? false,
    selections: Object.freeze([...args.selections]),
    active_warnings: Object.freeze(warnings),
    totals: Object.freeze({
      selected_scene_count: selected.length,
      estimated_input_tokens: selected.reduce((sum, s) => sum + s.estimated_input_tokens, 0),
      estimated_output_tokens: selected.reduce((sum, s) => sum + s.estimated_output_tokens, 0),
      estimated_cost_usd: selected.reduce((sum, s) => sum + s.estimated_cost_usd, 0),
      estimated_runtime_seconds_min: Math.max(60, Math.round(runtimeSeconds * 0.8)),
      estimated_runtime_seconds_max: Math.round(runtimeSeconds * 1.4) + 120,
    }),
  });
}
