import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0035_progressive_editorial_understanding.sql",
);
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0035 progressive editorial understanding", () => {
  it("1. adds understanding_quality jsonb column", () => {
    assert.match(migrationSql, /understanding_quality\s+jsonb/i);
  });

  it("2. adds synthesis_artifacts jsonb column", () => {
    assert.match(migrationSql, /synthesis_artifacts\s+jsonb/i);
  });

  it("3. is additive only on editorial_understandings", () => {
    assert.match(migrationSql, /alter table public\.editorial_understandings/i);
    assert.match(migrationSql, /add column if not exists/i);
  });

  it("4. does not alter author_manuscript_briefs or author_intent tables", () => {
    assert.doesNotMatch(migrationSql, /author_manuscript_briefs/i);
    assert.doesNotMatch(migrationSql, /author_intent_records/i);
  });

  it("5. contains no destructive table or data statements", () => {
    const forbidden = [/\bdrop table\b/i, /\bdrop column\b/i, /\bdelete from\b/i, /\btruncate\b/i];
    for (const pattern of forbidden) {
      assert.doesNotMatch(migrationSql, pattern);
    }
  });
});
