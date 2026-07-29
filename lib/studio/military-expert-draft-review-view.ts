import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MilitaryExpertFinding,
  MilitaryExpertReview,
  MilitaryExpertReviewStatus,
} from "@/experts/military-expert/contracts.ts";
import { classifyAuthoritativeResultIdValue } from "@/lib/editorial-workflow/authoritative-result-id.ts";
import { getWorkflowById } from "@/lib/editorial-workflow/workflow-store.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  buildAuthorReviewRequiredSection,
  buildMilitaryExpertCountExplanation,
  type MilitaryExpertAuthorReviewRequiredItem,
} from "@/lib/studio/military-expert-display.ts";
import {
  buildMilitaryExpertBoardCandidates,
  partitionMilitaryExpertBoardCandidates,
  type MilitaryExpertBoardCandidate,
} from "@/lib/studio/military-expert-revision-board.ts";
import {
  computeMilitaryExpertScoreSummary,
  isProvisionalFinding,
  type MilitaryExpertScoreSummary,
} from "@/lib/studio/military-expert-scoring.ts";
import type { StudioExpertRunStatus } from "@/lib/studio/types.ts";

export const DISPLAYABLE_MILITARY_EXPERT_REVIEW_STATUSES = [
  "complete",
  "completed_with_author_review_required",
] as const satisfies readonly MilitaryExpertReviewStatus[];

export interface MilitaryExpertDraftReviewRow {
  readonly id: string;
  readonly workflow_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly review_status: string;
  readonly generation_status: string;
  readonly provisional_release_used: boolean;
  readonly author_review_required_count: number;
  readonly validated_finding_count: number;
  readonly created_at: string;
}

export interface MilitaryExpertDraftFindingRow {
  readonly finding_index: number;
  readonly finding_id: string;
  readonly finding_status: string;
  readonly category: string;
  readonly severity: string;
  readonly realism_status: string;
  readonly confidence: string;
  readonly board_candidate_kind: string | null;
}

export interface MilitaryExpertReportDisplayModel {
  readonly reviewId: string;
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly reviewStatus: string;
  readonly generationStatus: string;
  readonly provisionalReleaseUsed: boolean;
  readonly createdAt: string;
  readonly completedReportStatusLabel: string;
  readonly scoreSummary: MilitaryExpertScoreSummary;
  readonly confirmedFindings: readonly MilitaryExpertDraftFindingRow[];
  readonly authorReviewRequiredFindings: readonly MilitaryExpertDraftFindingRow[];
  readonly authorReviewRequiredItems: readonly MilitaryExpertAuthorReviewRequiredItem[];
  readonly revisionCandidates: readonly MilitaryExpertBoardCandidate[];
  readonly investigationCandidates: readonly MilitaryExpertBoardCandidate[];
  readonly countExplanation: string | null;
  readonly revisionBoardIntegrationAvailable: false;
  readonly isProvisional: boolean;
}

export interface MilitaryExpertTeamRunStatus {
  readonly runStatus: StudioExpertRunStatus;
  readonly lastReviewAt: string | null;
  readonly latestReviewId: string | null;
  readonly completedReportStatusLabel: string | null;
}

export interface MilitaryExpertDraftReviewViewDeps {
  readonly supabase: SupabaseClient;
  readonly getWorkflow?: typeof getWorkflowById;
}

function defaultDeps(): MilitaryExpertDraftReviewViewDeps {
  return { supabase: getSupabaseAdmin(), getWorkflow: getWorkflowById };
}

export function isDisplayableMilitaryExpertReviewStatus(status: string): boolean {
  return (DISPLAYABLE_MILITARY_EXPERT_REVIEW_STATUSES as readonly string[]).includes(status);
}

export function buildCompletedReportStatusLabel(review: {
  readonly author_review_required_count: number;
  readonly validated_finding_count: number;
}): string {
  if (review.author_review_required_count > 0) {
    const count = review.author_review_required_count;
    return `Completed — ${count} Finding${count === 1 ? "" : "s"} Need Author Review`;
  }
  const total = review.validated_finding_count + review.author_review_required_count;
  return `Completed — ${total} Finding${total === 1 ? "" : "s"}`;
}

function rowFromReviewDb(raw: Record<string, unknown>): MilitaryExpertDraftReviewRow {
  return Object.freeze({
    id: String(raw.id),
    workflow_id: String(raw.workflow_id),
    manuscript_id: String(raw.manuscript_id),
    manuscript_version_id: String(raw.manuscript_version_id),
    review_status: String(raw.review_status),
    generation_status: String(raw.generation_status),
    provisional_release_used: Boolean(raw.provisional_release_used),
    author_review_required_count: Number(raw.author_review_required_count ?? 0),
    validated_finding_count: Number(raw.validated_finding_count ?? 0),
    created_at: String(raw.created_at),
  });
}

function rowFromFindingDb(raw: Record<string, unknown>): MilitaryExpertDraftFindingRow {
  return Object.freeze({
    finding_index: Number(raw.finding_index),
    finding_id: String(raw.finding_id),
    finding_status: String(raw.finding_status),
    category: String(raw.category),
    severity: String(raw.severity),
    realism_status: String(raw.realism_status),
    confidence: String(raw.confidence),
    board_candidate_kind: raw.board_candidate_kind ? String(raw.board_candidate_kind) : null,
  });
}

function structuralTitle(row: MilitaryExpertDraftFindingRow): string {
  return `${row.category.replace(/_/g, " ")} (${row.severity})`;
}

function findingRowToStubFinding(row: MilitaryExpertDraftFindingRow): MilitaryExpertFinding {
  const title = structuralTitle(row);
  return {
    finding_id: row.finding_id,
    category: row.category as MilitaryExpertFinding["category"],
    title,
    observation: `StoryDNA completed its check for this finding (${row.realism_status.replace(/_/g, " ")}).`,
    manuscript_evidence: [],
    confidence: row.confidence as MilitaryExpertFinding["confidence"],
    severity: row.severity as MilitaryExpertFinding["severity"],
    realism_status: row.realism_status as MilitaryExpertFinding["realism_status"],
    operational_impact: "Operational impact details are not shown in this summary view.",
    story_impact: "Story impact details are not shown in this summary view.",
    recommendation: "Review category and realism details before revising.",
    recommendation_type: "correct",
    preservation_note: "",
    author_challenge_allowed: true,
    finding_status:
      row.finding_status === "author_review_required" ? "author_review_required" : "validated",
  };
}

function stubReviewFromRows(
  review: MilitaryExpertDraftReviewRow,
  findings: readonly MilitaryExpertDraftFindingRow[],
): MilitaryExpertReview {
  return {
    expert_key: "military_expert",
    expert_version: "structural-view",
    definition_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    manuscript_version_id: review.manuscript_version_id,
    review_scope: "full_manuscript",
    review_status: review.review_status as MilitaryExpertReviewStatus,
    summary: "Military Expert draft review (structural summary).",
    strengths: [],
    findings: findings.map(findingRowToStubFinding),
    category_assessments: [],
    overall_realism_assessment: {
      conclusion: "See findings below.",
      confidence: "medium",
      primary_strengths: [],
      primary_concerns: [],
      preservation_priorities: [],
    },
    critical_issues: [],
    priority_actions: [],
    verification_requests: [],
    escalation_recommendations: [],
    uncertainty_summary: "",
    author_challenge_supported: true,
    next_step: "Review findings in Studio.",
    provenance: {
      validator_version: "structural-view",
      normalization_version: "structural-view",
      definition_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    },
  };
}

export function buildMilitaryExpertReportDisplayModel(args: {
  review: MilitaryExpertDraftReviewRow;
  findings: readonly MilitaryExpertDraftFindingRow[];
}): MilitaryExpertReportDisplayModel {
  const { review, findings } = args;
  const stubReview = stubReviewFromRows(review, findings);
  const scoreSummary = computeMilitaryExpertScoreSummary(stubReview);
  const boardCandidates = buildMilitaryExpertBoardCandidates(stubReview);
  const { revisionCandidates, investigationCandidates } =
    partitionMilitaryExpertBoardCandidates(boardCandidates);

  const authorReviewRequiredFindings = findings.filter(
    (row) => row.finding_status === "author_review_required",
  );
  const confirmedFindings = findings.filter((row) => row.finding_status !== "author_review_required");

  const authorReviewRequiredItems = buildAuthorReviewRequiredSection(
    stubReview.findings.filter(isProvisionalFinding),
  );

  const countExplanation = buildMilitaryExpertCountExplanation(
    confirmedFindings.length,
    scoreSummary.confirmedIssueCount,
  );

  return Object.freeze({
    reviewId: review.id,
    manuscriptId: review.manuscript_id,
    manuscriptVersionId: review.manuscript_version_id,
    reviewStatus: review.review_status,
    generationStatus: review.generation_status,
    provisionalReleaseUsed: review.provisional_release_used,
    createdAt: review.created_at,
    completedReportStatusLabel: buildCompletedReportStatusLabel(review),
    scoreSummary,
    confirmedFindings,
    authorReviewRequiredFindings,
    authorReviewRequiredItems,
    revisionCandidates,
    investigationCandidates,
    countExplanation,
    revisionBoardIntegrationAvailable: false as const,
    isProvisional:
      review.review_status === "completed_with_author_review_required" ||
      review.provisional_release_used,
  });
}

async function loadFindingsForReview(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<readonly MilitaryExpertDraftFindingRow[]> {
  const { data, error } = await supabase
    .from("studio_military_expert_draft_findings")
    .select(
      "finding_index, finding_id, finding_status, category, severity, realism_status, confidence, board_candidate_kind",
    )
    .eq("review_id", reviewId)
    .order("finding_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowFromFindingDb(row as Record<string, unknown>));
}

async function loadReviewRowById(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<MilitaryExpertDraftReviewRow | null> {
  const { data, error } = await supabase
    .from("studio_military_expert_draft_reviews")
    .select(
      "id, workflow_id, manuscript_id, manuscript_version_id, review_status, generation_status, provisional_release_used, author_review_required_count, validated_finding_count, created_at",
    )
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowFromReviewDb(data as Record<string, unknown>) : null;
}

export async function getLatestCompletedMilitaryExpertDraftReview(
  manuscriptId: string,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertDraftReviewRow | null> {
  const { data, error } = await deps.supabase
    .from("studio_military_expert_draft_reviews")
    .select(
      "id, workflow_id, manuscript_id, manuscript_version_id, review_status, generation_status, provisional_release_used, author_review_required_count, validated_finding_count, created_at",
    )
    .eq("manuscript_id", manuscriptId)
    .in("review_status", [...DISPLAYABLE_MILITARY_EXPERT_REVIEW_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowFromReviewDb(data as Record<string, unknown>) : null;
}

export async function getMilitaryExpertDraftReviewById(
  reviewId: string,
  expectedManuscriptId?: string,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertDraftReviewRow | null> {
  const review = await loadReviewRowById(deps.supabase, reviewId);
  if (!review) return null;
  if (expectedManuscriptId && review.manuscript_id !== expectedManuscriptId) return null;
  if (!isDisplayableMilitaryExpertReviewStatus(review.review_status)) return null;
  return review;
}

export async function resolveMilitaryExpertReviewFromAuthoritativeResultId(
  authoritativeResultId: string | null | undefined,
  expectedManuscriptId?: string,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertDraftReviewRow | null> {
  if (!authoritativeResultId) return null;
  if (classifyAuthoritativeResultIdValue(authoritativeResultId) !== "uuid") return null;
  return getMilitaryExpertDraftReviewById(authoritativeResultId, expectedManuscriptId, deps);
}

export async function resolveMilitaryExpertReviewFromWorkflowId(
  workflowId: string,
  expectedManuscriptId?: string,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertDraftReviewRow | null> {
  const getWorkflow = deps.getWorkflow ?? getWorkflowById;
  const workflow = await getWorkflow(workflowId);
  if (!workflow || workflow.workflow_type !== "military_expert_review") return null;
  if (expectedManuscriptId && workflow.manuscript_id !== expectedManuscriptId) return null;
  return resolveMilitaryExpertReviewFromAuthoritativeResultId(
    workflow.authoritative_result_id,
    expectedManuscriptId,
    deps,
  );
}

export async function loadMilitaryExpertReportDisplayModel(
  reviewId: string,
  expectedManuscriptId: string,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertReportDisplayModel | null> {
  const review = await getMilitaryExpertDraftReviewById(reviewId, expectedManuscriptId, deps);
  if (!review) return null;
  const findings = await loadFindingsForReview(deps.supabase, review.id);
  return buildMilitaryExpertReportDisplayModel({ review, findings });
}

export async function resolveMilitaryExpertTeamRunStatus(
  manuscriptId: string,
  activeWorkflowStatus: string | null | undefined,
  activeWorkflowAuthoritativeResultId: string | null | undefined,
  deps: MilitaryExpertDraftReviewViewDeps = defaultDeps(),
): Promise<MilitaryExpertTeamRunStatus> {
  if (activeWorkflowStatus && activeWorkflowStatus !== "completed") {
    return Object.freeze({
      runStatus: mapWorkflowStatusToRunStatus(activeWorkflowStatus),
      lastReviewAt: null,
      latestReviewId: null,
      completedReportStatusLabel: null,
    });
  }

  const fromActiveResult = await resolveMilitaryExpertReviewFromAuthoritativeResultId(
    activeWorkflowAuthoritativeResultId,
    manuscriptId,
    deps,
  );
  const review =
    fromActiveResult ?? (await getLatestCompletedMilitaryExpertDraftReview(manuscriptId, deps));

  if (!review) {
    return Object.freeze({
      runStatus: "waiting",
      lastReviewAt: null,
      latestReviewId: null,
      completedReportStatusLabel: null,
    });
  }

  return Object.freeze({
    runStatus: "completed",
    lastReviewAt: review.created_at,
    latestReviewId: review.id,
    completedReportStatusLabel: buildCompletedReportStatusLabel(review),
  });
}

function mapWorkflowStatusToRunStatus(status: string): StudioExpertRunStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "preparing":
    case "running":
    case "waiting":
    case "paused":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "waiting";
  }
}

export function militaryExpertReportHref(bookId: string, reviewId: string): string {
  return `/studio/books/${bookId}/experts/military-expert/reports/${reviewId}`;
}
