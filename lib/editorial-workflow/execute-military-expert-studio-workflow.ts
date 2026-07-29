import "server-only";

import { randomUUID } from "node:crypto";
import { getManuscriptReviewContext, getManuscriptMeta } from "@/lib/reviews";
import { readAnthropicApiKey } from "@/lib/expert-calibration/live/api-key.ts";
import { createBudgetController } from "@/lib/expert-calibration/live/budget-controller.ts";
import { estimateTokenCost } from "@/lib/expert-calibration/cost-analysis.ts";
import { resolveProviderSpec, ANTHROPIC_HAIKU_45_ALIAS } from "@/lib/expert-calibration/live/provider-allowlist.ts";
import { createAnthropicProviderInvoker } from "@/lib/expert-calibration/live/providers/anthropic/invoke.ts";
import { MILITARY_EXPERT } from "@/experts/military-expert/definition.ts";
import {
  buildMilitaryExpertGenerationRequest,
  runMilitaryExpertGenerationContract,
} from "@/experts/military-expert/generation-contract.ts";
import { MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING } from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import {
  buildContraryEvidenceRepairProviderDiagnostics,
  normalizeRepairResponseForContract,
} from "@/experts/military-expert/contrary-evidence-schema-repair.ts";
import { planMilitaryExpertContraryEvidenceRepair } from "./plan-military-expert-contrary-evidence-repair.ts";
import {
  STUDIO_MILITARY_BUDGET,
  STUDIO_MILITARY_BUDGET_LIMITS,
} from "./studio-military-expert-budget.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums } from "@/experts/military-expert/enum-normalization.ts";
import { classifyMilitaryExpertRepairNeed } from "@/experts/military-expert/repair-classification.ts";
import { isStudioMilitaryExpertLocalOverrideEnabled } from "@/lib/studio/military-expert-local-policy.ts";
import {
  getWorkflowById,
  isTerminalStatus,
  markWorkflowFailed,
  markWorkflowRunning,
  markWorkflowStarted,
  insertWorkflowEvent,
  setWorkflowPhase,
  touchWorkflowHeartbeat,
  verifyWorkflowVersionPin,
} from "./workflow-store.ts";
import { safeErrorForCode } from "./safe-errors.ts";
import { mapMilitaryExpertParseFailureToWorkflowErrorCode } from "@/experts/military-expert/parse-workflow-errors.ts";
import type { ModelJsonTrailingCategory } from "@/experts/military-expert/model-json-extraction.ts";
import { prepareSavedMilitaryExpertReport } from "@/lib/studio/military-expert-report-persistence.ts";
import { fileMilitaryExpertWorkflowCompletion } from "@/lib/studio/military-expert-completion-handoff.ts";

export { STUDIO_MILITARY_BUDGET } from "./studio-military-expert-budget.ts";

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

  const contractInput = {
    correlationId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    reviewScope: "full_manuscript" as const,
    manuscriptText: ctx.extractedText,
    canonicalWordCount: ctx.wordCount ?? 0,
    manuscriptHash: ctx.contentHash,
    maxOutputTokens: STUDIO_MILITARY_BUDGET.providerMaxOutputTokens,
  };

  let contractResult = await runMilitaryExpertGenerationContract(
    {
      ...contractInput,
      rawResponse: invokeResult.rawResponse,
    },
    { bypassFeatureFlag: true },
  );

  const initialRepairClassification = classifyMilitaryExpertRepairNeed({
    raw: invokeResult.rawResponse,
    expectedCorrelationId: correlationId,
  });

  if (
    !contractResult.ok &&
    contractResult.repairDecision === "schema_repair_required"
  ) {
    let parsedRoot: unknown;
    try {
      const extraction = extractStrictModelJsonObject(invokeResult.rawResponse.responseText);
      parsedRoot = normalizeMilitaryExpertGenerationEnums(JSON.parse(extraction.jsonText) as unknown)
        .normalized;
    } catch {
      parsedRoot = undefined;
    }

    const repairPlan = planMilitaryExpertContraryEvidenceRepair({
      parsedRoot,
      budgetState: budget.state(),
      budgetLimits: STUDIO_MILITARY_BUDGET_LIMITS,
      pricingProfileId: providerSpec.pricingProfileId,
      repairAlreadyAttempted: contractResult.contraryEvidenceRepair?.attempted === true,
      schemaRepairRequired: true,
    });

    if (repairPlan.action === "start_repair") {
      const { violations, repairPrompt } = repairPlan;
      const repairRequest = {
        ...request,
        systemPrompt: repairPrompt.systemPrompt,
        reviewPrompt: repairPrompt.userPrompt,
        maxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
      };

      await insertWorkflowEvent({
        workflowId,
        eventType: "contrary_evidence_repair_started",
        payload: {
          finding_indexes: violations.map((item) => item.findingIndex),
          missing_field_names: [...new Set(violations.flatMap((item) => [...item.missingFields]))],
          repair_attempted: true,
        },
      }).catch(() => {});

      const repairAbort = new AbortController();
      const repairTimeout = setTimeout(
        () => repairAbort.abort(),
        STUDIO_MILITARY_BUDGET.timeoutMs,
      );
      let repairInvoke;
      try {
        repairInvoke = await invoker({
          request: repairRequest,
          correlationId: `${correlationId}-repair`,
          caseId: workflowId,
          modelId: providerSpec.modelId,
          timeoutMs: STUDIO_MILITARY_BUDGET.timeoutMs,
          signal: repairAbort.signal,
        });
      } finally {
        clearTimeout(repairTimeout);
        await touchWorkflowHeartbeat(workflowId).catch(() => {});
      }

      if (repairInvoke.ok && repairInvoke.rawResponse) {
        const repairCallCorrelationId = `${correlationId}-repair`;
        const repairInputTokens = repairInvoke.rawResponse.inputTokens ?? 0;
        const repairOutputTokens = repairInvoke.rawResponse.outputTokens ?? 0;
        const repairEstimatedCostUsd = estimateTokenCost(
          repairInputTokens,
          repairOutputTokens,
          providerSpec.pricingProfileId,
        );
        budget.recordCall(repairEstimatedCostUsd, repairInputTokens, repairOutputTokens);

        const repairProviderDiagnostics = buildContraryEvidenceRepairProviderDiagnostics({
          workflowCorrelationId: correlationId,
          repairCallCorrelationId,
          repairRaw: repairInvoke.rawResponse,
          repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
          repairEstimatedCostUsd,
          providerCallCompleted: true,
        });

        const normalizedRepairResponse = normalizeRepairResponseForContract(
          repairInvoke.rawResponse,
          correlationId,
        );

        contractResult = await runMilitaryExpertGenerationContract(
          {
            ...contractInput,
            rawResponse: invokeResult.rawResponse,
            repairResponse: normalizedRepairResponse,
            repairCallCorrelationId,
            repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
            repairProviderDiagnostics,
          },
          { bypassFeatureFlag: true },
        );

        await insertWorkflowEvent({
          workflowId,
          eventType: "contrary_evidence_repair_completed",
          payload: contractResult.contraryEvidenceRepair?.eventPayload ?? {
            repair_attempted: true,
            repair_succeeded: contractResult.ok,
            ...repairProviderDiagnostics,
          },
        }).catch(() => {});
      } else {
        const repairCallCorrelationId = `${correlationId}-repair`;
        const repairProviderDiagnostics = buildContraryEvidenceRepairProviderDiagnostics({
          workflowCorrelationId: correlationId,
          repairCallCorrelationId,
          repairMaxOutputTokens: MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING.maxOutputTokens,
          providerCallCompleted: false,
        });

        contractResult = {
          ...contractResult,
          parseFailureCode: "CONTRARY_EVIDENCE_REPAIR_FAILED",
          contraryEvidenceRepair: {
            attempted: true,
            succeeded: false,
            deterministicNormalizationApplied: false,
            failureCode: "CONTRARY_EVIDENCE_REPAIR_FAILED",
            eventPayload: {
              repair_attempted: true,
              repair_succeeded: false,
              deterministic_normalization_applied: false,
              primary_failure_code: "CONTRARY_EVIDENCE_REPAIR_FAILED",
              repair_failure_code: "CONTRARY_EVIDENCE_REPAIR_FAILED",
              ...repairProviderDiagnostics,
            },
          },
        };

        await insertWorkflowEvent({
          workflowId,
          eventType: "contrary_evidence_repair_completed",
          payload: contractResult.contraryEvidenceRepair.eventPayload,
        }).catch(() => {});
      }
    } else if (repairPlan.action === "skip_repair") {
      await insertWorkflowEvent({
        workflowId,
        eventType: "contrary_evidence_repair_skipped",
        payload: repairPlan.skipEvent,
      }).catch(() => {});
    }
  }

  if (!contractResult.ok || (contractResult.generationStatus !== "success" && contractResult.generationStatus !== "provisional_success")) {
    const parseFailureCode = contractResult.parseFailureCode as
      | import("@/experts/military-expert/parsing.ts").MilitaryExpertParseFailureCode
      | "CONTRARY_EVIDENCE_REPAIR_FAILED"
      | "TOO_MANY_UNRESOLVED_FINDINGS"
      | "TOO_MANY_UNRESOLVED_CONTRARY_EVIDENCE_FINDINGS"
      | undefined;
    const trailingCategory = contractResult.parseTrailingCategory as
      | ModelJsonTrailingCategory
      | undefined;
    const trailingCommentaryUnsafe = contractResult.trailingCommentaryUnsafe === true;
    const trailingMarkdownSummaryUnsafe = contractResult.trailingMarkdownSummaryUnsafe === true;
    const errorCode =
      parseFailureCode === "CONTRARY_EVIDENCE_REPAIR_FAILED"
        ? "CONTRARY_EVIDENCE_REPAIR_FAILED"
        : parseFailureCode === "TOO_MANY_UNRESOLVED_FINDINGS" ||
            parseFailureCode === "TOO_MANY_UNRESOLVED_CONTRARY_EVIDENCE_FINDINGS"
          ? "TOO_MANY_UNRESOLVED_CONTRARY_EVIDENCE_FINDINGS"
          : parseFailureCode
          ? mapMilitaryExpertParseFailureToWorkflowErrorCode({
              parseFailureCode,
              trailingCategory,
              trailingCommentaryUnsafe,
              trailingMarkdownSummaryUnsafe,
              contraryEvidenceFailureCode: initialRepairClassification.contraryEvidenceFailureCode,
            })
          : "PIPELINE_FAILED";
    if (contractResult.parseDiagnostics || parseFailureCode || contractResult.contraryEvidenceRepair) {
      await insertWorkflowEvent({
        workflowId,
        eventType: "parse_failed",
        payload: {
          error_code: errorCode,
          parse_failure_code: contractResult.parseFailureCode ?? null,
          trailing_category: trailingCategory ?? null,
          diagnostics: contractResult.parseDiagnostics ?? null,
          contrary_evidence_repair: contractResult.contraryEvidenceRepair?.eventPayload ?? null,
          trailing_commentary_normalization:
            contractResult.trailingCommentaryNormalization ?? null,
          trailing_markdown_summary_normalization:
            contractResult.trailingMarkdownSummaryNormalization ?? null,
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

  if (contractResult.trailingCommentaryNormalization?.normalization_succeeded) {
    await insertWorkflowEvent({
      workflowId,
      eventType: "military_expert_trailing_commentary_removed",
      payload: contractResult.trailingCommentaryNormalization,
    }).catch(() => {});
  }

  if (contractResult.trailingMarkdownSummaryNormalization?.normalization_succeeded) {
    await insertWorkflowEvent({
      workflowId,
      eventType: "military_expert_trailing_markdown_summary_removed",
      payload: contractResult.trailingMarkdownSummaryNormalization,
    }).catch(() => {});
  }

  if (contractResult.provisionalRelease?.used && contractResult.provisionalRelease.eventPayload) {
    await insertWorkflowEvent({
      workflowId,
      eventType: "military_expert_provisional_release",
      payload: contractResult.provisionalRelease.eventPayload,
    }).catch(() => {});
  }

  if (!contractResult.review || !contractResult.parsedReviewHash) {
    await markWorkflowFailed({
      workflowId,
      errorCode: "COMPLETION_FILING_FAILED",
      safeErrorMessage: safeErrorForCode(
        "COMPLETION_FILING_FAILED",
        "Military Expert completion filing failed before results could be published.",
      ),
    });
    return { ok: false };
  }

  const savedReport = prepareSavedMilitaryExpertReport({
    review: contractResult.review,
    parsedReviewHash: contractResult.parsedReviewHash,
  });

  const filed = await fileMilitaryExpertWorkflowCompletion({
    workflowId,
    manuscriptId: workflow.manuscript_id,
    manuscriptVersionId: workflow.manuscript_version_id,
    review: contractResult.review,
    parsedReviewHash: contractResult.parsedReviewHash,
    requestHash: contractResult.requestHash,
    correlationId: contractResult.correlationId,
    expertVersion: contractResult.expertVersion,
    definitionHash: contractResult.definitionHash,
    generationStatus: contractResult.generationStatus,
    repairDecision: contractResult.repairDecision,
    provisionalReleaseUsed: contractResult.provisionalRelease?.used === true,
    savedReport,
    manuscriptTitle: meta?.title ?? "Manuscript",
    modelId: providerSpec.modelId,
    estimatedCostUsd: budget.snapshot().totalCostUsd,
  });

  return filed.ok ? { ok: true } : { ok: false };
}
