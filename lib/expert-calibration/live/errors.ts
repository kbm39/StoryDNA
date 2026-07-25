import type { LiveCalibrationFailureCode } from "./contracts.ts";

/** Process exit codes for live calibration CLI. */
export const LIVE_CALIBRATION_EXIT = Object.freeze({
  success: 0,
  generalFailure: 1,
  authorizationFailure: 2,
  allowlistViolation: 3,
  costLimitExceeded: 4,
  timeoutAbort: 5,
  scoringFailure: 6,
  invalidConfiguration: 7,
  providerError: 8,
} as const);

export type LiveCalibrationExitCode =
  (typeof LIVE_CALIBRATION_EXIT)[keyof typeof LIVE_CALIBRATION_EXIT];

const CODE_TO_EXIT: Record<LiveCalibrationFailureCode, LiveCalibrationExitCode> = {
  authorization_failure: LIVE_CALIBRATION_EXIT.authorizationFailure,
  allowlist_violation: LIVE_CALIBRATION_EXIT.allowlistViolation,
  cost_limit_exceeded: LIVE_CALIBRATION_EXIT.costLimitExceeded,
  timeout_abort: LIVE_CALIBRATION_EXIT.timeoutAbort,
  scoring_failure: LIVE_CALIBRATION_EXIT.scoringFailure,
  invalid_configuration: LIVE_CALIBRATION_EXIT.invalidConfiguration,
  provider_error: LIVE_CALIBRATION_EXIT.providerError,
  missing_api_key: LIVE_CALIBRATION_EXIT.authorizationFailure,
  synthetic_scenario_unknown: LIVE_CALIBRATION_EXIT.invalidConfiguration,
  result_store_rejected: LIVE_CALIBRATION_EXIT.invalidConfiguration,
  budget_exhausted: LIVE_CALIBRATION_EXIT.costLimitExceeded,
  correlation_mismatch: LIVE_CALIBRATION_EXIT.scoringFailure,
  general_failure: LIVE_CALIBRATION_EXIT.generalFailure,
};

export class LiveCalibrationError extends Error {
  readonly code: LiveCalibrationFailureCode;
  readonly exitCode: LiveCalibrationExitCode;

  constructor(code: LiveCalibrationFailureCode, message: string) {
    super(message);
    this.name = "LiveCalibrationError";
    this.code = code;
    this.exitCode = CODE_TO_EXIT[code] ?? LIVE_CALIBRATION_EXIT.generalFailure;
  }
}

export function liveCalibrationFailure(
  code: LiveCalibrationFailureCode,
  message: string,
): { ok: false; code: LiveCalibrationFailureCode; message: string; exitCode: LiveCalibrationExitCode } {
  return {
    ok: false,
    code,
    message,
    exitCode: CODE_TO_EXIT[code] ?? LIVE_CALIBRATION_EXIT.generalFailure,
  };
}

/** Strip credential-shaped content from error messages. */
export function sanitizeLiveCalibrationMessage(message: string): string {
  return message
    .replace(/(?:sk-[a-zA-Z0-9]{10,}|api[_-]?key\s*[:=]\S+|Bearer\s+\S+)/gi, "[REDACTED]")
    .slice(0, 500);
}
