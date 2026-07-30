import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { WORKFLOW_TYPES } from "../editorial-workflow/types.ts";

describe("migration 0031 synthesis tables", () => {
  it("extends workflow type and creates synthesis tables", () => {
    const sql = readFileSync(
      new URL("../../supabase/migrations/0031_studio_military_expert_v2_synthesis.sql", import.meta.url),
      "utf8",
    );
    assert.ok(sql.includes("military_expert_v2_synthesis"));
    assert.ok(sql.includes("studio_military_expert_v2_syntheses"));
    assert.ok(sql.includes("studio_military_expert_v2_synthesis_repairs"));
  });
});

describe("military expert v2 synthesis workflow boundary", () => {
  it("synthesis workflow type is distinct from scene review and v1", () => {
    assert.ok(WORKFLOW_TYPES.includes("military_expert_v2_synthesis"));
    assert.ok(WORKFLOW_TYPES.includes("military_expert_v2_scene_review"));
    assert.ok(WORKFLOW_TYPES.includes("military_expert_review"));
  });
});
