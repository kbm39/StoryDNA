import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverMilitaryScenes, DISCOVERY_PROVIDER_USED_IN_PHASE_1 } from "./discovery.ts";
import { validateMilitaryExpertInventory } from "./validate-inventory.ts";

const MILITARY_SAMPLE = `
Chapter 1
The convoy rolled through the dusty road when contact erupted from the left flank.
Incoming fire snapped overhead as the gunner returned fire from the turret.

Chapter 5
The team stacked on the door. Breaching charge ready. On my command, they kicked in
and cleared the first room under sustained fire.

Chapter 10
Radio crackled with sitrep. Command decision: hold position until MEDEVAC arrives.
Cole applied a tourniquet while still under fire.

Chapter 15
The black hawk descended into the LZ. Fast rope insertion as rotor wash filled the scene.
`.repeat(3);

describe("military expert v2 discovery", () => {
  it("discovers multiple military scene clusters deterministically", () => {
    assert.equal(DISCOVERY_PROVIDER_USED_IN_PHASE_1, false);
    const doc = discoverMilitaryScenes({
      inventoryId: "inv_disc_test",
      manuscriptId: "ms_test",
      manuscriptVersionId: "mv_test",
      workflowId: null,
      text: MILITARY_SAMPLE,
      contentHash: "hash_test_1234567890",
    });
    assert.ok(doc.scene_count >= 1);
    assert.ok(doc.scenes.every((s) => s.discovery_source === "deterministic_heuristic"));
    const validation = validateMilitaryExpertInventory(doc, MILITARY_SAMPLE.length);
    assert.equal(validation.ok, true);
  });

  it("merges adjacent signal chunks and assigns stable scene IDs", () => {
    const doc = discoverMilitaryScenes({
      inventoryId: "inv_merge",
      manuscriptId: "ms_test",
      manuscriptVersionId: "mv_test",
      workflowId: null,
      text: MILITARY_SAMPLE,
      contentHash: "hash_merge_1234567890",
    });
    const ids = new Set(doc.scenes.map((s) => s.scene_id));
    assert.equal(ids.size, doc.scenes.length);
    assert.ok(doc.scenes[0]?.scene_id.startsWith("ME-S-"));
  });

  it("does not invent exact page numbers", () => {
    const doc = discoverMilitaryScenes({
      inventoryId: "inv_pages",
      manuscriptId: "ms_test",
      manuscriptVersionId: "mv_test",
      workflowId: null,
      text: MILITARY_SAMPLE,
      contentHash: "hash_pages_1234567890",
    });
    for (const scene of doc.scenes) {
      assert.equal(scene.locator.exact_page_number, null);
      assert.equal(scene.locator.page_is_approximate, false);
    }
  });

  it("requires tactical anchor signals and filters weak prologue-only matches", () => {
    const prologueOnly = `
${"Domestic setup and character backstory without combat. ".repeat(400)}
Chapter 2
The convoy halted when ambush contact erupted. Gunner returned fire from the turret.
${"Aftermath and debrief. ".repeat(200)}
`;
    const doc = discoverMilitaryScenes({
      inventoryId: "inv_anchor",
      manuscriptId: "ms_test",
      manuscriptVersionId: "mv_test",
      workflowId: null,
      text: prologueOnly,
      contentHash: "hash_anchor_1234567890",
    });
    assert.ok(doc.scene_count >= 1);
    assert.ok(doc.scenes.every((s) => s.action_categories.some((c) => c !== "intelligence_or_planning")));
    const validation = validateMilitaryExpertInventory(doc, prologueOnly.length);
    assert.equal(validation.ok, true);
  });
});
