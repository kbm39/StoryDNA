import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0029_studio_military_expert_v2_inventory.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0029 military expert v2 inventory", () => {
  it("adds inventory, entry, selection, and snapshot tables", () => {
    assert.match(migrationSql, /studio_military_expert_scene_inventories/i);
    assert.match(migrationSql, /studio_military_expert_scene_inventory_entries/i);
    assert.match(migrationSql, /studio_military_expert_scene_selections/i);
    assert.match(migrationSql, /studio_military_expert_selection_snapshots/i);
  });

  it("extends workflow type check for military_expert_v2_inventory", () => {
    assert.match(migrationSql, /military_expert_v2_inventory/);
  });

  it("enforces unique scene_id per inventory and one confirmed snapshot", () => {
    assert.match(migrationSql, /unique \(inventory_id, scene_id\)/i);
    assert.match(migrationSql, /studio_military_expert_selection_snapshots_confirmed_unique/i);
  });

  it("does not modify finding_content or v1 review tables", () => {
    assert.doesNotMatch(migrationSql, /finding_content/i);
    assert.doesNotMatch(migrationSql, /studio_military_expert_draft_reviews/i);
  });
});
