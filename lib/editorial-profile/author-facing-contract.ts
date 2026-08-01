/** Author-facing Editorial Profile presentation contract — EP-5 */

import type { ProfileConfidenceLevel } from "./contract.ts";

/** Required positive-first presentation order — PRD §23. */
export const AUTHOR_FACING_SECTION_ORDER = [
  "editorial_understanding",
  "what_is_working",
  "protected_assets",
  "improvement_opportunities",
  "editorial_risks",
  "manuscript_characteristics",
  "recommended_specialist_support",
  "roadmap_preparation",
  "confidence_and_uncertainty",
  "what_happens_next",
] as const;

export type AuthorFacingSectionKey = (typeof AUTHOR_FACING_SECTION_ORDER)[number];

export const AUTHOR_FACING_SECTION_TITLES: Readonly<Record<AuthorFacingSectionKey, string>> = {
  editorial_understanding: "Editorial Understanding",
  what_is_working: "What Is Working",
  protected_assets: "Protected Assets",
  improvement_opportunities: "Improvement Opportunities",
  editorial_risks: "Editorial Risks",
  manuscript_characteristics: "Manuscript Characteristics",
  recommended_specialist_support: "Recommended Specialist Support",
  roadmap_preparation: "Roadmap Preparation",
  confidence_and_uncertainty: "Confidence and Uncertainty",
  what_happens_next: "What Happens Next",
};

/** Author-facing confidence levels — no raw decimals exposed. */
export const AUTHOR_FACING_CONFIDENCE_LEVELS = [
  "high",
  "moderate",
  "limited",
  "insufficient_evidence",
] as const;

export type AuthorFacingConfidenceLevel = (typeof AUTHOR_FACING_CONFIDENCE_LEVELS)[number];

export const AUTHOR_FACING_CONFIDENCE_LABELS: Readonly<Record<AuthorFacingConfidenceLevel, string>> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  limited: "Limited confidence",
  insufficient_evidence: "Insufficient evidence",
};

export function mapProfileConfidenceToAuthorFacing(
  level: ProfileConfidenceLevel,
  hasEvidence: boolean,
): AuthorFacingConfidenceLevel {
  if (!hasEvidence) return "insufficient_evidence";
  if (level === "high") return "high";
  if (level === "medium") return "moderate";
  return "limited";
}

/** Evidence basis labels — framing vs manuscript distinction. */
export const AUTHOR_FACING_EVIDENCE_BASIS = [
  "manuscript",
  "eic_synthesis",
  "author_intention",
  "alignment_comparison",
] as const;

export type AuthorFacingEvidenceBasis = (typeof AUTHOR_FACING_EVIDENCE_BASIS)[number];

export const AUTHOR_FACING_EVIDENCE_BASIS_LABELS: Readonly<Record<AuthorFacingEvidenceBasis, string>> = {
  manuscript: "From the manuscript",
  eic_synthesis: "EIC independent read",
  author_intention: "Your goal",
  alignment_comparison: "What you told me",
};

/** Characteristic interpretation modes for manuscript characteristics section. */
export const CHARACTERISTIC_INTERPRETATION_MODES = [
  "demonstrated",
  "descriptive",
  "evaluative",
  "inferred",
  "preliminary",
] as const;

export type CharacteristicInterpretationMode = (typeof CHARACTERISTIC_INTERPRETATION_MODES)[number];

/** Domain keys → professional publishing-house language (not expert keys). */
export const DOMAIN_KEY_AUTHOR_LABELS: Readonly<Record<string, string>> = {
  military_tactics: "Military tactics and operations",
  combat_medicine: "Combat medicine",
  financial_crimes: "Financial crimes and fraud",
  legal_procedure: "Legal procedure",
  medical_clinical: "Clinical medicine",
  police_procedure: "Police procedure",
  technical_systems: "Technical systems",
  historical_period: "Historical period accuracy",
  language_dialect: "Language and dialect",
  series_continuity: "Series continuity",
  timeline_chronology: "Timeline and chronology",
  structure: "Structural editing",
  commercial: "Commercial positioning",
};

/** Required opening copy — PRD §23. */
export const AUTHOR_FACING_PROFILE_OPENING_COPY =
  "This is my professional read of what's on the page — based on the manuscript itself, not the categories you selected. Your goals help me measure distance; they don't override what the text demonstrates. No specialist has reviewed your manuscript yet." as const;

/** Author-control statement — required in What Happens Next. */
export const AUTHOR_FACING_CONTROL_STATEMENT =
  "You retain final authority over your manuscript, editorial decisions, and whether to accept any recommendation." as const;

/** Specialist recommendation framing — no consent implied. */
export const AUTHOR_FACING_SPECIALIST_FRAMING =
  "Based on what I understand about your manuscript, I recommend support in these areas." as const;

/** Roadmap preparation boundary copy. */
export const AUTHOR_FACING_ROADMAP_NOT_GENERATED =
  "Your Editorial Roadmap has not been generated yet. The items below are preparation inputs only." as const;

/**
 * Internal vs author-facing field classification.
 * @see docs/governance/implementation/EDITORIAL_PROFILE_RUNTIME_IMPLEMENTATION.md EP-5
 */
export const AUTHOR_FACING_FIELD_CLASSIFICATION = {
  /** Safe for direct author display. */
  safe: [
    "profile_id",
    "manuscript_id",
    "manuscript_version_id",
    "activated_at",
    "generated_at",
    "story_identity.label",
    "story_identity.demonstration_summary",
    "protected_assets.label",
    "protected_assets.description",
    "editorial_risks.label",
    "editorial_risks.description",
    "evidence.locator.chapter_label",
    "evidence.observation",
    "evidence.excerpt",
  ],
  /** Transformed before display (keys → labels, enums → phrases). */
  transformed: [
    "identity_key",
    "engine_key",
    "domain_key",
    "emotion_key",
    "requirement_level",
    "confidence",
    "materiality",
    "severity",
    "assessment",
    "author_framing_alignment",
    "destination_alignment",
    "hook_strength",
    "market_lane_fit",
  ],
  /** Internal only — never in author-facing read model. */
  internal: [
    "contract_version",
    "trigger_event",
    "supersedes_profile_id",
    "superseded_by_profile_id",
    "dispute_metadata",
    "provider_model",
    "synthesis_timestamp",
    "driving_characteristics",
    "source_entry_ids",
    "priority_rank",
    "coverage_completeness",
    "specialist_manuscript_access_count",
    "is_expert_finding",
    "is_manuscript_evidence",
    "is_author_intent",
    "status",
    "validation_errors",
    "feature_flag",
  ],
  /** Visible only under specific conditions. */
  conditional: [
    "alignment_note",
    "excerpt",
    "contrary_evidence",
    "gaps_affecting_confidence",
    "sections_at_low_confidence",
  ],
  /** Prohibited from author display. */
  prohibited: [
    "expert_key",
    "raw_schema_label",
    "grade",
    "next_best_action",
    "roadmap_generated_true",
    "specialist_activated",
    "manuscript_sharing_consent",
    "provider_metadata",
    "stack_trace",
    "validation_violation",
    "feature_flag_name",
    "internal_policy_label",
  ],
} as const;

/** Statuses eligible for author-facing read model derivation. */
export const ACTIVE_AUTHORITATIVE_PROFILE_STATUSES = ["active", "updated"] as const;
