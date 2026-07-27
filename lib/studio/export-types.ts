/** Studio revision export contract types (K4). */

import type { ApprovedDisposition } from "./export-eligibility.ts";

export type SourceTextMatchState =
  | "EXACT_MATCH"
  | "UNIQUE_TEXT_MATCH"
  | "MULTIPLE_MATCHES"
  | "NO_MATCH"
  | "INSUFFICIENT_LOCATOR_DATA";

export type LocatorResolution = "resolved" | "partially_resolved" | "unresolved";

export type StudioRevisionConflictType =
  | "overlapping_location"
  | "duplicate_target"
  | "contradictory_replacement"
  | "stale_manuscript_version"
  | "source_text_mismatch"
  | "ambiguous_locator"
  | "superseded_review"
  | "unknown";

export interface StudioRevisionExportFilters {
  readonly includedDispositions: readonly string[];
  readonly includeDeferred: boolean;
  readonly expertIds: readonly string[];
  readonly chapterIds: readonly string[];
}

export interface StudioRevisionExportManuscript {
  readonly manuscriptId: string;
  readonly title: string;
  readonly seriesName: string | null;
  readonly volumeNumber: number | null;
  readonly activeVersionId: string | null;
  readonly activeVersionLabel: string | null;
  readonly authoritativeWordCount: number | null;
  readonly sourceFilename: string | null;
}

export interface StudioRevisionExportIntegrity {
  readonly canonicalManuscriptModified: false;
  readonly currentVersionChanged: false;
  readonly sourceVersionHash: string | null;
  readonly decisionSnapshotHash: string;
  readonly warning: string;
}

export interface StudioRevisionExportSummary {
  readonly totalCandidates: number;
  readonly includedItems: number;
  readonly acceptedUnchanged: number;
  readonly acceptedModified: number;
  readonly deferredIncluded: number;
  readonly excludedRejected: number;
  readonly excludedPending: number;
  readonly excludedDeferred: number;
  readonly unresolvedLocatorCount: number;
  readonly conflictCount: number;
  readonly safeForLaterApplication: number;
  readonly notSafeForAutomaticApplication: number;
}

export interface StudioRevisionExportItem {
  readonly itemId: string;
  readonly revisionCandidateId: string;
  readonly editorialIssueId: string | null;
  readonly reviewId: string | null;
  readonly expert: {
    readonly expertId: string;
    readonly expertName: string;
    readonly lifecycleStatus: string | null;
  };
  readonly manuscriptLocation: {
    readonly chapterId: string | null;
    readonly chapterTitle: string | null;
    readonly chapterNumber: number | null;
    readonly pageNumber: number | null;
    readonly paragraphNumber: number | null;
    readonly startOffset: number | null;
    readonly endOffset: number | null;
    readonly locatorLabel: string | null;
  };
  readonly revision: {
    readonly revisionType: string;
    readonly originalText: string;
    readonly expertSuggestedText: string;
    readonly authorFinalText: string | null;
    readonly finalExportText: string;
    readonly disposition: ApprovedDisposition | "deferred";
    readonly authorNote: string | null;
    readonly rejectionReason: string | null;
    readonly explanation: string;
    readonly rewriteRationale: string | null;
    readonly severity: string | null;
    readonly confidence: number | null;
    readonly canonImpact: string | null;
  };
  readonly source: {
    readonly manuscriptVersionId: string | null;
    readonly sourceTextHash: string;
    readonly suggestionHash: string;
    readonly decisionUpdatedAt: string;
  };
  readonly applicability: {
    readonly locatorResolved: boolean;
    readonly locatorResolution: LocatorResolution;
    readonly sourceTextMatchState: SourceTextMatchState;
    readonly sourceTextMatchesActiveVersion: boolean;
    readonly safeToApplyLater: boolean;
    readonly conflictReasons: readonly string[];
  };
  readonly planningOnly: boolean;
}

export interface StudioRevisionConflict {
  readonly conflictId: string;
  readonly affectedItemIds: readonly string[];
  readonly conflictType: StudioRevisionConflictType;
  readonly severity: "high" | "medium" | "low";
  readonly explanation: string;
  readonly recommendedAuthorAction: string;
}

export interface StudioRevisionExport {
  readonly exportVersion: string;
  readonly exportId: string;
  readonly generatedAt: string;
  readonly manuscript: StudioRevisionExportManuscript;
  readonly filters: StudioRevisionExportFilters;
  readonly integrity: StudioRevisionExportIntegrity;
  readonly summary: StudioRevisionExportSummary;
  readonly items: readonly StudioRevisionExportItem[];
  readonly planningItems: readonly StudioRevisionExportItem[];
  readonly conflicts: readonly StudioRevisionConflict[];
  readonly expectedActiveVersionId: string | null;
}

export type StudioExportPreviewFilter =
  | "all_accepted"
  | "accepted_unchanged"
  | "accepted_modified"
  | "expert"
  | "chapter"
  | "application_readiness"
  | "conflict_status";
