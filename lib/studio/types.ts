/** Kevin Track — Private Author Studio types (K1). */

export type StudioExpertTier =
  | "certified"
  | "validated"
  | "experimental"
  | "advisory_only"
  | "placeholder";

export type StudioActionItemStatus =
  | "open"
  | "reviewing"
  | "rewrite_proposed"
  | "accepted"
  | "rejected"
  | "needs_research"
  | "needs_expert"
  | "deferred"
  | "resolved";

export type StudioRewriteKind =
  | "sentence_replacement"
  | "paragraph_replacement"
  | "insertion"
  | "deletion"
  | "restructuring_recommendation"
  | "author_decision_required";

export interface StudioExpertDeskEntry {
  readonly key: string;
  readonly displayName: string;
  readonly purpose: string;
  readonly tier: StudioExpertTier;
  readonly tierLabel: string;
  readonly catalogAvailability: string | null;
  readonly certificationStatus: string | null;
  readonly selectionEnabled: boolean;
  readonly studioExecutionAllowed: boolean;
  readonly expectedRuntime: string;
  readonly estimatedCost: string | null;
  readonly scopeOptions: readonly string[];
  readonly prerequisites: readonly string[];
  readonly limitations: readonly string[];
  readonly experimentalNotice?: string;
  readonly placeholder: boolean;
}

export interface StudioLibraryBook {
  readonly id: string;
  readonly title: string;
  readonly seriesName: string | null;
  readonly volumeNumber: number | null;
  readonly activeVersionLabel: string | null;
  readonly activeVersionNumber: number | null;
  readonly wordCount: number | null;
  readonly lastUploadDate: string | null;
  readonly latestReviewStatus: string | null;
  readonly unresolvedIssueCount: number;
  readonly acceptedRevisionCount: number;
  readonly status: string;
}

export interface StudioBookWorkspace {
  readonly id: string;
  readonly title: string;
  readonly seriesName: string | null;
  readonly volumeNumber: number | null;
  readonly activeVersionId: string | null;
  readonly activeVersionLabel: string | null;
  readonly activeVersionNumber: number | null;
  readonly wordCount: number | null;
  readonly versions: readonly StudioVersionSummary[];
  readonly reviews: readonly StudioReviewSummary[];
  readonly openIssueCount: number;
  readonly acceptedRevisionCount: number;
  readonly openActionItemCount: number;
}

export interface StudioVersionSummary {
  readonly id: string;
  readonly versionNumber: number;
  readonly label: string | null;
  readonly wordCount: number | null;
  readonly createdAt: string;
  readonly isCurrent: boolean;
}

export interface StudioReviewSummary {
  readonly id: string;
  readonly perspective: string;
  readonly lifecycleStatus: string | null;
  readonly createdAt: string;
}

export interface StudioActionItem {
  readonly id: string;
  readonly issueId: string | null;
  readonly sourceExpert: string;
  readonly reviewId: string | null;
  readonly manuscriptVersionId: string | null;
  readonly chapterOrLocation: string | null;
  readonly quotedEvidence: string;
  readonly issueTitle: string;
  readonly explanation: string;
  readonly severity: string | null;
  readonly confidence: number | null;
  readonly category: string | null;
  readonly whyItMatters: string | null;
  readonly suggestedRewrite: string;
  readonly rewriteRationale: string | null;
  readonly rewriteKind: StudioRewriteKind;
  readonly canonImpact: string | null;
  readonly researchNeeded: boolean;
  readonly assignedExpert: string | null;
  readonly status: StudioActionItemStatus;
  readonly authorDecision: string | null;
  readonly authorNotes: string | null;
  readonly acceptedText: string | null;
  readonly rejectedReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudioExportOption {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly ready: boolean;
  readonly href: string | null;
  readonly comingLater: boolean;
}

export interface StudioRevisionBoardSummary {
  readonly total: number;
  readonly open: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly pending: number;
}
