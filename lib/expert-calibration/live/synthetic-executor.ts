import type { CalibrationReplayOutput } from "../contracts.ts";
import { runExpertCalibration } from "../runner.ts";
import {
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
  LiveCalibrationRunManifest,
  SyntheticScenarioId,
} from "./contracts.ts";
import { createBudgetController } from "./budget-controller.ts";
import { LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION } from "./constants.ts";
import { LIVE_CALIBRATION_EXIT } from "./errors.ts";
import { formatCliArgsForManifest } from "./cli-parser.ts";
import { writeRunManifest, writeAtomicArtifact } from "./result-store.ts";
import { resolveSyntheticScenario } from "./synthetic-adapter.ts";
import { getLiveCalibrationSubset } from "./subsets.ts";
import { estimateTokenCost } from "../cost-analysis.ts";

export interface SyntheticExecutorInput {
  readonly args: LiveCalibrationCliArgs;
  readonly callPlan: LiveCalibrationCallPlan;
  readonly runId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  readonly scenario: SyntheticScenarioId;
  readonly writeArtifacts?: boolean;
  readonly bypassFeatureFlags?: boolean;
  readonly now?: () => number;
}

export interface SyntheticExecutorResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly manifest: LiveCalibrationRunManifest;
  readonly filesWritten: number;
  readonly failureReason: string | null;
  readonly modelCalls: 0;
  readonly providerCalls: 0;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

function filterSuiteToSubset(args: LiveCalibrationCliArgs) {
  const subset = getLiveCalibrationSubset(args.subset);
  const caseIds = new Set(subset.caseIds);
  return Object.freeze({
    ...MILITARY_EXPERT_CALIBRATION_SUITE,
    cases: MILITARY_EXPERT_CALIBRATION_SUITE.cases.filter((c) => caseIds.has(c.case_id)),
  });
}

export async function executeSynthetic(
  input: SyntheticExecutorInput,
): Promise<SyntheticExecutorResult> {
  const now = input.now ?? (() => Date.now());
  const budget = createBudgetController({
    maxCalls: input.args.maxCalls,
    maxTotalCostUsd: input.args.maxTotalCostUsd,
    maxCostPerCallUsd: input.args.maxCostPerCallUsd,
    maxInputTokens: input.args.maxInputTokens,
    maxOutputTokens: input.args.maxOutputTokens,
  });

  const caseById = new Map(
    MILITARY_EXPERT_CALIBRATION_SUITE.cases.map((c) => [c.case_id, c]),
  );

  const replayOutputs: CalibrationReplayOutput[] = [];
  let failureReason: string | null = null;
  let ok = true;

  for (const planned of input.callPlan.calls) {
    if (!budget.canAffordCall(
      planned.estimatedCostUsd,
      planned.estimatedInputTokens,
      planned.estimatedOutputTokens,
    )) {
      ok = false;
      failureReason = "budget_exhausted";
      break;
    }

    const scenarioResult = resolveSyntheticScenario(
      input.scenario,
      planned.correlationId,
      planned.caseId,
    );

    if (scenarioResult.budgetExhausted) {
      ok = false;
      failureReason = "budget_exhausted";
      break;
    }

    if (scenarioResult.abortReason) {
      ok = false;
      failureReason = "timeout_abort";
      replayOutputs.push({
        case_id: planned.caseId,
        run_index: planned.runIndex,
        parse_status: "skipped",
        repair_required: false,
        safety_failure: false,
        duration_ms: input.args.timeoutMs,
        failure_reason: "timeout_abort",
      });
      break;
    }

    if (scenarioResult.providerError) {
      ok = false;
      failureReason = scenarioResult.providerError.message;
      replayOutputs.push({
        case_id: planned.caseId,
        run_index: planned.runIndex,
        parse_status: "parse_failed",
        repair_required: false,
        safety_failure: false,
        duration_ms: 0,
        failure_reason: scenarioResult.providerError.code,
      });
      continue;
    }

    const calibrationCase = caseById.get(planned.caseId)!;
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
        rawResponse: scenarioResult.rawResponse,
      },
      { bypassFeatureFlag: input.bypassFeatureFlags ?? true, now },
    );

    const actualCost = estimateTokenCost(
      scenarioResult.rawResponse?.inputTokens ?? planned.estimatedInputTokens,
      scenarioResult.rawResponse?.outputTokens ?? planned.estimatedOutputTokens,
      input.callPlan.providerSpec.pricingProfileId,
    );
    budget.recordCall(
      actualCost,
      scenarioResult.rawResponse?.inputTokens ?? planned.estimatedInputTokens,
      scenarioResult.rawResponse?.outputTokens ?? planned.estimatedOutputTokens,
    );

    if (!contractResult.ok || !contractResult.review) {
      ok = ok && false;
      if (!failureReason) failureReason = contractResult.failureReason ?? "generation_failed";
      replayOutputs.push({
        case_id: planned.caseId,
        run_index: planned.runIndex,
        parse_status:
          contractResult.generationStatus === "parse_failed" ? "parse_failed" : "validation_failed",
        repair_required: contractResult.repairDecision === "provider_repair_required",
        safety_failure: input.scenario === "unsafe_output",
        duration_ms: contractResult.durationMs,
        input_tokens: scenarioResult.rawResponse?.inputTokens ?? null,
        output_tokens: scenarioResult.rawResponse?.outputTokens ?? null,
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
      input_tokens: scenarioResult.rawResponse?.inputTokens ?? null,
      output_tokens: scenarioResult.rawResponse?.outputTokens ?? null,
      request_hash: contractResult.requestHash,
      raw_response_hash: contractResult.rawResponseHash ?? hashMilitaryExpertRawResponse(scenarioResult.rawResponse!),
      parsed_output_hash:
        contractResult.parsedReviewHash ?? hashMilitaryExpertParsedReview(contractResult.review),
    });
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

  const manifest: LiveCalibrationRunManifest = Object.freeze({
    schema_version: LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION,
    run_id: input.runId,
    correlation_id: input.correlationId,
    mode: "synthetic",
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
    synthetic_scenario: input.scenario,
    flags_acknowledged: false,
  });

  let filesWritten = calibrationResult.filesWritten;

  if (input.writeArtifacts !== false) {
    writeRunManifest(input.args.outputDir, input.runId, {
      ...manifest,
      cli_args: formatCliArgsForManifest(input.args),
      calibration_ok: calibrationResult.ok,
    }, input.args.overwrite);
    filesWritten += 1;
  }

  const scenarioFailed = failureReason !== null;
  const calibrationOk = calibrationResult.ok;

  let exitCode: number;
  if (failureReason === "timeout_abort") {
    exitCode = LIVE_CALIBRATION_EXIT.timeoutAbort;
  } else if (failureReason === "budget_exhausted") {
    exitCode = LIVE_CALIBRATION_EXIT.costLimitExceeded;
  } else if (input.scenario === "success" && calibrationOk && !scenarioFailed) {
    exitCode = LIVE_CALIBRATION_EXIT.success;
  } else if (input.scenario === "success") {
    exitCode = LIVE_CALIBRATION_EXIT.scoringFailure;
  } else {
    exitCode = LIVE_CALIBRATION_EXIT.generalFailure;
  }

  const resultOk = input.scenario === "success" ? calibrationOk && !scenarioFailed : false;

  return {
    ok: resultOk,
    exitCode,
    manifest,
    filesWritten,
    failureReason,
    modelCalls: 0,
    providerCalls: 0,
    productionWrites: 0,
    productionExecutionOccurred: false,
  };
}
