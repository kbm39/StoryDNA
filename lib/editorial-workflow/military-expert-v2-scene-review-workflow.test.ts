import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { WORKFLOW_TYPES } from "../editorial-workflow/types.ts";

describe("migration 0030 scene review tables", () => {
  it("extends workflow type and creates scene review tables", () => {
    const sql = readFileSync(
      new URL("../../supabase/migrations/0030_studio_military_expert_v2_scene_reviews.sql", import.meta.url),
      "utf8",
    );
    assert.ok(sql.includes("military_expert_v2_scene_review"));
    assert.ok(sql.includes("studio_military_expert_scene_reviews"));
    assert.ok(sql.includes("studio_military_expert_scene_review_repairs"));
    assert.ok(sql.includes("studio_military_expert_scene_review_coverage"));
    assert.ok(sql.includes("unique (selection_snapshot_id, scene_id)"));
  });
});

describe("military expert v2 scene review workflow boundary", () => {
  it("scene review workflow type is distinct from inventory and v1", () => {
    assert.ok(WORKFLOW_TYPES.includes("military_expert_v2_scene_review"));
    assert.ok(WORKFLOW_TYPES.includes("military_expert_v2_inventory"));
    assert.ok(WORKFLOW_TYPES.includes("military_expert_review"));
  });
});
