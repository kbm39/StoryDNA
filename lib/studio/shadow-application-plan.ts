import type { StudioRevisionExport, StudioRevisionExportItem } from "./export-types.ts";
import { hashText } from "./export-location-integrity.ts";
import {
  classifyBlockedState,
  mapRevisionTypeToOperation,
  operationsOverlap,
  sortOperationsForApplication,
  unsupportedApplicationReason,
} from "./shadow-operations.ts";
import type {
  ShadowApplicationPlan,
  ShadowApplicationPlanOperation,
  ShadowConflictResolution,
  StudioShadowApplicationItem,
} from "./shadow-types.ts";

export interface BuildShadowApplicationPlanInput {
  readonly manifest: StudioRevisionExport;
  readonly sourceText: string;
  readonly activeVersionId: string | null;
  readonly selectedRevisionIds: readonly string[];
  readonly conflictResolutions: readonly ShadowConflictResolution[];
}

function toApplicationItem(
  item: StudioRevisionExportItem,
  state: StudioShadowApplicationItem["applicationState"],
  reason: string,
  operationType: StudioShadowApplicationItem["operationType"],
): StudioShadowApplicationItem {
  return Object.freeze({
    revisionCandidateId: item.revisionCandidateId,
    editorialIssueId: item.editorialIssueId,
    reviewId: item.reviewId,
    expertId: item.expert.expertId,
    expertName: item.expert.expertName,
    disposition: item.revision.disposition,
    revisionType: item.revision.revisionType,
    originalText: item.revision.originalText,
    finalText: item.revision.finalExportText,
    sourceVersionId: item.source.manuscriptVersionId,
    locator: item.manuscriptLocation.locatorLabel,
    sourceMatchState: item.applicability.sourceTextMatchState,
    applicationState: state,
    applicationReason: reason,
    appliedStartOffset: item.manuscriptLocation.startOffset,
    appliedEndOffset: item.manuscriptLocation.endOffset,
    sourceHash: item.source.sourceTextHash,
    replacementHash: hashText(item.revision.finalExportText),
    operationType,
  });
}

function isExcludedByConflict(
  itemId: string,
  manifest: StudioRevisionExport,
  resolutions: readonly ShadowConflictResolution[],
): boolean {
  for (const conflict of manifest.conflicts) {
    if (!conflict.affectedItemIds.includes(itemId)) continue;
    const resolution = resolutions.find((r) => r.conflictId === conflict.conflictId);
    if (!resolution || resolution.choice === "unresolved") return true;
    if (resolution.choice === "exclude_both") return true;
    if (resolution.choice === "apply_item_a" && itemId !== conflict.affectedItemIds[0]) return true;
    if (resolution.choice === "apply_item_b" && itemId !== conflict.affectedItemIds[1]) return true;
  }
  return false;
}

export function buildShadowApplicationPlan(input: BuildShadowApplicationPlanInput): ShadowApplicationPlan {
  const selected = new Set(input.selectedRevisionIds);
  const operations: ShadowApplicationPlanOperation[] = [];
  const blockedItems: StudioShadowApplicationItem[] = [];
  const skippedItems: StudioShadowApplicationItem[] = [];

  for (const item of input.manifest.items) {
    if (item.planningOnly) continue;

    const operationType = mapRevisionTypeToOperation(item.revision.revisionType);
    const staleVersion =
      Boolean(
        item.source.manuscriptVersionId &&
          input.activeVersionId &&
          item.source.manuscriptVersionId !== input.activeVersionId,
      );
    const sourceMismatch = !item.applicability.sourceTextMatchesActiveVersion;
    const ambiguousLocator = item.applicability.sourceTextMatchState === "MULTIPLE_MATCHES";
    const hasConflict = item.applicability.conflictReasons.length > 0;
    const notSelected = !selected.has(item.revisionCandidateId);

    if (notSelected) {
      skippedItems.push(
        toApplicationItem(item, "skipped_unselected", "Revision was not selected for shadow application.", operationType),
      );
      continue;
    }

    if (isExcludedByConflict(item.itemId, input.manifest, input.conflictResolutions)) {
      blockedItems.push(
        toApplicationItem(item, "blocked_conflict", "Conflict requires explicit resolution before application.", operationType),
      );
      continue;
    }

    if (!operationType) {
      skippedItems.push(
        toApplicationItem(
          item,
          "skipped_unsafe",
          unsupportedApplicationReason(item.revision.revisionType),
          null,
        ),
      );
      continue;
    }

    if (staleVersion) {
      blockedItems.push(
        toApplicationItem(item, "blocked_stale_version", "Revision is based on a non-active manuscript version.", operationType),
      );
      continue;
    }

    if (sourceMismatch) {
      blockedItems.push(
        toApplicationItem(item, "blocked_source_mismatch", "Source text does not match the active manuscript.", operationType),
      );
      continue;
    }

    if (ambiguousLocator) {
      blockedItems.push(
        toApplicationItem(item, "blocked_ambiguous_locator", "Source location is ambiguous in the active manuscript.", operationType),
      );
      continue;
    }

    if (!item.applicability.safeToApplyLater) {
      skippedItems.push(
        toApplicationItem(item, "skipped_unsafe", "Revision is not safe for automatic shadow application.", operationType),
      );
      continue;
    }

    const start = item.manuscriptLocation.startOffset;
    const end = item.manuscriptLocation.endOffset;
    if (start === null || end === null) {
      skippedItems.push(
        toApplicationItem(item, "skipped_unsafe", "Deterministic source offsets are unavailable.", operationType),
      );
      continue;
    }

    if (operationType === "deletion" && item.revision.finalExportText.trim()) {
      skippedItems.push(
        toApplicationItem(item, "skipped_unsafe", "Deletion requires empty final text.", operationType),
      );
      continue;
    }

    operations.push(
      Object.freeze({
        itemId: item.itemId,
        operationType,
        startOffset: start,
        endOffset: end,
        originalText: item.revision.originalText,
        finalText: item.revision.finalExportText,
        sourceMatchState: item.applicability.sourceTextMatchState,
        ready: true,
        blockReason: null,
      }),
    );
  }

  const sorted = sortOperationsForApplication(operations);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (operationsOverlap(sorted[i]!, sorted[j]!)) {
        const item = input.manifest.items.find((m) => m.itemId === sorted[i]!.itemId)!;
        blockedItems.push(
          toApplicationItem(item, "blocked_conflict", "Overlapping shadow operations require conflict resolution.", mapRevisionTypeToOperation(item.revision.revisionType)),
        );
        const other = input.manifest.items.find((m) => m.itemId === sorted[j]!.itemId)!;
        blockedItems.push(
          toApplicationItem(other, "blocked_conflict", "Overlapping shadow operations require conflict resolution.", mapRevisionTypeToOperation(other.revision.revisionType)),
        );
      }
    }
  }

  const blockedIds = new Set(blockedItems.map((b) => b.revisionCandidateId));
  const readyOps = sorted.filter((op) => !blockedIds.has(op.itemId));

  return Object.freeze({
    operations: Object.freeze(readyOps),
    blockedItems: Object.freeze(blockedItems),
    skippedItems: Object.freeze(skippedItems),
  });
}
