import { createHash, randomUUID } from "node:crypto";
import { countManuscriptWords } from "@/lib/word-count.ts";
import { hashText } from "./export-location-integrity.ts";
import { buildShadowApplicationPlan } from "./shadow-application-plan.ts";
import { applyTextOperation } from "./shadow-operations.ts";
import type { StudioRevisionExport } from "./export-types.ts";
import type {
  ShadowApplicationPlan,
  ShadowConflictResolution,
  StudioShadowApplicationItem,
  StudioShadowChapter,
  StudioShadowConflict,
  StudioShadowManuscript,
} from "./shadow-types.ts";
import { STUDIO_SHADOW_VERSION } from "./shadow-types.ts";

export interface ApplyShadowInput {
  readonly manifest: StudioRevisionExport;
  readonly sourceText: string;
  readonly selectedRevisionIds: readonly string[];
  readonly conflictResolutions: readonly ShadowConflictResolution[];
  readonly expectedActiveVersionId: string | null;
  readonly expectedDecisionSnapshotHash: string;
}

export function defaultSelectedRevisionIds(manifest: StudioRevisionExport): string[] {
  return manifest.items
    .filter(
      (item) =>
        !item.planningOnly &&
        item.applicability.safeToApplyLater &&
        item.applicability.conflictReasons.length === 0 &&
        item.applicability.sourceTextMatchesActiveVersion,
    )
    .map((item) => item.revisionCandidateId);
}

function buildWholeManuscriptChapter(
  sourceText: string,
  shadowText: string,
  appliedIds: readonly string[],
): StudioShadowChapter {
  return Object.freeze({
    chapterId: "whole-manuscript",
    chapterTitle: "Full Manuscript",
    chapterNumber: null,
    sourceText,
    shadowText,
    sourceHash: hashText(sourceText),
    shadowHash: hashText(shadowText),
    changed: sourceText !== shadowText,
    appliedRevisionIds: appliedIds,
    diffSummary:
      sourceText === shadowText
        ? "No textual changes applied."
        : `${appliedIds.length} revision(s) applied to the shadow preview.`,
  });
}

export function applyShadowPlan(input: {
  readonly manifest: StudioRevisionExport;
  readonly sourceText: string;
  readonly plan: ShadowApplicationPlan;
}): {
  readonly shadowText: string;
  readonly appliedItems: StudioShadowApplicationItem[];
  readonly failedItems: StudioShadowApplicationItem[];
} {
  let shadowText = input.sourceText;
  const appliedItems: StudioShadowApplicationItem[] = [];
  const failedItems: StudioShadowApplicationItem[] = [];

  for (const op of input.plan.operations) {
    const manifestItem = input.manifest.items.find((i) => i.itemId === op.itemId);
    if (!manifestItem) continue;

    const result = applyTextOperation({
      text: shadowText,
      operationType: op.operationType,
      startOffset: op.startOffset,
      endOffset: op.endOffset,
      finalText: op.finalText,
      expectedOriginal: op.originalText,
    });

    if (!result.ok) {
      failedItems.push(
        Object.freeze({
          revisionCandidateId: manifestItem.revisionCandidateId,
          editorialIssueId: manifestItem.editorialIssueId,
          reviewId: manifestItem.reviewId,
          expertId: manifestItem.expert.expertId,
          expertName: manifestItem.expert.expertName,
          disposition: manifestItem.revision.disposition,
          revisionType: manifestItem.revision.revisionType,
          originalText: manifestItem.revision.originalText,
          finalText: manifestItem.revision.finalExportText,
          sourceVersionId: manifestItem.source.manuscriptVersionId,
          locator: manifestItem.manuscriptLocation.locatorLabel,
          sourceMatchState: manifestItem.applicability.sourceTextMatchState,
          applicationState: "failed_internal",
          applicationReason: result.error,
          appliedStartOffset: op.startOffset,
          appliedEndOffset: op.endOffset,
          sourceHash: manifestItem.source.sourceTextHash,
          replacementHash: hashText(manifestItem.revision.finalExportText),
          operationType: op.operationType,
        }),
      );
      continue;
    }

    shadowText = result.text;
    appliedItems.push(
      Object.freeze({
        revisionCandidateId: manifestItem.revisionCandidateId,
        editorialIssueId: manifestItem.editorialIssueId,
        reviewId: manifestItem.reviewId,
        expertId: manifestItem.expert.expertId,
        expertName: manifestItem.expert.expertName,
        disposition: manifestItem.revision.disposition,
        revisionType: manifestItem.revision.revisionType,
        originalText: manifestItem.revision.originalText,
        finalText: manifestItem.revision.finalExportText,
        sourceVersionId: manifestItem.source.manuscriptVersionId,
        locator: manifestItem.manuscriptLocation.locatorLabel,
        sourceMatchState: manifestItem.applicability.sourceTextMatchState,
        applicationState: "applied",
        applicationReason: "Applied to shadow preview.",
        appliedStartOffset: op.startOffset,
        appliedEndOffset: op.endOffset,
        sourceHash: manifestItem.source.sourceTextHash,
        replacementHash: hashText(manifestItem.revision.finalExportText),
        operationType: op.operationType,
      }),
    );
  }

  return Object.freeze({ shadowText, appliedItems, failedItems });
}

export function applyAcceptedRevisionsToShadow(input: ApplyShadowInput): StudioShadowManuscript | { error: string } {
  if (input.expectedActiveVersionId !== input.manifest.expectedActiveVersionId) {
    return {
      error:
        "The active manuscript version changed after the application plan was prepared. Refresh the preview before continuing.",
    };
  }

  if (input.expectedDecisionSnapshotHash !== input.manifest.integrity.decisionSnapshotHash) {
    return {
      error:
        "Revision decisions changed after the application plan was prepared. Refresh the preview before continuing.",
    };
  }

  const plan = buildShadowApplicationPlan({
    manifest: input.manifest,
    sourceText: input.sourceText,
    activeVersionId: input.manifest.expectedActiveVersionId,
    selectedRevisionIds: input.selectedRevisionIds,
    conflictResolutions: input.conflictResolutions,
  });

  const { shadowText, appliedItems, failedItems } = applyShadowPlan({
    manifest: input.manifest,
    sourceText: input.sourceText,
    plan,
  });

  const sourceWordCount = countManuscriptWords(input.sourceText);
  const finalWordCount = countManuscriptWords(shadowText);
  const sourceCharacterCount = input.sourceText.length;
  const finalCharacterCount = shadowText.length;

  const unresolvedConflictIds = input.manifest.conflicts
    .filter((c) => {
      const resolution = input.conflictResolutions.find((r) => r.conflictId === c.conflictId);
      return !resolution || resolution.choice === "unresolved";
    })
    .map((c) => c.conflictId);

  const conflicts: StudioShadowConflict[] = input.manifest.conflicts.map((c) =>
    Object.freeze({
      conflictId: c.conflictId,
      conflictType: c.conflictType,
      affectedItemIds: c.affectedItemIds,
      explanation: c.explanation,
      resolution:
        input.conflictResolutions.find((r) => r.conflictId === c.conflictId)?.choice ?? "unresolved",
    }),
  );

  const hasWarnings =
    plan.skippedItems.length > 0 ||
    plan.blockedItems.length > 0 ||
    failedItems.length > 0 ||
    unresolvedConflictIds.length > 0;

  const blockingReasons: string[] = [];
  if (unresolvedConflictIds.length > 0) {
    blockingReasons.push("Unresolved conflicts remain.");
  }
  if (failedItems.length > 0) {
    blockingReasons.push("One or more operations failed verification.");
  }

  const applicationStatus =
    failedItems.length > 0 && appliedItems.length === 0
      ? "failed"
      : hasWarnings
        ? "preview_complete_with_warnings"
        : "preview_complete";

  const appliedIds = appliedItems.map((i) => i.revisionCandidateId);
  const chapters = [buildWholeManuscriptChapter(input.sourceText, shadowText, appliedIds)];

  return Object.freeze({
    shadowVersion: STUDIO_SHADOW_VERSION,
    shadowId: randomUUID(),
    generatedAt: new Date().toISOString(),
    manuscript: Object.freeze({
      manuscriptId: input.manifest.manuscript.manuscriptId,
      title: input.manifest.manuscript.title,
      seriesName: input.manifest.manuscript.seriesName,
      volumeNumber: input.manifest.manuscript.volumeNumber,
    }),
    source: Object.freeze({
      activeVersionId: input.manifest.expectedActiveVersionId,
      sourceVersionLabel: input.manifest.manuscript.activeVersionLabel,
      sourceFilename: input.manifest.manuscript.sourceFilename,
      sourceWordCount,
      sourceCharacterCount,
      sourceHash: hashText(input.sourceText),
    }),
    selection: Object.freeze({
      requestedRevisionIds: Object.freeze(input.selectedRevisionIds),
      includedRevisionIds: Object.freeze(appliedIds),
      excludedRevisionIds: Object.freeze(
        input.manifest.items
          .map((i) => i.revisionCandidateId)
          .filter((id) => !input.selectedRevisionIds.includes(id)),
      ),
      resolvedConflictIds: Object.freeze(
        input.conflictResolutions.filter((r) => r.choice !== "unresolved").map((r) => r.conflictId),
      ),
      unresolvedConflictIds: Object.freeze(unresolvedConflictIds),
    }),
    application: Object.freeze({
      applicationStatus,
      appliedRevisionCount: appliedItems.length,
      skippedRevisionCount: plan.skippedItems.length,
      failedRevisionCount: failedItems.length,
      conflictCount: conflicts.length,
      unresolvedConflictCount: unresolvedConflictIds.length,
      sourceMismatchCount: plan.blockedItems.filter((b) => b.applicationState === "blocked_source_mismatch").length,
      finalWordCount,
      finalCharacterCount,
      finalHash: hashText(shadowText),
      netWordChange: finalWordCount - sourceWordCount,
      netCharacterChange: finalCharacterCount - sourceCharacterCount,
    }),
    integrity: Object.freeze({
      canonicalManuscriptModified: false,
      canonicalVersionChanged: false,
      sourceVersionStillActive: true,
      allAppliedSourcesVerified: failedItems.length === 0,
      readyForPromotionReview:
        applicationStatus === "preview_complete" && unresolvedConflictIds.length === 0 && failedItems.length === 0,
      blockingReasons: Object.freeze(blockingReasons),
      decisionSnapshotHash: input.manifest.integrity.decisionSnapshotHash,
      expectedActiveVersionId: input.manifest.expectedActiveVersionId,
    }),
    shadowText,
    chapters,
    appliedItems: Object.freeze(appliedItems),
    skippedItems: Object.freeze(plan.skippedItems),
    failedItems: Object.freeze([...plan.blockedItems, ...failedItems]),
    conflicts: Object.freeze(conflicts),
  });
}

export function snapshotCanonicalIntegrity(input: {
  readonly extractedText: string | null;
  readonly currentVersionId: string | null;
  readonly storagePath: string | null;
}) {
  return Object.freeze({
    textHash: hashText(input.extractedText ?? ""),
    currentVersionId: input.currentVersionId,
    storagePath: input.storagePath,
  });
}

export function assertCanonicalIntegrityUnchanged(
  before: ReturnType<typeof snapshotCanonicalIntegrity>,
  after: ReturnType<typeof snapshotCanonicalIntegrity>,
): boolean {
  return (
    before.textHash === after.textHash &&
    before.currentVersionId === after.currentVersionId &&
    before.storagePath === after.storagePath
  );
}
