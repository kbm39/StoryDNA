import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildValidMilitaryExpertReview } from "@/experts/military-expert/fixtures.ts";
import { hashMilitaryExpertParsedReview } from "@/experts/military-expert/generation-contract.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import { fileMilitaryExpertWorkflowCompletion } from "@/lib/studio/military-expert-completion-handoff.ts";
import { INVALID_AUTHORITATIVE_RESULT_ID } from "@/lib/editorial-workflow/authoritative-result-id.ts";

const WORKFLOW_ID = "3d6ab10a-d0ff-4aa9-b531-932554f1e826";
const MANUSCRIPT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_UUID = "44444444-4444-4444-8444-444444444444";
const PARSED_HASH = hashMilitaryExpertParsedReview(buildValidMilitaryExpertReview());

const WORKFLOW_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../editorial-workflow/execute-military-expert-studio-workflow.ts"),
  "utf8",
);
const LA_WORKFLOW_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../editorial-workflow/start-literary-agent-workflow.ts"),
  "utf8",
);

function buildInput(generationStatus: "success" | "provisional_success" = "success") {
  const review = buildValidMilitaryExpertReview();
  const parsedReviewHash = hashMilitaryExpertParsedReview(review);
  const savedReport = prepareSavedMilitaryExpertReport({ review, parsedReviewHash });
  return {
    workflowId: WORKFLOW_ID,
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionId: VERSION_ID,
    review,
    parsedReviewHash,
    requestHash: "request-hash",
    correlationId: "correlation-id",
    expertVersion: review.expert_version,
    definitionHash: review.definition_hash,
    generationStatus,
    repairDecision: "no_repair_needed" as const,
    provisionalReleaseUsed: generationStatus === "provisional_success",
    savedReport,
    manuscriptTitle: "Fixture Manuscript",
    modelId: "claude-haiku-4-5",
    estimatedCostUsd: 0.15,
  };
}

describe("military-expert-completion-handoff", () => {
  it("1. completes with persisted review UUID and hash in result summary only", async () => {
    const completed: Record<string, unknown>[] = [];
    const failed: Record<string, unknown>[] = [];

    const result = await fileMilitaryExpertWorkflowCompletion(buildInput(), {
      persistReview: async () =>
        Object.freeze({ reviewId: REVIEW_UUID, parsedReviewHash: PARSED_HASH, reused: false }),
      markCompleted: async (args) => {
        completed.push(args as unknown as Record<string, unknown>);
      },
      markFailed: async (args) => {
        failed.push(args as unknown as Record<string, unknown>);
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.reviewId, REVIEW_UUID);
    assert.equal(completed.length, 1);
    assert.equal(failed.length, 0);
    assert.equal(completed[0]?.authoritativeResultId, REVIEW_UUID);
    const summary = completed[0]?.resultSummary as Record<string, unknown>;
    assert.equal(summary.reviewId, REVIEW_UUID);
    assert.equal(summary.parsedReviewHash, PARSED_HASH);
  });

  it("2. persistence failure marks workflow failed without completion", async () => {
    const completed: unknown[] = [];
    const failed: Record<string, unknown>[] = [];

    const result = await fileMilitaryExpertWorkflowCompletion(buildInput(), {
      persistReview: async () => {
        throw new Error("db unavailable");
      },
      markCompleted: async () => {
        completed.push(true);
      },
      markFailed: async (args) => {
        failed.push(args as unknown as Record<string, unknown>);
      },
    });

    assert.equal(result.ok, false);
    assert.equal(completed.length, 0);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.errorCode, "COMPLETION_FILING_FAILED");
  });

  it("3. non-UUID review id from persistence is rejected at completion", async () => {
    const failed: Record<string, unknown>[] = [];

    const result = await fileMilitaryExpertWorkflowCompletion(buildInput(), {
      persistReview: async () =>
        Object.freeze({ reviewId: PARSED_HASH, parsedReviewHash: PARSED_HASH, reused: false }),
      markCompleted: async () => {},
      markFailed: async (args) => {
        failed.push(args as unknown as Record<string, unknown>);
      },
    });

    assert.equal(result.ok, false);
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.errorCode, INVALID_AUTHORITATIVE_RESULT_ID);
  });

  it("4. provisional success path uses persisted UUID", async () => {
    const completed: Record<string, unknown>[] = [];

    const result = await fileMilitaryExpertWorkflowCompletion(buildInput("provisional_success"), {
      persistReview: async () =>
        Object.freeze({ reviewId: REVIEW_UUID, parsedReviewHash: PARSED_HASH, reused: false }),
      markCompleted: async (args) => {
        completed.push(args as unknown as Record<string, unknown>);
      },
      markFailed: async () => {},
    });

    assert.equal(result.ok, true);
    const summary = completed[0]?.resultSummary as Record<string, unknown>;
    assert.equal(summary.generationStatus, "provisional_success");
    assert.equal(completed[0]?.authoritativeResultId, REVIEW_UUID);
  });

  it("5. execute workflow source no longer passes parsedReviewHash as authoritativeResultId", () => {
    assert.doesNotMatch(WORKFLOW_SRC, /authoritativeResultId:\s*contractResult\.parsedReviewHash/);
    assert.match(WORKFLOW_SRC, /fileMilitaryExpertWorkflowCompletion/);
  });

  it("6. Literary Agent completion handoff remains unchanged", () => {
    assert.match(LA_WORKFLOW_SRC, /authoritativeResultId:\s*result\.newReviewId/);
    assert.doesNotMatch(LA_WORKFLOW_SRC, /parsedReviewHash/);
  });
});
