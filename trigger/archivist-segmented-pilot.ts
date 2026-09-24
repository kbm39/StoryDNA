/**
 * Future segmented REVISED-11-2 paid-pilot Trigger task.
 * Prepared only. Does not start, deploy, or call a provider.
 * Must load real pinned manuscript text. Never passes empty manuscript_text.
 */

import { task, heartbeats, timeout } from "@trigger.dev/sdk/v3";
import { reconcileArchivistOrphanedWorkflowState } from "@/experts/archivist/live-orphan.ts";
import {
  ARCHIVIST_SEGMENTED_PILOT_TASK_ID,
  RECKONING_PAID_PILOT_AUTHORIZATION,
} from "@/experts/archivist/segmented/paid-pilot-authorization.ts";
import {
  assertPaidPilotMayConstructProvider,
  matchingPaidPilotGateRequest,
} from "@/experts/archivist/segmented/paid-pilot-gate.ts";
import {
  PAID_PILOT_TRIGGER_MAX_ATTEMPTS,
  PAID_PILOT_TRIGGER_MAX_DURATION_SECONDS,
} from "@/experts/archivist/segmented/paid-pilot-policy.ts";
import { PaidPilotUnauthorizedError } from "@/experts/archivist/segmented/errors.ts";

export { ARCHIVIST_SEGMENTED_PILOT_TASK_ID };

export interface ArchivistSegmentedPilotTaskPayload {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  authorization_id: string;
  resume_workflow_id?: string | null;
}

export async function executeArchivistSegmentedPilotTask(
  payload: ArchivistSegmentedPilotTaskPayload,
  hooks?: {
    onExecutionHeartbeat?: () => Promise<void>;
    abortSignal?: AbortSignal;
    shouldCancel?: () => Promise<boolean>;
    manuscriptText?: string;
  },
) {
  await hooks?.onExecutionHeartbeat?.();
  const cancelled = hooks?.shouldCancel ? await hooks.shouldCancel() : false;
  const manuscriptText = hooks?.manuscriptText ?? "";
  if (!manuscriptText.trim()) {
    throw new PaidPilotUnauthorizedError("manuscript_text_empty");
  }
  if (payload.authorization_id !== RECKONING_PAID_PILOT_AUTHORIZATION.authorization_id) {
    throw new PaidPilotUnauthorizedError("authorization_id_mismatch");
  }
  assertPaidPilotMayConstructProvider(
    matchingPaidPilotGateRequest({
      manuscript_id: payload.manuscript_id,
      manuscript_version_id: payload.manuscript_version_id,
      content_hash: payload.content_hash,
      resume_workflow_id: payload.resume_workflow_id ?? null,
      cancelled,
      signal: hooks?.abortSignal,
    }),
  );
  throw new PaidPilotUnauthorizedError("prepared_authorization_cannot_start_paid_pilot");
}

export const archivistSegmentedPilotTask = task({
  id: ARCHIVIST_SEGMENTED_PILOT_TASK_ID,
  retry: {
    maxAttempts: PAID_PILOT_TRIGGER_MAX_ATTEMPTS,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: PAID_PILOT_TRIGGER_MAX_DURATION_SECONDS,
  run: async (payload: ArchivistSegmentedPilotTaskPayload) => {
    return executeArchivistSegmentedPilotTask(payload, {
      onExecutionHeartbeat: () => heartbeats.yield(),
      abortSignal: timeout.signal,
    });
  },
});

export { reconcileArchivistOrphanedWorkflowState };
