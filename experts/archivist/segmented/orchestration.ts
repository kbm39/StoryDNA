/**
 * Source-level segmented orchestration for a future live mode.
 * Does not start Trigger, deploy, or make public live execution reachable.
 */

import { WorkflowCancelledError } from "@/lib/editorial-workflow/types.ts";
import { RECKONING_REVISED_11_SOURCE_PIN } from "../reckoning-revised-11-source-pin.ts";
import { RECKONING_REVISED_11_2_SOURCE_PIN } from "../reckoning-revised-11-2-source-pin.ts";
import { isArchivistLiveExecutionAllowed } from "../live-flags.ts";
import { reconcileArchivistOrphanedWorkflowState } from "../live-orphan.ts";
import { assertCertifiedSegmentedModel } from "./certified-model.ts";
import {
  DuplicateSegmentedResumeError,
  SegmentedExecutionUnauthorizedError,
} from "./errors.ts";
import type { SegmentCheckpoint } from "./types.ts";

export const SEGMENTED_ORCHESTRATION_PHASES = [
  "load_pinned_manuscript",
  "extract_units",
  "plan_segments",
  "prove_coverage",
  "observe_segments",
  "checkpoint",
  "resume_incomplete",
  "merge_book_graph",
  "pair_contradictions",
  "rehydrate_evidence",
  "classify",
  "assemble_review",
] as const;

export async function assertSegmentedLiveMayNotStart(args?: {
  signal?: AbortSignal;
  shouldCancel?: () => boolean | Promise<boolean>;
  activeWorkflowIds?: string[];
}): Promise<void> {
  if (RECKONING_REVISED_11_SOURCE_PIN.authorized_to_run !== false) {
    throw new SegmentedExecutionUnauthorizedError("authorized_to_run must remain false");
  }
  if (RECKONING_REVISED_11_2_SOURCE_PIN.authorized_to_run !== false) {
    throw new SegmentedExecutionUnauthorizedError("authorized_to_run must remain false");
  }
  if (isArchivistLiveExecutionAllowed() !== false) {
    throw new SegmentedExecutionUnauthorizedError("public live execution must remain fail-closed");
  }
  assertCertifiedSegmentedModel({
    provider: RECKONING_REVISED_11_2_SOURCE_PIN.provider,
    model: RECKONING_REVISED_11_2_SOURCE_PIN.model,
  });
  if (args?.signal?.aborted || (args?.shouldCancel && await args.shouldCancel())) {
    throw new WorkflowCancelledError();
  }
  if ((args?.activeWorkflowIds?.length ?? 0) > 0) {
    throw new DuplicateSegmentedResumeError("duplicate active segmented workflow");
  }
  throw new SegmentedExecutionUnauthorizedError(
    "segmented live orchestration is implemented but not authorized",
  );
}

export function reconcileSegmentedOrphans(
  checkpoints: readonly SegmentCheckpoint[],
  staleRunningIds: readonly string[] = [],
): SegmentCheckpoint[] {
  return checkpoints.map((checkpoint) => {
    if (checkpoint.status === "running" && staleRunningIds.includes(checkpoint.segment_id)) {
      return { ...checkpoint, status: "failed", error: "orphaned_running_checkpoint" };
    }
    return checkpoint;
  });
}

export { reconcileArchivistOrphanedWorkflowState };
