import "server-only";

import { randomUUID } from "node:crypto";
import { MILITARY_EXPERT_KEY, MILITARY_EXPERT_VERSION } from "@/experts/military-expert/contracts.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "@/experts/military-expert/generation-contract.ts";
import type { MilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-types.ts";
import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import { readAnthropicApiKey } from "@/lib/expert-calibration/live/api-key.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { resolveProviderSpec } from "@/lib/expert-calibration/live/provider-allowlist.ts";
import { createAnthropicProviderInvoker } from "@/lib/expert-calibration/live/providers/anthropic/invoke.ts";
import { hashCanonicalOutput } from "@/lib/expert-review-engine/canonical-output.ts";
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
import { validatePhase2BHandoff } from "@/lib/studio/military-expert-v2/handoff-validation.ts";
import { assembleMilitaryExpertV2SynthesisInput } from "@/lib/studio/military-expert-v2/synthesis-input.ts";
import {
  buildMilitaryExpertV2SynthesisGenerationRequest,
  MILITARY_EXPERT_V2_SYNTHESIS_PROMPT_VERSION,
} from "@/lib/studio/military-expert-v2/synthesis-prompt.ts";
import {
  buildPhase2BSynthesisBudgetLimits,
  estimatePhase2BSynthesisBudget,
  PHASE2B_MAX_REPAIR_ATTEMPTS,
  PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS,
  PHASE2B_SYNTHESIS_TIMEOUT_MS,
} from "@/lib/studio/military-expert-v2/synthesis-budget.ts";
import {
  classifySynthesisRepairNeed,
  mergeProviderOutputIntoSynthesisDocument,
  parseSynthesisProviderResponse,
  validateSynthesisDocument,
} from "@/lib/studio/military-expert-v2/synthesis-validation.ts";
import { normalizeSynthesisProviderOutput } from "@/lib/studio/military-expert-v2/synthesis-provider-output.ts";
import {
  buildSynthesisRepairPrompt,
  processSynthesisRepairResponse,
} from "@/lib/studio/military-expert-v2/synthesis-repair.ts";
import {
  getOrCreateSynthesisRow,
  loadSynthesisForSnapshot,
  markSynthesisRunning,
  persistCompletedSynthesis,
  persistFailedSynthesis,
  persistSynthesisRepairAttempt,
} from "@/lib/studio/military-expert-v2/synthesis-persistence.ts";
import { validateAndPersistCoverage } from "@/lib/studio/military-expert-v2/scene-review-coverage.ts";
import { loadSceneReviewsForSnapshot } from "@/lib/studio/military-expert-v2/scene-review-persistence.ts";
import {
  buildMilitaryExpertV2SynthesisReport,
  mapSynthesisToMilitaryExpertReview,
} from "@/lib/studio/military-expert-v2/synthesis-report.ts";
import {
  evaluateSynthesisAuthorQuality,
  findStrongestAndWeakestSynthesisFindings,
} from "@/lib/studio/military-expert-v2/synthesis-quality.ts";
import { hashMilitaryExpertV2SynthesisDocument } from "@/lib/studio/military-expert-v2/synthesis-contract.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import { fileMilitaryExpertWorkflowCompletion } from "@/lib/studio/military-expert-completion-handoff.ts";
import { MILITARY_EXPERT_V2_SYNTHESIS_DEFINITION_VERSION } from "./types.ts";
import { persistMilitaryExpertV2SynthesisDraftReview } from "@/lib/studio/persist-military-expert-draft-review.ts";

function buildSynthesisGenerationRequest(args: {
  synthesisId: string;
  input: ReturnType<typeof assembleMilitaryExpertV2SynthesisInput>;
  manuscriptHash: string;
  correlationId: string;
  reviewPrompt?: string;
}): MilitaryExpertGenerationRequest {
  const prompts = buildMilitaryExpertV2SynthesisGenerationRequest({
    synthesisId: args.synthesisId,
    input: args.input,
    manuscriptHash: args.manuscriptHash,
    correlationId: args.correlationId,
  });

  return Object.freeze({
    expertKey: MILITARY_EXPERT_KEY,
    expertVersion: MILITARY_EXPERT_VERSION,
    definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    correlationId: args.correlationId,
    manuscriptVersionId: args.input.manuscript_version_id,
    reviewScope: "scene",
    canonicalWordCount: 0,
    manuscriptHash: args.manuscriptHash,
    systemPrompt: prompts.systemPrompt,
    reviewPrompt: args.reviewPrompt ?? prompts.userPrompt,
    responseFormat: "json_object",
    temperature: 0,
    maxOutputTokens: prompts.maxOutputTokens,
    safetyMetadata: Object.freeze({
      editorialOnly: true,
      noOperationalInstruction: true,
      noServiceHistoryClaims: true,
      noFabricatedSources: true,
    }),
    provenance: Object.freeze({
      promptVersion: MILITARY_EXPERT_V2_SYNTHESIS_PROMPT_VERSION,
      outputSchemaVersion: "military_expert_v2_synthesis@v1",
      builderVersion: "military_expert_v2_synthesis@v1",
      generationProfileId: "military_expert_v2_synthesis",
    }),
  });
}

export async function executeMilitaryExpertV2SynthesisWorkflow(workflowId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  needsCalibration?: boolean;
  synthesisId?: string;
  reviewId?: string;
}> {
  if (!isMilitaryExpertV2AvailableInStudio()) {
    throw new Error("Military Expert V2 synthesis is not enabled.");
  }

  const workflow = await getWorkflowById(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  if (workflow.workflow_type !== "military_expert_v2_synthesis") {
    throw new Error("Unexpected workflow type for Military Expert V2 synthesis.");
  }

  if (workflow.status === "completed") {
    const existing = workflow.input_snapshot.phase2b?.selectionSnapshotId
      ? await loadSynthesisForSnapshot(workflow.input_snapshot.phase2b.selectionSnapshotId)
      : null;
    return {
      ok: true,
      skipped: true,
      synthesisId: existing?.synthesisId,
      reviewId: workflow.authoritative_result_id ?? undefined,
    };
  }
  if (isTerminalStatus(workflow.status) && workflow.status !== "failed") {
    return { ok: false, skipped: true };
  }

  const phase2b = workflow.input_snapshot.phase2b;
  if (!phase2b?.selectionSnapshotId || !phase2b.phase2aWorkflowId) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Missing Phase 2B handoff snapshot."),
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

  const handoff = await validatePhase2BHandoff({
    selectionSnapshotId: phase2b.selectionSnapshotId,
    phase2aWorkflowId: phase2b.phase2aWorkflowId,
    requirePinnedSnapshot: false,
    allowExistingSynthesis: true,
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

  const existingSynthesis = await loadSynthesisForSnapshot(phase2b.selectionSnapshotId);
  if (existingSynthesis?.document && workflow.authoritative_result_id) {
    return {
      ok: true,
      skipped: true,
      synthesisId: existingSynthesis.synthesisId,
      reviewId: workflow.authoritative_result_id,
    };
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

  const reviews = await loadSceneReviewsForSnapshot(phase2b.selectionSnapshotId);
  const coverage = await validateAndPersistCoverage({
    selectionSnapshotId: phase2b.selectionSnapshotId,
    workflowId: phase2b.phase2aWorkflowId,
    selectedSceneIds: handoff.selectedSceneIds,
  });

  const synthesisInput = assembleMilitaryExpertV2SynthesisInput({
    inventory: handoff.inventory,
    selectedSceneIds: handoff.selectedSceneIds,
    reviews,
    coverage,
  });

  const budgetEstimate = estimatePhase2BSynthesisBudget(synthesisInput);
  const budgetLimits = buildPhase2BSynthesisBudgetLimits(synthesisInput);
  const budget = createBudgetController(budgetLimits);
  const providerSpec = resolveProviderSpec(budgetEstimate.provider, budgetEstimate.modelAlias);

  const synthesisRow = await getOrCreateSynthesisRow({
    selectionSnapshotId: phase2b.selectionSnapshotId,
    inventoryId: handoff.inventory.inventory_id,
    manuscriptId: handoff.inventory.manuscript_id,
    manuscriptVersionId: handoff.inventory.manuscript_version_id,
    workflowId,
    phase2aWorkflowId: phase2b.phase2aWorkflowId,
  });

  if (synthesisRow.document && synthesisRow.status === "complete") {
    return { ok: true, skipped: true, synthesisId: synthesisRow.synthesisId };
  }

  await markSynthesisRunning(synthesisRow.synthesisId);

  const sceneReviewIdBySceneId = new Map(reviews.map((r) => [r.sceneId, r.sceneReviewId]));
  const insufficientEvidenceSceneIds = reviews
    .filter((r) => r.reviewStatus === "insufficient_evidence")
    .map((r) => r.sceneId);

  const validationCtx = {
    expectedSnapshotId: phase2b.selectionSnapshotId,
    expectedInventoryId: handoff.inventory.inventory_id,
    expectedManuscriptId: handoff.inventory.manuscript_id,
    selectedSceneIds: handoff.selectedSceneIds,
    sceneReviewIdBySceneId,
    insufficientEvidenceSceneIds,
  };

  await insertWorkflowEvent({
    workflowId,
    eventType: "v2_synthesis_started",
    phase: "preparing",
    payload: {
      selection_snapshot_id: phase2b.selectionSnapshotId,
      phase2a_workflow_id: phase2b.phase2aWorkflowId,
      provider: budgetEstimate.provider,
      model: budgetEstimate.model,
      estimated_cost_usd: budgetEstimate.totalReservationUsd,
    },
  });

  const invoker = createAnthropicProviderInvoker(apiKey);
  const runStartedAt = Date.now();
  let providerCallCount = 0;
  let repairCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  const correlationId = randomUUID();
  const request = buildSynthesisGenerationRequest({
    synthesisId: synthesisRow.synthesisId,
    input: synthesisInput,
    manuscriptHash: ctx.contentHash,
    correlationId,
  });

  const estimatedCost = estimateTokenCost(
    budgetEstimate.estimatedInputTokens,
    PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS,
    providerSpec.pricingProfileId,
  );

  if (!budget.canAffordCall(estimatedCost, budgetEstimate.estimatedInputTokens, PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS)) {
    await persistFailedSynthesis({
      synthesisId: synthesisRow.synthesisId,
      errorCode: "BUDGET_EXCEEDED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Synthesis budget exhausted."),
    });
    await markWorkflowFailed({
      workflowId,
      errorCode: "BUDGET_EXCEEDED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Synthesis budget exhausted."),
    });
    return { ok: false };
  }

  await setWorkflowPhase(workflowId, "memo_generation");
  await touchWorkflowHeartbeat(workflowId).catch(() => {});

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), PHASE2B_SYNTHESIS_TIMEOUT_MS);
  let invokeResult;
  try {
    invokeResult = await invoker({
      request,
      correlationId,
      caseId: workflowId,
      modelId: providerSpec.modelId,
      timeoutMs: PHASE2B_SYNTHESIS_TIMEOUT_MS,
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  providerCallCount++;
  let providerMetadata = null;

  if (!invokeResult.ok || !invokeResult.rawResponse) {
    await persistFailedSynthesis({
      synthesisId: synthesisRow.synthesisId,
      errorCode: "PROVIDER_FAILED",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        invokeResult.providerError?.message ?? "Provider call failed.",
      ),
    });
    await markWorkflowFailed({
      workflowId,
      errorCode: "PROVIDER_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Synthesis provider call failed."),
    });
    return { ok: false };
  }

  totalInputTokens += invokeResult.rawResponse.inputTokens ?? 0;
  totalOutputTokens += invokeResult.rawResponse.outputTokens ?? 0;
  totalCost += estimateTokenCost(
    invokeResult.rawResponse.inputTokens ?? 0,
    invokeResult.rawResponse.outputTokens ?? 0,
    providerSpec.pricingProfileId,
  );
  budget.recordCall(totalCost, totalInputTokens, totalOutputTokens);

  providerMetadata = Object.freeze({
    model: providerSpec.modelId,
    provider: budgetEstimate.provider,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cost_usd: totalCost,
    correlation_id: correlationId,
    captured_at: new Date().toISOString(),
  });

  const mergeCtx = {
    ...validationCtx,
    synthesisId: synthesisRow.synthesisId,
    input: synthesisInput,
    createdAt: synthesisRow.createdAt,
    providerMetadata,
  };

  const parsed = parseSynthesisProviderResponse(invokeResult.rawResponse.responseText);
  let validation: SynthesisValidationResult;
  if (!parsed.ok) {
    validation = {
      ok: false,
      document: null,
      structuralErrors: Object.freeze(["Document failed contract parsing."]),
      qualityErrors: Object.freeze([]),
      extractionError: parsed.error ?? "JSON extraction or parse failed.",
    };
  } else {
    const normalizedJson = normalizeSynthesisProviderOutput(
      parsed.json,
      validationCtx.sceneReviewIdBySceneId,
    );
    validation = validateSynthesisDocument(
      mergeProviderOutputIntoSynthesisDocument(normalizedJson, mergeCtx),
      validationCtx,
      { skipQualityScoring: true },
    );
  }

  let lastRawJson = invokeResult.rawResponse.responseText;
  let normalizedJson = parsed.ok
    ? normalizeSynthesisProviderOutput(parsed.json, validationCtx.sceneReviewIdBySceneId)
    : null;

  while (!validation.ok && repairCount < PHASE2B_MAX_REPAIR_ATTEMPTS) {
    await setWorkflowPhase(workflowId, "memo_repair");
    const repairReasons = classifySynthesisRepairNeed(validation);
    if (repairReasons.length === 0) break;

    const repairEstimated = estimatedCost * 0.5;
    if (!budget.canAffordCall(repairEstimated, 0, PHASE2B_SYNTHESIS_MAX_OUTPUT_TOKENS)) break;

    const repairPrompt = buildSynthesisRepairPrompt({
      originalJson: lastRawJson,
      repairReasons,
      synthesisId: synthesisRow.synthesisId,
    });
    const repairRequest = buildSynthesisGenerationRequest({
      synthesisId: synthesisRow.synthesisId,
      input: synthesisInput,
      manuscriptHash: ctx.contentHash,
      correlationId: randomUUID(),
      reviewPrompt: repairPrompt,
    });

    const repairAbort = new AbortController();
    const repairTimeout = setTimeout(() => repairAbort.abort(), PHASE2B_SYNTHESIS_TIMEOUT_MS);
    let repairResult;
    try {
      repairResult = await invoker({
        request: repairRequest,
        correlationId: repairRequest.correlationId,
        caseId: `${workflowId}:repair`,
        modelId: providerSpec.modelId,
        timeoutMs: PHASE2B_SYNTHESIS_TIMEOUT_MS,
        signal: repairAbort.signal,
      });
    } finally {
      clearTimeout(repairTimeout);
    }

    providerCallCount++;
    repairCount++;

    if (repairResult.ok && repairResult.rawResponse) {
      const rIn = repairResult.rawResponse.inputTokens ?? 0;
      const rOut = repairResult.rawResponse.outputTokens ?? 0;
      const rCost = estimateTokenCost(rIn, rOut, providerSpec.pricingProfileId);
      totalInputTokens += rIn;
      totalOutputTokens += rOut;
      totalCost += rCost;
      budget.recordCall(rCost, rIn, rOut);
      lastRawJson = repairResult.rawResponse.responseText;

      const repairProcessed = processSynthesisRepairResponse(lastRawJson, {
        ...validationCtx,
        synthesisId: synthesisRow.synthesisId,
        input: synthesisInput,
        createdAt: synthesisRow.createdAt,
        repairCostUsd: rCost,
        attemptNumber: repairCount,
        repairReasons,
        sceneReviewIdBySceneId: validationCtx.sceneReviewIdBySceneId,
      });

      if (repairProcessed.attempt) {
        await persistSynthesisRepairAttempt({
          synthesisId: synthesisRow.synthesisId,
          attempt: repairProcessed.attempt,
        });
      }

      if (repairProcessed.document) {
        validation = validateSynthesisDocument(repairProcessed.document, validationCtx);
      }
    }
  }

  if (!validation.ok || !validation.document) {
    validation = validateSynthesisDocument(
      normalizedJson
        ? mergeProviderOutputIntoSynthesisDocument(normalizedJson, mergeCtx)
        : null,
      validationCtx,
    );
  }

  if (!validation.ok || !validation.document) {
    await persistFailedSynthesis({
      synthesisId: synthesisRow.synthesisId,
      errorCode: "VALIDATION_FAILED",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        `Synthesis validation failed: ${[...validation.structuralErrors, ...validation.qualityErrors].join("; ") || "unknown"}`,
      ),
      repairCount,
    });
    await markWorkflowFailed({
      workflowId,
      errorCode: "VALIDATION_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Synthesis validation failed."),
    });
    return { ok: false, needsCalibration: true };
  }

  const completedDoc = Object.freeze({
    ...validation.document,
    synthesis_id: synthesisRow.synthesisId,
    provider_metadata: providerMetadata,
    completed_at: new Date().toISOString(),
    parsed_hash: hashMilitaryExpertV2SynthesisDocument(validation.document),
  });

  await persistCompletedSynthesis({
    document: completedDoc,
    providerMetadata: providerMetadata as unknown as Record<string, unknown>,
    costMetadata: {
      cost_usd: totalCost,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      provider_call_count: providerCallCount,
      repair_count: repairCount,
    },
  });

  const report = buildMilitaryExpertV2SynthesisReport({
    synthesis: completedDoc,
    inventory: handoff.inventory,
    selectedSceneIds: handoff.selectedSceneIds,
    reviews,
    input: synthesisInput,
  });

  const militaryReview = mapSynthesisToMilitaryExpertReview({
    synthesis: completedDoc,
    report,
  });

  const parsedReviewHash = hashCanonicalOutput({
    synthesis_id: completedDoc.synthesis_id,
    parsed_hash: completedDoc.parsed_hash,
    finding_count: militaryReview.findings.length,
  });

  const quality = evaluateSynthesisAuthorQuality(report);
  const { strongest, weakest } = findStrongestAndWeakestSynthesisFindings(report);
  const runtimeMs = Date.now() - runStartedAt;
  const meta = await getManuscriptMeta(workflow.manuscript_id);

  const savedReport = prepareSavedMilitaryExpertReport({
    review: militaryReview,
    parsedReviewHash,
  });

  const filed = await persistMilitaryExpertV2SynthesisDraftReview({
    workflowId,
    manuscriptId: workflow.manuscript_id,
    manuscriptVersionId: workflow.manuscript_version_id,
    review: militaryReview,
    parsedReviewHash,
    correlationId,
    synthesisDocument: completedDoc,
    v2Report: report,
    estimatedCostUsd: totalCost,
  });

  if (!filed.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "COMPLETION_FILING_FAILED",
      safeErrorMessage: safeErrorForCode("COMPLETION_FILING_FAILED"),
    });
    return { ok: false };
  }

  const completion = await fileMilitaryExpertWorkflowCompletion({
    workflowId,
    manuscriptId: workflow.manuscript_id,
    manuscriptVersionId: workflow.manuscript_version_id,
    review: militaryReview,
    parsedReviewHash,
    requestHash: null,
    correlationId,
    expertVersion: MILITARY_EXPERT_VERSION,
    definitionHash: MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
    generationStatus:
      militaryReview.review_status === "completed_with_author_review_required"
        ? "provisional_success"
        : "success",
    repairDecision: repairCount > 0 ? "provider_repair_required" : "no_repair_needed",
    provisionalReleaseUsed:
      militaryReview.review_status === "completed_with_author_review_required",
    savedReport,
    manuscriptTitle: meta?.title ?? "Manuscript",
    modelId: providerSpec.modelId,
    estimatedCostUsd: totalCost,
  });

  if (!completion.ok) {
    return { ok: false };
  }

  const resultSummary = {
    selection_snapshot_id: phase2b.selectionSnapshotId,
    phase2a_workflow_id: phase2b.phase2aWorkflowId,
    inventory_id: handoff.inventory.inventory_id,
    synthesis_id: synthesisRow.synthesisId,
    review_id: completion.reviewId,
    provider_call_count: providerCallCount,
    repair_count: repairCount,
    model: budgetEstimate.model,
    provider: budgetEstimate.provider,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: Math.round(totalCost * 10000) / 10000,
    runtime_ms: runtimeMs,
    synthesized_finding_count: militaryReview.findings.length,
    main_priority_count: report.topPriorityFindings.length,
    confirmed_count: report.confirmedFindings.length,
    author_review_required_count: report.authorReviewRequiredFindings.length,
    scene_appendix_count: report.sceneAppendix.length,
    quality_acceptance: quality.overallPass,
    strongest_finding: strongest,
    weakest_finding: weakest,
    workflow_definition_version: MILITARY_EXPERT_V2_SYNTHESIS_DEFINITION_VERSION,
  };

  await updateWorkflowRow(workflowId, { result_summary: resultSummary });

  await insertWorkflowEvent({
    workflowId,
    eventType: "completed",
    phase: "completed",
    payload: resultSummary,
  });

  return {
    ok: true,
    synthesisId: synthesisRow.synthesisId,
    reviewId: completion.reviewId,
    needsCalibration: !quality.overallPass,
  };
}
