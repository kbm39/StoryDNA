import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildValidMilitaryExpertReview } from "@/experts/military-expert/fixtures.ts";
import { hashMilitaryExpertParsedReview } from "@/experts/military-expert/generation-contract.ts";
import { persistMilitaryExpertDraftReview } from "@/lib/studio/persist-military-expert-draft-review.ts";

const WORKFLOW_ID = "3d6ab10a-d0ff-4aa9-b531-932554f1e826";
const MANUSCRIPT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_UUID = "44444444-4444-4444-8444-444444444444";

function createMockSupabase(initialExisting: { id: string; parsed_review_hash: string } | null = null) {
  let existing = initialExisting;
  const insertedReviews: Record<string, unknown>[] = [];
  const insertedFindings: Record<string, unknown>[] = [];

  const from = (table: string) => {
    if (table === "studio_military_expert_draft_reviews") {
      return {
        select: () => ({
          eq: (_col: string, workflowId: string) => ({
            maybeSingle: async () => ({
              data:
                existing && workflowId === WORKFLOW_ID
                  ? existing
                  : null,
              error: null,
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              insertedReviews.push(row);
              existing = { id: REVIEW_UUID, parsed_review_hash: String(row.parsed_review_hash) };
              return { data: { id: REVIEW_UUID }, error: null };
            },
          }),
        }),
      };
    }

    if (table === "studio_military_expert_draft_findings") {
      return {
        insert: async (rows: Record<string, unknown>[]) => {
          insertedFindings.push(...rows);
          return { error: null };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  };

  return {
    supabase: { from },
    insertedReviews,
    insertedFindings,
    setExisting(next: { id: string; parsed_review_hash: string } | null) {
      existing = next;
    },
  };
}

describe("persistMilitaryExpertDraftReview", () => {
  it("1. returns persisted review UUID separate from parsed hash", async () => {
    const review = buildValidMilitaryExpertReview();
    const parsedReviewHash = hashMilitaryExpertParsedReview(review);
    const mock = createMockSupabase();

    const result = await persistMilitaryExpertDraftReview(
      {
        workflowId: WORKFLOW_ID,
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: VERSION_ID,
        review,
        parsedReviewHash,
        requestHash: "request-hash",
        correlationId: "correlation-id",
        generationStatus: "success",
        provisionalReleaseUsed: false,
        expertVersion: review.expert_version,
        definitionHash: review.definition_hash,
        estimatedCostUsd: 0.12,
      },
      { supabase: mock.supabase as never },
    );

    assert.equal(result.reviewId, REVIEW_UUID);
    assert.equal(result.parsedReviewHash, parsedReviewHash);
    assert.equal(result.reused, false);
    assert.notEqual(result.reviewId, parsedReviewHash);
  });

  it("2. stores parsed hash on review row, not authoritative_result_id column", async () => {
    const review = buildValidMilitaryExpertReview();
    const parsedReviewHash = hashMilitaryExpertParsedReview(review);
    const mock = createMockSupabase();

    await persistMilitaryExpertDraftReview(
      {
        workflowId: WORKFLOW_ID,
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: VERSION_ID,
        review,
        parsedReviewHash,
        requestHash: null,
        correlationId: "correlation-id",
        generationStatus: "success",
        provisionalReleaseUsed: false,
        expertVersion: review.expert_version,
        definitionHash: review.definition_hash,
        estimatedCostUsd: null,
      },
      { supabase: mock.supabase as never },
    );

    assert.equal(mock.insertedReviews[0]?.parsed_review_hash, parsedReviewHash);
    assert.doesNotMatch(String(mock.insertedReviews[0]?.id ?? ""), /^[0-9a-f]{64}$/i);
  });

  it("3. idempotent retry reuses existing workflow review UUID", async () => {
    const review = buildValidMilitaryExpertReview();
    const parsedReviewHash = hashMilitaryExpertParsedReview(review);
    const existingId = "55555555-5555-4555-8555-555555555555";
    const mock = createMockSupabase({ id: existingId, parsed_review_hash: parsedReviewHash });

    const result = await persistMilitaryExpertDraftReview(
      {
        workflowId: WORKFLOW_ID,
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: VERSION_ID,
        review,
        parsedReviewHash,
        requestHash: null,
        correlationId: "correlation-id",
        generationStatus: "success",
        provisionalReleaseUsed: false,
        expertVersion: review.expert_version,
        definitionHash: review.definition_hash,
        estimatedCostUsd: null,
      },
      { supabase: mock.supabase as never },
    );

    assert.equal(result.reviewId, existingId);
    assert.equal(result.reused, true);
    assert.equal(mock.insertedReviews.length, 0);
  });

  it("4. links findings with board candidate kinds and full content", async () => {
    const review = buildValidMilitaryExpertReview();
    const parsedReviewHash = hashMilitaryExpertParsedReview(review);
    const mock = createMockSupabase();

    await persistMilitaryExpertDraftReview(
      {
        workflowId: WORKFLOW_ID,
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: VERSION_ID,
        review,
        parsedReviewHash,
        requestHash: null,
        correlationId: "correlation-id",
        generationStatus: "provisional_success",
        provisionalReleaseUsed: true,
        expertVersion: review.expert_version,
        definitionHash: review.definition_hash,
        estimatedCostUsd: 0.2,
      },
      { supabase: mock.supabase as never },
    );

    assert.ok(mock.insertedFindings.length > 0);
    assert.ok(
      mock.insertedFindings.some(
        (row) => row.board_candidate_kind === "revision_candidate" || row.board_candidate_kind === null,
      ),
    );
    assert.equal(mock.insertedFindings[0]?.review_id, REVIEW_UUID);
    assert.ok(mock.insertedFindings[0]?.finding_content);
    assert.equal(
      (mock.insertedFindings[0]?.finding_content as { title?: string }).title,
      review.findings[0]?.title,
    );
  });

  it("6. persists author-review-required finding prose", async () => {
    const review = buildValidMilitaryExpertReview();
    review.findings[0] = {
      ...review.findings[0]!,
      finding_status: "author_review_required",
      uncertainty_note: "Could not verify contrary evidence.",
    };
    const parsedReviewHash = hashMilitaryExpertParsedReview(review);
    const mock = createMockSupabase();

    await persistMilitaryExpertDraftReview(
      {
        workflowId: WORKFLOW_ID,
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionId: VERSION_ID,
        review,
        parsedReviewHash,
        requestHash: null,
        correlationId: "correlation-id",
        generationStatus: "provisional_success",
        provisionalReleaseUsed: true,
        expertVersion: review.expert_version,
        definitionHash: review.definition_hash,
        estimatedCostUsd: 0.2,
        unresolvedMissingFieldsByIndex: new Map([[0, ["contrary_evidence"]]]),
      },
      { supabase: mock.supabase as never },
    );

    const content = mock.insertedFindings[0]?.finding_content as {
      observation?: string;
      uncertainty_note?: string;
      missing_confidence_fields?: string[];
    };
    assert.equal(content.observation, review.findings[0]?.observation);
    assert.equal(content.uncertainty_note, "Could not verify contrary evidence.");
    assert.deepEqual(content.missing_confidence_fields, ["contrary_evidence"]);
  });

  it("5. throws on invalid parsed hash before insert", async () => {
    const review = buildValidMilitaryExpertReview();
    const mock = createMockSupabase();

    await assert.rejects(
      persistMilitaryExpertDraftReview(
        {
          workflowId: WORKFLOW_ID,
          manuscriptId: MANUSCRIPT_ID,
          manuscriptVersionId: VERSION_ID,
          review,
          parsedReviewHash: "not-a-hash",
          requestHash: null,
          correlationId: "correlation-id",
          generationStatus: "success",
          provisionalReleaseUsed: false,
          expertVersion: review.expert_version,
          definitionHash: review.definition_hash,
          estimatedCostUsd: null,
        },
        { supabase: mock.supabase as never },
      ),
      /INVALID_PARSED_REVIEW_HASH/,
    );
    assert.equal(mock.insertedReviews.length, 0);
  });
});
