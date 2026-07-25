import type { LiveCalibrationCliArgs, OperatorAuthorizationResult } from "./contracts.ts";
import {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_LIVE_SMOKE,
} from "./constants.ts";
import { readLiveCalibrationFeatureFlagStatus } from "./feature-flags.ts";
import {
  ANTHROPIC_HAIKU_45_ALIAS,
  ANTHROPIC_HAIKU_45_MODEL_ID,
  validateLiveCliModelAlias,
  validateModelLifecycleForLivePlan,
} from "./model-lifecycle.ts";

export interface LiveAuthorizationInput {
  readonly args: LiveCalibrationCliArgs;
  readonly ackToken?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly bypassFeatureFlags?: boolean;
}

export function validateLiveSmokeAuthorization(
  input: LiveAuthorizationInput,
): OperatorAuthorizationResult {
  const { args } = input;

  if (args.mode !== "live") {
    return { ok: true };
  }

  if (!input.ackToken || input.ackToken !== LIVE_CALIBRATION_ACK_TOKEN) {
    return {
      ok: false,
      failureCode: "authorization_failure",
      message: "Live mode requires valid --ack-token",
    };
  }

  if (!args.sessionId || args.sessionId.trim().length === 0) {
    return {
      ok: false,
      failureCode: "authorization_failure",
      message: "Live mode requires --session-id",
    };
  }

  if (!input.bypassFeatureFlags) {
    const env = input.env ?? process.env;
    const status = readLiveCalibrationFeatureFlagStatus(env);
    if (!status.allRequiredForLive) {
      const missing: string[] = [];
      if (!status.frameworkEnabled) missing.push("EXPERT_CALIBRATION_FRAMEWORK_ENABLED");
      if (!status.liveEnabled) missing.push("EXPERT_CALIBRATION_LIVE_ENABLED");
      if (!status.anthropicEnabled) missing.push("EXPERT_CALIBRATION_ANTHROPIC_ENABLED");
      if (!status.generationContractEnabled) {
        missing.push("EXPERT_MILITARY_GENERATION_CONTRACT_ENABLED");
      }
      if (!status.militaryLiveEnabled) missing.push("EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED");
      return {
        ok: false,
        failureCode: "authorization_failure",
        message: `Required feature flags off: ${missing.join(", ")}`,
      };
    }
  }

  if (args.subset !== LIVE_CALIBRATION_LIVE_SMOKE.subset) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode restricted to subset ${LIVE_CALIBRATION_LIVE_SMOKE.subset}`,
    };
  }

  if (args.suite !== LIVE_CALIBRATION_LIVE_SMOKE.suite) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode restricted to suite ${LIVE_CALIBRATION_LIVE_SMOKE.suite}`,
    };
  }

  if (args.expert !== LIVE_CALIBRATION_LIVE_SMOKE.expert) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode restricted to expert ${LIVE_CALIBRATION_LIVE_SMOKE.expert}`,
    };
  }

  if (args.provider !== LIVE_CALIBRATION_LIVE_SMOKE.provider) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode restricted to provider ${LIVE_CALIBRATION_LIVE_SMOKE.provider}`,
    };
  }

  try {
    validateLiveCliModelAlias(args.model);
    validateModelLifecycleForLivePlan(ANTHROPIC_HAIKU_45_MODEL_ID);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live model alias rejected";
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message,
    };
  }

  if (args.model !== ANTHROPIC_HAIKU_45_ALIAS) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode restricted to model ${ANTHROPIC_HAIKU_45_ALIAS}`,
    };
  }

  if (args.runs !== LIVE_CALIBRATION_LIVE_SMOKE.runs) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode requires --runs ${LIVE_CALIBRATION_LIVE_SMOKE.runs}`,
    };
  }

  if (args.maxCalls !== LIVE_CALIBRATION_LIVE_SMOKE.maxCalls) {
    return {
      ok: false,
      failureCode: "allowlist_violation",
      message: `Live mode requires --max-calls ${LIVE_CALIBRATION_LIVE_SMOKE.maxCalls}`,
    };
  }

  return { ok: true };
}
