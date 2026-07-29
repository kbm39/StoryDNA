import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MilitaryExpertReview } from "@/experts/military-expert/contracts.ts";
import type { MilitaryExpertGenerationStatus } from "@/experts/military-expert/generation-types.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertParsedReviewHash } from "@/lib/editorial-workflow/authoritative-result-id.ts";
import {
  buildMilitaryExpertBoardCandidates,
  type MilitaryExpertBoardCandidateKind,
} from "@/lib/studio/military-expert-revision-board.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";

export interface PersistMilitaryExpertDraftReviewArgs {
  workflowId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  review: MilitaryExpertReview;
  parsedReviewHash: string;
  requestHash: string | null;
  correlationId: string;
  generationStatus: MilitaryExpertGenerationStatus;
  provisionalReleaseUsed: boolean;
  expertVersion: string;
  definitionHash: string;
  estimatedCostUsd: number | null;
  unresolvedMissingFieldsByIndex?: ReadonlyMap<
    number,
    readonly ("contrary_evidence" | "uncertainty_note")[]
  >;
}

export interface PersistMilitaryExpertDraftReviewResult {
  readonly reviewId: string;
  readonly parsedReviewHash: string;
  readonly reused: boolean;
}

export interface PersistMilitaryExpertDraftReviewDeps {
  readonly supabase: SupabaseClient;
}

function defaultDeps(): PersistMilitaryExpertDraftReviewDeps {
  return { supabase: getSupabaseAdmin() };
}

function boardCandidateKindByIndex(
  review: MilitaryExpertReview,
): ReadonlyMap<number, MilitaryExpertBoardCandidateKind> {
  const map = new Map<number, MilitaryExpertBoardCandidateKind>();
  for (const candidate of buildMilitaryExpertBoardCandidates(review)) {
    map.set(candidate.findingIndex, candidate.kind);
  }
  return map;
}

export async function persistMilitaryExpertDraftReview(
  args: PersistMilitaryExpertDraftReviewArgs,
  deps: PersistMilitaryExpertDraftReviewDeps = defaultDeps(),
): Promise<PersistMilitaryExpertDraftReviewResult> {
  const parsedReviewHash = assertParsedReviewHash(args.parsedReviewHash);
  const savedReport = prepareSavedMilitaryExpertReport({
    review: args.review,
    parsedReviewHash,
    unresolvedMissingFieldsByIndex: args.unresolvedMissingFieldsByIndex,
  });
  const boardKinds = boardCandidateKindByIndex(args.review);

  const { data: existing, error: existingError } = await deps.supabase
    .from("studio_military_expert_draft_reviews")
    .select("id, parsed_review_hash")
    .eq("workflow_id", args.workflowId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    return Object.freeze({
      reviewId: String(existing.id),
      parsedReviewHash: String(existing.parsed_review_hash),
      reused: true,
    });
  }

  const { data: inserted, error: insertError } = await deps.supabase
    .from("studio_military_expert_draft_reviews")
    .insert({
      workflow_id: args.workflowId,
      manuscript_id: args.manuscriptId,
      manuscript_version_id: args.manuscriptVersionId,
      parsed_review_hash: parsedReviewHash,
      request_hash: args.requestHash,
      correlation_id: args.correlationId,
      review_status: savedReport.reviewStatus,
      generation_status: args.generationStatus,
      provisional_release_used: args.provisionalReleaseUsed,
      author_review_required_count: savedReport.authorReviewRequiredCount,
      validated_finding_count: savedReport.validatedFindingCount,
      expert_version: args.expertVersion,
      definition_hash: args.definitionHash,
      estimated_cost_usd: args.estimatedCostUsd,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const reviewId = String(inserted.id);
  const findingRows = savedReport.findings.map((finding) => ({
    review_id: reviewId,
    finding_index: finding.findingIndex,
    finding_id: finding.findingId,
    finding_status: finding.findingStatus,
    category: finding.category,
    severity: finding.severity,
    realism_status: finding.realismStatus,
    confidence: finding.confidence,
    board_candidate_kind: boardKinds.get(finding.findingIndex) ?? null,
    finding_content: finding.findingContent,
  }));

  if (findingRows.length > 0) {
    const { error: findingsError } = await deps.supabase
      .from("studio_military_expert_draft_findings")
      .insert(findingRows);
    if (findingsError) throw new Error(findingsError.message);
  }

  return Object.freeze({
    reviewId,
    parsedReviewHash,
    reused: false,
  });
}
