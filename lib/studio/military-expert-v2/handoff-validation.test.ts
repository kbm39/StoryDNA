import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PHASE2A_PINNED_SELECTED_SCENE_IDS,
  PHASE2A_PINNED_SELECTION_SNAPSHOT_ID,
  validatePinnedSceneIds,
} from "./handoff-validation.ts";

describe("phase 2A handoff validation", () => {
  it("validates pinned scene ID list exactly", () => {
    assert.ok(validatePinnedSceneIds([...PHASE2A_PINNED_SELECTED_SCENE_IDS]));
    assert.ok(!validatePinnedSceneIds(["ME-S-001", "ME-S-002"]));
    assert.ok(!validatePinnedSceneIds([...PHASE2A_PINNED_SELECTED_SCENE_IDS, "ME-S-999"]));
  });

  it("pins exact snapshot id constant", () => {
    assert.equal(
      PHASE2A_PINNED_SELECTION_SNAPSHOT_ID,
      "snap_a5c75c94-be71-4b6c-9582-3d6c0fe34fa1",
    );
    assert.equal(PHASE2A_PINNED_SELECTED_SCENE_IDS.length, 12);
  });
});
