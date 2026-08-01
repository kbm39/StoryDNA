import type {
  ActivationStatus,
  AuditEventType,
  AuthenticityPriorityModifier,
  AuthorResponseStatus,
  AuthorResponseTargetType,
  AuthorResponseType,
  CertificationStatus,
  CommercialEnablementStatus,
  ConsentStatus,
  DomainCentrality,
  ImpactLevel,
  KdaCapabilityKey,
  KdaConfidence,
  KdaDomainKey,
  KdaEvidencePolarity,
  KdaEvidenceSource,
  KdaMateriality,
  KdaTriggerEvent,
  KnowledgeDomainAnalysisStatus,
  ManuscriptAccessStatus,
  PlotCausalityImpact,
  ProfileProjectionTarget,
  ProfileProjectionType,
  RecommendationStatus,
  RegistryGapResolutionStatus,
  RoadmapRelevance,
  SequencingClass,
  SpecialistAvailability,
} from "./contract.ts";
import {
  KDA_ACTIVATION_BOUNDARIES,
  KDA_AUTHOR_CONTROL,
  KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION,
} from "./contract.ts";
import type { ManuscriptLocator } from "@/lib/editorial-profile/types.ts";

export type KdaValidationError = {
  readonly code: string;
  readonly message: string;
  readonly section?: string;
};

export type KdaValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly KdaValidationError[] };

export type KdaEvidenceEntry = {
  readonly evidence_id: string;
  readonly locator: ManuscriptLocator;
  readonly excerpt?: string | null;
  readonly paraphrased_event?: string | null;
  readonly observation: string;
  readonly polarity: KdaEvidencePolarity;
  readonly source: KdaEvidenceSource;
  readonly source_artifact_id?: string | null;
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes?: readonly string[];
  readonly author_display_safe: boolean;
  readonly display_safety: "author_safe" | "internal_only";
};

export type ConflictRecord = {
  readonly conflict_id: string;
  readonly description: string;
  readonly signal_a: string;
  readonly signal_b: string;
  readonly evidence_ids: readonly string[];
  readonly visible_to_author: boolean;
};

export type DomainEntry = {
  readonly domain_id: string;
  readonly domain_key: KdaDomainKey | string;
  readonly author_facing_name: string;
  readonly description: string;
  readonly centrality: DomainCentrality;
  readonly materiality: KdaMateriality;
  readonly narrative_role?: string | null;
  readonly manuscript_locations: readonly ManuscriptLocator[];
  readonly evidence: readonly KdaEvidenceEntry[];
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes: readonly string[];
  readonly conflicting_evidence: readonly ConflictRecord[];
  readonly consequence_if_inaccurate?: string | null;
  readonly reader_trust_impact?: ImpactLevel | null;
  readonly plot_causality_impact?: PlotCausalityImpact | null;
  readonly character_credibility_impact?: ImpactLevel | null;
  readonly commercial_relevance?: string | null;
  readonly sensitivity_relevance?: string | null;
  readonly author_authenticity_priority?: AuthenticityPriorityModifier | null;
  readonly capability_requirements: readonly (KdaCapabilityKey | string)[];
  readonly recommendation_ids: readonly string[];
  readonly sequencing?: SequencingClass | null;
  readonly specialist_availability: SpecialistAvailability;
  readonly registry_gap_status: boolean;
  readonly recommendation_status: RecommendationStatus;
  readonly author_response_status: AuthorResponseStatus;
  readonly roadmap_relevance?: RoadmapRelevance | null;
};

export type CapabilityMappingEntry = {
  readonly mapping_id: string;
  readonly domain_id: string;
  readonly capability_key: KdaCapabilityKey | string;
  readonly capability_scope: string;
  readonly relevance_reason: string;
  readonly evidence_ids: readonly string[];
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes: readonly string[];
  readonly overlaps_with_capability_keys: readonly string[];
  readonly is_registered: boolean;
  readonly is_certified: boolean;
  readonly is_available: boolean;
  readonly is_commercially_enabled: boolean;
  readonly is_assignable: boolean;
  readonly registry_gap_id?: string | null;
};

export type RegistryGapEntry = {
  readonly gap_id: string;
  readonly domain_id: string;
  readonly required_capability_key: KdaCapabilityKey | string;
  readonly reason: string;
  readonly evidence_ids: readonly string[];
  readonly centrality: DomainCentrality;
  readonly materiality: KdaMateriality;
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes: readonly string[];
  readonly author_facing_explanation: string;
  readonly unresolved_staffing_status: true;
  readonly platform_telemetry_eligible: boolean;
  readonly roadmap_dependency_eligible: boolean;
  readonly created_at: string;
  readonly resolution_status: RegistryGapResolutionStatus;
  readonly resolution_reference?: string | null;
};

export type SpecialistRecommendation = {
  readonly recommendation_id: string;
  readonly domain_id: string;
  readonly demonstrated_need: string;
  readonly manuscript_evidence_ids: readonly string[];
  readonly centrality: DomainCentrality;
  readonly materiality: KdaMateriality;
  readonly capability_rationale: string;
  readonly candidate_capability_key: KdaCapabilityKey | string;
  readonly candidate_expert_keys: readonly string[];
  readonly candidate_expert_family?: string | null;
  readonly capability_coverage: string;
  readonly certification_status: CertificationStatus;
  readonly availability: SpecialistAvailability;
  readonly commercial_enablement_status: CommercialEnablementStatus;
  readonly manuscript_access_status: ManuscriptAccessStatus;
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes: readonly string[];
  readonly related_protected_asset_ids: readonly string[];
  readonly related_risk_ids: readonly string[];
  readonly related_opportunity_ids: readonly string[];
  readonly sequence: SequencingClass;
  readonly sequencing_rationale?: string | null;
  readonly author_facing_explanation: string;
  readonly author_response_status: AuthorResponseStatus;
  readonly consent_status: ConsentStatus;
  readonly activation_status: ActivationStatus;
  readonly recommendation_status: RecommendationStatus;
  readonly registry_gap_id?: string | null;
};

export type ResponseEffectRecord = {
  readonly confidence_changed: boolean;
  readonly uncertainty_changed: boolean;
  readonly conflict_remains_visible: boolean;
  readonly peu_updates: boolean;
  readonly requires_new_artifact_version: boolean;
  readonly recommendation_status_changed: boolean;
  readonly roadmap_inputs_changed: boolean;
};

export type AuthorResponseEntry = {
  readonly response_id: string;
  readonly target_type: AuthorResponseTargetType;
  readonly target_id: string;
  readonly author_id?: string | null;
  readonly response_type: AuthorResponseType;
  readonly response_text?: string | null;
  readonly created_at: string;
  readonly state_before: string;
  readonly state_after: string;
  readonly effects: ResponseEffectRecord;
  readonly audit_event_id: string;
  readonly preserves_eic_conclusion: boolean;
  readonly preserves_manuscript_evidence: boolean;
};

export type AnalysisConfidenceBlock = {
  readonly overall_confidence: KdaConfidence;
  readonly independent_read_coverage: number;
  readonly domains_at_low_confidence: readonly string[];
  readonly uncovered_regions: readonly string[];
};

export type KdaProvenanceBlock = {
  readonly independent_read_id: string;
  readonly author_intent_id?: string | null;
  readonly editorial_understanding_id?: string | null;
  readonly manuscript_brief_id?: string | null;
  readonly editorial_profile_id?: string | null;
  readonly synthesis_timestamp: string;
  readonly read_coverage_percent: number;
  readonly uncovered_regions: readonly string[];
  readonly specialist_manuscript_access_count: number;
};

export type AuditEvent = {
  readonly event_id: string;
  readonly event_type: AuditEventType;
  readonly timestamp: string;
  readonly actor: "eic" | "author" | "system";
  readonly summary: string;
  readonly related_ids: readonly string[];
  readonly prior_state?: string | null;
  readonly new_state?: string | null;
};

export type KdaEicConfirmationRecord = {
  readonly confirmation_id: string;
  readonly contract_version: typeof KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION;
  readonly analysis_id: string;
  readonly analysis_version_status: KnowledgeDomainAnalysisStatus;
  readonly related_editorial_profile_id?: string | null;
  readonly related_editorial_profile_status?: string | null;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly candidate_status_before: KnowledgeDomainAnalysisStatus;
  readonly resulting_status: KnowledgeDomainAnalysisStatus;
  readonly eic_execution_id: string;
  readonly confirmed_at: string;
  readonly readiness: {
    readonly ready: boolean;
    readonly confirmation_validation_passed: boolean;
  };
  readonly validation_findings: readonly KdaValidationError[];
  readonly unresolved_uncertainty: readonly string[];
  readonly unresolved_conflicts: readonly string[];
  readonly domain_sufficiency: { readonly sufficient: boolean; readonly gaps: readonly string[] };
  readonly capability_mapping_sufficiency: {
    readonly sufficient: boolean;
    readonly gaps: readonly string[];
  };
  readonly registry_gap_acknowledgment: {
    readonly acknowledged: boolean;
    readonly gap_ids: readonly string[];
  };
  readonly recommendation_boundary_validation: { readonly passed: boolean; readonly violations: readonly string[] };
  readonly provenance_sufficiency: { readonly sufficient: boolean; readonly gaps: readonly string[] };
  readonly reason: string;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly author_control: Readonly<
    typeof KDA_AUTHOR_CONTROL & typeof KDA_ACTIVATION_BOUNDARIES
  >;
  readonly specialist_manuscript_access_granted: false;
  readonly expert_activation_performed: false;
  readonly roadmap_generated: false;
  readonly grade_assigned: false;
  readonly superseded_analysis_id: string | null;
};

export type KnowledgeDomainAnalysisV1 = {
  readonly contract_version: typeof KNOWLEDGE_DOMAIN_ANALYSIS_CONTRACT_VERSION;
  readonly analysis_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly independent_read_id: string;
  readonly editorial_profile_id?: string | null;
  readonly author_intent_id?: string | null;
  readonly editorial_understanding_id?: string | null;
  readonly eic_execution_id: string;
  readonly status: KnowledgeDomainAnalysisStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly activated_at?: string | null;
  readonly supersedes_analysis_id?: string | null;
  readonly superseded_by_analysis_id?: string | null;
  readonly trigger_event: KdaTriggerEvent;
  readonly domains: readonly DomainEntry[];
  readonly capability_mappings: readonly CapabilityMappingEntry[];
  readonly recommendations: readonly SpecialistRecommendation[];
  readonly registry_gaps: readonly RegistryGapEntry[];
  readonly author_responses: readonly AuthorResponseEntry[];
  readonly eic_confirmation?: KdaEicConfirmationRecord | null;
  readonly provenance: KdaProvenanceBlock;
  readonly audit_history: readonly AuditEvent[];
  readonly synthesis_confidence: AnalysisConfidenceBlock;
  readonly is_expert_finding: false;
  readonly is_manuscript_evidence: false;
  readonly is_author_intent: false;
  readonly is_specialist_assignment: false;
  readonly is_manuscript_sharing_consent: false;
  readonly is_expert_activation: false;
  readonly is_roadmap_generation: false;
  readonly is_grading: false;
};

export type ProfileProjectionEntry = {
  readonly projection_id: string;
  readonly source_analysis_id: string;
  readonly source_analysis_status: KnowledgeDomainAnalysisStatus;
  readonly source_domain_id: string;
  readonly evidence_ids: readonly string[];
  readonly confidence: KdaConfidence;
  readonly uncertainty_notes: readonly string[];
  readonly conflict_ids: readonly string[];
  readonly projection_type: ProfileProjectionType;
  readonly projected_target_section: ProfileProjectionTarget;
  readonly refresh_of_projection_id?: string | null;
  readonly superseded_by_projection_id?: string | null;
};

export type ProfileProjectionBundle = {
  readonly bundle_id: string;
  readonly source_analysis_id: string;
  readonly source_analysis_updated_at: string;
  readonly projections: readonly ProfileProjectionEntry[];
};

export type KdaVersionChainEntry = {
  readonly analysis_id: string;
  readonly status: KnowledgeDomainAnalysisStatus;
  readonly supersedes_analysis_id: string | null;
  readonly superseded_by_analysis_id: string | null;
  readonly created_at: string;
};
