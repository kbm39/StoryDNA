/**
 * Deterministic selected-scene coverage validation for Phase 2A.
 */

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  isSuccessfulTerminalSceneReviewStatus,
  isTerminalSceneReviewStatus,
  loadSceneReviewsForSnapshot,
  type PersistedSceneReviewRow,
} from "./scene-review-persistence.ts";
import type { MilitaryExpertSceneReviewStatus } from "./scene-review-contract.ts";

export const AUTHOR_MODE_ALLOWED_TERMINAL_STATUSES: readonly MilitaryExpertSceneReviewStatus[] = [
  "complete",
  "insufficient_evidence",
  "outside_expertise",
];

export interface SceneReviewCoverageMetrics {
  readonly selectionSnapshotId: string;
  readonly selectedCount: number;
  readonly terminalCount: number;
  readonly completeCount: number;
  readonly insufficientEvidenceCount: number;
  readonly outsideExpertiseCount: number;
  readonly failedCount: number;
  readonly queuedOrRunningCount: number;
  readonly coveragePercentage: number;
  readonly failedSceneIds: readonly string[];
  readonly incompleteSceneIds: readonly string[];
  readonly pass: boolean;
}

export function computeSceneReviewCoverage(
  selectedSceneIds: readonly string[],
  reviews: readonly PersistedSceneReviewRow[],
): SceneReviewCoverageMetrics {
  const reviewByScene = new Map(reviews.map((r) => [r.sceneId, r]));
  const failedSceneIds: string[] = [];
  const incompleteSceneIds: string[] = [];
  let completeCount = 0;
  let insufficientEvidenceCount = 0;
  let outsideExpertiseCount = 0;
  let failedCount = 0;
  let queuedOrRunningCount = 0;
  let terminalCount = 0;

  for (const sceneId of selectedSceneIds) {
    const review = reviewByScene.get(sceneId);
    if (!review) {
      incompleteSceneIds.push(sceneId);
      queuedOrRunningCount++;
      continue;
    }
    const status = review.reviewStatus;
    if (!isTerminalSceneReviewStatus(status)) {
      incompleteSceneIds.push(sceneId);
      queuedOrRunningCount++;
      continue;
    }
    terminalCount++;
    if (status === "complete") completeCount++;
    else if (status === "insufficient_evidence") insufficientEvidenceCount++;
    else if (status === "outside_expertise") outsideExpertiseCount++;
    else if (status === "failed") {
      failedCount++;
      failedSceneIds.push(sceneId);
    }
  }

  const selectedCount = selectedSceneIds.length;
  const successfulTerminal = completeCount + insufficientEvidenceCount + outsideExpertiseCount;
  const coveragePercentage =
    selectedCount === 0 ? 0 : Math.round((successfulTerminal / selectedCount) * 10000) / 100;

  const pass =
    selectedCount > 0 &&
    terminalCount === selectedCount &&
    failedCount === 0 &&
    queuedOrRunningCount === 0 &&
    incompleteSceneIds.length === 0 &&
    coveragePercentage === 100;

  return Object.freeze({
    selectionSnapshotId: reviews[0]?.selectionSnapshotId ?? "",
    selectedCount,
    terminalCount,
    completeCount,
    insufficientEvidenceCount,
    outsideExpertiseCount,
    failedCount,
    queuedOrRunningCount,
    coveragePercentage,
    failedSceneIds: Object.freeze(failedSceneIds),
    incompleteSceneIds: Object.freeze(incompleteSceneIds),
    pass,
  });
}

export async function persistSceneReviewCoverage(args: {
  selectionSnapshotId: string;
  workflowId: string;
  metrics: SceneReviewCoverageMetrics;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_military_expert_scene_review_coverage").upsert(
    {
      selection_snapshot_id: args.selectionSnapshotId,
      workflow_id: args.workflowId,
      selected_count: args.metrics.selectedCount,
      complete_count: args.metrics.completeCount,
      insufficient_evidence_count: args.metrics.insufficientEvidenceCount,
      outside_expertise_count: args.metrics.outsideExpertiseCount,
      failed_count: args.metrics.failedCount,
      coverage_percentage: args.metrics.coveragePercentage,
      validated_at: new Date().toISOString(),
    },
    { onConflict: "selection_snapshot_id" },
  );
  if (error) throw new Error(error.message);
}

export async function validateAndPersistCoverage(args: {
  selectionSnapshotId: string;
  workflowId: string;
  selectedSceneIds: readonly string[];
}): Promise<SceneReviewCoverageMetrics> {
  const reviews = await loadSceneReviewsForSnapshot(args.selectionSnapshotId);
  const metrics = computeSceneReviewCoverage(args.selectedSceneIds, reviews);
  await persistSceneReviewCoverage({
    selectionSnapshotId: args.selectionSnapshotId,
    workflowId: args.workflowId,
    metrics: { ...metrics, selectionSnapshotId: args.selectionSnapshotId },
  });
  return { ...metrics, selectionSnapshotId: args.selectionSnapshotId };
}

export function isSceneReviewCompleteForAuthorMode(status: MilitaryExpertSceneReviewStatus): boolean {
  return isSuccessfulTerminalSceneReviewStatus(status);
}
