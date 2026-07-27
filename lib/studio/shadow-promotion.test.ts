import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import type { StudioRevisionExport, StudioRevisionExportItem } from "@/lib/studio/export-types.ts";
import { hashText } from "@/lib/studio/export-location-integrity.ts";
import { applyAcceptedRevisionsToShadow } from "@/lib/studio/shadow-application-engine.ts";
import {
  buildPromotionVersionInsert,
  buildPromotionVersionLabel,
  validateShadowPromotionGates,
} from "@/lib/studio/shadow-promotion.ts";
import {
  STUDIO_SHADOW_PROMOTION_LABEL_PREFIX,
  STUDIO_SHADOW_PROMOTION_VERSION,
} from "@/lib/studio/shadow-promotion-types.ts";
import type { StudioShadowManuscript } from "@/lib/studio/shadow-types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = "Chapter 1\n\nHe ran fast through the alley.";

function exportItem(overrides: Partial<StudioRevisionExportItem> & { id: string; original: string; final: string; start: number; end: number }): StudioRevisionExportItem {
  return Object.freeze({
    itemId: overrides.id,
    revisionCandidateId: overrides.id,
    editorialIssueId: "issue-1",
    reviewId: "rev-1",
    expert: Object.freeze({ expertId: "literary_agent", expertName: "Literary Agent", lifecycleStatus: "open" }),
    manuscriptLocation: Object.freeze({
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
      pageNumber: null,
      paragraphNumber: null,
      startOffset: overrides.start,
      endOffset: overrides.end,
      locatorLabel: "Ch 1",
    }),
    revision: Object.freeze({
      revisionType: "line_edit",
      originalText: overrides.original,
      expertSuggestedText: overrides.final,
      authorFinalText: null,
      finalExportText: overrides.final,
      disposition: "accepted",
      authorNote: null,
      rejectionReason: null,
      explanation: "Stronger verb",
      rewriteRationale: null,
      severity: "moderate",
      confidence: 0.8,
      canonImpact: null,
    }),
    source: Object.freeze({
      manuscriptVersionId: "ver-1",
      sourceTextHash: hashText(overrides.original),
      suggestionHash: hashText(overrides.final),
      decisionUpdatedAt: "2026-01-01T00:00:00.000Z",
    }),
    applicability: Object.freeze({
      locatorResolved: true,
      locatorResolution: "resolved" as const,
      sourceTextMatchState: "EXACT_MATCH" as const,
      sourceTextMatchesActiveVersion: true,
      safeToApplyLater: true,
      conflictReasons: Object.freeze([]),
    }),
    planningOnly: false,
    exportDisposition: "accepted",
  });
}

function sampleManifest(items: StudioRevisionExportItem[]): StudioRevisionExport {
  return {
    exportVersion: "studio_revision_export@v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manuscript: Object.freeze({
      manuscriptId: "book-1",
      title: "Test Book",
      seriesName: null,
      volumeNumber: null,
      activeVersionLabel: "v1",
      sourceFilename: "test.docx",
    }),
    integrity: Object.freeze({
      decisionSnapshotHash: "snap-1",
      activeVersionHash: hashText(SOURCE),
      revisionCandidateCount: items.length,
      acceptedCount: items.length,
      acceptedModifiedCount: 0,
      deferredCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      safeForLaterApplication: items.length,
      notSafeForAutomaticApplication: 0,
    }),
    items,
    planningItems: [],
    conflicts: [],
    expectedActiveVersionId: "ver-1",
  };
}

function buildReadyShadow(): StudioShadowManuscript {
  const item = exportItem({
    id: "a",
    original: "He ran fast",
    final: "He sprinted",
    start: SOURCE.indexOf("He ran fast"),
    end: SOURCE.indexOf("He ran fast") + "He ran fast".length,
  });
  const result = applyAcceptedRevisionsToShadow({
    manifest: sampleManifest([item]),
    sourceText: SOURCE,
    selectedRevisionIds: ["a"],
    conflictResolutions: [],
    expectedActiveVersionId: "ver-1",
    expectedDecisionSnapshotHash: "snap-1",
  });
  if ("error" in result) throw new Error(result.error);
  return result;
}

describe("Kevin Track K6 shadow promotion", () => {
  it("1. promotion action requires requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/shadow-promotion.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
  });

  it("2. promotion contract version is defined", () => {
    assert.equal(STUDIO_SHADOW_PROMOTION_VERSION, "studio_shadow_promotion@v1");
  });

  it("3. gates block without confirmation", () => {
    const shadow = buildReadyShadow();
    const gates = validateShadowPromotionGates({
      shadow,
      request: {
        manuscriptId: "book-1",
        expectedActiveVersionId: "ver-1",
        expectedDecisionSnapshotHash: "snap-1",
        expectedShadowHash: shadow.application.finalHash,
        selectedRevisionIds: ["a"],
        conflictResolutions: [],
        confirmation: {
          acknowledgedNonActive: false,
          acknowledgedCanonicalUnchanged: false,
        },
      },
    });
    assert.equal(gates.readyForPromotion, false);
    assert.ok(gates.blockingReasons.some((r) => r.includes("acknowledgement")));
  });

  it("4. gates pass for ready shadow with confirmations", () => {
    const shadow = buildReadyShadow();
    const gates = validateShadowPromotionGates({
      shadow,
      request: {
        manuscriptId: "book-1",
        expectedActiveVersionId: "ver-1",
        expectedDecisionSnapshotHash: "snap-1",
        expectedShadowHash: shadow.application.finalHash,
        selectedRevisionIds: ["a"],
        conflictResolutions: [],
        confirmation: {
          acknowledgedNonActive: true,
          acknowledgedCanonicalUnchanged: true,
        },
      },
    });
    assert.equal(gates.readyForPromotion, true);
  });

  it("5. stale shadow hash blocks promotion", () => {
    const shadow = buildReadyShadow();
    const gates = validateShadowPromotionGates({
      shadow,
      request: {
        manuscriptId: "book-1",
        expectedActiveVersionId: "ver-1",
        expectedDecisionSnapshotHash: "snap-1",
        expectedShadowHash: "stale-hash",
        selectedRevisionIds: ["a"],
        conflictResolutions: [],
        confirmation: {
          acknowledgedNonActive: true,
          acknowledgedCanonicalUnchanged: true,
        },
      },
    });
    assert.equal(gates.readyForPromotion, false);
    assert.match(gates.blockingReasons.join(" "), /hash mismatch/i);
  });

  it("6. version insert uses non-active studio storage path", () => {
    const shadow = buildReadyShadow();
    const { row } = buildPromotionVersionInsert({
      manuscriptId: "book-1",
      shadow,
      sourceVersionId: "ver-1",
      sourceFilename: "book.docx",
      sourceStoragePath: "uploads/book.docx",
      nextVersionNumber: 2,
    });
    assert.equal(row.is_current, false);
    assert.match(row.storage_path, /^studio\/shadow-promoted\//);
    assert.match(row.source_filename, /shadow-promoted/);
    assert.equal(row.extracted_text, shadow.shadowText);
    assert.equal(row.supersedes_version_id, "ver-1");
  });

  it("7. default promotion label uses prefix", () => {
    const label = buildPromotionVersionLabel({ promotedAt: "2026-07-27T12:00:00.000Z" });
    assert.match(label, new RegExp(STUDIO_SHADOW_PROMOTION_LABEL_PREFIX));
  });

  it("8. promotion UI renders confirmation wizard", () => {
    const src = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/apply-preview/ShadowPreviewClient.tsx"),
      "utf8",
    );
    assert.match(src, /Promote to Draft Version/);
    assert.match(src, /current_version_id will remain unchanged/);
    assert.match(src, /promoteStudioShadowManuscript/);
  });

  it("9. promoted version notes record shadow metadata", () => {
    const shadow = buildReadyShadow();
    const { row } = buildPromotionVersionInsert({
      manuscriptId: "book-1",
      shadow,
      sourceVersionId: "ver-1",
      sourceFilename: "book.docx",
      sourceStoragePath: "uploads/book.docx",
      nextVersionNumber: 2,
    });
    const notes = JSON.parse(row.notes) as { studioShadowPromotion: string; shadowId: string };
    assert.equal(notes.studioShadowPromotion, STUDIO_SHADOW_PROMOTION_VERSION);
    assert.equal(notes.shadowId, shadow.shadowId);
  });

  it("10. military expert remains disabled", () => {
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
  });

  it("11. promotion does not reference current_version_id update", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/shadow-promotion.ts"), "utf8");
    assert.doesNotMatch(src, /current_version_id\s*:/);
    assert.match(src, /current_version_id changed during promotion/);
  });
});
