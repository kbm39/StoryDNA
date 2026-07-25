/** Shared calibration limits — expert-agnostic. */

export const EXPERT_CALIBRATION_CASE_SCHEMA_VERSION = "expert_calibration_case@v1" as const;
export const EXPERT_CALIBRATION_SUITE_SCHEMA_VERSION = "expert_calibration_suite@v1" as const;
export const EXPERT_CALIBRATION_REPORT_SCHEMA_VERSION = "expert_calibration_report@v1" as const;

/** Maximum manuscript excerpt characters per case. */
export const MAX_CALIBRATION_EXCERPT_CHARS = 5_000;

/** Maximum length for bounded string fields. */
export const MAX_CALIBRATION_FIELD_CHARS = 2_000;

/** Maximum cases per suite. */
export const MAX_CALIBRATION_CASES = 200;

/** Maximum tags per case. */
export const MAX_CALIBRATION_TAGS = 32;

/** Deterministic rounding for rates (4 decimal places). */
export const CALIBRATION_RATE_PRECISION = 4;

/** Credential-shaped pattern guard for fixture validation. */
export const CREDENTIAL_PATTERN =
  /(?:sk-[a-zA-Z0-9]{10,}|api[_-]?key\s*[:=]|Bearer\s+[a-zA-Z0-9._-]{20,})/i;
