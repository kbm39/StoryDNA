/**
 * Broader-cert session criteria. Historical official results are frozen:
 * v3 = 13/15 FAIL, v4 = 15/15 PASS. Do not authorize another paid session here.
 */

export const ARCHIVIST_CERT_20260924_V2_SESSION_ID = "archivist-cert-20260924-v2" as const;

export const ARCHIVIST_CERT_20260924_V2_AUTHORIZED = false as const;

export const ARCHIVIST_CERT_20260924_V3_SESSION_ID = "archivist-cert-20260924-v3" as const;

export const ARCHIVIST_CERT_20260924_V3_AUTHORIZED = false as const;

export const ARCHIVIST_CERT_20260924_V3_MODEL = "claude-haiku-4-5-20251001" as const;

export const ARCHIVIST_CERT_20260924_V3_CASE_COUNT = 15 as const;

export const ARCHIVIST_CERT_20260924_V3_CASE_CRITERIA = {
  score_final_classification: true,
  retain_model_classification: true,
  report_model_detection_rate: true,
  report_final_storydna_detection_rate: true,
  report_deterministic_promotions: true,
  report_deterministic_downgrades: true,
  require_asserted_transition_evidence: true,
  require_prior_canon_provenance: true,
  same_model_facing_contract: true,
  same_official_scoring: true,
  same_safety_thresholds: true,
} as const;

export const ARCHIVIST_CERT_20260924_V3_SUCCESS_BAR = {
  official_passes: 15,
  official_failures: 0,
  false_confirmed_contradictions: 0,
  intended_contradictions_detected: true,
  structured_output_gate: true,
  canon_safety_gate: true,
  no_uncontrolled_repair_loops: true,
  canon_writes: 0,
} as const;

export const ARCHIVIST_CERT_20260924_V3_OFFICIAL_RESULT = "13/15 FAIL" as const;

export const ARCHIVIST_CERT_20260924_V4_SESSION_ID = "archivist-cert-20260924-v4" as const;

export const ARCHIVIST_CERT_20260924_V4_AUTHORIZED = false as const;

export const ARCHIVIST_CERT_20260924_V4_MODEL = "claude-haiku-4-5-20251001" as const;

export const ARCHIVIST_CERT_20260924_V4_CASE_COUNT = 15 as const;

export const ARCHIVIST_CERT_20260924_V4_SUCCESS_BAR = {
  official_passes: 15,
  official_failures: 0,
  false_confirmed_contradictions: 0,
  intended_contradictions_detected: true,
  structured_output_gate: true,
  canon_safety_gate: true,
  no_uncontrolled_repair_loops: true,
  canon_writes: 0,
} as const;

export const ARCHIVIST_CERT_20260924_V4_OFFICIAL_RESULT = "15/15 PASS" as const;
