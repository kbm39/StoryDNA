import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { AUTHOR_INTENT_TYPES } from "./contract.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(ROOT, "supabase/migrations/0032_author_intent_eic_plan.sql");
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("migration 0032 author intent eic plan", () => {
  it("1. creates author_intent_records table", () => {
    assert.match(migrationSql, /create table if not exists public\.author_intent_records/i);
  });

  it("2. creates eic_editorial_plans table", () => {
    assert.match(migrationSql, /create table if not exists public\.eic_editorial_plans/i);
  });

  it("3. enforces storydna_author_intent@v1 contract version", () => {
    assert.match(migrationSql, /storydna_author_intent@v1/);
  });

  it("4. enforces storydna_eic_editorial_plan@v1 contract version", () => {
    assert.match(migrationSql, /storydna_eic_editorial_plan@v1/);
  });

  it("5. allows all committed intent types", () => {
    for (const intentType of AUTHOR_INTENT_TYPES) {
      assert.match(migrationSql, new RegExp(`'${intentType}'`));
    }
  });

  it("6. enforces one active intent per version via partial unique index", () => {
    assert.match(migrationSql, /author_intent_one_active_per_version/i);
    assert.match(migrationSql, /where status = 'active'/i);
  });

  it("7. contains no destructive table or data statements", () => {
    const forbidden = [/\bdrop table\b/i, /\bdrop column\b/i, /\bdelete from\b/i, /\btruncate\b/i];
    for (const pattern of forbidden) {
      assert.doesNotMatch(migrationSql, pattern);
    }
  });
});
