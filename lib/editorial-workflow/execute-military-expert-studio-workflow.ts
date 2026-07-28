import "server-only";

import { randomUUID } from "node:crypto";
import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import { readAnthropicApiKey } from "@/lib/expert-calibration/live/api-key.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { resolveProviderSpec, ANTHROPIC_HAIKU_45_ALIAS } from "@/lib/expert-calibration/live/provider-allowlist.ts";
import { createAnthropicProviderInvoker } from "@/lib/expert-calibration/live/providers/anthropic/invoke.ts";
import {
  buildMilitaryExpertGenerationRequest,
  runMilitaryExpertGenerationContract,
} from "@/experts/military-expert/generation-contract.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import {
  getWorkflowById,
  isTerminalStatus,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowRunning,
  markWorkflowStarted,
  insertWorkflowEvent,
  setWorkflowPhase,
  touchWorkflowHeartbeat,
  verifyWorkflowVersionPin,
} from "./workflow-store.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { MILITARY_EXPERT_STUDIO_DEFINITION_VERSION } from "./types.ts";

const STUDIO_MILITARY_BUDGET = Object.freeze({
  maxCalls: 1,
  maxTotalCostUsd: 0.25,
  maxCostPerCallUsd: 0.25,
  maxInputTokens: 120_000,
  maxOutputTokens: 8_192,
  providerMaxOutputTokens: 8_192,
  timeoutMs: 180_000,
});

export async function executeMilitaryExpertStudioWorkflow(workflowId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
}> {
  if (!isStudioMilitaryExpertLocalOverrideEnabled()) {
    throw new Error("Military Expert local Studio override is not enabled.");
  }

  const workflow = await getWorkflowById(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  if (workflow.workflow_type !== "military_expert_review") {
    throw new Error("Unexpected workflow type for Military Expert execution.");
  }

  if (workflow.status === "completed") {
    return { ok: true, skipped: true };
  }
  if (isTerminalStatus(workflow.status)) {
    return { ok: false, skipped: true };
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
  await setWorkflowPhase(workflowId, "validating");

  const pin = await verifyWorkflowVersionPin(workflow);
  if (!pin.ok) {
    await markWorkflowFailed({
      workflowId,
      errorCode: pin.errorCode,
      safeErrorMessage: safeErrorForCode(pin.errorCode),
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

  const budget = createBudgetController({
    maxCalls: STUDIO_MILITARY_BUDGET.maxCalls,
    maxTotalCostUsd: STUDIO_MILITARY_BUDGET.maxTotalCostUsd,
    maxCostPerCallUsd: STUDIO_MILITARY_BUDGET.maxCostPerCallUsd,
    runMaxInputTokens: STUDIO_MILITARY_BUDGET.maxInputTokens,
    runMaxOutputTokens: STUDIO_MILITARY_BUDGET.maxOutputTokens,
    providerMaxOutputTokensPerCall: STUDIO_MILITARY_BUDGET.providerMaxOutputTokens,
  });

  const providerSpec = resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS);
  const estimatedCost = estimateTokenCost(
    Math.min(ctx.wordCount ?? 0, STUDIO_MILITARY_BUDGET.maxInputTokens),
    STUDIO_MILITARY_BUDGET.providerMaxOutputTokens,
    providerSpec.pricingProfileId,
  );

  if (!budget.canAffordCall(estimatedCost, 0, STUDIO_MILITARY_BUDGET.providerMaxOutputTokens)) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode("PIPELINE_FAILED", "Run budget exceeded before provider call."),
    });
    return { ok: false };
  }

  const correlationId = randomUUID();
  const request = buildMilitaryExpertGenerationRequest({
    correlationId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    reviewScope: "full_manuscript",
    manuscriptText: ctx.extractedText,
    canonicalWordCount: ctx.wordCount ?? 0,
    manuscriptHash: ctx.contentHash,
    maxOutputTokens: STUDIO_MILITARY_BUDGET.providerMaxOutputTokens,
    includeStudioOutputBudget: true,
  });

  await setWorkflowPhase(workflowId, "memo_generation");

  const invoker = createAnthropicProviderInvoker(apiKey);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), STUDIO_MILITARY_BUDGET.timeoutMs);

  let invokeResult;
  try {
    invokeResult = await invoker({
      request,
      correlationId,
      caseId: workflowId,
      modelId: providerSpec.modelId,
      timeoutMs: STUDIO_MILITARY_BUDGET.timeoutMs,
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
    await touchWorkflowHeartbeat(workflowId).catch(() => {});
  }

  if (!invokeResult.ok || !invokeResult.rawResponse) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "PIPELINE_FAILED",
      safeErrorMessage: safeErrorForCode(
        "PIPELINE_FAILED",
        invokeResult.providerError?.message ?? "Provider invocation failed.",
      ),
    });
    return { ok: false };
  }

  const inputTokens = invokeResult.rawResponse.inputTokens ?? 0;
  const outputTokens = invokeResult.rawResponse.outputTokens ?? 0;
  budget.recordCall(
    estimateTokenCost(inputTokens, outputTokens, providerSpec.pricingProfileId),
    inputTokens,
    outputTokens,
  );

  const contractResult = await runMilitaryExpertGenerationContract(
    {
      correlationId,
      manuscriptVersionId: ctx.manuscriptVersionId,
      reviewScope: "full_manuscript",
      manuscriptText: ctx.extractedText,
      canonicalWordCount: ctx.wordCount ?? 0,
      manuscriptHash: ctx.contentHash,
      rawResponse: invokeResult.rawResponse,
    },
    { bypassFeatureFlag: true },
  );

  if (!contractResult.ok || contractResult.generationStatus !== "success") {
    const errorCode =
      contractResult.parseFailureCode === "provider_output_truncated"
        ? "PROVIDER_OUTPUT_TRUNCATED"
        : "PIPELINE_FAILED";
    if (contractResult.parseDiagnostics) {
      await insertWorkflowEvent({
        workflowId,
        eventType: "parse_failed",
        payload: {
          error_code: errorCode,
          parse_failure_code: contractResult.parseFailureCode ?? null,
          diagnostics: contractResult.parseDiagnostics,
        },
      }).catch(() => {});
    }
    await markWorkflowFailed({
      workflowId,
      errorCode,
      safeErrorMessage: safeErrorForCode(
        errorCode,
        contractResult.failureReason ?? "Military Expert validation failed.",
      ),
    });
    return { ok: false };
  }

  const meta = await getManuscriptMeta(workflow.manuscript_id);

  await markWorkflowCompleted({
    workflowId,
    authoritativeResultId: contractResult.parsedReviewHash ?? correlationId,
    authoritativeResultType: "military_expert_draft_review",
    resultSummary: {
      expertKey: "military_expert",
      expertVersion: contractResult.expertVersion,
      definitionHash: contractResult.definitionHash,
      correlationId: contractResult.correlationId,
      parsedReviewHash: contractResult.parsedReviewHash,
      requestHash: contractResult.requestHash,
      generationStatus: contractResult.generationStatus,
      repairDecision: contractResult.repairDecision,
      manuscriptTitle: meta?.title ?? "Manuscript",
      workflowDefinitionVersion: MILITARY_EXPERT_STUDIO_DEFINITION_VERSION,
      modelId: providerSpec.modelId,
      estimatedCostUsd: budget.snapshot().totalCostUsd,
    },
    nextBestAction: "Military Expert local test run completed. Review workflow summary in Studio.",
  });

  return { ok: true };
}
