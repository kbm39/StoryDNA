/** Studio shadow manuscript contract (K5). */

export const STUDIO_SHADOW_VERSION = "studio_shadow_manuscript@v1" as const;

export type ShadowApplicationState =
  | "applied"
  | "skipped_unsafe"
  | "skipped_unselected"
  | "blocked_conflict"
  | "blocked_stale_version"
  | "blocked_source_mismatch"
  | "blocked_ambiguous_locator"
  | "failed_internal";

export type ShadowApplicationStatus =
  | "preview_complete"
  | "preview_complete_with_warnings"
  | "blocked"
  | "failed";

export type ShadowOperationType =
  | "replacement"
  | "insertion_before"
  | "insertion_after"
  | "deletion";

export type ShadowConflictResolutionChoice =
  | "unresolved"
  | "apply_item_a"
  | "apply_item_b"
  | "apply_both_in_explicit_order"
  | "exclude_both"
  | "custom_shadow_text"
  | "resolved";

export interface ShadowConflictResolution {
  readonly conflictId: string;
  readonly choice: ShadowConflictResolutionChoice;
  readonly customText?: string | null;
  readonly explicitOrder?: readonly [string, string];
}

export interface StudioShadowApplicationItem {
  readonly revisionCandidateId: string;
  readonly editorialIssueId: string | null;
  readonly reviewId: string | null;
  readonly expertId: string;
  readonly expertName: string;
  readonly disposition: string;
  readonly revisionType: string;
  readonly originalText: string;
  readonly finalText: string;
  readonly sourceVersionId: string | null;
  readonly locator: string | null;
  readonly sourceMatchState: string;
  readonly applicationState: ShadowApplicationState;
  readonly applicationReason: string;
  readonly appliedStartOffset: number | null;
  readonly appliedEndOffset: number | null;
  readonly sourceHash: string;
  readonly replacementHash: string;
  readonly operationType: ShadowOperationType | null;
}

export interface StudioShadowChapter {
  readonly chapterId: string;
  readonly chapterTitle: string;
  readonly chapterNumber: number | null;
  readonly sourceText: string;
  readonly shadowText: string;
  readonly sourceHash: string;
  readonly shadowHash: string;
  readonly changed: boolean;
  readonly appliedRevisionIds: readonly string[];
  readonly diffSummary: string;
}

export interface StudioShadowConflict {
  readonly conflictId: string;
  readonly conflictType: string;
  readonly affectedItemIds: readonly string[];
  readonly explanation: string;
  readonly resolution: ShadowConflictResolutionChoice;
}

export interface StudioShadowManuscript {
  readonly shadowVersion: string;
  readonly shadowId: string;
  readonly generatedAt: string;
  readonly manuscript: {
    readonly manuscriptId: string;
    readonly title: string;
    readonly seriesName: string | null;
    readonly volumeNumber: number | null;
  };
  readonly source: {
    readonly activeVersionId: string | null;
    readonly sourceVersionLabel: string | null;
    readonly sourceFilename: string | null;
    readonly sourceWordCount: number;
    readonly sourceCharacterCount: number;
    readonly sourceHash: string;
  };
  readonly selection: {
    readonly requestedRevisionIds: readonly string[];
    readonly includedRevisionIds: readonly string[];
    readonly excludedRevisionIds: readonly string[];
    readonly resolvedConflictIds: readonly string[];
    readonly unresolvedConflictIds: readonly string[];
  };
  readonly application: {
    readonly applicationStatus: ShadowApplicationStatus;
    readonly appliedRevisionCount: number;
    readonly skippedRevisionCount: number;
    readonly failedRevisionCount: number;
    readonly conflictCount: number;
    readonly unresolvedConflictCount: number;
    readonly sourceMismatchCount: number;
    readonly finalWordCount: number;
    readonly finalCharacterCount: number;
    readonly finalHash: string;
    readonly netWordChange: number;
    readonly netCharacterChange: number;
  };
  readonly integrity: {
    readonly canonicalManuscriptModified: false;
    readonly canonicalVersionChanged: false;
    readonly sourceVersionStillActive: boolean;
    readonly allAppliedSourcesVerified: boolean;
    readonly readyForPromotionReview: boolean;
    readonly blockingReasons: readonly string[];
    readonly decisionSnapshotHash: string;
    readonly expectedActiveVersionId: string | null;
  };
  readonly shadowText: string;
  readonly chapters: readonly StudioShadowChapter[];
  readonly appliedItems: readonly StudioShadowApplicationItem[];
  readonly skippedItems: readonly StudioShadowApplicationItem[];
  readonly failedItems: readonly StudioShadowApplicationItem[];
  readonly conflicts: readonly StudioShadowConflict[];
}

export interface ShadowApplicationPlanOperation {
  readonly itemId: string;
  readonly operationType: ShadowOperationType;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly originalText: string;
  readonly finalText: string;
  readonly sourceMatchState: string;
  readonly ready: boolean;
  readonly blockReason: string | null;
}

export interface ShadowApplicationPlan {
  readonly operations: readonly ShadowApplicationPlanOperation[];
  readonly blockedItems: readonly StudioShadowApplicationItem[];
  readonly skippedItems: readonly StudioShadowApplicationItem[];
}
