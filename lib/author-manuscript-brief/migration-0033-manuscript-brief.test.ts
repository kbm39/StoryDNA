import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { MANUSCRIPT_BRIEF_STATUSES } from "./contract.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(ROOT, "supabase/migrations/0033_author_manuscript_briefs.sql");
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0033 author manuscript briefs", () => {
  it("1. creates author_manuscript_briefs table", () => {
    assert.match(migrationSql, /create table if not exists public\.author_manuscript_briefs/i);
  });

  it("2. enforces storydna_author_manuscript_brief@v1 contract version", () => {
    assert.match(migrationSql, /storydna_author_manuscript_brief@v1/);
  });

  it("3. allows all brief statuses", () => {
    for (const status of MANUSCRIPT_BRIEF_STATUSES) {
      assert.match(migrationSql, new RegExp(`'${status}'`));
    }
  });

  it("4. enforces one draft per author/version via partial unique index", () => {
    assert.match(migrationSql, /author_manuscript_briefs_one_draft_per_author_version/i);
    assert.match(migrationSql, /where status = 'draft'/i);
  });

  it("5. enforces one submitted brief per version", () => {
    assert.match(migrationSql, /author_manuscript_briefs_one_submitted_per_version/i);
    assert.match(migrationSql, /where status = 'submitted'/i);
  });

  it("6. prevents mutation of submitted brief content", () => {
    assert.match(migrationSql, /author_manuscript_briefs_immutable_submitted/i);
    assert.match(migrationSql, /Submitted manuscript briefs are immutable/i);
  });

  it("7. contains no destructive table or data statements", () => {
    const forbidden = [/\bdrop table\b/i, /\bdrop column\b/i, /\bdelete from\b/i, /\btruncate\b/i];
    for (const pattern of forbidden) {
      assert.doesNotMatch(migrationSql, pattern);
    }
  });
});
