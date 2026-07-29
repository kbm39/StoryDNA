import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0028_studio_military_expert_draft_finding_content.sql",
);

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0028 studio military expert draft finding content", () => {
  it("1. adds finding_content jsonb column to draft findings", () => {
    assert.match(migrationSql, /alter table public\.studio_military_expert_draft_findings/i);
    assert.match(migrationSql, /finding_content\s+jsonb/i);
  });

  it("2. does not alter prior migration tables destructively", () => {
    assert.doesNotMatch(migrationSql, /drop table/i);
    assert.doesNotMatch(migrationSql, /0027_studio_military_expert_draft_reviews/i);
  });

  it("3. indexes reviews with persisted finding content", () => {
    assert.match(migrationSql, /studio_military_expert_draft_findings_content_idx/i);
    assert.match(migrationSql, /where finding_content is not null/i);
  });
});
