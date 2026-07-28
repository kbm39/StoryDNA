import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { WORKFLOW_TYPES } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION_PATH = join(
  ROOT,
  "supabase/migrations/0024_studio_military_expert_workflow.sql",
);
const MIGRATION_0023_PATH = join(ROOT, "supabase/migrations/0023_editorial_workflows.sql");

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
const migration0023Sql = readFileSync(MIGRATION_0023_PATH, "utf8");

describe("migration 0024 studio military expert workflow", () => {
  it("1. drops the legacy constraint name from migration 0023", () => {
    assert.match(
      migrationSql,
      /drop constraint if exists editorial_workflows_type_check/i,
    );
    assert.match(
      migration0023Sql,
      /constraint editorial_workflows_type_check check/i,
    );
  });

  it("2. defensively drops editorial_workflows_workflow_type_check", () => {
    assert.match(
      migrationSql,
      /drop constraint if exists editorial_workflows_workflow_type_check/i,
    );
  });

  it("3. final constraint permits literary_agent_review and military_expert_review", () => {
    assert.match(migrationSql, /'literary_agent_review'/);
    assert.match(migrationSql, /'military_expert_review'/);
    assert.match(
      migrationSql,
      /add constraint editorial_workflows_workflow_type_check[\s\S]*check\s*\(/i,
    );
  });

  it("4. allows only the committed WorkflowType values", () => {
    const allowedInMigration = migrationSql.match(
      /workflow_type in \(([\s\S]*?)\)/i,
    )?.[1];
    assert.ok(allowedInMigration);
    for (const workflowType of WORKFLOW_TYPES) {
      assert.match(allowedInMigration, new RegExp(`'${workflowType}'`));
    }
    assert.doesNotMatch(allowedInMigration, /'developmental_editor'/);
    assert.doesNotMatch(allowedInMigration, /'placeholder'/);
  });

  it("5. contains no destructive table or data statements", () => {
    const forbidden = [
      /\bdrop table\b/i,
      /\bdrop column\b/i,
      /\bdelete from\b/i,
      /\bupdate\b/i,
      /\btruncate\b/i,
    ];
    for (const pattern of forbidden) {
      assert.doesNotMatch(migrationSql, pattern);
    }
  });

  it("6. existing Literary Agent workflow type remains valid", () => {
    assert.ok(WORKFLOW_TYPES.includes("literary_agent_review"));
    assert.match(migrationSql, /'literary_agent_review'/);
  });

  it("7. Military Expert workflow insertion matches committed WorkflowType", () => {
    assert.ok(WORKFLOW_TYPES.includes("military_expert_review"));
    assert.match(migrationSql, /'military_expert_review'/);
  });
});
