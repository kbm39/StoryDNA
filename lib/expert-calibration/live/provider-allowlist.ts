import type { LiveCalibrationProviderSpec } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";
import {
  ANTHROPIC_HAIKU_35_ALIAS,
  ANTHROPIC_HAIKU_35_MODEL_ID,
  ANTHROPIC_HAIKU_45_ALIAS,
  ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS,
  ANTHROPIC_HAIKU_45_MODEL_ID,
  ANTHROPIC_HAIKU_MODEL_ALIAS,
  ANTHROPIC_HAIKU_MODEL_ID,
  getModelLifecycleRecord,
  resolveModelIdFromAliasOrId,
  validateModelLifecycleForLivePlan,
} from "./model-lifecycle.ts";
import {
  CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
  CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE,
} from "../cost-analysis.ts";

export {
  ANTHROPIC_HAIKU_35_ALIAS,
  ANTHROPIC_HAIKU_35_MODEL_ID,
  ANTHROPIC_HAIKU_45_ALIAS,
  ANTHROPIC_HAIKU_45_MODEL_ID,
  ANTHROPIC_HAIKU_MODEL_ALIAS,
  ANTHROPIC_HAIKU_MODEL_ID,
};

/** @deprecated Historical replay only — not eligible for new live plans. */
export const ANTHROPIC_HAIKU_PRICING_PROFILE = CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE;

export const ANTHROPIC_HAIKU_45_PRICING_PROFILE = CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE;

const ACTIVE_SPEC: LiveCalibrationProviderSpec = Object.freeze({
  provider: "anthropic",
  modelId: ANTHROPIC_HAIKU_45_MODEL_ID,
  modelAlias: ANTHROPIC_HAIKU_45_ALIAS,
  pricingProfileId: ANTHROPIC_HAIKU_45_PRICING_PROFILE,
});

const ALLOWED_ACTIVE_SPECS: readonly LiveCalibrationProviderSpec[] = Object.freeze([ACTIVE_SPEC]);

function rejectRetiredOrAmbiguousModel(model: string): void {
  if (
    model === ANTHROPIC_HAIKU_35_ALIAS
    || model === ANTHROPIC_HAIKU_35_MODEL_ID
    || model === ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS
  ) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model not allowlisted: ${model}`,
    );
  }
}

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

  rejectRetiredOrAmbiguousModel(model);

  const modelId = resolveModelIdFromAliasOrId(model);
  if (!modelId) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model not allowlisted: ${model}`,
    );
  }

  const lifecycle = validateModelLifecycleForLivePlan(modelId);
  const match = ALLOWED_ACTIVE_SPECS.find((spec) => spec.modelId === lifecycle.modelId);
  if (!match) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model not allowlisted: ${model}`,
    );
  }

  if (match.pricingProfileId !== lifecycle.pricingProfileId) {
    throw new LiveCalibrationError(
      "invalid_configuration",
      "Provider spec pricing profile does not match model lifecycle",
    );
  }

  return match;
}

export function resolveHistoricalProviderSpec(
  provider: string,
  modelId: string,
): LiveCalibrationProviderSpec | null {
  if (provider !== "anthropic") {
    return null;
  }
  const lifecycle = getModelLifecycleRecord(modelId);
  if (!lifecycle) {
    return null;
  }
  return Object.freeze({
    provider: "anthropic",
    modelId: lifecycle.modelId,
    modelAlias: lifecycle.modelAlias,
    pricingProfileId: lifecycle.pricingProfileId,
  });
}

export function listAllowedProviderSpecs(): readonly LiveCalibrationProviderSpec[] {
  return ALLOWED_ACTIVE_SPECS;
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
