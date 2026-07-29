import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0027_studio_military_expert_draft_reviews.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0027 studio military expert draft reviews", () => {
  it("1. creates draft review table with parsed_review_hash", () => {
    assert.match(migrationSql, /create table if not exists public\.studio_military_expert_draft_reviews/i);
    assert.match(migrationSql, /parsed_review_hash\s+text not null/i);
    assert.match(migrationSql, /workflow_id[\s\S]*unique/i);
  });

  it("2. creates draft findings table with board candidate check", () => {
    assert.match(migrationSql, /create table if not exists public\.studio_military_expert_draft_findings/i);
    assert.match(migrationSql, /board_candidate_kind[\s\S]*revision_candidate[\s\S]*investigation_candidate/i);
  });

  it("3. indexes parsed_review_hash for dedup", () => {
    assert.match(migrationSql, /studio_military_expert_draft_reviews_parsed_hash_idx/i);
    assert.match(migrationSql, /\(parsed_review_hash\)/i);
  });

  it("4. keeps authoritative_result_id typing unchanged in editorial_workflows", () => {
    assert.doesNotMatch(migrationSql, /alter table public\.editorial_workflows/i);
  });
});
