/** Versioned contract: storydna_editorial_profile@v1 */

export const EDITORIAL_PROFILE_CONTRACT_VERSION = "storydna_editorial_profile@v1" as const;

/** Profile lifecycle states — PRD Section 9. */
export const EDITORIAL_PROFILE_STATUSES = [
  "not_started",
  "awaiting_independent_read",
  "generating",
  "incomplete_evidence",
  "draft",
  "awaiting_eic_confirmation",
  "active",
  "updated",
  "superseded",
  "blocked",
  "failed",
] as const;

export type EditorialProfileStatus = (typeof EDITORIAL_PROFILE_STATUSES)[number];

export const EDITORIAL_PROFILE_TRIGGER_EVENTS = [
  "independent_read_complete",
  "author_dispute_resolved",
  "manuscript_version_change",
  "alignment_patch",
] as const;

export type EditorialProfileTriggerEvent = (typeof EDITORIAL_PROFILE_TRIGGER_EVENTS)[number];

/** Constitutional flags — profile is orchestration metadata, not evidence or intent. */
export const EDITORIAL_PROFILE_IS_EXPERT_FINDING = false as const;
export const EDITORIAL_PROFILE_IS_MANUSCRIPT_EVIDENCE = false as const;
export const EDITORIAL_PROFILE_IS_AUTHOR_INTENT = false as const;

/** Evidence hierarchy levels — PRD Section 10. L5–L7 may inform alignment only. */
export const EVIDENCE_CLASSES = [
  "l1_manuscript_text",
  "l2_independent_read_observations",
  "l3_vision_alignment",
  "l4_contrary_evidence_search",
  "l5_editorial_understanding",
  "l6_manuscript_brief",
  "l7_author_intent",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/** Levels that may classify profile sections (L1–L3 when grounded in L1). */
export const CLASSIFICATION_EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  "l1_manuscript_text",
  "l2_independent_read_observations",
  "l3_vision_alignment",
  "l4_contrary_evidence_search",
] as const;

/** Framing-only levels — alignment comparison, never classification evidence. */
export const FRAMING_ONLY_EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  "l5_editorial_understanding",
  "l6_manuscript_brief",
  "l7_author_intent",
] as const;

/** Allowed EvidenceEntry.source values for profile claims. */
export const EVIDENCE_ENTRY_SOURCES = ["manuscript"] as const;

export type EvidenceEntrySource = (typeof EVIDENCE_ENTRY_SOURCES)[number];

/** Prohibited as EvidenceEntry.source — brief, understanding, intent, expert artifacts. */
export const PROHIBITED_EVIDENCE_SOURCES = [
  "author_intent",
  "editorial_understanding",
  "manuscript_brief",
  "author_framing",
  "expert_finding",
  "independent_read_ungrounded",
] as const;

export const PROFILE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type ProfileConfidenceLevel = (typeof PROFILE_CONFIDENCE_LEVELS)[number];

export const MATERIALITY_LEVELS = [
  "critical",
  "high",
  "moderate",
  "low",
  "negligible",
] as const;
export type MaterialityLevel = (typeof MATERIALITY_LEVELS)[number];

export const EVIDENCE_POLARITIES = ["supporting", "contrary", "neutral"] as const;
export type EvidencePolarity = (typeof EVIDENCE_POLARITIES)[number];

export const AUTHOR_FRAMING_ALIGNMENTS = ["aligned", "partially_aligned", "divergent"] as const;
export type AuthorFramingAlignment = (typeof AUTHOR_FRAMING_ALIGNMENTS)[number];

/** Story Identity controlled vocabulary (initial — extensible via minor amendment). */
export const IDENTITY_KEYS = [
  "literary_fiction",
  "commercial_thriller",
  "romantic_suspense",
  "historical_fiction",
  "speculative_fiction",
  "memoir",
  "ya_fiction",
  "middle_grade",
  "cozy_mystery",
  "epic_fantasy",
  "contemporary_drama",
  "standalone_novel",
  "series_installment",
  "linked_anthology",
  "novella",
  "short_story_collection",
  "book_club",
  "mass_market",
  "upmarket",
  "niche_genre",
  "crossover",
] as const;
export type IdentityKey = (typeof IDENTITY_KEYS)[number];

/** Story Engine controlled vocabulary. */
export const ENGINE_KEYS = [
  "mystery_engine",
  "suspense_engine",
  "romance_engine",
  "character_engine",
  "plot_engine",
  "theme_engine",
  "world_engine",
  "voice_engine",
  "humor_engine",
  "horror_engine",
  "wonder_engine",
  "stakes_engine",
] as const;
export type EngineKey = (typeof ENGINE_KEYS)[number];

export const ENGINE_ROLES = ["primary", "secondary", "supporting"] as const;
export type EngineRole = (typeof ENGINE_ROLES)[number];

export const EDITORIAL_CHARACTERISTIC_DOMAINS = [
  "structure",
  "pacing",
  "character",
  "voice",
  "dialogue",
  "prose",
  "theme",
  "opening",
  "ending",
  "continuity",
] as const;
export type EditorialCharacteristicDomain = (typeof EDITORIAL_CHARACTERISTIC_DOMAINS)[number];

export const EDITORIAL_ASSESSMENTS = ["strength", "developing", "gap", "risk"] as const;
export type EditorialAssessment = (typeof EDITORIAL_ASSESSMENTS)[number];

/** Technical / specialist domain keys — not expert keys. */
export const DOMAIN_KEYS = [
  "military_tactics",
  "combat_medicine",
  "financial_crimes",
  "legal_procedure",
  "medical_clinical",
  "police_procedure",
  "technical_systems",
  "historical_period",
  "language_dialect",
  "series_continuity",
  "timeline_chronology",
  "structure",
  "commercial",
] as const;
export type DomainKey = (typeof DOMAIN_KEYS)[number];

export const SPECIALIST_NEED_LEVELS = ["critical", "high", "medium", "low", "none"] as const;
export type SpecialistNeedLevel = (typeof SPECIALIST_NEED_LEVELS)[number];

export const EMOTION_KEYS = [
  "tension",
  "dread",
  "hope",
  "grief",
  "joy",
  "romantic_longing",
  "righteous_anger",
  "moral_ambiguity",
  "awe",
  "humor",
  "catharsis",
  "discomfort",
  "intimacy",
  "loneliness",
  "triumph",
] as const;
export type EmotionKey = (typeof EMOTION_KEYS)[number];

export const EMOTION_INTENSITIES = ["dominant", "present", "underdeveloped", "absent"] as const;
export type EmotionIntensity = (typeof EMOTION_INTENSITIES)[number];

export const EXECUTION_QUALITIES = ["effective", "uneven", "ineffective", "not_assessable"] as const;
export type ExecutionQuality = (typeof EXECUTION_QUALITIES)[number];

export const PROTECTED_ASSET_CATEGORIES = [
  "voice",
  "character",
  "scene",
  "relationship",
  "set_piece",
  "theme",
  "world",
  "dialogue",
  "prose",
  "humor",
  "suspense",
  "originality",
] as const;
export type ProtectedAssetCategory = (typeof PROTECTED_ASSET_CATEGORIES)[number];

export const PROTECTION_LEVELS = ["critical", "high", "moderate"] as const;
export type ProtectionLevel = (typeof PROTECTION_LEVELS)[number];

export const RISK_SEVERITIES = ["blocking", "significant", "moderate", "low"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const RISK_LIKELIHOODS = ["high", "medium", "low"] as const;
export type RiskLikelihood = (typeof RISK_LIKELIHOODS)[number];

export const REQUIREMENT_LEVELS = ["critical", "high", "medium", "low", "none"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const INTENT_MODIFIERS = ["elevates", "neutral", "suppresses", "not_applicable"] as const;
export type IntentModifier = (typeof INTENT_MODIFIERS)[number];

export const PUBLICATION_STATE_MODIFIERS = ["mandatory", "recommended", "neutral", "deferred"] as const;
export type PublicationStateModifier = (typeof PUBLICATION_STATE_MODIFIERS)[number];

export const SERIES_CONTEXT_MODIFIERS = ["mandatory", "recommended", "neutral", "not_applicable"] as const;
export type SeriesContextModifier = (typeof SERIES_CONTEXT_MODIFIERS)[number];

export const COMMERCIAL_ASSESSMENT_SCOPES = ["pre_expert_preliminary"] as const;
export type CommercialAssessmentScope = (typeof COMMERCIAL_ASSESSMENT_SCOPES)[number];

export const HOOK_STRENGTHS = ["strong", "developing", "weak", "not_assessable"] as const;
export type HookStrength = (typeof HOOK_STRENGTHS)[number];

export const MARKET_LANE_FITS = ["clear", "hybrid", "unclear", "not_assessable"] as const;
export type MarketLaneFit = (typeof MARKET_LANE_FITS)[number];

export const READINESS_SIGNALS = [
  "preliminary_promising",
  "preliminary_developing",
  "preliminary_weak",
  "not_assessable",
] as const;
export type ReadinessSignal = (typeof READINESS_SIGNALS)[number];

export const COMP_SIGNAL_TYPES = [
  "tone",
  "audience",
  "structure",
  "theme",
  "pace",
  "not_comp_claim",
] as const;
export type CompSignalType = (typeof COMP_SIGNAL_TYPES)[number];

export const DESTINATION_ALIGNMENTS = [
  "strongly_aligned",
  "substantially_aligned",
  "partially_aligned",
  "materially_misaligned",
] as const;
export type DestinationAlignment = (typeof DESTINATION_ALIGNMENTS)[number];

export const REGRESSION_RISKS = ["low", "medium", "high"] as const;
export type RegressionRisk = (typeof REGRESSION_RISKS)[number];

export const EVIDENCE_DEPTHS = ["strong", "adequate", "thin"] as const;
export type EvidenceDepth = (typeof EVIDENCE_DEPTHS)[number];

/** Activation thresholds — PRD Section 12. */
export const MIN_EDITORIAL_CHARACTERISTICS = 5 as const;
export const MIN_EDITORIAL_DOMAINS = 3 as const;
export const MIN_EDITORIAL_STRENGTHS = 2 as const;
export const MIN_EMOTIONAL_CHARACTERISTICS = 3 as const;
export const MIN_PROTECTED_ASSETS = 2 as const;
export const MIN_STORY_IDENTITY_LOCATORS_HIGH = 2 as const;
export const MAX_EDITORIAL_RISKS = 10 as const;
export const MIN_INDEPENDENT_READ_COVERAGE_ACTIVATION = 60 as const;
export const MAX_COMMERCIAL_CONFIDENCE: ProfileConfidenceLevel = "medium";

/** Major domains requiring explicit none entries when evaluated. */
export const MAJOR_EVALUATED_DOMAINS: readonly DomainKey[] = [
  "military_tactics",
  "combat_medicine",
  "financial_crimes",
  "series_continuity",
  "timeline_chronology",
] as const;

/**
 * Capability propagation — EIC-owned synthesis; downstream consumers deferred to EP-4+.
 * @see docs/governance/implementation/STORYDNA_EDITORIAL_PROFILE_FRAMEWORK.md
 */
export const EDITORIAL_PROFILE_CAPABILITY = {
  capability_id: "cap.editorial_profile",
  classification: "editor_in_chief_owned",
  propagation_decision: "move_to_editor_in_chief",
  downstream_consumers_deferred: [
    "cap.eic_initial_roadmap_creation",
    "cap.eic_plan_gate",
    "cap.editorial_roadmap",
    "expert_context_injection",
  ],
} as const;

/**
 * Author control boundaries — EIC owns creation; profile ≠ manuscript access grant.
 */
export const EDITORIAL_PROFILE_AUTHOR_CONTROL = {
  eic_owns_synthesis: true,
  author_may_not_select_experts_in_profile: true,
  sharing_requires_separate_approval: true,
  profile_is_not_manuscript_access_grant: true,
  specialist_manuscript_access_at_activation: 0,
} as const;
