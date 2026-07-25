import type { LiveCalibrationProviderSpec } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";

export const ANTHROPIC_HAIKU_MODEL_ID = "claude-3-5-haiku-20241022" as const;
export const ANTHROPIC_HAIKU_MODEL_ALIAS = "haiku-v1" as const;
export const ANTHROPIC_HAIKU_PRICING_PROFILE = "calibration_anthropic_haiku_v1" as const;

const ALLOWED_SPECS: readonly LiveCalibrationProviderSpec[] = Object.freeze([
  Object.freeze({
    provider: "anthropic" as const,
    modelId: ANTHROPIC_HAIKU_MODEL_ID,
    modelAlias: ANTHROPIC_HAIKU_MODEL_ALIAS,
    pricingProfileId: ANTHROPIC_HAIKU_PRICING_PROFILE,
  }),
]);

export function resolveProviderSpec(
  provider: string,
  model: string,
): LiveCalibrationProviderSpec {
  if (provider !== "anthropic") {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Provider not allowlisted: ${provider}`,
    );
  }

  const match = ALLOWED_SPECS.find(
    (spec) => spec.modelId === model || spec.modelAlias === model,
  );

  if (!match) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model not allowlisted: ${model}`,
    );
  }

  return match;
}

export function listAllowedProviderSpecs(): readonly LiveCalibrationProviderSpec[] {
  return ALLOWED_SPECS;
}

export function validateProviderAllowlist(
  provider: string,
  model: string,
): { ok: true; spec: LiveCalibrationProviderSpec } | { ok: false; message: string } {
  try {
    return { ok: true, spec: resolveProviderSpec(provider, model) };
  } catch (error) {
    if (error instanceof LiveCalibrationError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Provider allowlist validation failed" };
  }
}
