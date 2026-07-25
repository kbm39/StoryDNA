import type { OperatorAuthorizationInput, OperatorAuthorizationResult } from "./contracts.ts";
import { LIVE_CALIBRATION_ACK_TOKEN } from "./constants.ts";
import {
  readExpertCalibrationAnthropicEnabled,
  readExpertCalibrationLiveEnabled,
  readExpertMilitaryLiveCalibrationEnabled,
  readLiveCalibrationFeatureFlagStatus,
} from "./feature-flags.ts";
import { readExpertCalibrationFrameworkEnabled } from "../feature-flags.ts";
import { readExpertMilitaryGenerationContractEnabled } from "@/lib/expert-review-engine/feature-flags.ts";

export function validateOperatorAuthorization(
  input: OperatorAuthorizationInput,
): OperatorAuthorizationResult {
  const env = input.env ?? process.env;

  if (input.mode === "dry-run" || input.mode === "synthetic") {
    return { ok: true };
  }

  if (input.mode === "live") {
    if (!input.ackToken) {
      return {
        ok: false,
        failureCode: "authorization_failure",
        message: "Live mode requires --ack-token",
      };
    }

    if (input.ackToken !== LIVE_CALIBRATION_ACK_TOKEN) {
      return {
        ok: false,
        failureCode: "authorization_failure",
        message: "Invalid ack token",
      };
    }

    if (!input.bypassFeatureFlags) {
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

    return { ok: true };
  }

  return {
    ok: false,
    failureCode: "invalid_configuration",
    message: `Unknown mode: ${input.mode}`,
  };
}

export {
  readExpertCalibrationFrameworkEnabled,
  readExpertCalibrationLiveEnabled,
  readExpertCalibrationAnthropicEnabled,
  readExpertMilitaryLiveCalibrationEnabled,
  readExpertMilitaryGenerationContractEnabled,
  readLiveCalibrationFeatureFlagStatus,
};
