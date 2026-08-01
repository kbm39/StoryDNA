/** Versioned contract: storydna_knowledge_domain_analysis@v1 */

export const KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION =
  "storydna_knowledge_domain_analysis@v1" as const;

/** Lifecycle states — KDA PRD Section 10. */
export const KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES = [
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

export type KnowledgeDomainAnalysisStatus =
  (typeof KNOWLEDGE_DOMAIN_ANALYSIS_STATUSES)[number];

export const KDA_TRIGGER_EVENTS = [
  "independent_read_complete",
  "author_dispute_resolved",
  "manuscript_version_change",
  "alignment_patch",
] as const;

export type KdaTriggerEvent = (typeof KDA_TRIGGER_EVENTS)[number];

/** Constitutional artifact classification — orchestration metadata only. */
export const KDA_IS_EXPERT_FINDING = false as const;
export const KDA_IS_MANUSCRIPT_EVIDENCE = false as const;
export const KDA_IS_AUTHOR_INTENT = false as const;
export const KDA_IS_SPECIALIST_ASSIGNMENT = false as const;
export const KDA_IS_MANUSCRIPT_SHARING_CONSENT = false as const;
export const KDA_IS_EXPERT_ACTIVATION = false as const;
export const KDA_IS_ROADMAP_GENERATION = false as const;
export const KDA_IS_GRADING = false as const;

/** Domain centrality — KDA PRD Section 16. */
export const DOMAIN_CENTRALITY_LEVELS = [
  "central",
  "substantial_supporting",
  "limited_scene_specific",
  "incidental",
  "speculative",
  "insufficient_evidence",
  "not_material",
] as const;

export type DomainCentrality = (typeof DOMAIN_CENTRALITY_LEVELS)[number];

/** Materiality — aligned with Editorial Profile + not_material. */
export const KDA_MATERIALITY_LEVELS = [
  "critical",
  "high",
  "moderate",
  "low",
  "negligible",
  "not_material",
] as const;

export type KdaMateriality = (typeof KDA_MATERIALITY_LEVELS)[number];

export const KDA_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;
export type KdaConfidence = (typeof KDA_CONFIDENCE_LEVELS)[number];

export const IMPACT_LEVELS = ["severe", "moderate", "minor", "unknown"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const PLOT_CAUSALITY_IMPACTS = [
  "drives_turning_points",
  "supports",
  "minimal",
  "unknown",
] as const;

export type PlotCausalityImpact = (typeof PLOT_CAUSALITY_IMPACTS)[number];

export const AUTHENTICITY_PRIORITY_MODIFIERS = ["elevates", "neutral", "unknown"] as const;
export type AuthenticityPriorityModifier = (typeof AUTHENTICITY_PRIORITY_MODIFIERS)[number];

/** Evidence source types — distinguish manuscript from framing and synthesis. */
export const KDA_EVIDENCE_SOURCES = [
  "manuscript",
  "independent_read_interpretation",
  "eic_synthesis",
  "author_intent",
  "editorial_understanding",
  "specialist_finding",
] as const;

export type KdaEvidenceSource = (typeof KDA_EVIDENCE_SOURCES)[number];

/** Sources permitted as primary classification evidence for material domains. */
export const PRIMARY_DOMAIN_EVIDENCE_SOURCES: readonly KdaEvidenceSource[] = [
  "manuscript",
  "independent_read_interpretation",
  "eic_synthesis",
] as const;

/** Framing-only sources — never sole proof of domain materiality. */
export const FRAMING_ONLY_KDA_EVIDENCE_SOURCES: readonly KdaEvidenceSource[] = [
  "author_intent",
  "editorial_understanding",
] as const;

/** Post-approval only — must not appear in pre-expert authoritative analysis. */
export const POST_APPROVAL_EVIDENCE_SOURCES: readonly KdaEvidenceSource[] = [
  "specialist_finding",
] as const;

export const EVIDENCE_POLARITIES = ["supporting", "contrary", "neutral"] as const;
export type KdaEvidencePolarity = (typeof EVIDENCE_POLARITIES)[number];

export const EVIDENCE_DISPLAY_SAFETY = ["author_safe", "internal_only"] as const;
export type EvidenceDisplaySafety = (typeof EVIDENCE_DISPLAY_SAFETY)[number];

/** Normalized domain keys — extensible; not a closed list. */
export const KDA_DOMAIN_KEYS = [
  "police_procedure",
  "organized_crime",
  "criminal_law_prosecutorial",
  "military_operations",
  "firearms",
  "forensics",
  "medical_clinical",
  "financial_crimes",
  "legal_procedure",
  "intelligence_counterterrorism",
] as const;

export type KdaDomainKey = (typeof KDA_DOMAIN_KEYS)[number];

/** Capability identifiers — registry resolution deferred; contract-level keys only. */
export const KDA_CAPABILITY_KEYS = [
  "police_procedure",
  "organized_crime",
  "criminal_law_prosecutorial",
  "military_operations",
  "firearms",
] as const;

export type KdaCapabilityKey = (typeof KDA_CAPABILITY_KEYS)[number];

export const SPECIALIST_AVAILABILITY = [
  "available",
  "experimental",
  "unavailable",
  "registry_gap",
  "unknown",
] as const;

export type SpecialistAvailability = (typeof SPECIALIST_AVAILABILITY)[number];

export const RECOMMENDATION_STATUSES = [
  "proposed",
  "deferred",
  "author_declined",
  "approved_for_team",
  "not_recommended",
] as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const AUTHOR_RESPONSE_STATUSES = ["none", "pending", "responded"] as const;
export type AuthorResponseStatus = (typeof AUTHOR_RESPONSE_STATUSES)[number];

export const CONSENT_STATUSES = ["not_requested", "pending", "approved", "declined"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const ACTIVATION_STATUSES = ["not_activated", "pending", "activated"] as const;
export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];

export const MANUSCRIPT_ACCESS_STATUSES = ["not_shared", "pending", "shared"] as const;
export type ManuscriptAccessStatus = (typeof MANUSCRIPT_ACCESS_STATUSES)[number];

export const COMMERCIAL_ENABLEMENT_STATUSES = [
  "not_commercially_enabled",
  "commercially_enabled",
  "unknown",
] as const;

export type CommercialEnablementStatus = (typeof COMMERCIAL_ENABLEMENT_STATUSES)[number];

export const CERTIFICATION_STATUSES = [
  "certified",
  "experimental",
  "uncertified",
  "unknown",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const SEQUENCING_CLASSES = [
  "immediate",
  "early",
  "after_structural_work",
  "before_line_editing",
  "before_final_polish",
  "conditional",
  "after_revision",
  "repeat_review",
  "unresolved",
  "not_currently_recommended",
] as const;

export type SequencingClass = (typeof SEQUENCING_CLASSES)[number];

export const ROADMAP_RELEVANCE = [
  "required_input",
  "optional_input",
  "not_applicable",
] as const;

export type RoadmapRelevance = (typeof ROADMAP_RELEVANCE)[number];

export const REGISTRY_GAP_RESOLUTION_STATUSES = [
  "unresolved",
  "capability_added",
  "superseded",
] as const;

export type RegistryGapResolutionStatus = (typeof REGISTRY_GAP_RESOLUTION_STATUSES)[number];

/** PRD Section 30 — author response types. */
export const AUTHOR_RESPONSE_TYPES = [
  "ask_explain",
  "ask_evidence",
  "agree",
  "disagree",
  "explain_intention",
  "mark_intentional",
  "provide_context",
  "ask_strengthen",
  "ask_approaches",
  "ask_rewrite_example",
  "ask_other_specialist",
  "approve_roadmap_input",
  "defer",
  "reject",
  "reopen",
] as const;

export type AuthorResponseType = (typeof AUTHOR_RESPONSE_TYPES)[number];

export const AUTHOR_RESPONSE_TARGET_TYPES = [
  "domain_conclusion",
  "criticism",
  "risk",
  "protected_asset_connection",
  "specialist_recommendation",
  "registry_gap",
  "sequencing_recommendation",
] as const;

export type AuthorResponseTargetType = (typeof AUTHOR_RESPONSE_TARGET_TYPES)[number];

export const AUDIT_EVENT_TYPES = [
  "analysis_created",
  "domain_added",
  "domain_revised",
  "domain_removed",
  "recommendation_added",
  "registry_gap_recorded",
  "capability_mapped",
  "sequencing_changed",
  "presented_to_author",
  "author_response_recorded",
  "eic_rejoinder_recorded",
  "eic_confirmed",
  "projected_to_profile",
  "superseded",
  "blocked",
  "failed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const PROFILE_PROJECTION_TYPES = [
  "technical_characteristic",
  "specialist_requirement",
  "editorial_risk",
  "roadmap_input",
] as const;

export type ProfileProjectionType = (typeof PROFILE_PROJECTION_TYPES)[number];

export const PROFILE_PROJECTION_TARGETS = [
  "technical_characteristics",
  "specialist_requirements",
  "editorial_risks",
  "roadmap_inputs",
] as const;

export type ProfileProjectionTarget = (typeof PROFILE_PROJECTION_TARGETS)[number];

/** Placeholder patterns rejected when meaningful evidence required — KDA PRD Section 29. */
export const PLACEHOLDER_EVIDENCE_PATTERNS = [
  /^observation for chapter\s*\d+\s*$/i,
  /^see relevant scenes\.?$/i,
  /^tbd\.?$/i,
  /^placeholder\.?$/i,
  /^n\/a\.?$/i,
] as const;

export const MIN_INDEPENDENT_READ_COVERAGE_CONFIRMATION = 70 as const;

export const KDA_CAPABILITY = {
  capability_id: "cap.knowledge_domain_analysis",
  classification: "editor_in_chief_owned",
  propagation_decision: "move_to_editor_in_chief",
  downstream_consumers_deferred: [
    "cap.editorial_profile",
    "cap.eic_initial_roadmap_creation",
    "cap.editorial_roadmap",
    "cap.eic_plan_gate",
  ],
} as const;

export const KDA_AUTHOR_CONTROL = {
  eic_owns_domain_analysis: true,
  author_may_not_select_experts_without_eic_guidance: true,
  recommendation_is_not_assignment: true,
  recommendation_is_not_activation: true,
  recommendation_is_not_consent: true,
  recommendation_does_not_grant_manuscript_access: true,
  disagreement_does_not_erase_eic_conclusion: true,
  author_intent_does_not_erase_manuscript_evidence: true,
  specialist_manuscript_access_at_creation: 0,
} as const;

export const KDA_ACTIVATION_BOUNDARIES = {
  activation_is_authoritative_analysis_only: true,
  activation_grants_specialist_manuscript_access: false,
  activation_implies_author_consent: false,
  activation_implies_manuscript_sharing_consent: false,
  activation_implies_expert_activation: false,
  activation_generates_roadmap: false,
  activation_assigns_grade: false,
  activation_commercially_enables_experts: false,
} as const;
