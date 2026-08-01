import type {
  AuthorFramingAlignment,
  CommercialAssessmentScope,
  CompSignalType,
  DestinationAlignment,
  EditorialAssessment,
  EditorialCharacteristicDomain,
  EditorialProfileStatus,
  EditorialProfileTriggerEvent,
  EmotionIntensity,
  EmotionKey,
  EngineKey,
  EngineRole,
  EvidenceDepth,
  EvidenceEntrySource,
  EvidencePolarity,
  ExecutionQuality,
  HookStrength,
  IdentityKey,
  IntentModifier,
  MarketLaneFit,
  MaterialityLevel,
  ProfileConfidenceLevel,
  ProtectedAssetCategory,
  ProtectionLevel,
  PublicationStateModifier,
  ReadinessSignal,
  RegressionRisk,
  RequirementLevel,
  RiskLikelihood,
  RiskSeverity,
  SeriesContextModifier,
  SpecialistNeedLevel,
  DomainKey,
} from "./contract.ts";
import { EDITORIAL_PROFILE_CONTRACT_VERSION } from "./contract.ts";

export type ManuscriptLocator = {
  readonly chapter_id?: string | null;
  readonly chapter_label: string;
  readonly scene_id?: string | null;
  readonly paragraph_range?: string | null;
  readonly word_offset_start?: number | null;
  readonly word_offset_end?: number | null;
};

export type EvidenceEntry = {
  readonly evidence_id: string;
  readonly locator: ManuscriptLocator;
  readonly excerpt?: string | null;
  readonly observation: string;
  readonly polarity: EvidencePolarity;
  readonly source: EvidenceEntrySource;
};

export type IdentityClassification = {
  readonly identity_key: IdentityKey | string;
  readonly label: string;
  readonly demonstration_summary: string;
};

export type StoryIdentityBlock = {
  readonly primary_identity: IdentityClassification;
  readonly secondary_identities: readonly IdentityClassification[];
  readonly identity_rationale: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: ProfileConfidenceLevel;
  readonly author_framing_alignment: AuthorFramingAlignment;
  readonly alignment_note?: string | null;
};

export type StoryEngineEntry = {
  readonly engine_id: string;
  readonly engine_key: EngineKey | string;
  readonly label: string;
  readonly role: EngineRole;
  readonly demonstration_summary: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type EditorialCharacteristicEntry = {
  readonly characteristic_id: string;
  readonly domain: EditorialCharacteristicDomain;
  readonly label: string;
  readonly assessment: EditorialAssessment;
  readonly summary: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type TechnicalCharacteristicEntry = {
  readonly technical_id: string;
  readonly domain_key: DomainKey | string;
  readonly label: string;
  readonly observation: string;
  readonly materiality: MaterialityLevel;
  readonly confidence: ProfileConfidenceLevel;
  readonly evidence: readonly EvidenceEntry[];
  readonly specialist_need: SpecialistNeedLevel;
  readonly specialist_need_rationale: string;
};

export type EmotionalCharacteristicEntry = {
  readonly emotional_id: string;
  readonly emotion_key: EmotionKey | string;
  readonly label: string;
  readonly intensity: EmotionIntensity;
  readonly execution_quality: ExecutionQuality;
  readonly summary: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type ProtectedAssetEntry = {
  readonly asset_id: string;
  readonly category: ProtectedAssetCategory;
  readonly label: string;
  readonly description: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly protection_level: ProtectionLevel;
  readonly linked_engine_id?: string | null;
  readonly linked_emotional_id?: string | null;
  readonly confidence: ProfileConfidenceLevel;
};

export type EditorialRiskEntry = {
  readonly risk_id: string;
  readonly label: string;
  readonly description: string;
  readonly severity: RiskSeverity;
  readonly likelihood: RiskLikelihood;
  readonly materiality: MaterialityLevel;
  readonly evidence: readonly EvidenceEntry[];
  readonly confidence: ProfileConfidenceLevel;
  readonly mitigation_direction: string;
  readonly blocks_specialist_coverage?: string | null;
};

export type SpecialistRequirementEntry = {
  readonly requirement_id: string;
  readonly domain_key: DomainKey | string;
  readonly requirement_level: RequirementLevel;
  readonly justification: string;
  readonly driving_characteristics: readonly string[];
  readonly evidence_summary: string;
  readonly confidence: ProfileConfidenceLevel;
  readonly author_intent_modifier: IntentModifier;
  readonly publication_state_modifier: PublicationStateModifier;
  readonly series_context_modifier: SeriesContextModifier;
};

export type CompSignal = {
  readonly signal_type: CompSignalType;
  readonly description: string;
  readonly evidence: readonly EvidenceEntry[];
  readonly is_author_comp: boolean;
};

export type CommercialCharacteristicsBlock = {
  readonly commercial_assessment_scope: CommercialAssessmentScope;
  readonly hook_strength: HookStrength;
  readonly hook_evidence: readonly EvidenceEntry[];
  readonly comp_alignment_signals: readonly CompSignal[];
  readonly market_lane_fit: MarketLaneFit;
  readonly market_lane_rationale: string;
  readonly differentiation_signals: readonly string[];
  readonly commercial_risks: readonly string[];
  readonly readiness_signal: ReadinessSignal;
  readonly confidence: ProfileConfidenceLevel;
  readonly author_market_framing_alignment: AuthorFramingAlignment;
};

export type SpecialistRequirementSummary = {
  readonly domain_key: string;
  readonly requirement_level: RequirementLevel;
  readonly priority_rank: number;
};

export type DistanceInputSignal = {
  readonly signal_key: string;
  readonly weight: "high" | "medium" | "low";
  readonly direction: "reduces_distance" | "increases_distance";
  readonly source_entry_ids: readonly string[];
  readonly preliminary?: boolean;
};

export type ReadinessInputSignal = {
  readonly signal_key: string;
  readonly weight: "high" | "medium" | "low";
  readonly source_entry_ids: readonly string[];
  readonly preliminary?: boolean;
};

export type SequencingHint = {
  readonly hint_key: string;
  readonly rationale: string;
  readonly preliminary?: boolean;
};

export type RoiHint = {
  readonly hint_key: string;
  readonly rationale: string;
  readonly preliminary?: boolean;
};

export type NextActionHint = {
  readonly hint_key: string;
  readonly rationale: string;
  readonly preliminary?: boolean;
};

export type RoadmapInputsBlock = {
  readonly destination_alignment: DestinationAlignment;
  readonly alignment_source: string;
  readonly primary_story_identity_key: string;
  readonly primary_engine_key: string;
  readonly top_protected_asset_ids: readonly string[];
  readonly top_editorial_risk_ids: readonly string[];
  readonly specialist_requirements_summary: readonly SpecialistRequirementSummary[];
  readonly distance_input_signals: readonly DistanceInputSignal[];
  readonly readiness_input_signals: readonly ReadinessInputSignal[];
  readonly sequencing_hints: readonly SequencingHint[];
  readonly roi_hints: readonly RoiHint[];
  readonly next_action_hints: readonly NextActionHint[];
  readonly regression_risk: RegressionRisk;
  readonly coverage_completeness: number;
};

export type ProfileConfidenceBlock = {
  readonly overall_confidence: ProfileConfidenceLevel;
  readonly independent_read_coverage: number;
  readonly sections_at_low_confidence: readonly string[];
  readonly evidence_depth: EvidenceDepth;
  readonly gaps_affecting_confidence: readonly string[];
};

export type ProvenanceBlock = {
  readonly author_intent_id: string;
  readonly independent_read_id: string;
  readonly editorial_understanding_id?: string | null;
  readonly manuscript_brief_id?: string | null;
  readonly synthesis_timestamp: string;
  readonly independent_read_coverage: number;
  readonly specialist_manuscript_access_count: number;
};

export type DisputeBlock = {
  readonly disputed_entry_ids: readonly string[];
  readonly author_reason: string;
  readonly opened_at: string;
  readonly resolution?: "accepted" | "revised" | "deferred" | null;
};

export type EditorialProfileV1 = {
  readonly contract_version: typeof EDITORIAL_PROFILE_CONTRACT_VERSION;
  readonly profile_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly author_intent_id: string;
  readonly independent_read_id: string;
  readonly editorial_understanding_id?: string | null;
  readonly manuscript_brief_id?: string | null;
  readonly status: EditorialProfileStatus;
  readonly dispute_metadata?: DisputeBlock | null;
  readonly supersedes_profile_id?: string | null;
  readonly superseded_by_profile_id?: string | null;
  readonly generated_at: string;
  readonly activated_at?: string | null;
  readonly trigger_event: EditorialProfileTriggerEvent;
  readonly synthesis_confidence: ProfileConfidenceBlock;
  readonly story_identity: StoryIdentityBlock;
  readonly story_engines: readonly StoryEngineEntry[];
  readonly editorial_characteristics: readonly EditorialCharacteristicEntry[];
  readonly technical_characteristics: readonly TechnicalCharacteristicEntry[];
  readonly emotional_characteristics: readonly EmotionalCharacteristicEntry[];
  readonly protected_assets: readonly ProtectedAssetEntry[];
  readonly editorial_risks: readonly EditorialRiskEntry[];
  readonly specialist_requirements: readonly SpecialistRequirementEntry[];
  readonly commercial_characteristics: CommercialCharacteristicsBlock;
  readonly roadmap_inputs: RoadmapInputsBlock;
  readonly provenance: ProvenanceBlock;
  readonly is_expert_finding: false;
  readonly is_manuscript_evidence: false;
  readonly is_author_intent: false;
};

export type EditorialProfileValidationError = {
  readonly code: string;
  readonly message: string;
  readonly section?: string;
};

export type EditorialProfileValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly EditorialProfileValidationError[] };

export type EditorialProfileActivationResult =
  | { readonly ok: true; readonly profile: EditorialProfileV1 }
  | { readonly ok: false; readonly errors: readonly EditorialProfileValidationError[] };

export type ProfileVersionChainEntry = {
  readonly profile_id: string;
  readonly status: EditorialProfileStatus;
  readonly supersedes_profile_id: string | null;
  readonly superseded_by_profile_id: string | null;
  readonly generated_at: string;
};
