/** Live calibration constants — developer-only, never production-wired. */

export const LIVE_CALIBRATION_ACK_TOKEN =
  "I-ACKNOWLEDGE-LIVE-CALIBRATION-SPEND" as const;

/** Approved root directory for calibration artifacts (relative to cwd). */
export const LIVE_CALIBRATION_APPROVED_ROOT = ".calibration-results" as const;

export const LIVE_CALIBRATION_SCHEMA_VERSION = "expert_calibration_live@v1" as const;
export const LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION =
  "expert_calibration_run_manifest@v1" as const;

/** Provisional token estimates per case from design report (Haiku v1). */
export const LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE = 3_114 as const;
export const LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE = 2_500 as const;

/** Micro-USD precision for budget arithmetic (6 decimal places). */
export const LIVE_CALIBRATION_MICRO_USD_SCALE = 1_000_000 as const;

export const LIVE_CALIBRATION_DEFAULTS = Object.freeze({
  maxCalls: 3,
  maxTotalCostUsd: 0.05,
  maxCostPerCallUsd: 0.02,
  maxInputTokens: 50_000,
  maxOutputTokens: 50_000,
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
  runMaxCostUsd: 0.05,
});

export const LIVE_CALIBRATION_ALLOWED_EXPERTS = Object.freeze(["military_expert"] as const);

export const LIVE_CALIBRATION_ALLOWED_MODES = Object.freeze([
  "dry-run",
  "synthetic",
  "live",
] as const);

export const LIVE_CALIBRATION_ALLOWED_PROVIDERS = Object.freeze(["anthropic"] as const);
