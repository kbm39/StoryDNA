import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  EXPERT_CATALOG_ENTRIES,
  getExpertCatalogEntry,
  listExpertCatalogEntries,
} from "@/lib/expert-catalog.ts";
import {
  classifyStudioExpertTier,
  requiresPrivateUseAcknowledgment,
  studioExecutionAllowed,
} from "@/lib/studio/execution-policy.ts";
import {
  getCommercialCatalogSnapshot,
  groupStudioExpertsByTier,
  listStudioExpertDeskEntries,
} from "@/lib/studio/expert-desk.ts";
import { buildStudioActionItems, summarizeRevisionBoard } from "@/lib/studio/revision-board.ts";
import { isStudioFeatureEnabled } from "@/lib/studio/feature-flag.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("Kevin Track studio foundation", () => {
  it("1. studio feature enabled by default unless STUDIO_ENABLED=false", () => {
    const prev = process.env.STUDIO_ENABLED;
    delete process.env.STUDIO_ENABLED;
    assert.equal(isStudioFeatureEnabled(), true);
    process.env.STUDIO_ENABLED = "false";
    assert.equal(isStudioFeatureEnabled(), false);
    if (prev === undefined) delete process.env.STUDIO_ENABLED;
    else process.env.STUDIO_ENABLED = prev;
  });

  it("2. commercial expert catalog unchanged by studio layer", () => {
    const snapshot = getCommercialCatalogSnapshot();
    assert.deepEqual(snapshot, listExpertCatalogEntries());
    assert.equal(snapshot.length, EXPERT_CATALOG_ENTRIES.length);
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
    assert.equal(getExpertCatalogEntry("literary_agent")!.certificationStatus, "certified");
  });

  it("3. military expert listed as advisory not certified in studio desk", () => {
    const military = listStudioExpertDeskEntries().find((e) => e.key === "military_expert");
    assert.ok(military);
    assert.equal(military.tier, "advisory_only");
    assert.match(military.experimentalNotice ?? "", /Not commercially certified/);
    assert.equal(military.selectionEnabled, false);
  });

  it("4. literary agent is certified tier with studio execution when acknowledged path not needed", () => {
    const la = listStudioExpertDeskEntries().find((e) => e.key === "literary_agent");
    assert.ok(la);
    assert.equal(la.tier, "certified");
    assert.equal(la.studioExecutionAllowed, true);
  });

  it("5. experimental tier requires private use acknowledgment for execution", () => {
    const entry = getExpertCatalogEntry("military_expert")!;
    const tier = classifyStudioExpertTier(entry);
    assert.equal(requiresPrivateUseAcknowledgment(tier), true);
    assert.equal(
      studioExecutionAllowed({ entry, tier, context: { routeNamespace: "/studio" } }),
      false,
    );
    assert.equal(
      studioExecutionAllowed({
        entry,
        tier,
        context: { routeNamespace: "/studio", privateUseAcknowledged: true },
      }),
      true,
    );
  });

  it("6. studio expert desk includes placeholders for unregistered experts", () => {
    const keys = listStudioExpertDeskEntries().map((e) => e.key);
    assert.ok(keys.includes("show_vs_tell_editor"));
    assert.ok(keys.includes("police_expert"));
    const placeholder = listStudioExpertDeskEntries().find((e) => e.key === "police_expert");
    assert.equal(placeholder?.placeholder, true);
  });

  it("7. revision board maps candidates to action items", () => {
    const items = buildStudioActionItems({
      issues: [
        {
          id: "issue-1",
          manuscript_id: "m1",
          review_id: "r1",
          text: "Pacing concern",
          area: "structure",
          severity: "moderate",
          source_section: null,
          success_criterion: "Maintain tension",
          owning_reviewer: "Literary Agent",
          resolution_status: "open",
          verified_at: null,
          verification_note: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      candidates: [
        {
          id: "cand-1",
          manuscript_id: "m1",
          issue_id: "issue-1",
          phase_id: null,
          type: "line_edit",
          original: "He ran fast.",
          revised: "He sprinted.",
          locator: "Ch 3",
          word_savings: 0,
          reason: "Stronger verb",
          confidence: 0.8,
          confidence_reason: null,
          difficulty: null,
          story_risk: null,
          voice_risk: null,
          commercial_impact: null,
          reader_impact: null,
          grade_delta: null,
          consequence_if_unchanged: "Weaker action beat",
          dependencies: null,
          impacts: null,
          export_mode: "inline",
          verified: false,
          status: "proposed",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      responses: [],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]!.issueTitle, "Pacing concern");
    assert.equal(items[0]!.suggestedRewrite, "He sprinted.");
    assert.equal(items[0]!.studioDisposition, "pending");
    const summary = summarizeRevisionBoard(items);
    assert.equal(summary.total, 1);
    assert.equal(summary.notReviewed, 1);
    assert.equal(summary.acceptedRevisionCount, 0);
  });

  it("8. studio routes exist and do not modify expert-catalog source", () => {
    const catalogSrc = readFileSync(join(ROOT, "lib/expert-catalog.ts"), "utf8");
    assert.doesNotMatch(catalogSrc, /studioExecutionAllowed/);
    assert.doesNotMatch(catalogSrc, /Kevin Track/);
    const studioLayout = readFileSync(join(ROOT, "app/studio/layout.tsx"), "utf8");
    const studioShell = readFileSync(join(ROOT, "app/studio/components/StudioShell.tsx"), "utf8");
    assert.match(studioLayout, /requireStudioAccess/);
    assert.match(studioShell, /Private Author Studio/);
  });

  it("9. expert desk groups by tier", () => {
    const groups = groupStudioExpertsByTier(listStudioExpertDeskEntries());
    assert.ok(groups.certified.length >= 1);
    assert.ok(groups.advisory_only.length >= 1);
    assert.ok(groups.placeholder.length >= 1);
  });

  it("10. no global executionAllowed mutation in studio modules", () => {
    for (const file of ["lib/studio/expert-desk.ts", "lib/studio/library.ts"]) {
      const src = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(src, /\bselectionEnabled\s*=(?!=)/);
      assert.doesNotMatch(src, /\bexecutionAllowed\s*=(?!=)/);
    }
  });
});
