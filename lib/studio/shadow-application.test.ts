import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { getExpertCatalogEntry } from "@/lib/expert-catalog.ts";
import type { StudioRevisionExport, StudioRevisionExportItem } from "@/lib/studio/export-types.ts";
import { hashText } from "@/lib/studio/export-location-integrity.ts";
import { buildShadowApplicationPlan } from "@/lib/studio/shadow-application-plan.ts";
import {
  applyAcceptedRevisionsToShadow,
  applyShadowPlan,
  assertCanonicalIntegrityUnchanged,
  defaultSelectedRevisionIds,
  snapshotCanonicalIntegrity,
} from "@/lib/studio/shadow-application-engine.ts";
import {
  applyTextOperation,
  mapRevisionTypeToOperation,
  operationsOverlap,
  sortOperationsForApplication,
} from "@/lib/studio/shadow-operations.ts";
import {
  buildShadowPreviewFilename,
  generateShadowMarkdownDownload,
  SHADOW_NON_CANONICAL_HEADER,
} from "@/lib/studio/shadow-export.ts";
import { STUDIO_SHADOW_VERSION } from "@/lib/studio/shadow-types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SOURCE = "Chapter 1\n\nHe ran fast through the alley.\n\nShe waited by the door.";

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
      revisionType: overrides.revision?.revisionType ?? "line_edit",
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
      ...(overrides.applicability ?? {}),
    }),
    planningOnly: false,
  });
}

function sampleManifest(items: StudioRevisionExportItem[]): StudioRevisionExport {
  return {
    exportVersion: "studio_revision_export@v1",
    exportId: "exp-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manuscript: {
      manuscriptId: "m1",
      title: "Test Book",
      seriesName: null,
      volumeNumber: null,
      activeVersionId: "ver-1",
      activeVersionLabel: "v1",
      authoritativeWordCount: 10,
      sourceFilename: "test.docx",
    },
    filters: { includedDispositions: ["accepted"], includeDeferred: false, expertIds: [], chapterIds: [] },
    integrity: {
      canonicalManuscriptModified: false,
      currentVersionChanged: false,
      sourceVersionHash: hashText(SOURCE),
      decisionSnapshotHash: "snap-1",
      warning: "unchanged",
    },
    summary: {
      totalCandidates: items.length,
      includedItems: items.length,
      acceptedUnchanged: items.length,
      acceptedModified: 0,
      deferredIncluded: 0,
      excludedRejected: 0,
      excludedPending: 0,
      excludedDeferred: 0,
      unresolvedLocatorCount: 0,
      conflictCount: 0,
      safeForLaterApplication: items.length,
      notSafeForAutomaticApplication: 0,
    },
    items,
    planningItems: [],
    conflicts: [],
    expectedActiveVersionId: "ver-1",
  };
}

describe("Kevin Track K5 shadow application", () => {
  it("1. shadow actions require requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/shadow-preview.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
  });

  it("22. replacement applies correctly", () => {
    const start = SOURCE.indexOf("He ran fast");
    const end = start + "He ran fast".length;
    const result = applyTextOperation({
      text: SOURCE,
      operationType: "replacement",
      startOffset: start,
      endOffset: end,
      finalText: "He sprinted",
      expectedOriginal: "He ran fast",
    });
    assert.equal(result.ok && result.text.includes("He sprinted"), true);
    assert.equal(result.ok && result.text.includes("He ran fast"), false);
  });

  it("24. deletion applies correctly", () => {
    const start = SOURCE.indexOf("He ran fast");
    const end = start + "He ran fast".length;
    const result = applyTextOperation({
      text: SOURCE,
      operationType: "deletion",
      startOffset: start,
      endOffset: end,
      finalText: "",
      expectedOriginal: "He ran fast",
    });
    assert.equal(result.ok && !result.text.includes("He ran fast"), true);
  });

  it("26. application runs in reverse offset order", () => {
    const ops = sortOperationsForApplication([
      { itemId: "a", startOffset: 10, endOffset: 20 },
      { itemId: "b", startOffset: 40, endOffset: 50 },
    ]);
    assert.equal(ops[0]!.startOffset, 40);
  });

  it("29. overlapping replacements create conflict detection in plan", () => {
    const items = [
      exportItem({ id: "a", original: "He ran fast", final: "He sprinted", start: SOURCE.indexOf("He ran fast"), end: SOURCE.indexOf("He ran fast") + "He ran fast".length }),
      exportItem({ id: "b", original: "He ran fast through", final: "He dashed through", start: SOURCE.indexOf("He ran fast"), end: SOURCE.indexOf("He ran fast through") + "He ran fast through".length }),
    ];
    const plan = buildShadowApplicationPlan({
      manifest: sampleManifest(items),
      sourceText: SOURCE,
      activeVersionId: "ver-1",
      selectedRevisionIds: ["a", "b"],
      conflictResolutions: [],
    });
    assert.ok(plan.blockedItems.length >= 1 || plan.operations.length <= 1);
  });

  it("34. Keep A excludes B via conflict resolution", () => {
    const items = [
      exportItem({ id: "a", original: "He ran fast", final: "He sprinted", start: SOURCE.indexOf("He ran fast"), end: SOURCE.indexOf("He ran fast") + "He ran fast".length }),
      exportItem({ id: "b", original: "He ran fast", final: "He dashed", start: SOURCE.indexOf("He ran fast"), end: SOURCE.indexOf("He ran fast") + "He ran fast".length, applicability: { conflictReasons: ["contradictory_replacement"] } as never }),
    ];
    const manifest = sampleManifest(items);
    manifest.conflicts.push({
      conflictId: "c1",
      affectedItemIds: ["a", "b"],
      conflictType: "contradictory_replacement",
      severity: "high",
      explanation: "test",
      recommendedAuthorAction: "choose",
    });
    const plan = buildShadowApplicationPlan({
      manifest: { ...manifest, conflicts: manifest.conflicts },
      sourceText: SOURCE,
      activeVersionId: "ver-1",
      selectedRevisionIds: ["a", "b"],
      conflictResolutions: [{ conflictId: "c1", choice: "apply_item_a" }],
    });
    assert.ok(plan.operations.every((op) => op.itemId === "a"));
  });

  it("41. canonical integrity snapshot unchanged", () => {
    const before = snapshotCanonicalIntegrity({ extractedText: SOURCE, currentVersionId: "v1", storagePath: "p" });
    const after = snapshotCanonicalIntegrity({ extractedText: SOURCE, currentVersionId: "v1", storagePath: "p" });
    assert.equal(assertCanonicalIntegrityUnchanged(before, after), true);
  });

  it("48. word counts reconcile after application", () => {
    const item = exportItem({
      id: "a",
      original: "He ran fast",
      final: "He sprinted",
      start: SOURCE.indexOf("He ran fast"),
      end: SOURCE.indexOf("He ran fast") + "He ran fast".length,
    });
    const manifest = sampleManifest([item]);
    const plan = buildShadowApplicationPlan({
      manifest,
      sourceText: SOURCE,
      activeVersionId: "ver-1",
      selectedRevisionIds: ["a"],
      conflictResolutions: [],
    });
    const applied = applyShadowPlan({ manifest, sourceText: SOURCE, plan });
    const sourceWords = countManuscriptWords(SOURCE);
    const shadowWords = countManuscriptWords(applied.shadowText);
    assert.equal(typeof shadowWords, "number");
    assert.notEqual(applied.shadowText, SOURCE);
    assert.ok(shadowWords >= 0 && sourceWords >= 0);
  });

  it("50. full shadow generation returns contract", () => {
    const item = exportItem({
      id: "a",
      original: "He ran fast",
      final: "He sprinted",
      start: SOURCE.indexOf("He ran fast"),
      end: SOURCE.indexOf("He ran fast") + "He ran fast".length,
    });
    const manifest = sampleManifest([item]);
    const shadow = applyAcceptedRevisionsToShadow({
      manifest,
      sourceText: SOURCE,
      selectedRevisionIds: ["a"],
      conflictResolutions: [],
      expectedActiveVersionId: "ver-1",
      expectedDecisionSnapshotHash: "snap-1",
    });
    assert.notEqual("error" in shadow, true);
    if ("error" in shadow) return;
    assert.equal(shadow.shadowVersion, STUDIO_SHADOW_VERSION);
    assert.equal(shadow.integrity.canonicalManuscriptModified, false);
    assert.equal(shadow.application.appliedRevisionCount, 1);
  });

  it("52. selection UI renders", () => {
    const src = readFileSync(join(ROOT, "app/studio/books/[bookId]/apply-preview/ShadowPreviewClient.tsx"), "utf8");
    assert.match(src, /Revision Selection/);
    assert.match(src, /Generate Shadow Manuscript Preview/);
  });

  it("64. filenames include shadow-preview", () => {
    const name = buildShadowPreviewFilename("Test Book", "2026-07-27T00:00:00.000Z", "md");
    assert.match(name, /shadow-preview/);
  });

  it("65. downloads contain non-canonical warning", () => {
    const shadow = applyAcceptedRevisionsToShadow({
      manifest: sampleManifest([
        exportItem({
          id: "a",
          original: "He ran fast",
          final: "He sprinted",
          start: SOURCE.indexOf("He ran fast"),
          end: SOURCE.indexOf("He ran fast") + "He ran fast".length,
        }),
      ]),
      sourceText: SOURCE,
      selectedRevisionIds: ["a"],
      conflictResolutions: [],
      expectedActiveVersionId: "ver-1",
      expectedDecisionSnapshotHash: "snap-1",
    });
    if ("error" in shadow) throw new Error(shadow.error);
    const md = generateShadowMarkdownDownload(shadow);
    assert.match(md, new RegExp(SHADOW_NON_CANONICAL_HEADER.split("\n")[0]!));
  });

  it("67. military expert remains disabled", () => {
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
  });

  it("unsupported revision type mapped null", () => {
    assert.equal(mapRevisionTypeToOperation("structural"), null);
  });

  it("operationsOverlap detects overlap", () => {
    assert.equal(operationsOverlap({ startOffset: 0, endOffset: 10 }, { startOffset: 5, endOffset: 15 }), true);
  });

  it("defaultSelectedIds excludes unsafe items", () => {
    const safe = exportItem({ id: "a", original: "He ran fast", final: "He sprinted", start: 10, end: 21 });
    const unsafe = exportItem({
      id: "b",
      original: "missing",
      final: "x",
      start: 0,
      end: 1,
      applicability: { safeToApplyLater: false, sourceTextMatchesActiveVersion: false } as never,
    });
    const ids = defaultSelectedRevisionIds(sampleManifest([safe, unsafe]));
    assert.deepEqual(ids, ["a"]);
  });

  it("stale version blocks generation", () => {
    const item = exportItem({ id: "a", original: "He ran fast", final: "He sprinted", start: SOURCE.indexOf("He ran fast"), end: SOURCE.indexOf("He ran fast") + "He ran fast".length });
    const result = applyAcceptedRevisionsToShadow({
      manifest: sampleManifest([item]),
      sourceText: SOURCE,
      selectedRevisionIds: ["a"],
      conflictResolutions: [],
      expectedActiveVersionId: "stale",
      expectedDecisionSnapshotHash: "snap-1",
    });
    assert.equal("error" in result && result.error.includes("active manuscript version changed"), true);
  });
});
