import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  EXPERT_CATALOG_ENTRIES,
  getExpertCatalogEntry,
} from "@/lib/expert-catalog.ts";
import {
  classifyExpertExecution,
  isExpertLaunchableInStudio,
  listExpertsByClass,
  militaryExpertBlockReasons,
  militaryExpertStudioVerdict,
} from "@/lib/studio/expert-classification.ts";
import {
  buildStudioExecutionPolicy,
  commercialStatusForEntry,
  studioStatusForExpert,
} from "@/lib/studio/execution-policy.ts";
import { buildRoundtableShell } from "@/lib/studio/roundtable.ts";
import { formatCostField } from "@/lib/studio/cost-tracking.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Kevin Track K3 private expert execution", () => {
  it("1. studio expert actions invoke requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/expert-execution.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
    assert.match(src, /startLiteraryAgentPublishingWorkflow/);
  });

  it("2. commercial registry unchanged", () => {
    assert.equal(EXPERT_CATALOG_ENTRIES.length, 6);
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
    assert.equal(getExpertCatalogEntry("literary_agent")!.selectionEnabled, true);
  });

  it("3. military expert remains commercially disabled with studio blocked verdict", () => {
    assert.equal(militaryExpertStudioVerdict(), "MILITARY_STUDIO_BLOCKED");
    assert.ok(militaryExpertBlockReasons().length >= 3);
    assert.equal(classifyExpertExecution("military_expert"), "EXPERIMENTAL");
    assert.equal(
      isExpertLaunchableInStudio({
        expertKey: "military_expert",
        privateUseAcknowledged: true,
      }),
      false,
    );
  });

  it("4. literary agent is READY and launchable in studio", () => {
    assert.equal(classifyExpertExecution("literary_agent"), "READY");
    assert.equal(
      isExpertLaunchableInStudio({
        expertKey: "literary_agent",
        privateUseAcknowledged: false,
      }),
      true,
    );
  });

  it("5. canonical workflow reused — no duplicate review engine", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/expert-execution.ts"), "utf8");
    assert.doesNotMatch(src, /createWorkflowRow/);
    assert.match(src, /startLiteraryAgentPublishingWorkflow/);
    assert.doesNotMatch(src, /publish_commercial_review_generation/);
  });

  it("6. studio execution policy separates commercial and studio status", () => {
    const la = getExpertCatalogEntry("literary_agent")!;
    const policy = buildStudioExecutionPolicy({
      expertKey: "literary_agent",
      entry: la,
      privateUseAcknowledged: false,
    });
    assert.equal(commercialStatusForEntry(la), "certified");
    assert.equal(studioStatusForExpert("literary_agent"), "available");
    assert.equal(policy.launchable, true);
  });

  it("7. placeholder experts classified correctly", () => {
    const byClass = listExpertsByClass();
    assert.ok(byClass.PLACEHOLDER.includes("dialogue_expert"));
    assert.ok(byClass.PLACEHOLDER.includes("police_expert"));
    assert.equal(classifyExpertExecution("dialogue_expert"), "PLACEHOLDER");
  });

  it("8. roundtable shell is display-only synthesis", () => {
    const shell = buildRoundtableShell({
      team: [
        {
          manuscriptId: "m1",
          expertKey: "literary_agent",
          displayName: "Literary Agent",
          purpose: "test",
          executionClass: "READY",
          policy: buildStudioExecutionPolicy({
            expertKey: "literary_agent",
            entry: getExpertCatalogEntry("literary_agent"),
            privateUseAcknowledged: false,
          }),
          tier: "certified",
          tierLabel: "Certified",
          certificationStatus: "certified",
          expectedRuntime: "5–15 minutes",
          estimatedCost: null,
          ownerNotes: null,
          recruitedAt: "2026-01-01",
          runStatus: "completed",
          lastReviewAt: null,
          latestReviewId: null,
        },
      ],
      issueCount: 5,
      candidateCount: 3,
    });
    assert.ok(shell);
    assert.equal(shell!.title, "Roundtable Discussion");
    assert.match(shell!.priority, /Revision Board/);
  });

  it("9. cost tracking never invents unavailable values", () => {
    assert.equal(formatCostField(null), "Unavailable");
    assert.equal(formatCostField("Varies"), "Varies");
  });

  it("10. editorial team client includes recruit and launch controls", () => {
    const src = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/experts/EditorialTeamClient.tsx"),
      "utf8",
    );
    assert.match(src, /Recruit/);
    assert.match(src, /Run Review/);
    assert.match(src, /Start Editorial Round/);
    assert.match(src, /RoundtableShell/);
    assert.match(src, /roundtable\.title/);
  });

  it("11. no global executionAllowed mutation in studio modules", () => {
    for (const file of [
      "lib/studio/expert-classification.ts",
      "lib/studio/editorial-team.ts",
      "lib/studio/execution-policy.ts",
    ]) {
      const src = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(src, /\bselectionEnabled\s*=(?!=)/);
      assert.doesNotMatch(src, /\bexecutionAllowed\s*=(?!=)/);
    }
  });

  it("12. migration adds studio editorial team table only", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/0025_studio_editorial_team.sql"),
      "utf8",
    );
    assert.match(sql, /studio_editorial_team_members/);
    assert.doesNotMatch(sql, /editorial_workflows/);
  });
});
