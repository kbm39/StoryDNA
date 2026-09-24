/**
 * Historical smoke-v3 criteria. Official result is frozen as 3/3 PASS.
 * This file does not authorize or rerun that session.
 */

export const ARCHIVIST_SMOKE_20260922_V3_SESSION_ID = "archivist-smoke-20260922-v3" as const;

export const ARCHIVIST_V3_AUTHORIZED = false as const;

export const ARCHIVIST_V3_CASE_CRITERIA = {
  within_book_exact_contradiction: {
    serialization_valid: true,
    blue_green_confirmed: true,
    both_side_evidence_valid: true,
    entity_resolution_valid: true,
    no_canon_safety_violation: true,
  },
  explained_apparent_conflict: {
    serialization_valid: true,
    confirmed_contradiction: false,
    explained_temporal_change_recognized: true,
  },
  no_false_positive_control: {
    serialization_valid: true,
    confirmed_contradiction_count: 0,
    prefer_zero_unnecessary_verification_findings: true,
  },
} as const;

export const ARCHIVIST_V3_REQUIRED_OFFICIAL_PASSES = 3 as const;

export const ARCHIVIST_SMOKE_20260922_V3_OFFICIAL_RESULT = "3/3 PASS" as const;
