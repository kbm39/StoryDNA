/**
 * Proposed next paid session after confirmation-eligibility + laterality.
 * This file does not authorize or run that session.
 */

export const ARCHIVIST_CERT_20260924_V2_SESSION_ID = "archivist-cert-20260924-v2" as const;

export const ARCHIVIST_CERT_20260924_V2_AUTHORIZED = false as const;

export const ARCHIVIST_CERT_20260924_V2_CASE_CRITERIA = {
  score_final_classification: true,
  retain_model_classification: true,
  report_model_detection_rate: true,
  report_final_storydna_detection_rate: true,
  report_deterministic_promotions: true,
  report_deterministic_downgrades: true,
} as const;
