import type {
  AuthorFacingConfidenceLevel,
  AuthorFacingEvidenceBasis,
  AuthorFacingSectionKey,
  CharacteristicInterpretationMode,
} from "./author-facing-contract.ts";
import { EDITORIAL_PROFILE_CONTRACT_VERSION } from "./contract.ts";

export type AuthorFacingEvidenceReference = {
  readonly evidence_id: string;
  readonly locator_label: string;
  readonly observation: string;
  readonly excerpt: string | null;
  readonly evidence_basis: AuthorFacingEvidenceBasis;
  readonly has_contrary_signal: boolean;
};

export type AuthorFacingStrengthEntry = {
  readonly entry_id: string;
  readonly statement: string;
  readonly why_it_works: string;
  readonly evidence: readonly AuthorFacingEvidenceReference[];
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly uncertainty_notes: readonly string[];
  readonly source_section: string;
  readonly may_become_protected_asset: boolean;
  readonly related_protected_asset_id: string | null;
};

export type AuthorFacingProtectedAssetEntry = {
  readonly asset_id: string;
  readonly what_to_protect: string;
  readonly why_it_matters: string;
  readonly evidence: readonly AuthorFacingEvidenceReference[];
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly avoid_damaging: string;
  readonly related_characteristic: string | null;
};

export type AuthorFacingImprovementOpportunity = {
  readonly entry_id: string;
  readonly description: string;
  readonly why_it_matters: string;
  readonly evidence: readonly AuthorFacingEvidenceReference[];
  readonly reader_effect: string | null;
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly uncertainty_notes: readonly string[];
  readonly related_protected_asset_ids: readonly string[];
  readonly related_risk_ids: readonly string[];
  readonly may_benefit_from_specialist: boolean;
};

export type AuthorFacingEditorialRiskEntry = {
  readonly risk_id: string;
  readonly risk_description: string;
  readonly evidence: readonly AuthorFacingEvidenceReference[];
  readonly why_it_matters: string;
  readonly potential_effect: string;
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly uncertainty_notes: readonly string[];
  readonly conflicting_evidence: boolean;
  readonly related_protected_asset_ids: readonly string[];
  readonly may_need_specialist_evaluation: boolean;
};

export type AuthorFacingManuscriptCharacteristic = {
  readonly characteristic_id: string;
  readonly name: string;
  readonly interpretation: string;
  readonly why_it_matters: string;
  readonly evidence: readonly AuthorFacingEvidenceReference[];
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly uncertainty_notes: readonly string[];
  readonly interpretation_mode: CharacteristicInterpretationMode;
  readonly category: "story_identity" | "story_engine" | "editorial" | "technical" | "emotional" | "commercial";
};

export type AuthorFacingSpecialistRecommendation = {
  readonly recommendation_id: string;
  readonly demonstrated_need: string;
  readonly capability_area: string;
  readonly why_it_may_help: string;
  readonly evidence_summary: string;
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly uncertainty_notes: readonly string[];
  readonly suggested_timing: string | null;
  readonly related_protected_asset_ids: readonly string[];
  readonly related_opportunity_ids: readonly string[];
  readonly related_risk_ids: readonly string[];
  readonly specialist_not_activated: true;
  readonly manuscript_sharing_not_authorized: true;
};

export type AuthorFacingRoadmapPreparation = {
  readonly likely_destination: string;
  readonly current_editorial_position: string;
  readonly protected_strengths: readonly string[];
  readonly principal_improvement_areas: readonly string[];
  readonly possible_sequencing: readonly string[];
  readonly readiness_considerations: readonly string[];
  readonly confidence: AuthorFacingConfidenceLevel;
  readonly confidence_label: string;
  readonly unresolved_questions: readonly string[];
  readonly roadmap_generated: false;
  readonly no_final_next_best_action: true;
};

export type AuthorFacingEditorialUnderstanding = {
  readonly opening_copy: string;
  readonly story_kind: string;
  readonly narrative_drivers: readonly string[];
  readonly emotional_experience: readonly string[];
  readonly author_intention_summary: string | null;
  readonly alignment_summary: string;
  readonly alignment_differences: readonly string[];
  readonly synthesis_narrative: string;
  readonly uncertainty_notes: readonly string[];
  readonly manuscript_supported: readonly string[];
  readonly author_stated_intention: readonly string[];
  readonly eic_synthesis: readonly string[];
  readonly unresolved_differences: readonly string[];
};

export type AuthorFacingConfidenceSummary = {
  readonly overall_confidence: AuthorFacingConfidenceLevel;
  readonly overall_confidence_label: string;
  readonly read_coverage_note: string;
  readonly evidence_depth_note: string;
  readonly sections_with_limited_confidence: readonly string[];
  readonly gaps_affecting_confidence: readonly string[];
  readonly uncertainty_explanations: readonly string[];
  readonly unresolved_conflicts: readonly string[];
};

export type AuthorFacingWhatHappensNext = {
  readonly summary: string;
  readonly no_specialist_activated: true;
  readonly no_manuscript_shared: true;
  readonly recommendations_are_recommendations: true;
  readonly author_retains_final_authority: true;
  readonly roadmap_is_later_step: true;
  readonly author_control_statement: string;
};

export type AuthorFacingSectionEnvelope<T> = {
  readonly section_key: AuthorFacingSectionKey;
  readonly display_order: number;
  readonly title: string;
  readonly content: T;
};

export type AuthorFacingEditorialProfileReadModel = {
  readonly contract_version: typeof EDITORIAL_PROFILE_CONTRACT_VERSION;
  readonly read_model_kind: "author_facing_editorial_profile";
  readonly profile_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly is_active_authoritative: true;
  readonly source_profile_status: "active" | "updated";
  readonly source_generated_at: string;
  readonly source_activated_at: string | null;
  readonly presentation_timestamp: string;
  readonly provenance: {
    readonly author_intent_id: string;
    readonly independent_read_id: string;
    readonly editorial_understanding_id: string | null;
    readonly manuscript_brief_id: string | null;
  };
  readonly sections: readonly AuthorFacingSectionEnvelope<unknown>[];
  readonly editorial_understanding: AuthorFacingEditorialUnderstanding;
  readonly what_is_working: readonly AuthorFacingStrengthEntry[];
  readonly protected_assets: readonly AuthorFacingProtectedAssetEntry[];
  readonly improvement_opportunities: readonly AuthorFacingImprovementOpportunity[];
  readonly editorial_risks: readonly AuthorFacingEditorialRiskEntry[];
  readonly manuscript_characteristics: readonly AuthorFacingManuscriptCharacteristic[];
  readonly recommended_specialist_support: readonly AuthorFacingSpecialistRecommendation[];
  readonly roadmap_preparation: AuthorFacingRoadmapPreparation;
  readonly confidence_and_uncertainty: AuthorFacingConfidenceSummary;
  readonly what_happens_next: AuthorFacingWhatHappensNext;
  readonly capability_status: {
    readonly specialists_executed: false;
    readonly manuscript_sharing_granted: false;
    readonly roadmap_generated: false;
    readonly grade_assigned: false;
  };
  readonly author_control_statement: string;
};

export type AuthorFacingReadModelValidationError = {
  readonly code: string;
  readonly message: string;
  readonly section?: string;
};

export type AuthorFacingReadModelValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly AuthorFacingReadModelValidationError[] };

export type CreateAuthorFacingEditorialProfileReadModelFailureCode =
  | "feature_flag_disabled"
  | "missing_profile"
  | "non_active_profile"
  | "manuscript_mismatch"
  | "version_mismatch"
  | "missing_provenance"
  | "presentation_validation_failed";

export type CreateAuthorFacingEditorialProfileReadModelInput = {
  readonly profile: import("./types.ts").EditorialProfileV1 | null | undefined;
  readonly expectedManuscriptId: string;
  readonly expectedManuscriptVersionId: string;
  readonly presentationTimestamp?: string;
  /** Optional author intention summary for alignment display — framing only. */
  readonly authorIntentionSummary?: string | null;
};

export type CreateAuthorFacingEditorialProfileReadModelResult =
  | { readonly ok: true; readonly readModel: AuthorFacingEditorialProfileReadModel }
  | {
      readonly ok: false;
      readonly code: CreateAuthorFacingEditorialProfileReadModelFailureCode;
      readonly message: string;
      readonly validation?: AuthorFacingReadModelValidationResult;
    };
