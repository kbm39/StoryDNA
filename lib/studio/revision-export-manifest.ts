import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions.ts";
import { getManuscriptMeta, getManuscriptReviewContext } from "@/lib/reviews.ts";
import { getAuthorEditResponses } from "@/lib/suggested-edits.ts";
import { getSeries } from "@/lib/series.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { mapDbDispositionToStudio } from "./decisions.ts";
import {
  isApprovedRevisionDecision,
  isPlanningOnlyDisposition,
  resolveFinalExportText,
  STUDIO_REVISION_EXPORT_VERSION,
} from "./export-eligibility.ts";
import { attachConflictReasons, detectRevisionExportConflicts } from "./export-conflicts.ts";
import {
  classifySourceTextMatch,
  hashText,
  isSafeToApplyLater,
  resolveLocatorState,
} from "./export-location-integrity.ts";
import type {
  StudioRevisionExport,
  StudioRevisionExportItem,
} from "./export-types.ts";

export interface BuildAcceptedRevisionManifestInput {
  readonly manuscriptId: string;
  readonly includeDeferred?: boolean;
  readonly expertIds?: readonly string[];
  readonly chapterIds?: readonly string[];
  readonly generatedAt?: string;
}

function decisionSnapshotHash(items: readonly StudioRevisionExportItem[], versionId: string | null): string {
  const payload = items
    .map(
      (item) =>
        `${item.revisionCandidateId}|${item.revision.disposition}|${item.revision.finalExportText}|${versionId ?? ""}`,
    )
    .sort()
    .join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function compareExportItems(a: StudioRevisionExportItem, b: StudioRevisionExportItem): number {
  const aOffset = a.manuscriptLocation.startOffset ?? Number.MAX_SAFE_INTEGER;
  const bOffset = b.manuscriptLocation.startOffset ?? Number.MAX_SAFE_INTEGER;
  if (aOffset !== bOffset) return aOffset - bOffset;

  const aLocator = a.manuscriptLocation.locatorLabel ?? "";
  const bLocator = b.manuscriptLocation.locatorLabel ?? "";
  if (aLocator !== bLocator) return aLocator.localeCompare(bLocator);

  const aDate = a.source.decisionUpdatedAt;
  const bDate = b.source.decisionUpdatedAt;
  if (aDate !== bDate) return aDate.localeCompare(bDate);

  return a.revisionCandidateId.localeCompare(b.revisionCandidateId);
}

export async function buildAcceptedRevisionManifest(
  input: BuildAcceptedRevisionManifestInput,
): Promise<StudioRevisionExport | null> {
  const meta = await getManuscriptMeta(input.manuscriptId);
  if (!meta) return null;

  const [ctx, series, issues, candidates, { responses }] = await Promise.all([
    getManuscriptReviewContext(input.manuscriptId),
    meta.series_id ? getSeries(meta.series_id) : Promise.resolve(null),
    getEditorialIssues(input.manuscriptId),
    getRevisionCandidates(input.manuscriptId),
    getAuthorEditResponses(input.manuscriptId),
  ]);

  const supabase = getSupabaseAdmin();
  let versionLabel: string | null = null;
  if (meta.current_version_id) {
    const { data: version } = await supabase
      .from("manuscript_versions")
      .select("label, version_number")
      .eq("id", meta.current_version_id)
      .maybeSingle();
    versionLabel =
      (version?.label as string | null) ??
      (version?.version_number ? `v${version.version_number}` : null);
  }

  const issueById = new Map(issues.map((i) => [i.id, i]));
  const responseByCandidate = new Map(responses.map((r) => [r.candidate_id, r]));
  const activeText = ctx?.passageVerificationText ?? ctx?.extractedText ?? "";
  const activeVersionId = ctx?.manuscriptVersionId ?? meta.current_version_id ?? null;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const approvedItems: StudioRevisionExportItem[] = [];
  const planningItems: StudioRevisionExportItem[] = [];

  let excludedRejected = 0;
  let excludedPending = 0;
  let excludedDeferred = 0;

  for (const candidate of candidates) {
    const response = responseByCandidate.get(candidate.id);
    const disposition = mapDbDispositionToStudio(response?.disposition);
    const issue = candidate.issue_id ? issueById.get(candidate.issue_id) : undefined;
    const expertName = issue?.owning_reviewer ?? "Literary Agent";
    const expertId = expertName.toLowerCase().replace(/\s+/g, "_");

    if (input.expertIds?.length && !input.expertIds.includes(expertId)) continue;
    const chapterLabel = candidate.locator ?? null;
    if (input.chapterIds?.length && chapterLabel && !input.chapterIds.includes(chapterLabel)) continue;

    if (disposition === "rejected") {
      excludedRejected += 1;
      continue;
    }
    if (disposition === "pending") {
      excludedPending += 1;
      continue;
    }
    if (disposition === "deferred") {
      excludedDeferred += 1;
      if (!input.includeDeferred) continue;
    }
    if (!isApprovedRevisionDecision(disposition) && !isPlanningOnlyDisposition(response?.disposition)) {
      continue;
    }

    const finalResolved = isApprovedRevisionDecision(disposition)
      ? resolveFinalExportText({
          disposition,
          expertSuggestedText: candidate.revised,
          authorModifiedText: response?.author_modified_text ?? null,
        })
      : { ok: true as const, text: candidate.revised };

    if (!finalResolved.ok) continue;

    const match = classifySourceTextMatch({
      originalText: candidate.original,
      activeManuscriptText: activeText,
      storedStartOffset: null,
      storedEndOffset: null,
    });
    const locator = resolveLocatorState({
      locatorLabel: chapterLabel,
      startOffset: match.startOffset,
      endOffset: match.endOffset,
      sourceTextMatchState: match.state,
    });
    const staleVersion =
      Boolean(candidate.manuscript_version_id && activeVersionId && candidate.manuscript_version_id !== activeVersionId);
    const conflictReasons: string[] = [];
    if (staleVersion) conflictReasons.push("stale_manuscript_version");

    const item: StudioRevisionExportItem = Object.freeze({
      itemId: candidate.id,
      revisionCandidateId: candidate.id,
      editorialIssueId: candidate.issue_id,
      reviewId: issue?.review_id ?? null,
      expert: Object.freeze({
        expertId,
        expertName,
        lifecycleStatus: issue?.resolution_status ?? null,
      }),
      manuscriptLocation: Object.freeze({
        chapterId: null,
        chapterTitle: null,
        chapterNumber: null,
        pageNumber: null,
        paragraphNumber: null,
        startOffset: match.startOffset,
        endOffset: match.endOffset,
        locatorLabel: chapterLabel,
      }),
      revision: Object.freeze({
        revisionType: candidate.type,
        originalText: candidate.original,
        expertSuggestedText: candidate.revised,
        authorFinalText:
          disposition === "accepted_modified" ? response?.author_modified_text ?? null : null,
        finalExportText: finalResolved.text,
        disposition: isApprovedRevisionDecision(disposition) ? disposition : "deferred",
        authorNote: response?.author_note ?? null,
        rejectionReason: null,
        explanation: candidate.reason ?? issue?.text ?? "",
        rewriteRationale: candidate.confidence_reason ?? candidate.reason ?? null,
        severity: issue?.severity ?? candidate.story_risk ?? null,
        confidence: candidate.confidence,
        canonImpact: candidate.consequence_if_unchanged ?? null,
      }),
      source: Object.freeze({
        manuscriptVersionId: candidate.manuscript_version_id ?? response?.manuscript_version_id ?? null,
        sourceTextHash: hashText(candidate.original),
        suggestionHash: hashText(candidate.revised),
        decisionUpdatedAt: response?.updated_at ?? response?.responded_at ?? candidate.created_at,
      }),
      applicability: Object.freeze({
        locatorResolved: locator.locatorResolved,
        locatorResolution: locator.locatorResolution,
        sourceTextMatchState: match.state,
        sourceTextMatchesActiveVersion: match.matchesActiveVersion,
        safeToApplyLater: isSafeToApplyLater({
          sourceTextMatchState: match.state,
          locatorResolved: locator.locatorResolved,
          staleVersion,
        }),
        conflictReasons: Object.freeze(conflictReasons),
      }),
      planningOnly: disposition === "deferred",
    });

    if (item.planningOnly) planningItems.push(item);
    else approvedItems.push(item);
  }

  approvedItems.sort(compareExportItems);
  planningItems.sort(compareExportItems);

  let itemsWithConflicts = attachConflictReasons(approvedItems, []);
  const conflicts = detectRevisionExportConflicts(itemsWithConflicts);
  itemsWithConflicts = attachConflictReasons(itemsWithConflicts, conflicts);

  const unresolvedLocatorCount = itemsWithConflicts.filter((i) => !i.applicability.locatorResolved).length;
  const safeForLaterApplication = itemsWithConflicts.filter((i) => i.applicability.safeToApplyLater).length;

  const exportData: StudioRevisionExport = Object.freeze({
    exportVersion: STUDIO_REVISION_EXPORT_VERSION,
    exportId: randomUUID(),
    generatedAt,
    manuscript: Object.freeze({
      manuscriptId: input.manuscriptId,
      title: meta.title,
      seriesName: series?.title ?? null,
      volumeNumber: meta.series_order ?? null,
      activeVersionId,
      activeVersionLabel: versionLabel,
      authoritativeWordCount: ctx?.wordCount ?? meta.word_count ?? null,
      sourceFilename: meta.original_filename ?? null,
    }),
    filters: Object.freeze({
      includedDispositions: input.includeDeferred
        ? (["accepted", "accepted_modified", "deferred"] as const)
        : (["accepted", "accepted_modified"] as const),
      includeDeferred: input.includeDeferred === true,
      expertIds: Object.freeze(input.expertIds ?? []),
      chapterIds: Object.freeze(input.chapterIds ?? []),
    }),
    integrity: Object.freeze({
      canonicalManuscriptModified: false,
      currentVersionChanged: false,
      sourceVersionHash: ctx?.contentHash ?? null,
      decisionSnapshotHash: decisionSnapshotHash(itemsWithConflicts, activeVersionId),
      warning:
        "This export records accepted editorial decisions. Your canonical manuscript has not been changed.",
    }),
    summary: Object.freeze({
      totalCandidates: candidates.length,
      includedItems: itemsWithConflicts.length + planningItems.length,
      acceptedUnchanged: itemsWithConflicts.filter((i) => i.revision.disposition === "accepted").length,
      acceptedModified: itemsWithConflicts.filter((i) => i.revision.disposition === "accepted_modified").length,
      deferredIncluded: planningItems.length,
      excludedRejected,
      excludedPending,
      excludedDeferred: input.includeDeferred ? 0 : excludedDeferred,
      unresolvedLocatorCount,
      conflictCount: conflicts.length,
      safeForLaterApplication,
      notSafeForAutomaticApplication: itemsWithConflicts.length - safeForLaterApplication,
    }),
    items: Object.freeze(itemsWithConflicts),
    planningItems: Object.freeze(planningItems),
    conflicts: Object.freeze(conflicts),
    expectedActiveVersionId: activeVersionId,
  });

  return exportData;
}

export async function assertActiveVersionMatches(input: {
  readonly manuscriptId: string;
  readonly expectedActiveVersionId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getManuscriptReviewContext(input.manuscriptId);
  if (!ctx) return { ok: false, error: "Manuscript not found." };
  const current = ctx.manuscriptVersionId ?? null;
  if (current !== input.expectedActiveVersionId) {
    return {
      ok: false,
      error:
        "The active manuscript version changed after this preview was generated. Refresh the preview before exporting.",
    };
  }
  return { ok: true };
}
