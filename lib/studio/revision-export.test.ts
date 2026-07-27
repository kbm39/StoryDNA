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
  isApprovedRevisionDecision,
  isPlanningOnlyDisposition,
  resolveFinalExportText,
  STUDIO_REVISION_EXPORT_VERSION,
} from "@/lib/studio/export-eligibility.ts";
import {
  classifySourceTextMatch,
  hashText,
  isSafeToApplyLater,
  resolveLocatorState,
} from "@/lib/studio/export-location-integrity.ts";
import { attachConflictReasons, detectRevisionExportConflicts } from "@/lib/studio/export-conflicts.ts";
import {
  generateStudioRevisionJsonExport,
  parseStudioRevisionJsonExport,
} from "@/lib/studio/revision-export-json.ts";
import { generateStudioRevisionMarkdownExport } from "@/lib/studio/revision-export-markdown.ts";
import {
  buildStudioRevisionJsonFilename,
  PRIVATE_EXPORT_CACHE_CONTROL,
} from "@/lib/studio/revision-export-filename.ts";
import {
  buildTextualDiffLines,
  DIFF_PREVIEW_NOTICE,
  formatTextualDiffForDisplay,
} from "@/lib/studio/textual-diff.ts";
import { buildStudioActionItems } from "@/lib/studio/revision-board.ts";
import type { StudioRevisionExportItem } from "@/lib/studio/export-types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const sampleCandidate = {
  id: "cand-1",
  manuscript_id: "m1",
  issue_id: "issue-1",
  phase_id: null,
  type: "line_edit" as const,
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
  consequence_if_unchanged: null,
  dependencies: null,
  impacts: null,
  export_mode: "inline" as const,
  verified: false,
  status: "proposed" as const,
  created_at: "2026-01-01T00:00:00.000Z",
};

function buildExportItem(
  overrides: Partial<StudioRevisionExportItem> & {
    originalText?: string;
    finalExportText?: string;
    disposition?: "accepted" | "accepted_modified" | "deferred";
  } = {},
): StudioRevisionExportItem {
  const originalText = overrides.originalText ?? "He ran fast.";
  const finalExportText = overrides.finalExportText ?? "He sprinted.";
  const disposition = overrides.disposition ?? "accepted";
  return Object.freeze({
    itemId: overrides.itemId ?? "cand-1",
    revisionCandidateId: overrides.revisionCandidateId ?? "cand-1",
    editorialIssueId: "issue-1",
    reviewId: "rev-1",
    expert: Object.freeze({ expertId: "literary_agent", expertName: "Literary Agent", lifecycleStatus: "open" }),
    manuscriptLocation: Object.freeze({
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
      pageNumber: null,
      paragraphNumber: null,
      startOffset: overrides.manuscriptLocation?.startOffset ?? 0,
      endOffset: overrides.manuscriptLocation?.endOffset ?? originalText.length,
      locatorLabel: "Ch 3",
    }),
    revision: Object.freeze({
      revisionType: "line_edit",
      originalText,
      expertSuggestedText: "He sprinted.",
      authorFinalText: disposition === "accepted_modified" ? finalExportText : null,
      finalExportText,
      disposition,
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
      sourceTextHash: hashText(originalText),
      suggestionHash: hashText("He sprinted."),
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
    planningOnly: disposition === "deferred",
    ...overrides,
  });
}

describe("Kevin Track K4 revision export", () => {
  it("1. export preview action requires requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/actions/revision-export.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
  });

  it("2. json route requires requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/books/[bookId]/exports/json/route.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
  });

  it("3. markdown route requires requireStudioAccess", () => {
    const src = readFileSync(join(ROOT, "app/studio/books/[bookId]/exports/markdown/route.ts"), "utf8");
    assert.match(src, /requireStudioAccess/);
  });

  it("6. accepted included by eligibility", () => {
    assert.equal(isApprovedRevisionDecision("accepted"), true);
  });

  it("7. accepted_modified included by eligibility", () => {
    assert.equal(isApprovedRevisionDecision("modified"), true);
  });

  it("8. rejected excluded", () => {
    assert.equal(isApprovedRevisionDecision("rejected"), false);
  });

  it("9. deferred excluded by default eligibility", () => {
    assert.equal(isApprovedRevisionDecision("skipped"), false);
    assert.equal(isPlanningOnlyDisposition("skipped"), true);
  });

  it("10. pending excluded", () => {
    assert.equal(isApprovedRevisionDecision("pending"), false);
  });

  it("13. accepted uses expert suggestion as finalExportText", () => {
    const result = resolveFinalExportText({
      disposition: "accepted",
      expertSuggestedText: "He sprinted.",
      authorModifiedText: null,
    });
    assert.equal(result.ok && result.text, "He sprinted.");
  });

  it("14. accepted_modified uses author text as finalExportText", () => {
    const result = resolveFinalExportText({
      disposition: "accepted_modified",
      expertSuggestedText: "He sprinted.",
      authorModifiedText: "He dashed.",
    });
    assert.equal(result.ok && result.text, "He dashed.");
  });

  it("15. expert suggestion preserved separately in action items", () => {
    const items = buildStudioActionItems({
      issues: [],
      candidates: [sampleCandidate],
      responses: [
        {
          id: "r1",
          candidate_id: "cand-1",
          manuscript_id: "m1",
          disposition: "modified",
          author_modified_text: "He dashed.",
          author_note: null,
          responded_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(items[0]!.suggestedRewrite, "He sprinted.");
    assert.equal(items[0]!.acceptedText, "He dashed.");
  });

  it("16. missing modified text fails safely", () => {
    const result = resolveFinalExportText({
      disposition: "accepted_modified",
      expertSuggestedText: "He sprinted.",
      authorModifiedText: "  ",
    });
    assert.equal(result.ok, false);
  });

  it("17. exact location classified correctly", () => {
    const match = classifySourceTextMatch({
      originalText: "He ran fast.",
      activeManuscriptText: "Chapter 1. He ran fast. End.",
      storedStartOffset: 11,
      storedEndOffset: 23,
    });
    assert.equal(match.state, "EXACT_MATCH");
  });

  it("18. unique text match classified correctly", () => {
    const match = classifySourceTextMatch({
      originalText: "unique phrase here",
      activeManuscriptText: "Start unique phrase here end",
      storedStartOffset: null,
      storedEndOffset: null,
    });
    assert.equal(match.state, "EXACT_MATCH");
  });

  it("19. multiple matches marked ambiguous", () => {
    const match = classifySourceTextMatch({
      originalText: "the",
      activeManuscriptText: "the cat and the dog",
      storedStartOffset: null,
      storedEndOffset: null,
    });
    assert.equal(match.state, "MULTIPLE_MATCHES");
  });

  it("20. no match marked stale", () => {
    const match = classifySourceTextMatch({
      originalText: "missing text entirely",
      activeManuscriptText: "Something else altogether",
      storedStartOffset: null,
      storedEndOffset: null,
    });
    assert.equal(match.state, "NO_MATCH");
  });

  it("21. no fabricated locator values", () => {
    const locator = resolveLocatorState({
      locatorLabel: "Ch 3",
      startOffset: null,
      endOffset: null,
      sourceTextMatchState: "NO_MATCH",
    });
    assert.equal(locator.locatorResolved, false);
  });

  it("22. unresolved locator marked unsafe", () => {
    assert.equal(
      isSafeToApplyLater({
        sourceTextMatchState: "NO_MATCH",
        locatorResolved: false,
        staleVersion: false,
      }),
      false,
    );
  });

  it("23. contradictory replacements detected", () => {
    const items = [
      buildExportItem({ itemId: "a", finalExportText: "Text A" }),
      buildExportItem({ itemId: "b", finalExportText: "Text B" }),
    ];
    const conflicts = detectRevisionExportConflicts(items);
    assert.ok(conflicts.some((c) => c.conflictType === "contradictory_replacement"));
  });

  it("24. overlapping locations detected", () => {
    const items = [
      buildExportItem({ itemId: "a", manuscriptLocation: { startOffset: 0, endOffset: 10 } as never }),
      buildExportItem({ itemId: "b", manuscriptLocation: { startOffset: 5, endOffset: 15 } as never }),
    ];
    const conflicts = detectRevisionExportConflicts(items);
    assert.ok(conflicts.some((c) => c.conflictType === "overlapping_location"));
  });

  it("27. conflicts do not remove items", () => {
    const items = [buildExportItem()];
    const conflicts = detectRevisionExportConflicts(items);
    const enriched = attachConflictReasons(items, conflicts);
    assert.equal(enriched.length, 1);
  });

  it("28. export version serialized", () => {
    assert.equal(STUDIO_REVISION_EXPORT_VERSION, "studio_revision_export@v1");
  });

  it("35. JSON parses successfully", () => {
    const item = buildExportItem();
    const manifest = {
      exportVersion: STUDIO_REVISION_EXPORT_VERSION,
      exportId: "exp-1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      manuscript: {
        manuscriptId: "m1",
        title: "Book",
        seriesName: null,
        volumeNumber: null,
        activeVersionId: "v1",
        activeVersionLabel: "v1",
        authoritativeWordCount: 1000,
        sourceFilename: "book.docx",
      },
      filters: {
        includedDispositions: ["accepted"],
        includeDeferred: false,
        expertIds: [],
        chapterIds: [],
      },
      integrity: {
        canonicalManuscriptModified: false as const,
        currentVersionChanged: false as const,
        sourceVersionHash: "abc",
        decisionSnapshotHash: "def",
        warning: "test",
      },
      summary: {
        totalCandidates: 1,
        includedItems: 1,
        acceptedUnchanged: 1,
        acceptedModified: 0,
        deferredIncluded: 0,
        excludedRejected: 0,
        excludedPending: 0,
        excludedDeferred: 0,
        unresolvedLocatorCount: 0,
        conflictCount: 0,
        safeForLaterApplication: 1,
        notSafeForAutomaticApplication: 0,
      },
      items: [item],
      planningItems: [],
      conflicts: [],
      expectedActiveVersionId: "v1",
    };
    const json = generateStudioRevisionJsonExport(manifest);
    const parsed = parseStudioRevisionJsonExport(json);
    assert.equal(parsed.exportVersion, STUDIO_REVISION_EXPORT_VERSION);
  });

  it("36. Markdown contains required sections", () => {
    const manifest = {
      exportVersion: STUDIO_REVISION_EXPORT_VERSION,
      exportId: "exp-1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      manuscript: {
        manuscriptId: "m1",
        title: "Book",
        seriesName: null,
        volumeNumber: null,
        activeVersionId: "v1",
        activeVersionLabel: "v1",
        authoritativeWordCount: 1000,
        sourceFilename: "book.docx",
      },
      filters: { includedDispositions: ["accepted"], includeDeferred: false, expertIds: [], chapterIds: [] },
      integrity: {
        canonicalManuscriptModified: false as const,
        currentVersionChanged: false as const,
        sourceVersionHash: null,
        decisionSnapshotHash: "def",
        warning: "manuscript not changed",
      },
      summary: {
        totalCandidates: 1,
        includedItems: 1,
        acceptedUnchanged: 1,
        acceptedModified: 0,
        deferredIncluded: 0,
        excludedRejected: 0,
        excludedPending: 0,
        excludedDeferred: 0,
        unresolvedLocatorCount: 0,
        conflictCount: 0,
        safeForLaterApplication: 1,
        notSafeForAutomaticApplication: 0,
      },
      items: [buildExportItem()],
      planningItems: [],
      conflicts: [],
      expectedActiveVersionId: "v1",
    };
    const md = generateStudioRevisionMarkdownExport(manifest);
    assert.match(md, /# Accepted Revision Decisions/);
    assert.match(md, /### Original/);
    assert.match(md, /### Expert Suggestion/);
    assert.match(md, /### Kevin's Final Text/);
    assert.match(md, /### Application Readiness/);
  });

  it("37. filenames sanitized", () => {
    const name = buildStudioRevisionJsonFilename('Book: "Redemption"!', "2026-07-27T00:00:00.000Z");
    assert.doesNotMatch(name, /"/);
    assert.match(name, /\.json$/);
  });

  it("38. private cache headers constant", () => {
    assert.match(PRIVATE_EXPORT_CACHE_CONTROL, /no-store/);
  });

  it("39. stale version check implemented in manifest module", () => {
    const src = readFileSync(join(ROOT, "lib/studio/revision-export-manifest.ts"), "utf8");
    assert.match(src, /assertActiveVersionMatches/);
    assert.match(src, /The active manuscript version changed after this preview was generated/);
  });

  it("47. preview UI includes side-by-side panels", () => {
    const src = readFileSync(
      join(ROOT, "app/studio/books/[bookId]/exports/AcceptedRevisionPreviewClient.tsx"),
      "utf8",
    );
    assert.match(src, /Original/);
    assert.match(src, /Expert Suggestion/);
    assert.match(src, /Kevin/);
  });

  it("48. diff preview renders", () => {
    const lines = buildTextualDiffLines("He ran fast.", "He sprinted fast.");
    const formatted = formatTextualDiffForDisplay(lines);
    assert.match(formatted, /[-+]/);
    assert.equal(DIFF_PREVIEW_NOTICE, "Preview only — not yet applied to manuscript.");
  });

  it("58. commercial exports unchanged", () => {
    const src = readFileSync(join(ROOT, "app/manuscripts/[id]/export-reviews/route.ts"), "utf8");
    assert.doesNotMatch(src, /requireStudioAccess/);
  });

  it("60. military expert remains globally disabled", () => {
    assert.equal(getExpertCatalogEntry("military_expert")!.selectionEnabled, false);
    assert.equal(EXPERT_CATALOG_ENTRIES.length, 6);
  });

  it("manifest builder export exists", () => {
    const src = readFileSync(join(ROOT, "lib/studio/revision-export-manifest.ts"), "utf8");
    assert.match(src, /buildAcceptedRevisionManifest/);
  });
});
