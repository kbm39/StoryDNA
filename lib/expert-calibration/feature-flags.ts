export const EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME =
  "EXPERT_CALIBRATION_FRAMEWORK_ENABLED" as const;

const TRUTHY_VALUES = new Set(["true", "1", "yes"]);

/** Default off — absent/empty/malformed disables calibration runner. */
export function readExpertCalibrationFrameworkEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME];
  if (raw === undefined) return false;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  return TRUTHY_VALUES.has(trimmed.toLowerCase());
}
