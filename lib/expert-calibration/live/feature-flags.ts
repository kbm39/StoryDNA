import { readExpertCalibrationFrameworkEnabled } from "../feature-flags.ts";
import { readExpertMilitaryGenerationContractEnabled } from "@/lib/expert-review-engine/feature-flags.ts";

export const EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME =
  "EXPERT_CALIBRATION_LIVE_ENABLED" as const;

export const EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME =
  "EXPERT_CALIBRATION_ANTHROPIC_ENABLED" as const;

export const EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME =
  "EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED" as const;

const TRUTHY_VALUES = new Set(["true", "1", "yes"]);

function readTruthyFlag(
  env: Readonly<Record<string, string | undefined>>,
  flagName: string,
): boolean {
  const raw = env[flagName];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}

/** Default off — absent/empty/malformed disables live calibration. */
export function readExpertCalibrationLiveEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return readTruthyFlag(env, EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME);
}

/** Default off — absent/empty/malformed disables Anthropic invoker. */
export function readExpertCalibrationAnthropicEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return readTruthyFlag(env, EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME);
}

/** Default off — absent/empty/malformed disables Military Expert live calibration. */
export function readExpertMilitaryLiveCalibrationEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return readTruthyFlag(env, EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME);
}

export interface LiveCalibrationFeatureFlagStatus {
  readonly frameworkEnabled: boolean;
  readonly liveEnabled: boolean;
  readonly anthropicEnabled: boolean;
  readonly generationContractEnabled: boolean;
  readonly militaryLiveEnabled: boolean;
  readonly allRequiredForLive: boolean;
}

export function readLiveCalibrationFeatureFlagStatus(
  env: Readonly<Record<string, string | undefined>> = process.env,
): LiveCalibrationFeatureFlagStatus {
  const frameworkEnabled = readExpertCalibrationFrameworkEnabled(env);
  const liveEnabled = readExpertCalibrationLiveEnabled(env);
  const anthropicEnabled = readExpertCalibrationAnthropicEnabled(env);
  const generationContractEnabled = readExpertMilitaryGenerationContractEnabled(env);
  const militaryLiveEnabled = readExpertMilitaryLiveCalibrationEnabled(env);

  return {
    frameworkEnabled,
    liveEnabled,
    anthropicEnabled,
    generationContractEnabled,
    militaryLiveEnabled,
    allRequiredForLive:
      frameworkEnabled &&
      liveEnabled &&
      anthropicEnabled &&
      generationContractEnabled &&
      militaryLiveEnabled,
  };
}
