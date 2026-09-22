/**
 * Archivist continuity-review Trigger task.
 *
 * Uses the hardened Literary Agent execution foundation (heartbeat/yield,
 * timeout.signal, AbortSignal, maxDuration). Not deployed or run in this phase.
 * If invoked, fail closed: execution_wired and live_model_certified remain false.
 */

import { task, heartbeats, timeout } from "@trigger.dev/sdk/v3";
import { runArchivistLiveExecution } from "@/experts/archivist/live-execute.ts";
import { reconcileArchivistOrphanedWorkflowState } from "@/experts/archivist/live-orphan.ts";

export const ARCHIVIST_CONTINUITY_REVIEW_TASK_ID = "archivist-continuity-review" as const;

export interface ArchivistContinuityReviewTaskPayload {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  expert_version_id: string;
  series_id?: string | null;
  series_order?: number | null;
  prior_authoritative_manuscript_versions?: Array<{
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  }>;
}

export async function executeArchivistContinuityReviewTask(
  payload: ArchivistContinuityReviewTaskPayload,
  hooks?: {
    onExecutionHeartbeat?: () => Promise<void>;
    abortSignal?: AbortSignal;
    shouldCancel?: () => Promise<boolean>;
  },
) {
  return runArchivistLiveExecution({
    request: {
      expert_key: "archivist",
      expert_version_id: payload.expert_version_id,
      manuscript_id: payload.manuscript_id,
      manuscript_version_id: payload.manuscript_version_id,
      content_hash: payload.content_hash,
      mode: "live",
      manuscript_text: "",
      series_id: payload.series_id,
      series_order: payload.series_order,
      prior_authoritative_manuscript_versions: payload.prior_authoritative_manuscript_versions,
    },
    options: {
      expertKey: "archivist",
      expertVersionId: payload.expert_version_id,
      manuscriptId: payload.manuscript_id,
      manuscriptVersionId: payload.manuscript_version_id,
      contentHash: payload.content_hash,
      executionMode: "live",
      onExecutionHeartbeat: hooks?.onExecutionHeartbeat,
      abortSignal: hooks?.abortSignal,
      shouldCancel: hooks?.shouldCancel,
    },
  });
}

export const archivistContinuityReviewTask = task({
  id: ARCHIVIST_CONTINUITY_REVIEW_TASK_ID,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: 3600,
  run: async (payload: ArchivistContinuityReviewTaskPayload) => {
    return executeArchivistContinuityReviewTask(payload, {
      onExecutionHeartbeat: () => heartbeats.yield(),
      abortSignal: timeout.signal,
    });
  },
});

export { reconcileArchivistOrphanedWorkflowState };
