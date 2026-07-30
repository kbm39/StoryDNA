import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleSceneExcerpt, validateSceneOffsets } from "./scene-excerpt.ts";
import type { MilitaryExpertSceneInventoryEntry } from "./contracts.ts";

const SYNTHETIC_TEXT =
  "Before the action begins, the team moves through quiet streets. ".repeat(20) +
  "STACK ON THE DOOR. Alpha holds security while Bravo prepares to enter. Contact erupts. ".repeat(5) +
  "After extraction, the team regroups at the rally point. ".repeat(20);

const scene: MilitaryExpertSceneInventoryEntry = Object.freeze({
  inventory_id: "inv_test",
  scene_id: "ME-S-001",
  manuscript_id: "ms_test",
  manuscript_version_id: "mv_test",
  scene_index: 1,
  locator: Object.freeze({
    exact_page_number: null,
    page_is_approximate: true,
    chapter_label: "Chapter 1",
    scene_heading: "Breach",
    approximate_book_percentage: 25,
    internal_start_offset: 1200,
    internal_end_offset: 1800,
  }),
  two_sentence_description: "Synthetic breach scene for testing. Team enters under contact.",
  scene_types: Object.freeze(["breach", "firefight"]),
  action_categories: Object.freeze(["room_entry_or_breach", "firefight_or_battle"]),
  participants: Object.freeze(["Alpha", "Bravo"]),
  priority_tier: "major",
  discovery_confidence: 0.9,
  discovery_source: "deterministic_heuristic",
  default_selected: true,
  selection_warning_codes: Object.freeze([]),
  source_hash: "test_hash",
});

describe("scene excerpt assembly", () => {
  it("validates offsets against manuscript length", () => {
    assert.ok(validateSceneOffsets(scene, SYNTHETIC_TEXT.length).ok);
    const bad = {
      ...scene,
      locator: { ...scene.locator, internal_end_offset: SYNTHETIC_TEXT.length + 100 },
    };
    assert.equal(validateSceneOffsets(bad, SYNTHETIC_TEXT.length).ok, false);
  });

  it("assembles bounded excerpt with context windows", () => {
    const excerpt = assembleSceneExcerpt({ scene, manuscriptText: SYNTHETIC_TEXT });
    assert.equal(excerpt.sceneId, "ME-S-001");
    assert.ok(excerpt.sceneExcerpt.includes("STACK ON THE DOOR"));
    assert.ok(excerpt.contextBefore.length > 0);
    assert.ok(excerpt.contextAfter.length > 0);
    assert.ok(excerpt.totalCharsSent <= 12000);
  });
});
