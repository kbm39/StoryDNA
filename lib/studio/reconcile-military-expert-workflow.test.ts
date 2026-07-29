import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorialWorkflowRow } from "@/lib/editorial-workflow/types.ts";
import { INVALID_AUTHORITATIVE_RESULT_ID } from "@/lib/editorial-workflow/authoritative-result-id.ts";
import { reconcileStuckMilitaryExpertWorkflow } from "@/lib/studio/reconcile-military-expert-workflow.ts";

const WORKFLOW_ID = "3d6ab10a-d0ff-4aa9-b531-932554f1e826";

function runningWorkflow(
  overrides: Partial<EditorialWorkflowRow> = {},
): EditorialWorkflowRow {
  return {
    id: WORKFLOW_ID,
    workflow_type: "military_expert_review",
    status: "running",
    authoritative_result_id: null,
    ...overrides,
  } as EditorialWorkflowRow;
}

function mockSupabase(reviewRow: { id: string } | null) {
  return {
    from(table: string) {
      if (table === "studio_military_expert_draft_reviews") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: reviewRow, error: null }),
            }),
          }),
        };
      }
      if (table === "editorial_workflows") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ count: 0, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as never;
}

describe("reconcile-military-expert-workflow", () => {
  it("16. marks stuck running workflow failed when no review persisted", async () => {
    const failed: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];

    const result = await reconcileStuckMilitaryExpertWorkflow(WORKFLOW_ID, {
      supabase: mockSupabase(null),
      getWorkflow: async () => runningWorkflow(),
      markFailed: async (args) => {
        failed.push(args as unknown as Record<string, unknown>);
      },
      updateRow: async (_id, patch) => {
        updates.push(patch);
      },
    });

    assert.equal(result.action, "marked_failed");
    assert.equal(result.previousStatus, "running");
    assert.equal(result.reviewPersisted, false);
    assert.equal(result.errorCode, "COMPLETION_FILING_FAILED");
    assert.equal(failed.length, 1);
    assert.equal(updates[0]?.current_phase, null);
    assert.equal(updates[0]?.authoritative_result_id, null);
  });

  it("9. partial persistence without review does not complete", async () => {
    let completed = false;

    const result = await reconcileStuckMilitaryExpertWorkflow(WORKFLOW_ID, {
      supabase: mockSupabase(null),
      getWorkflow: async () => runningWorkflow(),
      markFailed: async () => {},
      updateRow: async () => {},
    });

    assert.equal(completed, false);
    assert.equal(result.reviewPersisted, false);
    assert.equal(result.action, "marked_failed");
  });

  it("invalid authoritative hash cleanup uses INVALID_AUTHORITATIVE_RESULT_ID", async () => {
    const failed: Record<string, unknown>[] = [];

    const result = await reconcileStuckMilitaryExpertWorkflow(WORKFLOW_ID, {
      supabase: mockSupabase(null),
      getWorkflow: async () =>
        runningWorkflow({
          status: "completed",
          authoritative_result_id:
            "7e08a44c0e23b9465dc6ab4100bc82e392a526206b652ea40d5c3c85e01020ab",
        }),
      markFailed: async (args) => {
        failed.push(args as unknown as Record<string, unknown>);
      },
      updateRow: async () => {},
    });

    assert.equal(result.errorCode, INVALID_AUTHORITATIVE_RESULT_ID);
    assert.equal(failed[0]?.errorCode, INVALID_AUTHORITATIVE_RESULT_ID);
  });

  it("15. skips reconciliation when review exists and workflow is terminal", async () => {
    const result = await reconcileStuckMilitaryExpertWorkflow(WORKFLOW_ID, {
      supabase: mockSupabase({ id: "44444444-4444-4444-8444-444444444444" }),
      getWorkflow: async () =>
        runningWorkflow({
          status: "completed",
          authoritative_result_id: "44444444-4444-4444-8444-444444444444",
        }),
      markFailed: async () => {
        assert.fail("should not mark failed");
      },
      updateRow: async () => {
        assert.fail("should not update");
      },
    });

    assert.equal(result.action, "none");
    assert.equal(result.reviewPersisted, true);
  });
});
