import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { parseMilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { locatorHasAuthorFacingFallback } from "./locator.ts";

export interface InventoryValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly sceneId?: string;
}

export interface InventoryValidationResult {
  readonly ok: boolean;
  readonly issues: readonly InventoryValidationIssue[];
}

const MAJOR_SCENE_TYPES = new Set([
  "firefight",
  "battle",
  "breach",
  "room_entry",
  "casualty_under_fire",
  "aviation_insertion",
]);

function pushIssue(
  issues: InventoryValidationIssue[],
  code: string,
  message: string,
  sceneId?: string,
): void {
  issues.push(Object.freeze({ code, message, sceneId }));
}

export function validateMilitaryExpertInventory(
  document: MilitaryExpertSceneInventoryDocument,
  manuscriptTextLength: number,
  options?: { readonly hasPageMap?: boolean },
): InventoryValidationResult {
  const issues: InventoryValidationIssue[] = [];
  const hasPageMap = options?.hasPageMap ?? false;

  const reparsed = parseMilitaryExpertSceneInventoryDocument(document);
  if (!reparsed) {
    pushIssue(issues, "invalid_contract", "Inventory document failed contract parsing.");
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }

  if (document.scenes.length === 0) {
    pushIssue(issues, "empty_inventory", "Inventory must contain at least one scene.");
  }

  const sceneIds = new Set<string>();
  for (const scene of document.scenes) {
    if (sceneIds.has(scene.scene_id)) {
      pushIssue(issues, "duplicate_scene_id", "Duplicate scene_id within inventory.", scene.scene_id);
    }
    sceneIds.add(scene.scene_id);

    if (scene.manuscript_version_id !== document.manuscript_version_id) {
      pushIssue(
        issues,
        "version_mismatch",
        "Scene manuscript_version_id does not match inventory.",
        scene.scene_id,
      );
    }

    const { internal_start_offset: start, internal_end_offset: end } = scene.locator;
    if (start < 0 || end <= start) {
      pushIssue(issues, "invalid_offsets", "End offset must be greater than start offset.", scene.scene_id);
    }
    if (end > manuscriptTextLength) {
      pushIssue(
        issues,
        "offsets_out_of_bounds",
        "Scene offsets exceed manuscript text length.",
        scene.scene_id,
      );
    }

    if (!scene.two_sentence_description.trim()) {
      pushIssue(issues, "missing_description", "Two-sentence description is required.", scene.scene_id);
    }

    if (scene.discovery_confidence < 0 || scene.discovery_confidence > 1) {
      pushIssue(
        issues,
        "invalid_confidence",
        "Discovery confidence must be between 0 and 1.",
        scene.scene_id,
      );
    }

    if (!locatorHasAuthorFacingFallback(scene.locator)) {
      pushIssue(
        issues,
        "missing_locator_fallback",
        "Scene must have a valid author-facing locator fallback.",
        scene.scene_id,
      );
    }

    if (scene.locator.exact_page_number != null && !hasPageMap) {
      pushIssue(
        issues,
        "unsourced_exact_page",
        "Exact page number requires a source-backed page map.",
        scene.scene_id,
      );
    }

    if (scene.locator.page_is_approximate && scene.locator.exact_page_number == null) {
      pushIssue(
        issues,
        "approximate_without_page",
        "page_is_approximate requires an exact_page_number value.",
        scene.scene_id,
      );
    }

    const hasMajorType = scene.scene_types.some((t) => MAJOR_SCENE_TYPES.has(t));
    if (hasMajorType && scene.priority_tier === "minor") {
      pushIssue(
        issues,
        "major_classification_mismatch",
        "Scenes with major tactical types should not be classified as minor.",
        scene.scene_id,
      );
    }
  }

  if (document.scene_count !== document.scenes.length) {
    pushIssue(issues, "scene_count_mismatch", "scene_count does not match scenes array length.");
  }

  const actualMajor = document.scenes.filter((s) => s.priority_tier === "major").length;
  if (document.major_scene_count !== actualMajor) {
    pushIssue(issues, "major_count_mismatch", "major_scene_count does not match classified scenes.");
  }

  return Object.freeze({ ok: issues.length === 0, issues: Object.freeze(issues) });
}

export function assertInventoryReadyForSelection(
  document: MilitaryExpertSceneInventoryDocument,
  manuscriptTextLength: number,
): InventoryValidationResult {
  const result = validateMilitaryExpertInventory(document, manuscriptTextLength);
  if (!result.ok) return result;
  if (document.inventory_status !== "ready_for_selection" && document.inventory_status !== "draft") {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: "invalid_status",
          message: "Inventory must be ready_for_selection before author selection.",
        }),
      ]),
    });
  }
  return result;
}
