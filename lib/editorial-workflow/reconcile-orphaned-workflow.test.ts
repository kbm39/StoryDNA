import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_WORKFLOW_STATUSES, type EditorialWorkflowRow } from "./types.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import {
  reconcileOrphanedWorkflowState,
  type ReconcileTriggerRun,
} from "./reconcile-orphaned-workflow.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function workflow(overrides: Partial<EditorialWorkflowRow> = {}): EditorialWorkflowRow {
  return {
    id: "3ba4a552-0fb3-49d5-8230-e4e0fb62d04a",
    user_id: null,
    manuscript_id: "66e2ee1a-4664-4171-9841-1bda9e25486a",
    manuscript_version_id: "45e007a6-38bc-4f85-b8be-23c6d5bec31d",
    content_hash: "hash",
    workflow_type: "literary_agent_review",
    workflow_definition_version: "literary_agent_review@v1",
    department: null,
    owner_type: null,
    owner_label: null,
    purpose: null,
    participating_experts: null,
    next_best_action: null,
    status: "running",
    waiting_reason: null,
    current_phase: "memo_generation",
    progress_summary: "Reading the manuscript",
    trigger_run_id: "run_06g8n51qh25vkru9ln9492pi01",
    idempotency_key: "idem-1",
    authoritative_result_id: null,
    authoritative_result_type: null,
    result_summary: null,
    error_code: null,
    safe_error_message: null,
    diagnostics_storage_key: null,
    attempt_count: 1,
    max_attempts: 2,
    cancellation_requested_at: null,
    cancelled_at: null,
    cancelled_by: null,
    input_snapshot: {
      manuscriptTitle: "What Remains — Book Five",
      wordCount: 96217,
      characterCount: 539667,
      workflowOwner: "StoryDNA",
      workflowPurpose: "literary_agent_review",
      participatingExperts: ["Literary Agent"],
      reviewerDefinitionId: "literary_agent",
      editorialDecisionLogEnabled: false,
      authorGuidancePauseSupported: false,
      nextBestActionOnCompletion: true,
    },
    queued_at: "2026-09-10T13:49:01.400Z",
    started_at: "2026-09-10T13:49:03.328Z",
    heartbeat_at: "2026-09-10T14:22:05.171Z",
    paused_at: null,
    completed_at: null,
    failed_at: null,
    created_at: "2026-09-10T13:49:01.400Z",
    updated_at: "2026-09-10T14:00:15.033Z",
    ...overrides,
  };
}

async function runReconcile(args: {
  row: EditorialWorkflowRow | null;
  trigger?: ReconcileTriggerRun;
  expectedTriggerRunId?: string;
}) {
  const failed: Array<Record<string, unknown>> = [];
  const cancelled: string[] = [];
  const result = await reconcileOrphanedWorkflowState({
    workflowId: args.row?.id ?? "missing",
    expectedTriggerRunId: args.expectedTriggerRunId ?? "run_06g8n51qh25vkru9ln9492pi01",
    getWorkflow: async () => args.row,
    retrieveRun: async (id) => {
      if (!args.trigger) throw new Error("retrieve should not run");
      assert.equal(id, args.row?.trigger_run_id);
      return args.trigger;
    },
    markFailed: async (input) => {
      failed.push(input);
    },
    markCancelled: async (id) => {
      cancelled.push(id);
    },
    safeErrorForCode,
  });
  return { result, failed, cancelled };
}

describe("orphan Trigger reconciliation", () => {
  it("fail-closes stalled Trigger runs as failed, not cancelled", async () => {
    const { result, failed, cancelled } = await runReconcile({
      row: workflow(),
      trigger: {
        id: "run_06g8n51qh25vkru9ln9492pi01",
        status: "CANCELED",
        error: { message: "trigger.dev internal error (TASK_RUN_STALLED_EXECUTING)" },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.action, "marked_failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.errorCode, "PIPELINE_FAILED");
    assert.equal(cancelled.length, 0);
    const summary = failed[0]?.resultSummary as Record<string, unknown>;
    assert.equal(summary.failureKind, "trigger_run_stalled");
    assert.equal(summary.lastPhase, "memo_generation");
  });

  it("uses cancelled when the author requested cancellation", async () => {
    const { result, failed, cancelled } = await runReconcile({
      row: workflow({ cancellation_requested_at: "2026-09-10T13:50:00.000Z" }),
      trigger: {
        id: "run_06g8n51qh25vkru9ln9492pi01",
        status: "CANCELED",
        error: { message: "Cancelled by user" },
      },
    });
    assert.equal(result.action, "marked_cancelled");
    assert.equal(cancelled.length, 1);
    assert.equal(failed.length, 0);
  });

  it("is idempotent for an already terminal workflow", async () => {
    const first = await runReconcile({
      row: workflow({ status: "failed", failed_at: "2026-09-10T15:00:00.000Z" }),
    });
    const second = await runReconcile({
      row: workflow({ status: "failed", failed_at: "2026-09-10T15:00:00.000Z" }),
    });
    assert.equal(first.result.action, "already_terminal");
    assert.equal(second.result.action, "already_terminal");
    assert.equal(first.failed.length, 0);
    assert.equal(second.failed.length, 0);
  });

  it("refuses to fail-close a genuinely active Trigger run", async () => {
    const { result, failed } = await runReconcile({
      row: workflow(),
      trigger: { id: "run_06g8n51qh25vkru9ln9492pi01", status: "EXECUTING" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.action, "refused_active_run");
    assert.equal(failed.length, 0);
  });

  it("refuses a Trigger run id that does not belong to the workflow", async () => {
    const { result, failed } = await runReconcile({
      row: workflow(),
      expectedTriggerRunId: "run_other",
    });
    assert.equal(result.action, "refused_mismatch");
    assert.equal(failed.length, 0);
  });
});

describe("duplicate workflow guard remains intact", () => {
  it("treats running as an active status that blocks a second workflow", () => {
    assert.ok(ACTIVE_WORKFLOW_STATUSES.includes("running"));
    assert.ok(ACTIVE_WORKFLOW_STATUSES.includes("queued"));
    const src = readFileSync(join(ROOT, "lib/editorial-workflow/start-literary-agent-workflow.ts"), "utf8");
    assert.match(src, /getActiveWorkflowForManuscript/);
    assert.match(src, /existing: true/);
    assert.doesNotMatch(src, /ACTIVE_WORKFLOW_STATUSES\.filter/);
  });

  it("reconciliation never creates a workflow or invokes a provider", () => {
    const src = readFileSync(
      join(ROOT, "lib/editorial-workflow/reconcile-orphaned-workflow.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /createWorkflowRow/);
    assert.doesNotMatch(src, /startLiteraryAgent/);
    assert.doesNotMatch(src, /generateAgentReview/);
    assert.doesNotMatch(src, /anthropic/i);
  });
});
