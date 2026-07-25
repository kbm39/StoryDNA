/** Live calibration constants — developer-only, never production-wired. */

export const LIVE_CALIBRATION_ACK_TOKEN =
  "I-ACKNOWLEDGE-LIVE-CALIBRATION-SPEND" as const;

/** Approved root directory for calibration artifacts (relative to cwd). */
export const LIVE_CALIBRATION_APPROVED_ROOT = ".calibration-results" as const;

export const LIVE_CALIBRATION_SCHEMA_VERSION = "expert_calibration_live@v1" as const;
export const LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION =
  "expert_calibration_run_manifest@v1" as const;

/** Provisional token estimates per case from design report (Haiku 4.5 smoke). */
export const LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE = 3_114 as const;
export const LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE = 2_500 as const;

/** Default bounded provider output cap for live calibration (pricing-derived; see budget-policy.ts). */
export const LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS = 4_096 as const;

export const LIVE_CALIBRATION_MICRO_USD_SCALE = 1_000_000 as const;

export const LIVE_CALIBRATION_DEFAULTS = Object.freeze({
  maxCalls: 3,
  maxTotalCostUsd: 0.08,
  maxCostPerCallUsd: 0.03,
  maxInputTokens: 50_000,
  maxOutputTokens: LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS,
  timeoutMs: 120_000,
  maxRuntimeMs: 600_000,
  runs: 1,
  overwrite: false,
  sessionMaxCostUsd: 1.0,
  retainRawResponses: false,
});

/** Live smoke gate — only this configuration may execute paid provider calls. */
export const LIVE_CALIBRATION_LIVE_SMOKE = Object.freeze({
  expert: "military_expert" as const,
  suite: "military_expert_v1_draft_golden" as const,
  subset: "military_expert_smoke_v1" as const,
  provider: "anthropic" as const,
  runs: 1,
  maxCalls: 3,
});

export const LIVE_CALIBRATION_SESSION_DEFAULTS = Object.freeze({
  sessionMaxCostUsd: 1.0,
  runMaxCostUsd: 0.08,
});

export const LIVE_CALIBRATION_ALLOWED_EXPERTS = Object.freeze(["military_expert"] as const);

export const LIVE_CALIBRATION_ALLOWED_MODES = Object.freeze([
  "dry-run",
  "synthetic",
  "live",
] as const);

export const LIVE_CALIBRATION_ALLOWED_PROVIDERS = Object.freeze(["anthropic"] as const);
