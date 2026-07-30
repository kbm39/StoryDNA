import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInitialSelections,
  canConfirmSelection,
  computeActiveWarnings,
  defaultSelectedForScene,
  MILITARY_EXPERT_WARNING_COPY,
} from "./selection-policy.ts";
import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";
import { estimateSceneReviewCost } from "./estimator.ts";

function scene(partial: Partial<MilitaryExpertSceneInventoryEntry> & { scene_id: string }): MilitaryExpertSceneInventoryEntry {
  return Object.freeze({
    inventory_id: "inv_test",
    scene_id: partial.scene_id,
    manuscript_id: "ms_test",
    manuscript_version_id: "mv_test",
    scene_index: 1,
    locator: Object.freeze({
      exact_page_number: null,
      page_is_approximate: false,
      chapter_label: null,
      scene_heading: null,
      approximate_book_percentage: 50,
      internal_start_offset: 1000,
      internal_end_offset: 3000,
    }),
    two_sentence_description: "First. Second.",
    scene_types: partial.scene_types ?? ["firefight"],
    action_categories: partial.action_categories ?? ["firefight_or_battle"],
    participants: [],
    priority_tier: partial.priority_tier ?? "major",
    discovery_confidence: 0.9,
    discovery_source: "deterministic_heuristic",
    default_selected: partial.priority_tier !== "minor",
    selection_warning_codes: [],
    source_hash: "hash",
    ...partial,
  });
}

describe("military expert v2 selection policy", () => {
  it("defaults major selected in author mode", () => {
    const major = scene({ scene_id: "ME-S-001", priority_tier: "major" });
    const minor = scene({ scene_id: "ME-S-002", priority_tier: "minor", scene_types: ["other"] });
    assert.equal(defaultSelectedForScene(major, "author"), true);
    assert.equal(defaultSelectedForScene(minor, "author"), false);
  });

  it("blocks zero-selection confirmation", () => {
    const selections = buildInitialSelections([scene({ scene_id: "ME-S-001", priority_tier: "minor", scene_types: ["other"] })], "author", estimateSceneReviewCost);
    const cleared = selections.map((s) => Object.freeze({ ...s, is_selected: false }));
    const check = canConfirmSelection(cleared, [], true);
    assert.equal(check.ok, false);
  });

  it("emits no_firefights_selected warning when firefights exist but none selected", () => {
    const scenes = [
      scene({ scene_id: "ME-S-001", scene_types: ["firefight"] }),
      scene({ scene_id: "ME-S-002", scene_types: ["communications"], priority_tier: "moderate" }),
    ];
    const selections = buildInitialSelections(scenes, "author", estimateSceneReviewCost).map((s) =>
      s.scene_id === "ME-S-001"
        ? Object.freeze({ ...s, is_selected: false })
        : Object.freeze({ ...s, is_selected: true }),
    );
    const warnings = computeActiveWarnings(scenes, selections);
    assert.ok(warnings.includes("no_firefights_selected"));
    assert.ok(MILITARY_EXPERT_WARNING_COPY.no_firefights_selected.includes("firefight realism"));
  });
});
