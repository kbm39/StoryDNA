import "server-only";

import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { runFreshEditorialGeneration } from "@/lib/editorial-generation/run-fresh-editorial-generation";
import {
  createWorkflowRow,
  getActiveWorkflowForManuscript,
  getWorkflowById,
  isCancellationRequested,
  isTerminalStatus,
  linkTriggerRun,
  markWorkflowCancelled,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowRunning,
  markWorkflowStarted,
  markWorkflowWaiting,
  setWorkflowPhase,
  touchWorkflowHeartbeat,
  verifyWorkflowVersionPin,
} from "./workflow-store.ts";
import { newWorkflowIdempotencyKey, isUniqueViolation } from "./idempotency.ts";
import {
  LITERARY_AGENT_DEFINITION_VERSION,
  type EditorialWorkflowHooks,
  WorkflowCancelledError,
} from "./types.ts";
import { errorCodeFromMessage, safeErrorForCode } from "./safe-errors.ts";
import { triggerLiteraryAgentReviewTask } from "./trigger-client.ts";
import {
  nextBestActionForCompletedWorkflow,
  workflowMetadataForType,
} from "./workflow-definitions.ts";

export interface StartLiteraryAgentWorkflowResult {
  ok: boolean;
  workflowId?: string;
  existing?: boolean;
  error?: string;
}

function buildInputSnapshot(args: {
  title: string;
  wordCount: number | null;
  characterCount: number | null;
}): import("./types.ts").WorkflowInputSnapshot {
  return {
    manuscriptTitle: args.title,
    wordCount: args.wordCount,
    characterCount: args.characterCount,
    workflowOwner: "StoryDNA",
    workflowPurpose: "literary_agent_review",
    participatingExperts: ["Literary Agent"],
    reviewerDefinitionId: "literary_agent",
    editorialDecisionLogEnabled: false,
    authorGuidancePauseSupported: false,
    nextBestActionOnCompletion: true,
  };
}

export async function startLiteraryAgentWorkflow(
  manuscriptId: string,
): Promise<StartLiteraryAgentWorkflowResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const existing = await getActiveWorkflowForManuscript({
    manuscriptId,
    workflowType: "literary_agent_review",
  });
  if (existing) {
    return { ok: true, workflowId: existing.id, existing: true };
  }

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }
  if (!ctx.manuscriptVersionId || !ctx.contentHash) {
    return {
      ok: false,
      error: "This manuscript has no version snapshot for Publishing Workflow.",
    };
  }

  const meta = await getManuscriptMeta(manuscriptId);
  const idempotencyKey = newWorkflowIdempotencyKey();

  let workflow;
  try {
    workflow = await createWorkflowRow({
      manuscriptId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      contentHash: ctx.contentHash,
      workflowType: "literary_agent_review",
      workflowDefinitionVersion: LITERARY_AGENT_DEFINITION_VERSION,
      idempotencyKey,
      inputSnapshot: buildInputSnapshot({
        title: meta?.title ?? "Manuscript",
        wordCount: ctx.wordCount,
        characterCount: ctx.characterCount,
      }),
      metadata: workflowMetadataForType("literary_agent_review"),
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const active = await getActiveWorkflowForManuscript({
        manuscriptId,
        workflowType: "literary_agent_review",
      });
      if (active) return { ok: true, workflowId: active.id, existing: true };
    }
    throw e;
  }

  const triggerResult = await triggerLiteraryAgentReviewTask(workflow.id);
  if (!triggerResult.ok) {
    await markWorkflowFailed({
      workflowId: workflow.id,
      errorCode: "TRIGGER_UNAVAILABLE",
      safeErrorMessage: safeErrorForCode("TRIGGER_UNAVAILABLE"),
    });
    return { ok: false, error: safeErrorForCode("TRIGGER_UNAVAILABLE") };
  }

  if (triggerResult.runId) {
    await linkTriggerRun(workflow.id, triggerResult.runId);
  }

  return { ok: true, workflowId: workflow.id, existing: false };
}

async function persistUncaughtWorkflowFailure(workflowId: string, original: Error): Promise<void> {
  try {
    const current = await getWorkflowById(workflowId);
    if (!current || isTerminalStatus(current.status)) {
      return;
    }
    await markWorkflowFailed({
      workflowId,
      errorCode: "WORKER_INIT_FAILED",
      safeErrorMessage: safeErrorForCode("WORKER_INIT_FAILED"),
    });
  } catch (persistErr) {
    console.error("[Publishing Workflow] failed to persist workflow failure", {
      workflowId,
      originalError: original.name,
      originalMessage: original.message.slice(0, 200),
      persistMessage:
        persistErr instanceof Error ? persistErr.message.slice(0, 200) : String(persistErr),
    });
  }
}

export async function executeLiteraryAgentWorkflow(workflowId: string): Promise<{
  ok: boolean;
  cancelled?: boolean;
  skipped?: boolean;
}> {
  if (!workflowId) {
    throw new Error("Missing workflow id.");
  }

  try {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

  if (workflow.status === "completed" && workflow.authoritative_result_id) {
    return { ok: true, skipped: true };
  }
  if (workflow.status === "cancelled" || workflow.cancelled_at) {
    return { ok: true, cancelled: true, skipped: true };
  }

  const attemptCount = workflow.attempt_count + 1;
  await markWorkflowStarted(workflowId, attemptCount);

  const pin = await verifyWorkflowVersionPin(workflow);
  if (!pin.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: pin.errorCode,
      safeErrorMessage: safeErrorForCode(pin.errorCode),
    });
    return { ok: false };
  }

  const supabase = getSupabaseAdmin();
  const { count: authorResponseCount } = await supabase
    .from("author_edit_responses")
    .select("id", { count: "exact", head: true })
    .eq("manuscript_id", workflow.manuscript_id);

  if ((authorResponseCount ?? 0) > 0) {
    await markWorkflowWaiting(
      workflowId,
      "author_input",
      safeErrorForCode("AUTHOR_RESPONSES_PRESENT"),
    );
    return { ok: false };
  }

  await markWorkflowRunning(workflowId);
  await setWorkflowPhase(workflowId, "validating");

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  const startHeartbeat = () => {
    heartbeatTimer = setInterval(() => {
      void touchWorkflowHeartbeat(workflowId).catch(() => {});
    }, 30_000);
  };
  const stopHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const hooks: EditorialWorkflowHooks = {
    workflowId,
    triggerRunId: workflow.trigger_run_id,
    onPhase: async (phase) => {
      await setWorkflowPhase(workflowId, phase);
    },
    shouldCancel: async () => isCancellationRequested(workflowId),
    assertVersionPin: async () => {
      const current = await getWorkflowById(workflowId);
      if (!current) throw new Error("Workflow missing during execution.");
      const check = await verifyWorkflowVersionPin(current);
      if (!check.ok) throw new Error(check.errorCode);
    },
  };

  startHeartbeat();
  try {
    const result = await runFreshEditorialGeneration(workflow.manuscript_id, hooks);

    if (!result.ok) {
      const code = errorCodeFromMessage(result.error ?? "");
      await markWorkflowFailed({
        workflowId,
        errorCode: code,
        safeErrorMessage: safeErrorForCode(code, result.error),
        diagnosticsStorageKey: result.diagnosticsStorageKey ?? null,
      });
      return { ok: false };
    }

    if (!result.newReviewId) {
      await markWorkflowFailed({
        workflowId,
        errorCode: "PIPELINE_FAILED",
        safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Publish did not return a review id."),
      });
      return { ok: false };
    }

    await markWorkflowCompleted({
      workflowId,
      authoritativeResultId: result.newReviewId,
      authoritativeResultType: "commercial_review",
      resultSummary: {
        reviewId: result.newReviewId,
        issueCount: result.issueCount ?? 0,
        candidateCount: result.candidateCount ?? 0,
        oldReviewId: result.oldReviewId ?? null,
        warnings: result.warnings ?? [],
      },
      nextBestAction: nextBestActionForCompletedWorkflow("literary_agent_review"),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof WorkflowCancelledError) {
      await markWorkflowCancelled(workflowId);
      return { ok: true, cancelled: true };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "VERSION_PIN_MISMATCH") {
      await markWorkflowFailed({
        workflowId,
        errorCode: "VERSION_PIN_MISMATCH",
        safeErrorMessage: safeErrorForCode("VERSION_PIN_MISMATCH"),
      });
      return { ok: false };
    }
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED"),
    });
    return { ok: false };
  } finally {
    stopHeartbeat();
  }
  } catch (e) {
    const original = e instanceof Error ? e : new Error(String(e));
    await persistUncaughtWorkflowFailure(workflowId, original);
    throw original;
  }
}

export async function getWorkflowForClient(workflowId: string) {
  const row = await getWorkflowById(workflowId);
  if (!row) return null;
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    workflowType: row.workflow_type,
    department: row.department,
    ownerLabel: row.owner_label,
    purpose: row.purpose,
    participatingExperts: row.participating_experts,
    nextBestAction: row.next_best_action,
    status: row.status,
    waitingReason: row.waiting_reason,
    currentPhase: row.current_phase,
    progressSummary: row.progress_summary,
    safeErrorMessage: row.safe_error_message,
    authoritativeResultId: row.authoritative_result_id,
    resultSummary: row.result_summary,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    heartbeatAt: row.heartbeat_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
    cancellationRequestedAt: row.cancellation_requested_at,
    isTerminal: isTerminalStatus(row.status),
  };
}
