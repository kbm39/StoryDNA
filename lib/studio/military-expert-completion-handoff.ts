import "server-only";

import type { MilitaryExpertReview } from "@/experts/military-expert/contracts.ts";
import type { MilitaryExpertGenerationStatus } from "@/experts/military-expert/generation-types.ts";
import type { MilitaryExpertRepairDecision } from "@/experts/military-expert/generation-types.ts";
import {
  isInvalidAuthoritativeResultIdError,
  validateAuthoritativeResultId,
} from "@/lib/editorial-workflow/authoritative-result-id.ts";
import {
  markWorkflowCompleted,
  markWorkflowFailed,
} from "@/lib/editorial-workflow/workflow-store.ts";
import { safeErrorForCode } from "@/lib/editorial-workflow/safe-errors.ts";
import { MILITARY_EXPERT_STUDIO_DEFINITION_VERSION } from "@/lib/editorial-workflow/types.ts";
import type { SavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import {
  persistMilitaryExpertDraftReview,
  type PersistMilitaryExpertDraftReviewResult,
} from "@/lib/studio/persist-military-expert-draft-review.ts";

export interface MilitaryExpertCompletionHandoffInput {
  workflowId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  review: MilitaryExpertReview;
  parsedReviewHash: string;
  requestHash: string | null;
  correlationId: string;
  expertVersion: string;
  definitionHash: string;
  generationStatus: Extract<MilitaryExpertGenerationStatus, "success" | "provisional_success">;
  repairDecision: MilitaryExpertRepairDecision;
  provisionalReleaseUsed: boolean;
  savedReport: SavedMilitaryExpertReport;
  manuscriptTitle: string;
  modelId: string;
  estimatedCostUsd: number;
}

export interface MilitaryExpertCompletionHandoffDeps {
  persistReview: (
    args: Parameters<typeof persistMilitaryExpertDraftReview>[0],
  ) => Promise<PersistMilitaryExpertDraftReviewResult>;
  markCompleted: typeof markWorkflowCompleted;
  markFailed: typeof markWorkflowFailed;
}

const defaultDeps = (): MilitaryExpertCompletionHandoffDeps =>
  Object.freeze({
    persistReview: persistMilitaryExpertDraftReview,
    markCompleted: markWorkflowCompleted,
    markFailed: markWorkflowFailed,
  });

export async function fileMilitaryExpertWorkflowCompletion(
  input: MilitaryExpertCompletionHandoffInput,
  deps: MilitaryExpertCompletionHandoffDeps = defaultDeps(),
): Promise<{ ok: true; reviewId: string } | { ok: false }> {
  let persisted: PersistMilitaryExpertDraftReviewResult;
  try {
    persisted = await deps.persistReview({
      workflowId: input.workflowId,
      manuscriptId: input.manuscriptId,
      manuscriptVersionId: input.manuscriptVersionId,
      review: input.review,
      parsedReviewHash: input.parsedReviewHash,
      requestHash: input.requestHash,
      correlationId: input.correlationId,
      generationStatus: input.generationStatus,
      provisionalReleaseUsed: input.provisionalReleaseUsed,
      expertVersion: input.expertVersion,
      definitionHash: input.definitionHash,
      estimatedCostUsd: input.estimatedCostUsd,
    });
  } catch {
    await deps.markFailed({
      workflowId: input.workflowId,
      errorCode: "COMPLETION_FILING_FAILED",
      safeErrorMessage: safeErrorForCode(
        "COMPLETION_FILING_FAILED",
        "Military Expert completion filing failed before results could be published.",
      ),
    });
    return { ok: false };
  }

  try {
    validateAuthoritativeResultId(persisted.reviewId);
    await deps.markCompleted({
      workflowId: input.workflowId,
      authoritativeResultId: persisted.reviewId,
      authoritativeResultType: "military_expert_draft_review",
      resultSummary: {
        expertKey: "military_expert",
        expertVersion: input.expertVersion,
        definitionHash: input.definitionHash,
        correlationId: input.correlationId,
        reviewId: persisted.reviewId,
        parsedReviewHash: persisted.parsedReviewHash,
        requestHash: input.requestHash,
        generationStatus: input.generationStatus,
        reviewStatus: input.review.review_status,
        repairDecision: input.repairDecision,
        provisionalReleaseUsed: input.provisionalReleaseUsed,
        authorReviewRequiredCount: input.savedReport.authorReviewRequiredCount,
        validatedFindingCount: input.savedReport.validatedFindingCount,
        manuscriptTitle: input.manuscriptTitle,
        workflowDefinitionVersion: MILITARY_EXPERT_STUDIO_DEFINITION_VERSION,
        modelId: input.modelId,
        estimatedCostUsd: input.estimatedCostUsd,
      },
      nextBestAction:
        input.generationStatus === "provisional_success"
          ? "Military Expert local test run completed with author review required findings. Review unresolved items in Studio."
          : "Military Expert local test run completed. Review workflow summary in Studio.",
    });
  } catch (error) {
    const errorCode = isInvalidAuthoritativeResultIdError(error)
      ? "INVALID_AUTHORITATIVE_RESULT_ID"
      : "COMPLETION_FILING_FAILED";
    await deps.markFailed({
      workflowId: input.workflowId,
      errorCode,
      safeErrorMessage: safeErrorForCode(
        errorCode,
        "Military Expert completion filing failed before results could be published.",
      ),
    });
    return { ok: false };
  }

  return { ok: true, reviewId: persisted.reviewId };
}
