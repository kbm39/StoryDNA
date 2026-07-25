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
import { validateOperatorAuthorization } from "./operator-auth.ts";
import { validateLiveSmokeAuthorization } from "./live-authorization.ts";
import { readAnthropicApiKey } from "./api-key.ts";
import { appendAuditEvent, createAuditEvent } from "./audit-log.ts";
import { resolveProviderSpec } from "./provider-allowlist.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { executeDryRun } from "./dry-run-executor.ts";
import { executeSynthetic } from "./synthetic-executor.ts";
import { executeLive } from "./live-executor.ts";
import { createAnthropicProviderInvoker } from "./providers/anthropic/invoke.ts";
import { isSyntheticScenarioId } from "./synthetic-adapter.ts";

function defaultRandomId(): string {
  return `cal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function failureResult(
  partial: Partial<LiveCalibrationResult> &
    Pick<LiveCalibrationResult, "ok" | "mode" | "runId" | "correlationId" | "exitCode">,
): LiveCalibrationResult {
  const base = {
    schema_version: LIVE_CALIBRATION_SCHEMA_VERSION,
    callPlan: null,
    suiteResult: null,
    report: null,
    manifest: null,
    filesWritten: 0,
    failureCode: null,
    failureReason: null,
    productionWrites: 0 as const,
    productionExecutionOccurred: false as const,
  };

  if (partial.mode === "live") {
    return Object.freeze({
      ...base,
      modelCalls: partial.modelCalls ?? 0,
      providerCalls: partial.providerCalls ?? 0,
      sessionId: partial.sessionId ?? "",
      ...partial,
    });
  }

  return Object.freeze({
    ...base,
    modelCalls: 0 as const,
    providerCalls: 0 as const,
    ...partial,
  });
}

export async function runLiveCalibration(
  args: LiveCalibrationCliArgs,
  dependencies: LiveCalibrationOrchestratorDependencies = {},
): Promise<LiveCalibrationResult> {
  const now = dependencies.now ?? (() => Date.now());
  const randomId = dependencies.randomId ?? defaultRandomId;
  const env = dependencies.env ?? process.env;
  const startedAt = now();
  const runId = randomId();
  const correlationId = args.correlationId ?? randomId();

  try {
    const auth = validateOperatorAuthorization({
      mode: args.mode,
      ackToken: args.ackToken,
      env,
      bypassFeatureFlags: dependencies.bypassFeatureFlags,
    });

    if (!auth.ok) {
      return failureResult({
        ok: false,
        mode: args.mode,
        runId,
        correlationId,
        exitCode: LIVE_CALIBRATION_EXIT.authorizationFailure,
        failureCode: auth.failureCode ?? "authorization_failure",
        failureReason: auth.message ?? "Authorization failed",
      });
    }

    if (args.mode === "live") {
      const liveAuth = validateLiveSmokeAuthorization({
        args,
        ackToken: args.ackToken,
        env,
        bypassFeatureFlags: dependencies.bypassFeatureFlags,
      });

      if (!liveAuth.ok) {
        if (args.sessionId) {
          appendAuditEvent(
            createAuditEvent({
              session_id: args.sessionId,
              run_id: runId,
              event_type: "authorization_denied",
              detail: { reason: liveAuth.message ?? "authorization denied" },
            }),
          );
        }
        return failureResult({
          ok: false,
          mode: "live",
          runId,
          correlationId,
          exitCode: LIVE_CALIBRATION_EXIT.authorizationFailure,
          failureCode: liveAuth.failureCode ?? "authorization_failure",
          failureReason: liveAuth.message ?? "Live authorization failed",
          sessionId: args.sessionId ?? "",
        });
      }

      const apiKey = readAnthropicApiKey(env);
      if (!apiKey) {
        appendAuditEvent(
          createAuditEvent({
            session_id: args.sessionId!,
            run_id: runId,
            event_type: "authorization_denied",
            detail: { reason: "missing_api_key" },
          }),
        );
        return failureResult({
          ok: false,
          mode: "live",
          runId,
          correlationId,
          exitCode: LIVE_CALIBRATION_EXIT.authorizationFailure,
          failureCode: "missing_api_key",
          failureReason: "ANTHROPIC_API_KEY is not configured",
          sessionId: args.sessionId!,
        });
      }
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

      return failureResult({
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

      return failureResult({
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

    if (args.mode === "live") {
      const apiKey = readAnthropicApiKey(env)!;
      const providerInvoker =
        dependencies.providerInvoker ?? createAnthropicProviderInvoker(apiKey);

      const live = await executeLive({
        args,
        callPlan,
        runId,
        correlationId,
        startedAt,
        providerInvoker,
        writeArtifacts: dependencies.writeArtifacts,
        bypassFeatureFlags: dependencies.bypassFeatureFlags,
        retainRawResponses: args.retainRawResponses,
        now,
      });

      return failureResult({
        ok: live.ok,
        mode: "live",
        runId,
        correlationId,
        exitCode: live.exitCode,
        callPlan,
        manifest: live.manifest,
        filesWritten: live.filesWritten,
        failureReason: live.failureReason,
        failureCode: live.ok ? null : (live.failureCode ?? "scoring_failure"),
        modelCalls: live.modelCalls,
        providerCalls: live.providerCalls,
        sessionId: live.sessionId,
      });
    }

    return failureResult({
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
      return failureResult({
        ok: false,
        mode: args.mode,
        runId,
        correlationId,
        exitCode: error.exitCode,
        failureCode: error.code,
        failureReason: sanitizeLiveCalibrationMessage(error.message),
        ...(args.mode === "live"
          ? { sessionId: args.sessionId ?? "", modelCalls: 0, providerCalls: 0 }
          : {}),
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return failureResult({
      ok: false,
      mode: args.mode,
      runId,
      correlationId,
      exitCode: LIVE_CALIBRATION_EXIT.generalFailure,
      failureCode: "general_failure",
      failureReason: sanitizeLiveCalibrationMessage(message),
      ...(args.mode === "live"
        ? { sessionId: args.sessionId ?? "", modelCalls: 0, providerCalls: 0 }
        : {}),
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
