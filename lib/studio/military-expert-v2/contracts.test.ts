import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
  MILITARY_EXPERT_V2_HANDOFF_VERSION,
  parseMilitaryExpertSceneInventoryDocument,
  parseMilitaryExpertSceneInventoryEntry,
  parseMilitaryExpertSceneLocator,
  parseMilitaryExpertSelectionSnapshot,
  parseMilitaryExpertV2ReviewHandoffPayload,
} from "./contracts.ts";

const sampleLocator = {
  exact_page_number: 187,
  page_is_approximate: false,
  chapter_label: "Chapter 19",
  scene_heading: null,
  approximate_book_percentage: 76,
  internal_start_offset: 455200,
  internal_end_offset: 458900,
};

const sampleEntry = {
  inventory_id: "inv_test",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  scene_index: 1,
  locator: sampleLocator,
  two_sentence_description: "First sentence about tactical action. Second sentence about coverage.",
  scene_types: ["firefight"],
  action_categories: ["firefight_or_battle"],
  participants: ["Cole"],
  priority_tier: "major",
  discovery_confidence: 0.9,
  discovery_source: "deterministic_heuristic",
  default_selected: true,
  selection_warning_codes: ["major_scene_deselected"],
  source_hash: "abc123",
};

describe("military expert v2 contracts", () => {
  it("parses locator with exact page", () => {
    const loc = parseMilitaryExpertSceneLocator(sampleLocator);
    assert.ok(loc);
    assert.equal(loc.exact_page_number, 187);
    assert.equal(loc.page_is_approximate, false);
  });

  it("rejects approximate page without page number", () => {
    const loc = parseMilitaryExpertSceneLocator({
      ...sampleLocator,
      exact_page_number: null,
      page_is_approximate: true,
    });
    assert.ok(loc);
  });

  it("parses inventory entry", () => {
    const entry = parseMilitaryExpertSceneInventoryEntry(sampleEntry);
    assert.ok(entry);
    assert.equal(entry.scene_id, "ME-S-001");
  });

  it("parses full inventory document", () => {
    const doc = parseMilitaryExpertSceneInventoryDocument({
      contract_version: MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
      inventory_id: "inv_test",
      manuscript_id: "ms_test",
      manuscript_version_id: "mv_test",
      workflow_id: null,
      generated_at: new Date().toISOString(),
      mode: "author",
      scene_count: 1,
      major_scene_count: 1,
      inventory_status: "ready_for_selection",
      scenes: [sampleEntry],
    });
    assert.ok(doc);
    assert.equal(doc.scenes.length, 1);
  });

  it("rejects malformed inventory with invalid enum", () => {
    const entry = parseMilitaryExpertSceneInventoryEntry({
      ...sampleEntry,
      scene_types: ["not_a_real_type"],
    });
    assert.equal(entry, null);
  });

  it("parses selection snapshot and handoff payload", () => {
    const selectionEntry = {
      inventory_id: "inv_test",
      scene_id: "ME-S-001",
      is_selected: true,
      selection_source: "system_default",
      selected_at: new Date().toISOString(),
      warning_acknowledged: false,
      estimated_input_tokens: 1000,
      estimated_output_tokens: 800,
      estimated_cost_usd: 0.05,
      estimated_runtime_seconds: 90,
    };
    const snapshot = parseMilitaryExpertSelectionSnapshot({
      selection_snapshot_id: "snap_test",
      inventory_id: "inv_test",
      manuscript_id: "ms_test",
      manuscript_version_id: "mv_test",
      mode: "author",
      confirmed_at: null,
      confirmed_by: "author",
      immutable: false,
      selections: [selectionEntry],
      active_warnings: [],
      totals: {
        selected_scene_count: 1,
        estimated_input_tokens: 1000,
        estimated_output_tokens: 800,
        estimated_cost_usd: 0.05,
        estimated_runtime_seconds_min: 60,
        estimated_runtime_seconds_max: 120,
      },
    });
    assert.ok(snapshot);

    const inventory = parseMilitaryExpertSceneInventoryDocument({
      contract_version: MILITARY_EXPERT_SCENE_INVENTORY_CONTRACT_VERSION,
      inventory_id: "inv_test",
      manuscript_id: "ms_test",
      manuscript_version_id: "mv_test",
      workflow_id: null,
      generated_at: new Date().toISOString(),
      mode: "author",
      scene_count: 1,
      major_scene_count: 1,
      inventory_status: "ready_for_selection",
      scenes: [sampleEntry],
    });
    assert.ok(inventory);

    const handoff = parseMilitaryExpertV2ReviewHandoffPayload({
      handoff_version: MILITARY_EXPERT_V2_HANDOFF_VERSION,
      inventory_id: "inv_test",
      selection_snapshot_id: "snap_test",
      manuscript_id: "ms_test",
      manuscript_version_id: "mv_test",
      selected_scene_ids: ["ME-S-001"],
      selection_snapshot: snapshot,
      expected_scene_count: 1,
      selected_scene_coverage_target: 1.0,
      mode: "author",
      estimated_budget_usd: 0.05,
      workflow_definition_version: "military_expert_review@v2-scene",
      inventory_document: inventory,
    });
    assert.ok(handoff);
  });
});
