#!/usr/bin/env node
/**
 * Phase 2A integration run — executes scene review workflow for pinned snapshot.
 * Bypasses Trigger when unavailable; executes workflow synchronously in-process.
 */

import { randomUUID } from "node:crypto";
import { executeMilitaryExpertV2SceneReviewWorkflow } from "../lib/editorial-workflow/execute-military-expert-v2-scene-review-workflow.ts";
import { createWorkflowRow, getWorkflowById } from "../lib/editorial-workflow/workflow-store.ts";
import { newWorkflowIdempotencyKey } from "../lib/editorial-workflow/idempotency.ts";
import { workflowMetadataForType } from "../lib/editorial-workflow/workflow-definitions.ts";
import { MILITARY_EXPERT_V2_SCENE_REVIEW_DEFINITION_VERSION } from "../lib/editorial-workflow/types.ts";
import {
  PHASE2A_PINNED_SELECTION_SNAPSHOT_ID,
  buildPhase2AWorkflowInputSnapshot,
  validatePhase2AHandoff,
} from "../lib/studio/military-expert-v2/handoff-validation.ts";
import { estimatePhase2ASceneReviewBudget } from "../lib/studio/military-expert-v2/scene-review-budget.ts";
import { getManuscriptReviewContext, getManuscriptMeta } from "../lib/reviews.ts";
import { getSupabaseAdmin } from "../lib/supabase/server.ts";
import { loadSceneReviewsForSnapshot } from "../lib/studio/military-expert-v2/scene-review-persistence.ts";
import { validateAndPersistCoverage } from "../lib/studio/military-expert-v2/scene-review-coverage.ts";
import {
  evaluatePhase2AAcceptance,
  findStrongestAndWeakestScenes,
  scoreMilitaryDepth,
} from "../lib/studio/military-expert-v2/scene-review-quality.ts";

const snapshotId = process.env.PHASE2A_SNAPSHOT_ID ?? PHASE2A_PINNED_SELECTION_SNAPSHOT_ID;

async function resetFailedSceneReviews(supabase) {
  const { data: failedReviews } = await supabase
    .from("studio_military_expert_scene_reviews")
    .select("scene_review_id")
    .eq("selection_snapshot_id", snapshotId)
    .eq("review_status", "failed");

  if (failedReviews?.length) {
    const ids = failedReviews.map((r) => r.scene_review_id);
    await supabase
      .from("studio_military_expert_scene_review_repairs")
      .delete()
      .in("scene_review_id", ids);
  }

  await supabase
    .from("studio_military_expert_scene_reviews")
    .update({
      review_status: "queued",
      error_code: null,
      safe_error_message: null,
      review_content: null,
      repair_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("selection_snapshot_id", snapshotId)
    .eq("review_status", "failed");
}

async function findOrCreateWorkflow(handoff) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("editorial_workflows")
    .select("id, status")
    .eq("workflow_type", "military_expert_v2_scene_review")
    .contains("input_snapshot", { phase2a: { selectionSnapshotId: snapshotId } })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "completed") {
    return existing.id;
  }

  if (existing?.status === "failed") {
    await resetFailedSceneReviews(supabase);
    await supabase
      .from("editorial_workflows")
      .update({
        status: "queued",
        error_code: null,
        safe_error_message: null,
        failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }

  if (existing && existing.status !== "cancelled") {
    return existing.id;
  }

  await resetFailedSceneReviews(supabase);

  const ctx = await getManuscriptReviewContext(handoff.inventory.manuscript_id);
  const meta = await getManuscriptMeta(handoff.inventory.manuscript_id);
  const inputSnapshot = buildPhase2AWorkflowInputSnapshot({
    selectionSnapshotId: snapshotId,
    inventoryId: handoff.inventory.inventory_id,
    manuscriptId: handoff.inventory.manuscript_id,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    selectedSceneIds: handoff.selectedSceneIds,
    title: meta?.title ?? "Manuscript",
    wordCount: ctx?.wordCount ?? null,
    characterCount: ctx?.characterCount ?? null,
  });

  const workflow = await createWorkflowRow({
    manuscriptId: handoff.inventory.manuscript_id,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    contentHash: ctx.contentHash,
    workflowType: "military_expert_v2_scene_review",
    workflowDefinitionVersion: MILITARY_EXPERT_V2_SCENE_REVIEW_DEFINITION_VERSION,
    idempotencyKey: newWorkflowIdempotencyKey(),
    inputSnapshot,
    metadata: workflowMetadataForType("military_expert_v2_scene_review"),
  });
  return workflow.id;
}

async function main() {
  console.log("=== Military Expert V2 Phase 2A Integration Run ===");
  console.log("Snapshot:", snapshotId);

  process.env.STUDIO_MILITARY_EXPERT_ENABLED = process.env.STUDIO_MILITARY_EXPERT_ENABLED ?? "1";
  process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC = process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC ?? "1";

  const handoff = await validatePhase2AHandoff({
    selectionSnapshotId: snapshotId,
    requirePinnedSnapshot: true,
  });
  if (!handoff.ok) {
    console.error("Handoff validation failed:", handoff.errorMessage);
    process.exit(1);
  }

  const selectedScenes = handoff.inventory.scenes.filter((s) =>
    handoff.selectedSceneIds.includes(s.scene_id),
  );
  const budget = estimatePhase2ASceneReviewBudget(selectedScenes.length, selectedScenes);
  console.log("Provider:", budget.provider);
  console.log("Model:", budget.model);
  console.log("Selected scenes:", budget.selectedSceneCount);
  console.log("Estimated cost USD:", budget.totalReservationUsd);
  console.log("Repair reserve USD:", budget.repairReserveUsd);
  console.log("Concurrency:", budget.maxConcurrentScenes);

  const workflowId = await findOrCreateWorkflow(handoff);
  console.log("Workflow ID:", workflowId);

  const result = await executeMilitaryExpertV2SceneReviewWorkflow(workflowId);
  console.log("Execution result:", JSON.stringify(result, null, 2));

  const workflow = await getWorkflowById(workflowId);
  const reviews = await loadSceneReviewsForSnapshot(snapshotId);
  const coverage = await validateAndPersistCoverage({
    selectionSnapshotId: snapshotId,
    workflowId,
    selectedSceneIds: handoff.selectedSceneIds,
  });
  const scorecards = reviews.filter((r) => r.document).map((r) => scoreMilitaryDepth(r.document));
  const acceptance = evaluatePhase2AAcceptance(scorecards);
  const { strongest, weakest } = findStrongestAndWeakestScenes(scorecards);

  console.log("\n=== Integration Metrics ===");
  console.log(JSON.stringify({
    workflowId,
    sceneReviewIds: reviews.map((r) => r.sceneReviewId),
    resultSummary: workflow?.result_summary,
    coverage,
    acceptance,
    strongest,
    weakest,
    scorecards: scorecards.map((s) => ({ sceneId: s.sceneId, pass: s.overallPass, scores: s.scores })),
  }, null, 2));

  if (!result.ok) process.exit(1);
  if (!acceptance.ok) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
