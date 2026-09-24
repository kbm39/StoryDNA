import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SQL = readFileSync(join(ROOT, "supabase/migrations/0026_archivist_segmented_workflows.sql"), "utf8");

function names(sql: string, pattern: RegExp): string[] {
  return [...sql.matchAll(pattern)].map((match) => match[1]).sort();
}

describe("migration 0026 archivist segmented workflows (static, not applied)", () => {
  it("is additive and does not mutate manuscripts, reviews, or accepted canon", () => {
    assert.match(SQL, /DO NOT APPLY/);
    assert.doesNotMatch(SQL, /alter table public\.(manuscripts|manuscript_versions|reviews|editorial_workflows|story_dna|experts|expert_versions|canon_facts)\b/i);
    assert.doesNotMatch(SQL, /drop table/i);
    assert.doesNotMatch(SQL, /truncate /i);
    assert.doesNotMatch(SQL, /delete from /i);
  });

  it("creates the segmented persistence tables", () => {
    assert.deepEqual(names(SQL, /create table if not exists public\.(\w+)/g), [
      "archivist_book_graphs",
      "archivist_candidate_reviews",
      "archivist_coverage_reports",
      "archivist_segment_checkpoints",
      "archivist_segment_observations",
      "archivist_segment_plans",
      "archivist_segmented_cost_ledger",
      "archivist_segmented_workflows",
    ]);
  });

  it("keeps authorized_to_run false and observations candidate-only", () => {
    assert.match(SQL, /authorized_to_run = false/);
    assert.match(SQL, /archivist_segment_observations_no_accepted/);
    assert.match(SQL, /segment_observation/);
    assert.match(SQL, /global_reconciliation/);
  });

  it("enables RLS and revokes anon/authenticated writes", () => {
    const tables = names(SQL, /create table if not exists public\.(\w+)/g);
    for (const table of tables) {
      assert.match(SQL, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(SQL, new RegExp(`revoke insert, update, delete on public\\.${table} from anon, authenticated`));
    }
  });
});
