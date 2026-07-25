import type {
  LiveCalibrationCliArgs,
  LiveCalibrationOrchestratorDependencies,
  LiveCalibrationResult,
  SyntheticScenarioId,
} from "./contracts.ts";
import {
  LIVE_CALIBRATION_EXIT,
  LiveCalibrationError,
  sanitizeLiveCalibrationMessage,
} from "./errors.ts";
import { LIVE_CALIBRATION_SCHEMA_VERSION } from "./constants.ts";
import { parseLiveCalibrationCliArgs } from "./cli-parser.ts";
import { validateOperatorAuthorization, validateLiveModeNotImplemented } from "./operator-auth.ts";
import { resolveProviderSpec } from "./provider-allowlist.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { executeDryRun } from "./dry-run-executor.ts";
import { executeSynthetic } from "./synthetic-executor.ts";
import { isSyntheticScenarioId } from "./synthetic-adapter.ts";

function defaultRandomId(): string {
  return `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function baseResult(
  partial: Partial<LiveCalibrationResult> & Pick<LiveCalibrationResult, "ok" | "mode" | "runId" | "correlationId" | "exitCode">,
): LiveCalibrationResult {
  return Object.freeze({
    schema_version: LIVE_CALIBRATION_SCHEMA_VERSION,
    callPlan: null,
    suiteResult: null,
    report: null,
    manifest: null,
    filesWritten: 0,
    failureCode: null,
    failureReason: null,
    modelCalls: 0,
    providerCalls: 0,
    productionWrites: 0,
    productionExecutionOccurred: false,
    ...partial,
  });
}

export async function runLiveCalibration(
  args: LiveCalibrationCliArgs,
  dependencies: LiveCalibrationOrchestratorDependencies = {},
): Promise<LiveCalibrationResult> {
  const now = dependencies.now ?? (() => Date.now());
  const randomId = dependencies.randomId ?? defaultRandomId;
  const startedAt = now();
  const runId = randomId();
  const correlationId = args.correlationId ?? randomId();

  try {
    const liveNotImplemented = validateLiveModeNotImplemented(args.mode);
    if (!liveNotImplemented.ok) {
      return baseResult({
        ok: false,
        mode: args.mode,
        runId,
        correlationId,
        exitCode: LIVE_CALIBRATION_EXIT.authorizationFailure,
        failureCode: liveNotImplemented.failureCode ?? "live_execution_not_implemented",
        failureReason: liveNotImplemented.message ?? "Live execution not implemented",
      });
    }

    const auth = validateOperatorAuthorization({
      mode: args.mode,
      ackToken: args.ackToken,
      bypassFeatureFlags: dependencies.bypassFeatureFlags,
    });

    if (!auth.ok) {
      return baseResult({
        ok: false,
        mode: args.mode,
        runId,
        correlationId,
        exitCode: LIVE_CALIBRATION_EXIT.authorizationFailure,
        failureCode: auth.failureCode ?? "authorization_failure",
        failureReason: auth.message ?? "Authorization failed",
      });
    }

    const providerSpec = resolveProviderSpec(args.provider, args.model);
    const callPlan = buildLiveCalibrationCallPlan({
      args,
      providerSpec,
      correlationPrefix: correlationId,
    });

    if (args.mode === "dry-run") {
      const dryRun = await executeDryRun({
        args,
        callPlan,
        runId,
        correlationId,
        startedAt,
        writeArtifacts: dependencies.writeArtifacts,
      });

      return baseResult({
        ok: true,
        mode: "dry-run",
        runId,
        correlationId,
        exitCode: dryRun.exitCode,
        callPlan,
        manifest: dryRun.manifest,
        filesWritten: dryRun.filesWritten,
      });
    }

    if (args.mode === "synthetic") {
      const scenario: SyntheticScenarioId =
        args.syntheticScenario && isSyntheticScenarioId(args.syntheticScenario)
          ? args.syntheticScenario
          : dependencies.syntheticScenario ?? "success";

      const synthetic = await executeSynthetic({
        args,
        callPlan,
        runId,
        correlationId,
        startedAt,
        scenario,
        writeArtifacts: dependencies.writeArtifacts,
        bypassFeatureFlags: dependencies.bypassFeatureFlags,
        now,
      });

      return baseResult({
        ok: synthetic.ok,
        mode: "synthetic",
        runId,
        correlationId,
        exitCode: synthetic.exitCode,
        callPlan,
        manifest: synthetic.manifest,
        filesWritten: synthetic.filesWritten,
        failureReason: synthetic.failureReason,
        failureCode: synthetic.ok ? null : "scoring_failure",
      });
    }

    return baseResult({
      ok: false,
      mode: args.mode,
      runId,
      correlationId,
      exitCode: LIVE_CALIBRATION_EXIT.invalidConfiguration,
      failureCode: "invalid_configuration",
      failureReason: `Unsupported mode: ${args.mode}`,
    });
  } catch (error) {
    if (error instanceof LiveCalibrationError) {
      return baseResult({
        ok: false,
        mode: args.mode,
        runId,
        correlationId,
        exitCode: error.exitCode,
        failureCode: error.code,
        failureReason: sanitizeLiveCalibrationMessage(error.message),
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return baseResult({
      ok: false,
      mode: args.mode,
      runId,
      correlationId,
      exitCode: LIVE_CALIBRATION_EXIT.generalFailure,
      failureCode: "general_failure",
      failureReason: sanitizeLiveCalibrationMessage(message),
    });
  }
}

export async function runLiveCalibrationFromArgv(
  argv: readonly string[],
  dependencies: LiveCalibrationOrchestratorDependencies = {},
): Promise<LiveCalibrationResult> {
  const args = parseLiveCalibrationCliArgs(argv);
  return runLiveCalibration(args, dependencies);
}

export { parseLiveCalibrationCliArgs };
