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
  readonly studioDisposition: StudioAuthorDisposition;
  readonly decisionLabel: string;
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
  readonly notReviewed: number;
  readonly accepted: number;
  readonly acceptedModified: number;
  readonly rejected: number;
  readonly deferred: number;
  readonly acceptedRevisionCount: number;
}

export type StudioExpertRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "waiting"
  | "blocked"
  | "failed"
  | "cancelled";

export interface StudioEditorialTeamMember {
  readonly manuscriptId: string;
  readonly expertKey: string;
  readonly displayName: string;
  readonly purpose: string;
  readonly executionClass: string;
  readonly policy: import("./execution-policy.ts").StudioExecutionPolicy;
  readonly tier: StudioExpertTier;
  readonly tierLabel: string;
  readonly certificationStatus: string | null;
  readonly expectedRuntime: string;
  readonly estimatedCost: string | null;
  readonly ownerNotes: string | null;
  readonly recruitedAt: string;
  readonly runStatus: StudioExpertRunStatus;
  readonly lastReviewAt: string | null;
  readonly latestReviewId: string | null;
}

export interface StudioEditorialHealth {
  readonly issues: number;
  readonly resolved: number;
  readonly accepted: number;
  readonly deferred: number;
  readonly rejected: number;
  readonly open: number;
  readonly overallProgress: number;
}

export interface StudioCostSummary {
  readonly estimatedCost: string;
  readonly actualCost: string | null;
  readonly runtime: string | null;
  readonly tokens: string | null;
  readonly provider: string;
  readonly model: string;
  readonly costAvailable: boolean;
}

export interface StudioReviewExecutionView {
  readonly workflowId: string;
  readonly expertKey: string;
  readonly expertDisplayName: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly currentPhase: string | null;
  readonly currentPhaseLabel: string;
  readonly progressSummary: string | null;
  readonly safeErrorMessage: string | null;
  readonly startedAt: string | null;
  readonly elapsed: string;
  readonly isTerminal: boolean;
  readonly authoritativeResultId: string | null;
  readonly resultSummary: unknown;
  readonly cost: StudioCostSummary;
}

export interface StudioRoundtableShell {
  readonly title: string;
  readonly subtitle: string;
  readonly agreement: string;
  readonly disagreement: string;
  readonly priority: string;
  readonly recommendedOrder: readonly string[];
  readonly consensus: string;
  readonly showShell: boolean;
}

export type StudioLaunchScope = "full_book" | "selected_chapters" | "excerpt";
