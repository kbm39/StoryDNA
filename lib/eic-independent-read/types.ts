import type {
  AuthorFramingAlignment,
  DestinationAlignment,
  EditorialAssessment,
  EditorialCharacteristicDomain,
  EmotionIntensity,
  EmotionKey,
  EngineKey,
  EngineRole,
  EvidencePolarity,
  ExecutionQuality,
  HookStrength,
  IdentityKey,
  MarketLaneFit,
  MaterialityLevel,
  ProfileConfidenceLevel,
  ProtectedAssetCategory,
  ProtectionLevel,
  ReadinessSignal,
  RiskLikelihood,
  RiskSeverity,
  SpecialistNeedLevel,
  DomainKey,
} from "@/lib/editorial-profile/contract.ts";
import { EIC_INDEPENDENT_READ_CONTRACT_VERSION } from "./contract.ts";
import type { IndependentReadStatus } from "./contract.ts";

export type IndependentReadLocator = {
  readonly chapter_id?: string | null;
  readonly chapter_label: string;
  readonly scene_id?: string | null;
  readonly paragraph_range?: string | null;
  readonly word_offset_start?: number | null;
  readonly word_offset_end?: number | null;
};

/** L2 observation grounded in L1 manuscript text — required for profile synthesis. */
export type IndependentReadEvidence = {
  readonly evidence_id: string;
  readonly locator: IndependentReadLocator;
  readonly excerpt?: string | null;
  readonly observation: string;
  readonly polarity: EvidencePolarity;
  readonly source: "manuscript";
  readonly grounded_in_manuscript: true;
};

export type IndependentReadIdentitySignal = {
  readonly identity_key: IdentityKey | string;
  readonly label: string;
  readonly demonstration_summary: string;
  readonly secondary_identities?: readonly {
    readonly identity_key: IdentityKey | string;
    readonly label: string;
    readonly demonstration_summary: string;
    readonly evidence: readonly IndependentReadEvidence[];
  }[];
  readonly evidence: readonly IndependentReadEvidence[];
  readonly confidence: ProfileConfidenceLevel;
};

export type IndependentReadEngineSignal = {
  readonly engine_id: string;
  readonly engine_key: EngineKey | string;
  readonly label: string;
  readonly role: EngineRole;
  readonly demonstration_summary: string;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type IndependentReadEditorialSignal = {
  readonly characteristic_id: string;
  readonly domain: EditorialCharacteristicDomain;
  readonly label: string;
  readonly assessment: EditorialAssessment;
  readonly summary: string;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type IndependentReadTechnicalSignal = {
  readonly technical_id: string;
  readonly domain_key: DomainKey | string;
  readonly label: string;
  readonly observation: string;
  readonly materiality: MaterialityLevel;
  readonly confidence: ProfileConfidenceLevel;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly specialist_need: SpecialistNeedLevel;
  readonly specialist_need_rationale: string;
};

export type IndependentReadEmotionalSignal = {
  readonly emotional_id: string;
  readonly emotion_key: EmotionKey | string;
  readonly label: string;
  readonly intensity: EmotionIntensity;
  readonly execution_quality: ExecutionQuality;
  readonly summary: string;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly confidence: ProfileConfidenceLevel;
  readonly materiality: MaterialityLevel;
};

export type IndependentReadAssetSignal = {
  readonly asset_id: string;
  readonly category: ProtectedAssetCategory;
  readonly label: string;
  readonly description: string;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly protection_level: ProtectionLevel;
  readonly linked_engine_id?: string | null;
  readonly linked_emotional_id?: string | null;
  readonly confidence: ProfileConfidenceLevel;
};

export type IndependentReadRiskSignal = {
  readonly risk_id: string;
  readonly label: string;
  readonly description: string;
  readonly severity: RiskSeverity;
  readonly likelihood: RiskLikelihood;
  readonly materiality: MaterialityLevel;
  readonly evidence: readonly IndependentReadEvidence[];
  readonly confidence: ProfileConfidenceLevel;
  readonly mitigation_direction: string;
  readonly blocks_specialist_coverage?: string | null;
};

export type IndependentReadCommercialSignal = {
  readonly hook_strength: HookStrength;
  readonly hook_evidence: readonly IndependentReadEvidence[];
  readonly market_lane_fit: MarketLaneFit;
  readonly market_lane_rationale: string;
  readonly differentiation_signals: readonly string[];
  readonly commercial_risks: readonly string[];
  readonly readiness_signal: ReadinessSignal;
  readonly confidence: ProfileConfidenceLevel;
  readonly author_market_framing?: string | null;
};

export type IndependentReadVisionAlignment = {
  readonly destination_alignment: DestinationAlignment;
  readonly alignment_source: string;
  readonly unresolved_questions?: readonly string[];
};

export type EicIndependentReadV1 = {
  readonly contract_version: typeof EIC_INDEPENDENT_READ_CONTRACT_VERSION;
  readonly independent_read_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly status: IndependentReadStatus;
  readonly coverage_percent: number;
  readonly completed_at: string | null;
  readonly specialist_manuscript_access_count: number;
  readonly story_identity: IndependentReadIdentitySignal;
  readonly story_engines: readonly IndependentReadEngineSignal[];
  readonly editorial_characteristics: readonly IndependentReadEditorialSignal[];
  readonly technical_characteristics: readonly IndependentReadTechnicalSignal[];
  readonly emotional_characteristics: readonly IndependentReadEmotionalSignal[];
  readonly protected_assets: readonly IndependentReadAssetSignal[];
  readonly editorial_risks: readonly IndependentReadRiskSignal[];
  readonly commercial_signals: IndependentReadCommercialSignal;
  readonly vision_alignment?: IndependentReadVisionAlignment | null;
  readonly is_expert_finding: false;
};
