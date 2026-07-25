import type { CalibrationReplayOutput } from "../contracts.ts";
import { runExpertCalibration } from "../runner.ts";
import {
  buildMilitaryExpertGenerationRequest,
  hashMilitaryExpertParsedReview,
  hashMilitaryExpertRawResponse,
  runMilitaryExpertGenerationContract,
} from "@/experts/military-expert/generation-contract.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";
import { militaryExpertCalibrationAdapter } from "@/experts/military-expert/calibration/adapter.ts";
import { MILITARY_EXPERT_CALIBRATION_THRESHOLDS } from "@/experts/military-expert/calibration/thresholds.ts";
import type {
  LiveCalibrationCallPlan,
  LiveCalibrationCliArgs,
  LiveCalibrationProviderInvoker,
  LiveCalibrationRunManifest,
} from "./contracts.ts";
import { appendAuditEvent, createAuditEvent } from "./audit-log.ts";
import { createBudgetController } from "./budget-controller.ts";
import { LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION } from "./constants.ts";
import { LIVE_CALIBRATION_EXIT } from "./errors.ts";
import { formatCliArgsForManifest } from "./cli-parser.ts";
import { writeRunManifest, writeAtomicArtifact } from "./result-store.ts";
import { getLiveCalibrationSubset } from "./subsets.ts";
import { estimateTokenCost } from "../cost-analysis.ts";
import {
  commitSessionSpend,
  reserveSessionBudget,
  type SessionBudgetReservation,
} from "./session-budget.ts";
import { createAbortController, isAbortError } from "./abort-controller.ts";

export interface LiveExecutorInput {
  readonly args: LiveCalibrationCliArgs;
  readonly callPlan: LiveCalibrationCallPlan;
  readonly runId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  readonly providerInvoker: LiveCalibrationProviderInvoker;
  readonly writeArtifacts?: boolean;
  readonly bypassFeatureFlags?: boolean;
  readonly retainRawResponses?: boolean;
  readonly now?: () => number;
}

export interface LiveExecutorResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly manifest: LiveCalibrationRunManifest;
  readonly filesWritten: number;
  readonly failureReason: string | null;
  readonly failureCode: "scoring_failure" | "provider_error" | "timeout_abort" | "budget_exhausted" | "cost_limit_exceeded" | null;
  readonly modelCalls: number;
  readonly providerCalls: number;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
  readonly sessionId: string;
}

function filterSuiteToSubset(args: LiveCalibrationCliArgs) {
  const subset = getLiveCalibrationSubset(args.subset);
  const caseIds = new Set(subset.caseIds);
  return Object.freeze({
    ...MILITARY_EXPERT_CALIBRATION_SUITE,
    cases: MILITARY_EXPERT_CALIBRATION_SUITE.cases.filter((c) => caseIds.has(c.case_id)),
  });
}

export async function executeLive(input: LiveExecutorInput): Promise<LiveExecutorResult> {
  const now = input.now ?? (() => Date.now());
  const sessionId = input.args.sessionId!;
  const budget = createBudgetController({
    maxCalls: input.args.maxCalls,
    maxTotalCostUsd: input.args.maxTotalCostUsd,
    maxCostPerCallUsd: input.args.maxCostPerCallUsd,
    maxInputTokens: input.args.maxInputTokens,
    maxOutputTokens: input.args.maxOutputTokens,
  });

  let sessionReservation: SessionBudgetReservation | null = null;
  try {
    sessionReservation = reserveSessionBudget(
      sessionId,
      input.args.sessionMaxCostUsd,
      input.callPlan.totalEstimatedCostUsd,
    );
    appendAuditEvent(
      createAuditEvent({
        session_id: sessionId,
        run_id: input.runId,
        event_type: "session_budget_reserved",
        detail: {
          estimated_cost_usd: input.callPlan.totalEstimatedCostUsd,
          version: sessionReservation.expectedVersion,
        },
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session budget reservation failed";
    return {
      ok: false,
      exitCode: LIVE_CALIBRATION_EXIT.costLimitExceeded,
      manifest: buildManifest(input, now, false),
      filesWritten: 0,
      failureReason: message,
      failureCode: "cost_limit_exceeded",
      modelCalls: 0,
      providerCalls: 0,
      productionWrites: 0,
      productionExecutionOccurred: false,
      sessionId,
    };
  }

  appendAuditEvent(
    createAuditEvent({
      session_id: sessionId,
      run_id: input.runId,
      event_type: "live_run_started",
      detail: { planned_calls: input.callPlan.calls.length },
    }),
  );

  const caseById = new Map(
    MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => [c.case_id, c]),
  );

  const replayOutputs: CalibrationReplayOutput[] = [];
  let failureReason: string | null = null;
  let failureCode: LiveExecutorResult["failureCode"] = null;
  let ok = true;
  let modelCalls = 0;
  let providerCalls = 0;
  let totalActualCostUsd = 0;
  const abortController = createAbortController(input.args.timeoutMs);

  for (const planned of input.callPlan.calls) {
    if (abortController.signal.aborted) {
      ok = false;
      failureReason = "timeout_abort";
      failureCode = "timeout_abort";
      break;
    }

    if (!budget.canAffordCall(
      planned.estimatedCostUsd,
      planned.estimatedInputTokens,
      planned.estimatedOutputTokens,
    )) {
      ok = false;
      failureReason = "budget_exhausted";
      failureCode = "budget_exhausted";
      break;
    }

    const calibrationCase = caseById.get(planned.caseId)!;
    const request = buildMilitaryExpertGenerationRequest({
      correlationId: planned.correlationId,
      manuscriptVersionId: `cal-${planned.caseId}`,
      reviewScope: calibrationCase.manuscript.scope === "scene" ? "scene" : "sample",
      manuscriptText: calibrationCase.manuscript.text,
      canonicalWordCount: calibrationCase.manuscript.word_count,
      manuscriptHash: calibrationCase.manuscript.content_hash,
      genreContext: calibrationCase.manuscript.genre_context ?? null,
      countryPeriod: calibrationCase.manuscript.country_period ?? null,
    });

    appendAuditEvent(
      createAuditEvent({
        session_id: sessionId,
        run_id: input.runId,
        event_type: "provider_call_started",
        detail: { case_id: planned.caseId, correlation_id: planned.correlationId },
      }),
    );

    let invokeResult;
    try {
      invokeResult = await input.providerInvoker({
        request,
        correlationId: planned.correlationId,
        caseId: planned.caseId,
        modelId: input.callPlan.providerSpec.modelId,
        timeoutMs: input.args.timeoutMs,
        signal: abortController.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        ok = false;
        failureReason = "timeout_abort";
        failureCode = "timeout_abort";
        break;
      }
      ok = false;
      failureReason = error instanceof Error ? error.message : "Provider invocation failed";
      failureCode = "provider_error";
      break;
    }

    providerCalls += 1;

    if (!invokeResult.ok || !invokeResult.rawResponse) {
      ok = false;
      failureReason = invokeResult.providerError?.message ?? "Provider invocation failed";
      failureCode = "provider_error";
      replayOutputs.push({
        case_id: planned.caseId,
        run_index: planned.runIndex,
        parse_status: "parse_failed",
        repair_required: false,
        safety_failure: false,
        duration_ms: invokeResult.durationMs,
        failure_reason: invokeResult.providerError?.code ?? "provider_error",
      });
      appendAuditEvent(
        createAuditEvent({
          session_id: sessionId,
          run_id: input.runId,
          event_type: "provider_call_completed",
          detail: { case_id: planned.caseId, ok: false },
        }),
      );
      break;
    }

    modelCalls += 1;

    if (input.retainRawResponses && input.writeArtifacts !== false) {
      writeAtomicArtifact({
        outputDir: input.args.outputDir,
        runId: input.runId,
        filename: `raw-${planned.caseId}-run${planned.runIndex}.json`,
        content: JSON.stringify(invokeResult.rawResponse, null, 2),
        overwrite: input.args.overwrite,
      });
    }

    const contractResult = await runMilitaryExpertGenerationContract(
      {
        correlationId: planned.correlationId,
        manuscriptVersionId: `cal-${planned.caseId}`,
        reviewScope: calibrationCase.manuscript.scope === "scene" ? "scene" : "sample",
        manuscriptText: calibrationCase.manuscript.text,
        canonicalWordCount: calibrationCase.manuscript.word_count,
        manuscriptHash: calibrationCase.manuscript.content_hash,
        genreContext: calibrationCase.manuscript.genre_context ?? null,
        countryPeriod: calibrationCase.manuscript.country_period ?? null,
        rawResponse: invokeResult.rawResponse,
      },
      { bypassFeatureFlag: input.bypassFeatureFlags ?? true, now },
    );

    const actualCost = estimateTokenCost(
      invokeResult.rawResponse.inputTokens ?? planned.estimatedInputTokens,
      invokeResult.rawResponse.outputTokens ?? planned.estimatedOutputTokens,
      input.callPlan.providerSpec.pricingProfileId,
    );
    budget.recordCall(
      actualCost,
      invokeResult.rawResponse.inputTokens ?? planned.estimatedInputTokens,
      invokeResult.rawResponse.outputTokens ?? planned.estimatedOutputTokens,
    );
    totalActualCostUsd += actualCost;

    appendAuditEvent(
      createAuditEvent({
        session_id: sessionId,
        run_id: input.runId,
        event_type: "provider_call_completed",
        detail: {
          case_id: planned.caseId,
          ok: contractResult.ok,
          cost_usd: actualCost,
        },
      }),
    );

    if (!contractResult.ok || !contractResult.review) {
      ok = ok && false;
      if (!failureReason) failureReason = contractResult.failureReason ?? "generation_failed";
      if (!failureCode) failureCode = "scoring_failure";
      replayOutputs.push({
        case_id: planned.caseId,
        run_index: planned.runIndex,
        parse_status:
          contractResult.generationStatus === "parse_failed" ? "parse_failed" : "validation_failed",
        repair_required: contractResult.repairDecision === "provider_repair_required",
        safety_failure: false,
        duration_ms: contractResult.durationMs,
        input_tokens: invokeResult.rawResponse.inputTokens ?? null,
        output_tokens: invokeResult.rawResponse.outputTokens ?? null,
        request_hash: contractResult.requestHash,
        raw_response_hash: contractResult.rawResponseHash,
        parsed_output_hash: contractResult.parsedReviewHash,
        failure_reason: contractResult.failureReason,
      });
      continue;
    }

    replayOutputs.push({
      case_id: planned.caseId,
      run_index: planned.runIndex,
      review: contractResult.review,
      parse_status: "success",
      repair_required: contractResult.repairDecision === "provider_repair_required",
      safety_failure: militaryExpertCalibrationAdapter.isSafetyFailure(contractResult.review),
      duration_ms: contractResult.durationMs,
      input_tokens: invokeResult.rawResponse.inputTokens ?? null,
      output_tokens: invokeResult.rawResponse.outputTokens ?? null,
      request_hash: contractResult.requestHash,
      raw_response_hash: contractResult.rawResponseHash ?? hashMilitaryExpertRawResponse(invokeResult.rawResponse),
      parsed_output_hash:
        contractResult.parsedReviewHash ?? hashMilitaryExpertParsedReview(contractResult.review),
    });
  }

  if (sessionReservation && totalActualCostUsd > 0) {
    commitSessionSpend(sessionId, input.args.sessionMaxCostUsd, sessionReservation, totalActualCostUsd);
    appendAuditEvent(
      createAuditEvent({
        session_id: sessionId,
        run_id: input.runId,
        event_type: "session_budget_committed",
        detail: { actual_cost_usd: totalActualCostUsd },
      }),
    );
  }

  const filteredSuite = filterSuiteToSubset(input.args);
  const calibrationResult = await runExpertCalibration(
    {
      suite: filteredSuite,
      config: {
        run_id: input.runId,
        correlation_id: input.correlationId,
        mode: "replay",
        repeat_count: input.args.runs,
      },
      replayOutputs,
    },
    {
      adapter: militaryExpertCalibrationAdapter,
      thresholds: MILITARY_EXPERT_CALIBRATION_THRESHOLDS,
      bypassFeatureFlag: input.bypassFeatureFlags ?? true,
      now,
      writeReportFile: input.writeArtifacts !== false
        ? (filename, content) => {
            writeAtomicArtifact({
              outputDir: input.args.outputDir,
              runId: input.runId,
              filename,
              content,
              overwrite: input.args.overwrite,
            });
          }
        : undefined,
    },
  );

  const manifest = buildManifest(input, now, true);
  let filesWritten = calibrationResult.filesWritten;

  if (input.writeArtifacts !== false) {
    writeRunManifest(input.args.outputDir, input.runId, {
      ...manifest,
      cli_args: formatCliArgsForManifest(input.args),
      calibration_ok: calibrationResult.ok,
      session_id: sessionId,
      model_calls: modelCalls,
      provider_calls: providerCalls,
    }, input.args.overwrite);
    filesWritten += 1;
  }

  const scenarioFailed = failureReason !== null;
  const calibrationOk = calibrationResult.ok;

  let exitCode: number;
  if (failureCode === "timeout_abort") {
    exitCode = LIVE_CALIBRATION_EXIT.timeoutAbort;
  } else if (failureCode === "budget_exhausted") {
    exitCode = LIVE_CALIBRATION_EXIT.costLimitExceeded;
  } else if (failureCode === "provider_error") {
    exitCode = LIVE_CALIBRATION_EXIT.providerError;
  } else if (calibrationOk && !scenarioFailed && modelCalls === input.callPlan.calls.length) {
    exitCode = LIVE_CALIBRATION_EXIT.success;
  } else {
    exitCode = LIVE_CALIBRATION_EXIT.scoringFailure;
  }

  const resultOk = calibrationOk && !scenarioFailed && modelCalls === input.callPlan.calls.length;

  appendAuditEvent(
    createAuditEvent({
      session_id: sessionId,
      run_id: input.runId,
      event_type: resultOk ? "live_run_completed" : "live_run_failed",
      detail: { ok: resultOk, model_calls: modelCalls, provider_calls: providerCalls },
    }),
  );

  return {
    ok: resultOk,
    exitCode,
    manifest,
    filesWritten,
    failureReason,
    failureCode,
    modelCalls,
    providerCalls,
    productionWrites: 0,
    productionExecutionOccurred: false,
    sessionId,
  };
}

function buildManifest(
  input: LiveExecutorInput,
  now: () => number,
  flagsAcknowledged: boolean,
): LiveCalibrationRunManifest {
  return Object.freeze({
    schema_version: LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION,
    run_id: input.runId,
    correlation_id: input.correlationId,
    mode: "live",
    expert_key: input.args.expert,
    suite_id: input.args.suite,
    subset_id: input.args.subset,
    subset_hash: input.callPlan.subsetHash,
    provider: input.args.provider,
    model_id: input.callPlan.providerSpec.modelId,
    pricing_profile_id: input.callPlan.providerSpec.pricingProfileId,
    runs: input.args.runs,
    planned_calls: input.callPlan.calls.length,
    estimated_cost_usd: input.callPlan.totalEstimatedCostUsd,
    started_at: new Date(input.startedAt).toISOString(),
    completed_at: new Date(now()).toISOString(),
    synthetic_scenario: null,
    flags_acknowledged: flagsAcknowledged,
  });
}
