import type { LiveCalibrationProvider } from "./contracts.ts";
import { LiveCalibrationError } from "./errors.ts";

export type LiveCalibrationModelLifecycleStatus = "active" | "deprecated" | "retired";

export interface LiveCalibrationModelLifecycleRecord {
  readonly provider: LiveCalibrationProvider;
  readonly modelId: string;
  readonly modelAlias: string;
  readonly status: LiveCalibrationModelLifecycleStatus;
  readonly announcedDeprecationDate: string | null;
  readonly retirementDate: string | null;
  readonly recommendedReplacement: string | null;
  readonly pricingProfileId: string;
  readonly verifiedDate: string;
  readonly sourceLabel: string;
}

export const ANTHROPIC_HAIKU_35_MODEL_ID = "claude-3-5-haiku-20241022" as const;
export const ANTHROPIC_HAIKU_35_ALIAS = "haiku-v1" as const;

export const ANTHROPIC_HAIKU_45_MODEL_ID = "claude-haiku-4-5-20251001" as const;
export const ANTHROPIC_HAIKU_45_ALIAS = "haiku-4-5-v1" as const;
export const ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS = "claude-haiku-4-5" as const;

export const ANTHROPIC_OPUS_48_MODEL_ID = "claude-opus-4-8" as const;
export const ANTHROPIC_OPUS_48_ALIAS = "opus-4-8-v1" as const;

/** Primary active exports for live calibration. */
export const ANTHROPIC_HAIKU_MODEL_ID = ANTHROPIC_HAIKU_45_MODEL_ID;
export const ANTHROPIC_HAIKU_MODEL_ALIAS = ANTHROPIC_HAIKU_45_ALIAS;

const MODEL_LIFECYCLE_BY_ID: Readonly<Record<string, LiveCalibrationModelLifecycleRecord>> =
  Object.freeze({
    [ANTHROPIC_HAIKU_35_MODEL_ID]: Object.freeze({
      provider: "anthropic",
      modelId: ANTHROPIC_HAIKU_35_MODEL_ID,
      modelAlias: ANTHROPIC_HAIKU_35_ALIAS,
      status: "retired",
      announcedDeprecationDate: null,
      retirementDate: "2026-02-19",
      recommendedReplacement: ANTHROPIC_HAIKU_45_MODEL_ID,
      pricingProfileId: "calibration_anthropic_haiku_v1",
      verifiedDate: "2026-07-25",
      sourceLabel: "anthropic-model-deprecations",
    }),
    [ANTHROPIC_HAIKU_45_MODEL_ID]: Object.freeze({
      provider: "anthropic",
      modelId: ANTHROPIC_HAIKU_45_MODEL_ID,
      modelAlias: ANTHROPIC_HAIKU_45_ALIAS,
      status: "active",
      announcedDeprecationDate: null,
      retirementDate: null,
      recommendedReplacement: null,
      pricingProfileId: "calibration_anthropic_haiku_4_5_v1",
      verifiedDate: "2026-07-25",
      sourceLabel: "anthropic-model-deprecations",
    }),
    [ANTHROPIC_OPUS_48_MODEL_ID]: Object.freeze({
      provider: "anthropic",
      modelId: ANTHROPIC_OPUS_48_MODEL_ID,
      modelAlias: ANTHROPIC_OPUS_48_ALIAS,
      status: "active",
      announcedDeprecationDate: null,
      retirementDate: null,
      recommendedReplacement: null,
      pricingProfileId: "calibration_anthropic_opus_4_8_v1",
      verifiedDate: "2026-07-30",
      sourceLabel: "anthropic-provider-policy",
    }),
  });

const ALIAS_TO_MODEL_ID: Readonly<Record<string, string>> = Object.freeze({
  [ANTHROPIC_HAIKU_35_ALIAS]: ANTHROPIC_HAIKU_35_MODEL_ID,
  [ANTHROPIC_HAIKU_45_ALIAS]: ANTHROPIC_HAIKU_45_MODEL_ID,
  [ANTHROPIC_OPUS_48_ALIAS]: ANTHROPIC_OPUS_48_MODEL_ID,
});

export function getModelLifecycleRecord(modelId: string): LiveCalibrationModelLifecycleRecord | null {
  return MODEL_LIFECYCLE_BY_ID[modelId] ?? null;
}

export function resolveModelIdFromAliasOrId(model: string): string | null {
  if (model in MODEL_LIFECYCLE_BY_ID) {
    return model;
  }
  return ALIAS_TO_MODEL_ID[model] ?? null;
}

export function isLiveEligibleLifecycleStatus(status: LiveCalibrationModelLifecycleStatus): boolean {
  return status === "active";
}

export function validateModelLifecycleForLivePlan(modelId: string): LiveCalibrationModelLifecycleRecord {
  const record = getModelLifecycleRecord(modelId);
  if (!record) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model lifecycle unknown: ${modelId}`,
    );
  }
  if (!isLiveEligibleLifecycleStatus(record.status)) {
    const replacement = record.recommendedReplacement ?? "none";
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model ${modelId} is ${record.status}; recommended replacement: ${replacement}`,
    );
  }
  return record;
}

export function validateLiveCliModelAlias(model: string): void {
  if (model === ANTHROPIC_HAIKU_45_ALIAS) {
    return;
  }
  if (model === ANTHROPIC_HAIKU_35_ALIAS || model === ANTHROPIC_HAIKU_35_MODEL_ID) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Model ${model} is retired; use ${ANTHROPIC_HAIKU_45_ALIAS}`,
    );
  }
  if (model === ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS || model === ANTHROPIC_HAIKU_45_MODEL_ID) {
    throw new LiveCalibrationError(
      "allowlist_violation",
      `Live mode requires StoryDNA alias ${ANTHROPIC_HAIKU_45_ALIAS}, not ${model}`,
    );
  }
  throw new LiveCalibrationError(
    "allowlist_violation",
    `Model not allowlisted for live mode: ${model}`,
  );
}

export function toModelLifecycleSnapshot(
  record: LiveCalibrationModelLifecycleRecord,
): LiveCalibrationModelLifecycleSnapshot {
  return Object.freeze({
    provider: record.provider,
    model_id: record.modelId,
    model_alias: record.modelAlias,
    status: record.status,
    announced_deprecation_date: record.announcedDeprecationDate,
    retirement_date: record.retirementDate,
    recommended_replacement: record.recommendedReplacement,
    pricing_profile_id: record.pricingProfileId,
    verified_date: record.verifiedDate,
    source_label: record.sourceLabel,
  });
}

export interface LiveCalibrationModelLifecycleSnapshot {
  readonly provider: LiveCalibrationProvider;
  readonly model_id: string;
  readonly model_alias: string;
  readonly status: LiveCalibrationModelLifecycleStatus;
  readonly announced_deprecation_date: string | null;
  readonly retirement_date: string | null;
  readonly recommended_replacement: string | null;
  readonly pricing_profile_id: string;
  readonly verified_date: string;
  readonly source_label: string;
}

export function listModelLifecycleRecords(): readonly LiveCalibrationModelLifecycleRecord[] {
  return Object.freeze(Object.values(MODEL_LIFECYCLE_BY_ID));
}
