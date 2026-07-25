import { computeCostMetrics } from "./cost-analysis.ts";
import type {
  CalibrationCaseResult,
  CalibrationReplayOutput,
  CalibrationRunConfiguration,
  CalibrationSuiteResult,
  ExpertCalibrationSuite,
  HumanAdjudicationRecord,
} from "./contracts.ts";
import { computeEditorialMetrics, computeEvidenceMetrics, computeCalibrationMetrics } from "./metrics.ts";
import { computeLatencyMetrics } from "./latency.ts";
import { computeStabilityMetrics } from "./stability.ts";
import { buildCalibrationReport } from "./report.ts";
import { loadCalibrationSuite } from "./suite.ts";
import { scoreCalibrationCase } from "./scoring.ts";
import {
  buildThresholdInputFromSuite,
  evaluateCertificationThresholds,
} from "./thresholds.ts";
import type { CalibrationReport, CalibrationRunnerDependencies } from "./contracts.ts";
import {
  EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME,
  readExpertCalibrationFrameworkEnabled,
} from "./feature-flags.ts";

export interface RunExpertCalibrationInput {
  suite: ExpertCalibrationSuite;
  config: CalibrationRunConfiguration;
  replayOutputs: readonly CalibrationReplayOutput[];
}

export interface RunExpertCalibrationResult {
  ok: boolean;
  suiteResult?: CalibrationSuiteResult;
  report?: CalibrationReport;
  failureReason?: string;
  modelCalls: 0;
  providerCalls: 0;
  productionWrites: 0;
  filesWritten: number;
  productionExecutionOccurred: false;
}

function findReplay(
  outputs: readonly CalibrationReplayOutput[],
  caseId: string,
  runIndex: number,
): CalibrationReplayOutput | undefined {
  return outputs.find((o) => o.case_id === caseId && o.run_index === runIndex);
}

function isHumanAdjudicated(
  caseId: string,
  records: readonly HumanAdjudicationRecord[] | undefined,
): boolean {
  return records?.some((r) => r.case_id === caseId) ?? false;
}

/**
 * Test/replay-only calibration runner.
 * Never calls providers, Trigger, databases, or production workflows.
 */
export async function runExpertCalibration(
  input: RunExpertCalibrationInput,
  dependencies: CalibrationRunnerDependencies,
): Promise<RunExpertCalibrationResult> {
  const guards = dependencies.sideEffectGuards ?? {};
  const now = dependencies.now ?? (() => Date.now());
  const startedAt = now();
  let filesWritten = 0;

  const base = {
    modelCalls: 0 as const,
    providerCalls: 0 as const,
    productionWrites: 0 as const,
    productionExecutionOccurred: false as const,
    filesWritten: 0,
  };

  const flagReader =
    dependencies.featureFlagReader ?? readExpertCalibrationFrameworkEnabled;
  if (!dependencies.bypassFeatureFlag && !flagReader()) {
    return {
      ...base,
      ok: false,
      failureReason: `${EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME} is off`,
    };
  }

  const loaded = loadCalibrationSuite(input.suite);
  if (!loaded.ok) {
    return { ...base, ok: false, failureReason: loaded.errors.join("; ") };
  }

  const suite = loaded.suite;
  const caseResults: CalibrationCaseResult[] = [];

  for (let runIndex = 0; runIndex < input.config.repeat_count; runIndex++) {
    for (const calibrationCase of suite.cases) {
      const replay = findReplay(input.replayOutputs, calibrationCase.case_id, runIndex);
      if (!replay) {
        caseResults.push({
          case_id: calibrationCase.case_id,
          correlation_id: `${input.config.correlation_id}-${calibrationCase.case_id}-${runIndex}`,
          ok: false,
          run_index: runIndex,
          duration_ms: 0,
          model_calls: 0,
          provider_calls: 0,
          input_tokens: null,
          output_tokens: null,
          request_hash: null,
          raw_response_hash: null,
          parsed_output_hash: null,
          true_positives: [],
          false_positives: [],
          false_negatives: [
            {
              key: "replay-missing",
              kind: "false_negative",
              score: 0,
              message: "Replay output missing for case",
            },
          ],
          prohibited_violations: [],
          non_finding_violations: [],
          uncertainty_results: [],
          case_score: 0,
          evidence_quality_score: 0,
          editorial_quality_score: null,
          parse_status: "skipped",
          repair_required: false,
          safety_failure: false,
          adjudication_required: calibrationCase.adjudication.mode !== "automatic",
          human_adjudication_pending: calibrationCase.adjudication.mode !== "automatic",
          failure_reason: "replay_missing",
          production_execution_occurred: false,
        });
        continue;
      }

      if (replay.review === undefined) {
        caseResults.push({
          case_id: calibrationCase.case_id,
          correlation_id: `${input.config.correlation_id}-${calibrationCase.case_id}-${runIndex}`,
          ok: false,
          run_index: runIndex,
          duration_ms: replay.duration_ms ?? 0,
          model_calls: 0,
          provider_calls: 0,
          input_tokens: replay.input_tokens ?? null,
          output_tokens: replay.output_tokens ?? null,
          request_hash: replay.request_hash ?? null,
          raw_response_hash: replay.raw_response_hash ?? null,
          parsed_output_hash: null,
          true_positives: [],
          false_positives: [],
          false_negatives: [],
          prohibited_violations: [],
          non_finding_violations: [],
          uncertainty_results: [],
          case_score: 0,
          evidence_quality_score: 0,
          editorial_quality_score: null,
          parse_status: replay.parse_status ?? "parse_failed",
          repair_required: replay.repair_required ?? false,
          safety_failure: replay.safety_failure ?? false,
          adjudication_required: false,
          human_adjudication_pending: false,
          failure_reason: replay.failure_reason ?? "parse_failed",
          production_execution_occurred: false,
        });
        continue;
      }

      const validation = dependencies.adapter.validateOutput(replay.review);
      if (!validation.ok) {
        caseResults.push({
          case_id: calibrationCase.case_id,
          correlation_id: `${input.config.correlation_id}-${calibrationCase.case_id}-${runIndex}`,
          ok: false,
          run_index: runIndex,
          duration_ms: replay.duration_ms ?? 0,
          model_calls: 0,
          provider_calls: 0,
          input_tokens: replay.input_tokens ?? null,
          output_tokens: replay.output_tokens ?? null,
          request_hash: replay.request_hash ?? null,
          raw_response_hash: replay.raw_response_hash ?? null,
          parsed_output_hash: replay.parsed_output_hash ?? null,
          true_positives: [],
          false_positives: [],
          false_negatives: [],
          prohibited_violations: [],
          non_finding_violations: [],
          uncertainty_results: [],
          case_score: 0,
          evidence_quality_score: 0,
          editorial_quality_score: null,
          parse_status: "validation_failed",
          repair_required: replay.repair_required ?? false,
          safety_failure: dependencies.adapter.isSafetyFailure(replay.review),
          adjudication_required: false,
          human_adjudication_pending: false,
          failure_reason: validation.errors.slice(0, 3).join("; "),
          production_execution_occurred: false,
        });
        continue;
      }

      const projected = dependencies.adapter.projectFindings(replay.review);
      const humanDone = isHumanAdjudicated(
        calibrationCase.case_id,
        dependencies.humanAdjudications,
      );
      const scoring = scoreCalibrationCase(calibrationCase, projected, {
        humanAdjudicated: humanDone,
      });

      const safety_failure =
        dependencies.adapter.isSafetyFailure(replay.review) || replay.safety_failure === true;
      const ok =
        !safety_failure &&
        scoring.false_negatives.length === 0 &&
        scoring.prohibited_violations.length === 0 &&
        scoring.non_finding_violations.length === 0 &&
        scoring.case_score >= 0.8;

      caseResults.push({
        case_id: calibrationCase.case_id,
        correlation_id: `${input.config.correlation_id}-${calibrationCase.case_id}-${runIndex}`,
        ok,
        run_index: runIndex,
        duration_ms: replay.duration_ms ?? 0,
        model_calls: 0,
        provider_calls: 0,
        input_tokens: replay.input_tokens ?? null,
        output_tokens: replay.output_tokens ?? null,
        request_hash: replay.request_hash ?? null,
        raw_response_hash: replay.raw_response_hash ?? null,
        parsed_output_hash: replay.parsed_output_hash ?? null,
        true_positives: scoring.true_positives,
        false_positives: scoring.false_positives,
        false_negatives: scoring.false_negatives,
        prohibited_violations: scoring.prohibited_violations,
        non_finding_violations: scoring.non_finding_violations,
        uncertainty_results: scoring.uncertainty_results,
        case_score: scoring.case_score,
        evidence_quality_score: scoring.evidence_quality_score,
        editorial_quality_score: scoring.editorial_quality_score,
        parse_status: replay.parse_status ?? "success",
        repair_required: replay.repair_required ?? false,
        safety_failure,
        adjudication_required: scoring.adjudication_required,
        human_adjudication_pending: scoring.adjudication_required && !humanDone,
        production_execution_occurred: false,
      });
    }
  }

  const metrics = computeCalibrationMetrics(caseResults);
  const evidence_metrics = computeEvidenceMetrics(caseResults);
  const editorial_metrics = computeEditorialMetrics(caseResults);
  const stability = computeStabilityMetrics(caseResults, input.config.repeat_count);
  const cost = computeCostMetrics(caseResults);
  const latency = computeLatencyMetrics(caseResults);

  const requiredIds = suite.cases
    .filter((c) => c.priority === "required")
    .map((c) => c.case_id);

  const thresholdInput = buildThresholdInputFromSuite(
    {
      suite_id: suite.suite_id,
      run_id: input.config.run_id,
      expert_key: suite.expert_key,
      expert_version: suite.expert_version,
      definition_hash: suite.definition_hash,
      mode: input.config.mode,
      case_results: caseResults,
      metrics,
      evidence_metrics,
      editorial_metrics,
      stability,
      cost,
      latency,
      certification: {
        status: "not_ready",
        ready: false,
        blockers_failed: [],
        warnings_raised: [],
        human_adjudication_pending: 0,
        certified: false,
      },
      duration_ms: Math.max(0, now() - startedAt),
      started_at: new Date(startedAt).toISOString(),
      completed_at: new Date(now()).toISOString(),
      model_calls: 0,
      provider_calls: 0,
      production_writes: 0,
      files_written: 0,
      production_execution_occurred: false,
    },
    requiredIds,
  );

  const certification = evaluateCertificationThresholds(
    dependencies.thresholds,
    thresholdInput,
  );

  const suiteResult: CalibrationSuiteResult = Object.freeze({
    suite_id: suite.suite_id,
    run_id: input.config.run_id,
    expert_key: suite.expert_key,
    expert_version: suite.expert_version,
    definition_hash: suite.definition_hash,
    mode: input.config.mode,
    case_results: Object.freeze(caseResults),
    metrics,
    evidence_metrics,
    editorial_metrics,
    stability,
    cost,
    latency,
    certification,
    duration_ms: Math.max(0, now() - startedAt),
    started_at: new Date(startedAt).toISOString(),
    completed_at: new Date(now()).toISOString(),
    model_calls: 0,
    provider_calls: 0,
    production_writes: 0,
    files_written: filesWritten,
    production_execution_occurred: false,
  });

  const report = buildCalibrationReport(suiteResult);

  if (dependencies.writeReportFile) {
    dependencies.writeReportFile(`${report.report_id}.json`, JSON.stringify(report, null, 2));
    filesWritten += 1;
    guards.onFileWrite?.();
  }

  return {
    ok: certification.blockers_failed.length === 0,
    suiteResult,
    report,
    modelCalls: 0,
    providerCalls: 0,
    productionWrites: 0,
    filesWritten,
    productionExecutionOccurred: false,
  };
}
