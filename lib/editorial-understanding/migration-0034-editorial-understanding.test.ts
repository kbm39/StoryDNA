import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { EDITORIAL_UNDERSTANDING_STATUSES } from "./contract.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0034_editorial_understanding_conversation.sql",
);
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0034 editorial understanding conversation", () => {
  it("1. creates editorial_understandings table", () => {
    assert.match(migrationSql, /create table if not exists public\.editorial_understandings/i);
  });

  it("2. enforces storydna_editorial_understanding@v1 contract version", () => {
    assert.match(migrationSql, /storydna_editorial_understanding@v1/);
  });

  it("3. allows all Phase 1B-ab statuses", () => {
    for (const status of EDITORIAL_UNDERSTANDING_STATUSES) {
      assert.match(migrationSql, new RegExp(`'${status}'`));
    }
  });

  it("4. enforces one draft per author/version via partial unique index", () => {
    assert.match(migrationSql, /editorial_understandings_one_draft_per_author_version/i);
    assert.match(migrationSql, /where status = 'draft'/i);
  });

  it("5. enforces one confirmed understanding per version", () => {
    assert.match(migrationSql, /editorial_understandings_one_confirmed_per_version/i);
    assert.match(migrationSql, /where status = 'confirmed'/i);
  });

  it("6. prevents mutation of confirmed understanding content", () => {
    assert.match(migrationSql, /editorial_understandings_immutable_confirmed/i);
    assert.match(migrationSql, /Confirmed editorial understanding records are immutable/i);
  });

  it("7. enforces one clarification per stage in stage_turns", () => {
    assert.match(migrationSql, /editorial_understandings_one_clarification_per_stage/i);
    assert.match(migrationSql, /At most one clarification is allowed per stage/i);
  });

  it("8. stores stage responses, clarifications, confidence, and cost metadata", () => {
    assert.match(migrationSql, /stage_turns\s+jsonb/i);
    assert.match(migrationSql, /resolved_clarifications\s+jsonb/i);
    assert.match(migrationSql, /confidence\s+jsonb/i);
    assert.match(migrationSql, /provider_model/i);
    assert.match(migrationSql, /provider_cost_usd/i);
  });

  it("9. does not alter author_manuscript_briefs or author_intent tables", () => {
    assert.doesNotMatch(migrationSql, /author_manuscript_briefs/i);
    assert.doesNotMatch(migrationSql, /author_intent_records/i);
  });

  it("10. contains no destructive table or data statements", () => {
    const forbidden = [/\bdrop table\b/i, /\bdrop column\b/i, /\bdelete from\b/i, /\btruncate\b/i];
    for (const pattern of forbidden) {
      assert.doesNotMatch(migrationSql, pattern);
    }
  });
});
