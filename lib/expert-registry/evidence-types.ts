/** Evidence-Backed Expert Commentary — shared enums and structures. */

export const EVIDENCE_TYPES = [
  "MANUSCRIPT",
  "EXTERNAL_SOURCE",
  "ANALYTICAL",
  "RUBRIC",
  "COMPARATIVE",
  "AUTHOR_PROVIDED",
  "SYSTEM_METADATA",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const CONFIDENCE_LEVELS = [
  "HIGH",
  "MODERATE",
  "LOW",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const MATERIAL_OUTPUT_TYPES = [
  "material_criticism",
  "factual_assertion",
  "recommendation",
  "score",
  "conclusion",
  "editorial_opinion",
] as const;

export type MaterialOutputType = (typeof MATERIAL_OUTPUT_TYPES)[number];

/** Required fields for a future structured evidence record (Phase 2+). */
export const EVIDENCE_RECORD_FIELDS = [
  "claim",
  "evidence",
  "evidence_type",
  "evidence_location",
  "reasoning",
  "confidence",
  "verification_instructions",
  "contrary_evidence",
  "recommendation",
  "limitations",
] as const;

export type EvidenceRecordField = (typeof EVIDENCE_RECORD_FIELDS)[number];
