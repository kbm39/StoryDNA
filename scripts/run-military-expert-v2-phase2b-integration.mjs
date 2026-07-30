#!/usr/bin/env node
/**
 * Phase 2B integration run — executes synthesis workflow for pinned snapshot.
 */

import { executeMilitaryExpertV2SynthesisWorkflow } from "../lib/editorial-workflow/execute-military-expert-v2-synthesis-workflow.ts";
import { createWorkflowRow, getWorkflowById } from "../lib/editorial-workflow/workflow-store.ts";
import { newWorkflowIdempotencyKey } from "../lib/editorial-workflow/idempotency.ts";
import { workflowMetadataForType } from "../lib/editorial-workflow/workflow-definitions.ts";
import { MILITARY_EXPERT_V2_SYNTHESIS_DEFINITION_VERSION } from "../lib/editorial-workflow/types.ts";
import {
  PHASE2A_PINNED_SELECTION_SNAPSHOT_ID,
  buildPhase2BWorkflowInputSnapshot,
  validatePhase2BHandoff,
} from "../lib/studio/military-expert-v2/handoff-validation.ts";
import { estimatePhase2BSynthesisBudget } from "../lib/studio/military-expert-v2/synthesis-budget.ts";
import { getManuscriptReviewContext, getManuscriptMeta } from "../lib/reviews.ts";
import { getSupabaseAdmin } from "../lib/supabase/server.ts";
import { loadSynthesisForSnapshot } from "../lib/studio/military-expert-v2/synthesis-persistence.ts";
import {
  evaluateSynthesisAuthorQuality,
  findStrongestAndWeakestSynthesisFindings,
} from "../lib/studio/military-expert-v2/synthesis-quality.ts";
import { loadInventoryById } from "../lib/studio/military-expert-v2/persistence.ts";
import { loadSceneReviewsForSnapshot } from "../lib/studio/military-expert-v2/scene-review-persistence.ts";
import { assembleMilitaryExpertV2SynthesisInput } from "../lib/studio/military-expert-v2/synthesis-input.ts";
import { computeSceneReviewCoverage } from "../lib/studio/military-expert-v2/scene-review-coverage.ts";
import { buildMilitaryExpertV2SynthesisReport } from "../lib/studio/military-expert-v2/synthesis-report.ts";

const snapshotId =
  process.env.PHASE2B_SNAPSHOT_ID ?? PHASE2A_PINNED_SELECTION_SNAPSHOT_ID;
const phase2aWorkflowId =
  process.env.PHASE2A_WORKFLOW_ID ?? "6ffa7629-b831-4d5c-81c0-3784b470849a";

async function findOrCreateWorkflow(handoff) {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("editorial_workflows")
    .select("id, status, authoritative_result_id")
    .eq("workflow_type", "military_expert_v2_synthesis")
    .contains("input_snapshot", { phase2b: { selectionSnapshotId: snapshotId } })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "completed") {
    return existing.id;
  }

  if (existing && existing.status !== "cancelled" && existing.status !== "failed") {
    return existing.id;
  }

  const ctx = await getManuscriptReviewContext(handoff.inventory.manuscript_id);
  const meta = await getManuscriptMeta(handoff.inventory.manuscript_id);
  const inputSnapshot = buildPhase2BWorkflowInputSnapshot({
    selectionSnapshotId: snapshotId,
    inventoryId: handoff.inventory.inventory_id,
    manuscriptId: handoff.inventory.manuscript_id,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    selectedSceneIds: handoff.selectedSceneIds,
    phase2aWorkflowId: handoff.phase2aWorkflowId,
    title: meta?.title ?? "Manuscript",
    wordCount: ctx?.wordCount ?? null,
    characterCount: ctx?.characterCount ?? null,
  });

  const workflow = await createWorkflowRow({
    manuscriptId: handoff.inventory.manuscript_id,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    contentHash: ctx.contentHash,
    workflowType: "military_expert_v2_synthesis",
    workflowDefinitionVersion: MILITARY_EXPERT_V2_SYNTHESIS_DEFINITION_VERSION,
    idempotencyKey: newWorkflowIdempotencyKey(),
    inputSnapshot,
    metadata: workflowMetadataForType("military_expert_v2_synthesis"),
  });
  return workflow.id;
}

async function main() {
  console.log("=== Military Expert V2 Phase 2B Integration Run ===");
  console.log("Snapshot:", snapshotId);
  console.log("Phase 2A workflow:", phase2aWorkflowId);

  process.env.STUDIO_MILITARY_EXPERT_ENABLED = process.env.STUDIO_MILITARY_EXPERT_ENABLED ?? "1";
  process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC = process.env.MILITARY_EXPERT_V2_SCENE_CENTRIC ?? "1";

  const handoff = await validatePhase2BHandoff({
    selectionSnapshotId: snapshotId,
    phase2aWorkflowId,
    requirePinnedSnapshot: true,
    allowExistingSynthesis: true,
  });
  if (!handoff.ok) {
    console.error("Handoff validation failed:", handoff.errorMessage);
    process.exit(1);
  }

  const budget = estimatePhase2BSynthesisBudget();
  console.log("Provider:", budget.provider);
  console.log("Model:", budget.model);
  console.log("Estimated cost USD:", budget.totalReservationUsd);

  const workflowId = await findOrCreateWorkflow(handoff);
  console.log("Workflow ID:", workflowId);

  const result = await executeMilitaryExpertV2SynthesisWorkflow(workflowId);
  console.log("Execution result:", JSON.stringify(result, null, 2));

  const workflow = await getWorkflowById(workflowId);
  const synthesisRow = await loadSynthesisForSnapshot(snapshotId);

  let quality = null;
  let strongest = null;
  let weakest = null;
  let report = null;

  if (synthesisRow?.document && handoff.inventory) {
    const inventory = await loadInventoryById(handoff.inventory.inventory_id);
    const reviews = await loadSceneReviewsForSnapshot(snapshotId);
    const coverage = computeSceneReviewCoverage(handoff.selectedSceneIds, reviews);
    const input = assembleMilitaryExpertV2SynthesisInput({
      inventory: inventory,
      selectedSceneIds: handoff.selectedSceneIds,
      reviews,
      coverage,
    });
    report = buildMilitaryExpertV2SynthesisReport({
      synthesis: synthesisRow.document,
      inventory: inventory,
      selectedSceneIds: handoff.selectedSceneIds,
      reviews,
      input,
    });
    quality = evaluateSynthesisAuthorQuality(report);
    ({ strongest, weakest } = findStrongestAndWeakestSynthesisFindings(report));
  }

  console.log("\n=== Integration Metrics ===");
  console.log(
    JSON.stringify(
      {
        workflowId,
        synthesisId: synthesisRow?.synthesisId,
        authoritativeReviewId: workflow?.authoritative_result_id,
        resultSummary: workflow?.result_summary,
        quality,
        strongest,
        weakest,
        reportCounts: report
          ? {
              topPriority: report.topPriorityFindings.length,
              confirmed: report.confirmedFindings.length,
              authorReviewRequired: report.authorReviewRequiredFindings.length,
              sceneAppendix: report.sceneAppendix.length,
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (!result.ok) process.exit(1);
  if (result.needsCalibration) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
