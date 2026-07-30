import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSelectionSnapshot,
  canConfirmSelection,
  computeActiveWarnings,
} from "./selection-policy.ts";
import type { MilitaryExpertSceneInventoryEntry, MilitaryExpertSceneSelectionEntry } from "./contracts.ts";
import { parseMilitaryExpertSelectionSnapshot } from "./contracts.ts";

const scene: MilitaryExpertSceneInventoryEntry = Object.freeze({
  inventory_id: "inv_imm",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  scene_index: 1,
  locator: Object.freeze({
    exact_page_number: null,
    page_is_approximate: false,
    chapter_label: null,
    scene_heading: null,
    approximate_book_percentage: 50,
    internal_start_offset: 0,
    internal_end_offset: 2000,
  }),
  two_sentence_description: "First. Second.",
  scene_types: ["firefight"],
  action_categories: ["firefight_or_battle"],
  participants: [],
  priority_tier: "major",
  discovery_confidence: 0.9,
  discovery_source: "deterministic_heuristic",
  default_selected: true,
  selection_warning_codes: [],
  source_hash: "hash",
});

const selection: MilitaryExpertSceneSelectionEntry = Object.freeze({
  inventory_id: "inv_imm",
  scene_id: "ME-S-001",
  is_selected: true,
  selection_source: "system_default",
  selected_at: new Date().toISOString(),
  warning_acknowledged: false,
  estimated_input_tokens: 1000,
  estimated_output_tokens: 800,
  estimated_cost_usd: 0.05,
  estimated_runtime_seconds: 90,
});

describe("military expert v2 confirmation immutability", () => {
  it("builds immutable confirmed snapshot", () => {
    const snapshot = buildSelectionSnapshot({
      snapshotId: "snap_imm",
      inventoryId: "inv_imm",
      manuscriptId: "ms_test",
      manuscriptVersionId: "mv_test",
      mode: "author",
      scenes: [scene],
      selections: [selection],
      immutable: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "author",
    });
    assert.equal(snapshot.immutable, true);
    assert.ok(snapshot.confirmed_at);
    const parsed = parseMilitaryExpertSelectionSnapshot(snapshot);
    assert.ok(parsed);
  });

  it("blocks confirmation with zero selections", () => {
    const deselected = Object.freeze({ ...selection, is_selected: false });
    const check = canConfirmSelection([deselected], computeActiveWarnings([scene], [deselected]), true);
    assert.equal(check.ok, false);
  });
});
