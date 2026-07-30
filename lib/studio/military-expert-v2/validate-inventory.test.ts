import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateMilitaryExpertInventory } from "./validate-inventory.ts";
import type { MilitaryExpertSceneInventoryDocument } from "./contracts.ts";
import { MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION } from "./contracts.ts";

function baseDoc(
  scenes: MilitaryExpertSceneInventoryDocument["scenes"],
): MilitaryExpertSceneInventoryDocument {
  const major = scenes.filter((s) => s.priority_tier === "major").length;
  return Object.freeze({
    contract_version: MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
    inventory_id: "inv_val",
    manuscript_id: "ms_test",
    manuscript_version_id: "mv_test",
    workflow_id: null,
    generated_at: new Date().toISOString(),
    mode: "author",
    scene_count: scenes.length,
    major_scene_count: major,
    scenes,
    inventory_status: "ready_for_selection",
  });
}

const validScene = Object.freeze({
  inventory_id: "inv_val",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  scene_index: 1,
  locator: Object.freeze({
    exact_page_number: null,
    page_is_approximate: false,
    chapter_label: "Chapter 1",
    scene_heading: null,
    approximate_book_percentage: 10,
    internal_start_offset: 100,
    internal_end_offset: 1200,
  }),
  two_sentence_description: "First sentence here. Second sentence here.",
  scene_types: ["firefight"] as const,
  action_categories: ["firefight_or_battle"] as const,
  participants: [] as const,
  priority_tier: "major" as const,
  discovery_confidence: 0.8,
  discovery_source: "deterministic_heuristic" as const,
  default_selected: true,
  selection_warning_codes: [] as const,
  source_hash: "hash1",
});

describe("military expert v2 inventory validation", () => {
  it("accepts valid inventory", () => {
    const result = validateMilitaryExpertInventory(baseDoc([validScene]), 5000);
    assert.equal(result.ok, true);
  });

  it("rejects empty inventory", () => {
    const result = validateMilitaryExpertInventory(baseDoc([]), 5000);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "empty_inventory"));
  });

  it("rejects duplicate scene IDs", () => {
    const dup = Object.freeze({ ...validScene, scene_index: 2 });
    const result = validateMilitaryExpertInventory(baseDoc([validScene, dup]), 5000);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "duplicate_scene_id"));
  });

  it("rejects offsets out of bounds", () => {
    const bad = Object.freeze({
      ...validScene,
      locator: Object.freeze({
        ...validScene.locator,
        internal_end_offset: 99999,
      }),
    });
    const result = validateMilitaryExpertInventory(baseDoc([bad]), 5000);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "offsets_out_of_bounds"));
  });

  it("rejects unsourced exact page numbers", () => {
    const bad = Object.freeze({
      ...validScene,
      locator: Object.freeze({
        ...validScene.locator,
        exact_page_number: 42,
        page_is_approximate: false,
      }),
    });
    const result = validateMilitaryExpertInventory(baseDoc([bad]), 5000, { hasPageMap: false });
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "unsourced_exact_page"));
  });
});
