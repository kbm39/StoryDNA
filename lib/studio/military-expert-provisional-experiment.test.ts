import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildValidGenerationContractInput,
  FIXTURE_MISSING_CONTRARY_EVIDENCE,
} from "@/experts/military-expert/generation-fixtures.ts";
import { runMilitaryExpertGenerationContract } from "@/experts/military-expert/generation-contract.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import {
  buildMilitaryExpertBoardCandidates,
  partitionMilitaryExpertBoardCandidates,
} from "@/lib/studio/military-expert-revision-board.ts";
import { fileMilitaryExpertWorkflowCompletion } from "@/lib/studio/military-expert-completion-handoff.ts";
import { validateAuthoritativeResultId } from "@/lib/editorial-workflow/authoritative-result-id.ts";

const REVIEW_UUID = "55555555-5555-4555-8555-555555555555";

describe("Military Expert provisional experiment workflow handoff", () => {
  it("complete primary report with qualifying gaps completes with review UUID and investigation candidates", async () => {
    const prior = { ...process.env };
    process.env.NODE_ENV = "development";
    process.env.STUDIO_ENABLED = "true";
    process.env.STUDIO_MILITARY_EXPERT_ENABLED = "1";

    try {
      const contractResult = await runMilitaryExpertGenerationContract(
        {
          ...buildValidGenerationContractInput(),
          rawResponse: FIXTURE_MISSING_CONTRARY_EVIDENCE,
        },
        { bypassFeatureFlag: true },
      );

      assert.equal(contractResult.ok, true);
      assert.equal(contractResult.generationStatus, "provisional_success");
      assert.ok(contractResult.review);
      assert.ok(contractResult.parsedReviewHash);

      const savedReport = prepareSavedMilitaryExpertReport({
        review: contractResult.review!,
        parsedReviewHash: contractResult.parsedReviewHash!,
      });
      const board = partitionMilitaryExpertBoardCandidates(
        buildMilitaryExpertBoardCandidates(contractResult.review!),
      );

      assert.ok(board.investigationCandidates.length > 0);
      assert.equal(board.revisionCandidates.length, 0);

      const completed: Record<string, unknown>[] = [];
      const filed = await fileMilitaryExpertWorkflowCompletion(
        {
          workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          manuscriptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          manuscriptVersionId: contractResult.review!.manuscript_version_id,
          review: contractResult.review!,
          parsedReviewHash: contractResult.parsedReviewHash!,
          requestHash: contractResult.requestHash,
          correlationId: contractResult.correlationId,
          expertVersion: contractResult.expertVersion,
          definitionHash: contractResult.definitionHash,
          generationStatus: "provisional_success",
          repairDecision: contractResult.repairDecision,
          provisionalReleaseUsed: true,
          savedReport,
          manuscriptTitle: "Fixture Manuscript",
          modelId: "claude-haiku-4-5",
          estimatedCostUsd: 0.2,
        },
        {
          persistReview: async () =>
            Object.freeze({
              reviewId: REVIEW_UUID,
              parsedReviewHash: contractResult.parsedReviewHash!,
              reused: false,
            }),
          markCompleted: async (args) => {
            completed.push(args as unknown as Record<string, unknown>);
          },
          markFailed: async () => {
            assert.fail("workflow should not fail");
          },
        },
      );

      assert.equal(filed.ok, true);
      assert.equal(completed.length, 1);
      validateAuthoritativeResultId(String(completed[0]?.authoritativeResultId));
      const summary = completed[0]?.resultSummary as Record<string, unknown>;
      assert.equal(summary.reviewId, REVIEW_UUID);
      assert.equal(summary.parsedReviewHash, contractResult.parsedReviewHash);
      assert.equal(summary.generationStatus, "provisional_success");
      assert.equal(summary.provisionalReleaseUsed, true);
      assert.ok(Number(summary.authorReviewRequiredCount) > 0);
    } finally {
      process.env = prior;
    }
  });
});
