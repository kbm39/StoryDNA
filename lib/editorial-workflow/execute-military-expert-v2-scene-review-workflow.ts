import "server-only";

import { randomUUID } from "node:crypto";
import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import { readAnthropicApiKey } from "@/lib/expert-calibration/live/api-key.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { resolveProviderSpec } from "@/lib/expert-calibration/live/provider-allowlist.ts";
import { createAnthropicProviderInvoker } from "@/lib/expert-calibration/live/providers/anthropic/invoke.ts";
import {
  getWorkflowById,
  insertWorkflowEvent,
  isTerminalStatus,
  markWorkflowFailed,
  markWorkflowRunning,
  markWorkflowStarted,
  setWorkflowPhase,
  touchWorkflowHeartbeat,
  updateWorkflowRow,
  verifyWorkflowVersionPin,
} from "./workflow-store.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { isMilitaryExpertV2AvailableInStudio } from "@/lib/studio/military-expert-v2-feature-flag.ts";
import { validatePhase2AHandoff } from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { assembleSceneExcerpt } from "@/lib/studio/military-expert-v2/scene-excerpt.ts";
import { buildSceneReviewGenerationRequest } from "@/lib/studio/military-expert-v2/scene-review-invoke.ts";
import {
  applyDeterministicSceneReviewPatches,
  buildSceneReviewRepairPrompt,
  classifySceneReviewRepairNeed,
  processSceneReviewRepairResponse,
} from "@/lib/studio/military-expert-v2/scene-review-repair.ts";
import {
  validateSceneReviewDocument,
  parseSceneReviewProviderResponse,
  type SceneReviewValidationContext,
} from "@/lib/studio/military-expert-v2/scene-review-validation.ts";
import {
  mergeProviderOutputIntoReviewDocument,
  parseMilitaryExpertSceneReviewProviderOutput,
} from "@/lib/studio/military-expert-v2/scene-review-provider-output.ts";
import { hashMilitaryExpertSceneReviewDocument } from "@/lib/studio/military-expert-v2/scene-review-contract.ts";
import {
  buildPhase2ASceneReviewBudgetLimits,
  estimatePhase2ASceneReviewBudget,
  PHASE2A_MAX_CONCURRENT_SCENES,
  PHASE2A_MAX_REPAIR_ATTEMPTS,
  PHASE2A_SCENE_MAX_OUTPUT_TOKENS,
  PHASE2A_SCENE_TIMEOUT_MS,
} from "@/lib/studio/military-expert-v2/scene-review-budget.ts";
import {
  getOrCreateSceneReviewRow,
  isSuccessfulTerminalSceneReviewStatus,
  markSceneReviewRunning,
  persistCompletedSceneReview,
  persistFailedSceneReview,
  persistSceneReviewRepairAttempt,
  loadSceneReviewsForSnapshot,
} from "@/lib/studio/military-expert-v2/scene-review-persistence.ts";
import { validateAndPersistCoverage } from "@/lib/studio/military-expert-v2/scene-review-coverage.ts";
import {
  evaluatePhase2AAcceptance,
  findStrongestAndWeakestScenes,
  scoreMilitaryDepth,
} from "@/lib/studio/military-expert-v2/scene-review-quality.ts";
import type { MilitaryExpertSceneInventoryEntry } from "@/lib/studio/military-expert-v2/contracts.ts";

function validateMergedProviderJson(
  rawText: string,
  ctx: SceneReviewValidationContext & {
    sceneReviewId: string;
    inventoryId: string;
    selectionSnapshotId: string;
    sceneId: string;
    manuscriptId: string;
    manuscriptVersionId: string;
    workflowId: string;
    scene: MilitaryExpertSceneInventoryEntry;
    retryCount: number;
    repairCount: number;
    createdAt: string;
    providerMetadata: import("@/lib/studio/military-expert-v2/scene-review-contract.ts").MilitaryExpertSceneReviewProviderMetadata;
  },
) {
  const parsed = parseSceneReviewProviderResponse(rawText);
  if (!parsed.ok) {
    return {
      ok: false,
      document: null,
      structuralErrors: ["Provider output parse failed."],
      qualityErrors: [],
      extractionError: parsed.error ?? null,
    };
  }
  const providerOutput = parseMilitaryExpertSceneReviewProviderOutput(parsed.json);
  if (!providerOutput) {
    return {
      ok: false,
      document: null,
      structuralErrors: ["Provider output contract failed."],
      qualityErrors: [],
      extractionError: null,
    };
  }
  const merged = mergeProviderOutputIntoReviewDocument(providerOutput, {
    sceneReviewId: ctx.sceneReviewId,
    inventoryId: ctx.inventoryId,
    selectionSnapshotId: ctx.selectionSnapshotId,
    sceneId: ctx.sceneId,
    manuscriptId: ctx.manuscriptId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    workflowId: ctx.workflowId,
    locator: ctx.scene.locator,
    sceneTypes: ctx.scene.scene_types,
    actionCategories: ctx.scene.action_categories,
    participants: ctx.scene.participants,
    retryCount: ctx.retryCount,
    repairCount: ctx.repairCount,
    createdAt: ctx.createdAt,
    providerMetadata: ctx.providerMetadata,
    parsedReviewHash: "pending",
  });
  return validateSceneReviewDocument(merged, ctx, { skipQualityScoring: true });
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function executeMilitaryExpertV2SceneReviewWorkflow(workflowId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  coveragePass?: boolean;
  needsCalibration?: boolean;
}> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    throw new Error("Military Expert V2 scene review is not enabled.");
  }

  const workflow = await getWorkflowById(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  if (workflow.workflow_type !== "military_expert_v2_scene_review") {
    throw new Error("Unexpected workflow type for Military Expert V2 scene review.");
  }

  if (workflow.status === "completed") {
    return { ok: true, skipped: true, coveragePass: true };
  }
  if (isTerminalStatus(workflow.status) && workflow.status !== "failed") {
    return { ok: false, skipped: true };
  }

  const phase2a = workflow.input_snapshot.phase2a;
  if (!phase2a?.selectionSnapshotId) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Missing Phase 2A handoff snapshot."),
    });
    return { ok: false };
  }

  const apiKey = readAnthropicApiKey();
  if (!apiKey) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PROVIDER_UNAVAILABLE",
      safeErrorMessage: safeErrorForCode("PROVIDER_UNAVAILABLE"),
    });
    return { ok: false };
  }

  await markWorkflowStarted(workflowId, workflow.attempt_count + 1);
  await markWorkflowRunning(workflowId);
  await setWorkflowPhase(workflowId, "preparing");

  const pin = await verifyWorkflowVersionPin(workflow);
  if (!pin.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: pin.errorCode,
      safeErrorMessage: safeErrorForCode(pin.errorCode),
    });
    return { ok: false };
  }

  const handoff = await validatePhase2AHandoff({
    selectionSnapshotId: phase2a.selectionSnapshotId,
    requirePinnedSnapshot: false,
  });
  if (!handoff.ok || !handoff.inventory || !handoff.selectedSceneIds) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        handoff.errorMessage ?? "Handoff validation failed.",
      ),
    });
    return { ok: false };
  }

  const ctx = await getManuscriptReviewContext(workflow.manuscript_id);
  if (!ctx?.extractedText.trim() || !ctx.manuscriptVersionId || !ctx.contentHash) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Manuscript context unavailable."),
    });
    return { ok: false };
  }

  const selectedScenes = handoff.inventory.scenes.filter((s) =>
    handoff.selectedSceneIds!.includes(s.scene_id),
  );
  const budgetEstimate = estimatePhase2ASceneReviewBudget(
    selectedScenes.length,
    selectedScenes,
  );
  const budgetLimits = buildPhase2ASceneReviewBudgetLimits(selectedScenes.length);
  const budget = createBudgetController(budgetLimits);
  const providerSpec = resolveProviderSpec(
    budgetEstimate.provider,
    budgetEstimate.modelAlias,
  );

  await insertWorkflowEvent({
    workflowId,
    eventType: "v2_scene_review_started",
    phase: "preparing",
    payload: {
      selection_snapshot_id: phase2a.selectionSnapshotId,
      selected_scene_count: selectedScenes.length,
      provider: budgetEstimate.provider,
      model: budgetEstimate.model,
      estimated_cost_usd: budgetEstimate.totalReservationUsd,
      concurrency: PHASE2A_MAX_CONCURRENT_SCENES,
    },
  });

  const invoker = createAnthropicProviderInvoker(apiKey);
  const runStartedAt = Date.now();
  let providerCallCount = 0;
  let totalRepairCount = 0;

  await setWorkflowPhase(workflowId, "reviewing_scenes");

  const sceneMetrics: Array<{
    sceneId: string;
    sceneReviewId: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    repairCount: number;
  }> = [];

  await runWithConcurrency(selectedScenes, PHASE2A_MAX_CONCURRENT_SCENES, async (scene) => {
    await touchWorkflowHeartbeat(workflowId).catch(() => {});

    const existingReviews = await loadSceneReviewsForSnapshot(phase2a.selectionSnapshotId);
    const existing = existingReviews.find((r) => r.sceneId === scene.scene_id);
    if (existing && isSuccessfulTerminalSceneReviewStatus(existing.reviewStatus)) {
      return;
    }

    const row = await getOrCreateSceneReviewRow({
      selectionSnapshotId: phase2a.selectionSnapshotId,
      inventoryId: handoff.inventory!.inventory_id,
      sceneId: scene.scene_id,
      manuscriptId: handoff.inventory!.manuscript_id,
      manuscriptVersionId: handoff.inventory!.manuscript_version_id,
      workflowId,
    });

    if (isSuccessfulTerminalSceneReviewStatus(row.reviewStatus)) return;

    await markSceneReviewRunning(row.sceneReviewId);

    let excerpt;
    try {
      excerpt = assembleSceneExcerpt({ scene, manuscriptText: ctx.extractedText });
    } catch {
      await persistFailedSceneReview({
        sceneReviewId: row.sceneReviewId,
        errorCode: "SCENE_EXCERPT_FAILED",
        safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Scene excerpt assembly failed."),
        retryCount: row.retryCount + 1,
      });
      return;
    }

    const request = buildSceneReviewGenerationRequest({
      excerpt,
      inventoryId: handoff.inventory!.inventory_id,
      selectionSnapshotId: phase2a.selectionSnapshotId,
      sceneId: scene.scene_id,
      manuscriptId: handoff.inventory!.manuscript_id,
      manuscriptVersionId: handoff.inventory!.manuscript_version_id,
      manuscriptHash: ctx.contentHash,
      maxOutputTokens: PHASE2A_SCENE_MAX_OUTPUT_TOKENS,
    });

    const estimatedCost = estimateTokenCost(
      excerpt.totalCharsSent * 0.25,
      PHASE2A_SCENE_MAX_OUTPUT_TOKENS,
      providerSpec.pricingProfileId,
    );
    if (!budget.canAffordCall(estimatedCost, 0, PHASE2A_SCENE_MAX_OUTPUT_TOKENS)) {
      await persistFailedSceneReview({
        sceneReviewId: row.sceneReviewId,
        errorCode: "BUDGET_EXCEEDED",
        safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Scene review budget exhausted."),
        retryCount: row.retryCount + 1,
      });
      return;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PHASE2A_SCENE_TIMEOUT_MS);
    let invokeResult;
    try {
      invokeResult = await invoker({
        request,
        correlationId: request.correlationId,
        caseId: `${workflowId}:${scene.scene_id}`,
        modelId: providerSpec.modelId,
        timeoutMs: PHASE2A_SCENE_TIMEOUT_MS,
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    providerCallCount++;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    if (invokeResult.ok && invokeResult.rawResponse) {
      inputTokens = invokeResult.rawResponse.inputTokens ?? 0;
      outputTokens = invokeResult.rawResponse.outputTokens ?? 0;
      costUsd = estimateTokenCost(inputTokens, outputTokens, providerSpec.pricingProfileId);
      budget.recordCall(costUsd, inputTokens, outputTokens);
    } else {
      await persistFailedSceneReview({
        sceneReviewId: row.sceneReviewId,
        errorCode: "PROVIDER_FAILED",
        safeErrorMessage: safeErrorForCode(
          "PIPELINE_FAILED",
          invokeResult.providerError?.message ?? "Provider call failed.",
        ),
        retryCount: row.retryCount + 1,
      });
      return;
    }

    const validationCtx = {
      expectedSceneId: scene.scene_id,
      expectedInventoryId: handoff.inventory!.inventory_id,
      expectedSnapshotId: phase2a.selectionSnapshotId,
      sceneIsMajor: scene.priority_tier === "major",
    };

    const mergeCtx = {
      ...validationCtx,
      sceneReviewId: row.sceneReviewId,
      inventoryId: handoff.inventory!.inventory_id,
      selectionSnapshotId: phase2a.selectionSnapshotId,
      sceneId: scene.scene_id,
      manuscriptId: handoff.inventory!.manuscript_id,
      manuscriptVersionId: handoff.inventory!.manuscript_version_id,
      workflowId,
      scene,
      retryCount: row.retryCount,
      repairCount: row.repairCount,
      createdAt: row.createdAt,
      providerMetadata: Object.freeze({
        model: providerSpec.modelId,
        provider: budgetEstimate.provider,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        correlation_id: request.correlationId,
        captured_at: new Date().toISOString(),
      }),
    };

    let repairCount = 0;
    let validation = validateMergedProviderJson(invokeResult.rawResponse.responseText, mergeCtx);

    if (!validation.ok && repairCount < PHASE2A_MAX_REPAIR_ATTEMPTS) {
      await setWorkflowPhase(workflowId, "repairing_scenes");
      const repairReasons = classifySceneReviewRepairNeed(validation);
      if (repairReasons.length > 0 && budget.canAffordCall(estimatedCost * 0.5, 0, PHASE2A_SCENE_MAX_OUTPUT_TOKENS)) {
        const repairPrompt = buildSceneReviewRepairPrompt({
          originalJson: invokeResult.rawResponse.responseText,
          repairReasons,
          sceneId: scene.scene_id,
        });
        const repairRequest = {
          ...request,
          correlationId: randomUUID(),
          reviewPrompt: repairPrompt,
        };
        const repairAbort = new AbortController();
        const repairTimeout = setTimeout(() => repairAbort.abort(), PHASE2A_SCENE_TIMEOUT_MS);
        let repairResult;
        try {
          repairResult = await invoker({
            request: repairRequest,
            correlationId: repairRequest.correlationId,
            caseId: `${workflowId}:${scene.scene_id}:repair`,
            modelId: providerSpec.modelId,
            timeoutMs: PHASE2A_SCENE_TIMEOUT_MS,
            signal: repairAbort.signal,
          });
        } finally {
          clearTimeout(repairTimeout);
        }
        providerCallCount++;
        repairCount++;
        totalRepairCount++;

        if (repairResult.ok && repairResult.rawResponse) {
          const rIn = repairResult.rawResponse.inputTokens ?? 0;
          const rOut = repairResult.rawResponse.outputTokens ?? 0;
          const rCost = estimateTokenCost(rIn, rOut, providerSpec.pricingProfileId);
          budget.recordCall(rCost, rIn, rOut);
          inputTokens += rIn;
          outputTokens += rOut;
          costUsd += rCost;

          const repairProcessed = processSceneReviewRepairResponse(
            repairResult.rawResponse.responseText,
            {
              ...validationCtx,
              workflowId,
              sceneReviewId: row.sceneReviewId,
              locator: scene.locator,
              sceneTypes: scene.scene_types,
              actionCategories: scene.action_categories,
              participants: scene.participants,
              createdAt: row.createdAt,
              repairCount: row.repairCount,
              retryCount: row.retryCount,
              repairCostUsd: rCost,
              attemptNumber: repairCount,
              repairReasons,
            },
          );

          if (repairProcessed.attempt) {
            await persistSceneReviewRepairAttempt({
              sceneReviewId: row.sceneReviewId,
              attempt: repairProcessed.attempt,
            });
          }

          if (repairProcessed.document) {
            validation = validateSceneReviewDocument(repairProcessed.document, validationCtx, {
              skipQualityScoring: true,
            });
          } else if (repairResult.rawResponse) {
            validation = validateMergedProviderJson(repairResult.rawResponse.responseText, {
              ...mergeCtx,
              repairCount: row.repairCount + repairCount,
              providerMetadata: Object.freeze({
                ...mergeCtx.providerMetadata,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costUsd,
              }),
            });
          }
        }
      }
    }

    if (!validation.ok || !validation.document) {
      validation = validateMergedProviderJson(invokeResult.rawResponse.responseText, {
        ...mergeCtx,
        repairCount: row.repairCount + repairCount,
      });
    }

    if (!validation.ok || !validation.document) {
      await persistFailedSceneReview({
        sceneReviewId: row.sceneReviewId,
        errorCode: "VALIDATION_FAILED",
        safeErrorMessage: safeErrorForCode(
          "PIPELINE_FAILED",
          "Scene review validation failed.",
        ),
        retryCount: row.retryCount + 1,
      });
      return;
    }

    const completedDoc = Object.freeze({
      ...validation.document,
      scene_review_id: row.sceneReviewId,
      workflow_id: workflowId,
      manuscript_id: handoff.inventory!.manuscript_id,
      manuscript_version_id: handoff.inventory!.manuscript_version_id,
      locator: scene.locator,
      scene_types: scene.scene_types,
      action_categories: scene.action_categories,
      participants: scene.participants,
      retry_count: row.retryCount,
      repair_count: row.repairCount + repairCount,
      created_at: row.createdAt,
      completed_at: new Date().toISOString(),
      provider_metadata: Object.freeze({
        model: providerSpec.modelId,
        provider: budgetEstimate.provider,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        correlation_id: request.correlationId,
        captured_at: new Date().toISOString(),
      }),
    });

    await persistCompletedSceneReview({
      document: completedDoc,
      providerMetadata: completedDoc.provider_metadata as unknown as Record<string, unknown>,
      costMetadata: { cost_usd: costUsd, input_tokens: inputTokens, output_tokens: outputTokens },
    });

    sceneMetrics.push({
      sceneId: scene.scene_id,
      sceneReviewId: row.sceneReviewId,
      inputTokens,
      outputTokens,
      costUsd,
      repairCount,
    });
  });

  await setWorkflowPhase(workflowId, "validating_coverage");
  const coverage = await validateAndPersistCoverage({
    selectionSnapshotId: phase2a.selectionSnapshotId,
    workflowId,
    selectedSceneIds: handoff.selectedSceneIds,
  });

  const reviews = await loadSceneReviewsForSnapshot(phase2a.selectionSnapshotId);
  const scorecards = reviews
    .filter((r) => r.document)
    .map((r) => scoreMilitaryDepth(r.document!));
  const acceptance = evaluatePhase2AAcceptance(scorecards);
  const { strongest, weakest } = findStrongestAndWeakestScenes(scorecards);
  const runtimeMs = Date.now() - runStartedAt;
  const totalInputTokens = sceneMetrics.reduce((s, m) => s + m.inputTokens, 0);
  const totalOutputTokens = sceneMetrics.reduce((s, m) => s + m.outputTokens, 0);
  const totalCost = sceneMetrics.reduce((s, m) => s + m.costUsd, 0);

  const resultSummary = {
    selection_snapshot_id: phase2a.selectionSnapshotId,
    inventory_id: handoff.inventory.inventory_id,
    selected_scene_count: handoff.selectedSceneIds.length,
    provider_call_count: providerCallCount,
    model: budgetEstimate.model,
    provider: budgetEstimate.provider,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: Math.round(totalCost * 10000) / 10000,
    runtime_ms: runtimeMs,
    repair_count: totalRepairCount,
    coverage: coverage,
    strongest_scene: strongest,
    weakest_scene: weakest,
    scene_review_ids: reviews.map((r) => r.sceneReviewId),
    quality_acceptance: acceptance.ok,
    phase: coverage.pass ? (acceptance.ok ? "completed" : "needs_calibration") : "coverage_incomplete",
  };

  if (!coverage.pass) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "COVERAGE_INCOMPLETE",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        `Coverage incomplete. Failed scenes: ${coverage.failedSceneIds.join(", ") || "none"}. Incomplete: ${coverage.incompleteSceneIds.join(", ")}.`,
      ),
    });
    await updateWorkflowRow(workflowId, { result_summary: resultSummary });
    return { ok: false, coveragePass: false };
  }

  const completedAt = new Date().toISOString();
  await updateWorkflowRow(workflowId, {
    status: "completed",
    current_phase: "completed",
    progress_summary: acceptance.ok
      ? "Military Expert V2 scene reviews complete"
      : "Scene reviews complete — calibration needed",
    result_summary: resultSummary,
    completed_at: completedAt,
    heartbeat_at: completedAt,
    safe_error_message: null,
    error_code: null,
  });

  await insertWorkflowEvent({
    workflowId,
    eventType: "completed",
    phase: "completed",
    payload: resultSummary,
  });

  return {
    ok: true,
    coveragePass: true,
    needsCalibration: !acceptance.ok,
  };
}
