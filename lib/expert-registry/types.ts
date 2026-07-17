/**
 * Expert Registry — structured expert definition types.
 *
 * Conceptual layers (professional constitution, not a prompt repository):
 * Identity → Professional Standards → Knowledge Domains → Competencies → Limitations
 * → Evaluation Framework → Evidence Policy → Execution Profile
 */

import type { ConfidenceLevel, EvidenceType, MaterialOutputType } from "./evidence-types.ts";

export const EXPERT_SCHEMA_VERSION = "expert_definition@v1" as const;

export const EXPERT_SCOPES = ["platform", "project", "dynamic", "custom"] as const;
export type ExpertScope = (typeof EXPERT_SCOPES)[number];

export const EXPERT_ENTITY_STATUSES = ["active", "archived"] as const;
export type ExpertEntityStatus = (typeof EXPERT_ENTITY_STATUSES)[number];

export const EXPERT_LIFECYCLE_STATUSES = ["draft", "active", "deprecated", "archived"] as const;
export type ExpertLifecycleStatus = (typeof EXPERT_LIFECYCLE_STATUSES)[number];

export const EXPERT_CATEGORIES = [
  "editor_in_chief",
  "literary_agent",
  "developmental_editor",
  "line_editor",
  "copy_editor",
  "character_expert",
  "dialogue_expert",
  "plot_expert",
  "pacing_expert",
  "archivist_continuity",
  "librarian",
  "fact_checker",
  "psychologist",
  "police_expert",
  "military_expert",
  "medical_expert",
  "legal_expert",
  "construction_expert",
  "romance_expert",
  "producer",
  "screenwriter",
  "marketing_strategist",
  "publicist",
  "audience_expert",
] as const;

export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];

export const EXPERT_VERSION_EVENT_TYPES = [
  "created",
  "activated",
  "deprecated",
  "archived",
  "superseded",
  "validation_failed",
  "seed_updated",
] as const;

export type ExpertVersionEventType = (typeof EXPERT_VERSION_EVENT_TYPES)[number];

export interface TriggerCondition {
  key: string;
  description: string;
  signal: string;
  match: string;
  weight: number;
}

export interface ExpertPriority {
  tier: "core" | "standard" | "specialist";
  base: number;
}

export interface EvaluationCategory {
  key: string;
  name: string;
  weight?: number;
  questions: string[];
}

export interface FailureCondition {
  key: string;
  condition: string;
  severity: "abort" | "degrade" | "warn";
  disclosure: string;
}

export interface KnowledgeDomain {
  name: string;
  authorities: string[];
  keyConcepts: string[];
  commonErrors: string[];
}

export interface EvidenceRequirement {
  output_type: MaterialOutputType;
  minimum_records: number;
  required_fields: string[];
  allowed_types: EvidenceType[];
}

export interface ManuscriptAnchorRequirements {
  require_version_id: boolean;
  require_locator: boolean;
  max_excerpt_words: number;
  require_verification: boolean;
}

export interface ExternalSourceRequirements {
  required_when: string[];
  minimum_reliability: "high" | "moderate" | "low";
  require_citation_fields: string[];
}

export interface CitationRequirements {
  format: "structured" | "narrative";
  allow_urls: boolean;
  allow_doi: boolean;
}

export interface VerificationRequirements {
  author_can_locate_independently: boolean;
  block_on_fabricated_quotes: boolean;
}

export interface ContraryEvidenceRequirements {
  required_for_repeat_criticism: boolean;
  search_current_manuscript: boolean;
  statuses_allowed_without_deduction: string[];
}

export interface ConfidenceRules {
  levels: ConfidenceLevel[];
  require_explanation: boolean;
  block_publish_on_insufficient: boolean;
}

export interface ConfidenceThresholds {
  minimum_for_material_claims: ConfidenceLevel;
  block_on_insufficient: boolean;
}

export interface EvidencePolicyOverrides {
  additional_allowed_types?: EvidenceType[];
  stricter_minimum_records?: Partial<Record<MaterialOutputType, number>>;
  stricter_manuscript_anchor?: Partial<ManuscriptAnchorRequirements>;
}

export interface ResearchPermissions {
  allow_external_lookup: boolean;
  allow_author_provided_sources: boolean;
}

export interface SourceRequirements {
  minimum_reliability_for_facts: "high" | "moderate" | "low";
}

/** What the expert should, may, and must not evaluate — used by future Editor-in-Chief. */
export interface ProfessionalResponsibility {
  /** Core mandate — primary evaluation scope. */
  should_evaluate: string[];
  /** Permitted but not primary — evaluate only when appropriate or requested. */
  may_evaluate: string[];
  /** Explicit out-of-scope — defer to a named specialist; never publish as established findings. */
  must_not_evaluate: string[];
}

/**
 * Future per-domain confidence (0–100). Phase 1 stores declarative ceilings only;
 * Expert Runtime may compute live values in Phase 2+.
 */
export interface DomainConfidenceEntry {
  domain: string;
  /** 0–100; optional in Phase 1 — registry-declared competency ceiling, not runtime-computed. */
  confidence_percent?: number;
  notes?: string;
}

export interface InputSpec {
  key: string;
  type: string;
  description?: string;
}

export interface ExpertDefinitionV1 {
  schema_version: typeof EXPERT_SCHEMA_VERSION;

  identity: {
    expert_key: string;
    display_name: string;
    title: string;
    description: string;
    department: string;
    category: ExpertCategory;
    role_boundaries?: string[];
    collaboration_role?: string;
  };

  purpose: {
    mission: string;
    responsibilities: string[];
    non_responsibilities: string[];
    intended_use: string[];
    prerequisites: string[];
    trigger_conditions: TriggerCondition[];
    priority: ExpertPriority;
  };

  professional_standards: {
    principles: string[];
    ethics: string[];
    author_respect_rules: string[];
    evidence_standards: string[];
    verification_standards: string[];
    bias_avoidance_rules: string[];
    disclosure_requirements: string[];
    uncertainty_rules: string[];
    conflict_handling_rules: string[];
    confidence_thresholds: ConfidenceThresholds;
    source_integrity_rules: string[];
    non_fabrication_rules: string[];
    contrary_evidence_obligations: string[];
    escalation_rules: string[];
    specialist_deference_rules: string[];
    prediction_and_market_limitations: string[];
  };

  evaluation_framework: {
    categories: EvaluationCategory[];
    review_methodology: string[];
    reasoning_rules: string[];
    issue_priority_rules: string[];
    severity_logic?: string[];
    completion_requirements: string[];
    failure_conditions: FailureCondition[];
    safety_boundaries: string[];
    collaboration_rules: string[];
    exclusions: string[];
  };

  evidence_policy: {
    profile_refs: string[];
    allowed_evidence_types: EvidenceType[];
    per_output_requirements: EvidenceRequirement[];
    manuscript_anchor_requirements: ManuscriptAnchorRequirements;
    external_source_requirements: ExternalSourceRequirements;
    citation_requirements: CitationRequirements;
    verification_requirements: VerificationRequirements;
    contrary_evidence_requirements: ContraryEvidenceRequirements;
    insufficient_evidence_behavior: "block" | "downgrade" | "flag";
    confidence_rules: ConfidenceRules;
    expert_specific_overrides?: EvidencePolicyOverrides;
  };

  knowledge: {
    /** What the expert understands (authorities, concepts, common errors). */
    knowledge_domains: KnowledgeDomain[];
    /** What the expert is qualified to evaluate. */
    competencies: string[];
    /** What the expert is NOT qualified to evaluate — triggers specialist referral. */
    limitations: string[];
    professional_responsibility: ProfessionalResponsibility;
    /** Reserved for Phase 2+ domain-scoped confidence; optional declarative ceilings in Phase 1. */
    domain_confidence?: DomainConfidenceEntry[];
    research_permissions: ResearchPermissions;
    source_requirements: SourceRequirements;
  };

  io: {
    required_inputs: InputSpec[];
    optional_inputs: InputSpec[];
    output_schema_refs: string[];
    artifact_types: string[];
    issue_types: string[];
    recommendation_types: string[];
    completion_requirements: string[];
  };

  execution_profile: {
    preferred_model_capabilities: string[];
    context_strategy: "full_manuscript" | "segmented" | "retrieval";
    estimated_runtime_class: "short" | "medium" | "long";
    estimated_cost_class: "low" | "medium" | "high";
    parallel_safe: boolean;
    workflow_compatibility: string[];
  };

  versioning: {
    version: string;
    lifecycle_status: ExpertLifecycleStatus;
    change_summary?: string;
  };

  /** Registry metadata — not used for prompt assembly in Phase 1. */
  registry_metadata?: {
    runtime_source?: string;
    /** When false, Publishing Workflow must not load this definition at runtime. */
    execution_wired?: boolean;
    notes?: string;
    /** Future: workflows execute via expert_version_id (Execute Expert, not Execute Literary Agent). */
    execution_model?: "expert_version";
  };
}

export interface ExpertRow {
  id: string;
  expert_key: string;
  scope: ExpertScope;
  manuscript_id: string | null;
  series_id: string | null;
  display_name: string;
  title: string | null;
  description: string | null;
  department: string | null;
  category: ExpertCategory;
  status: ExpertEntityStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpertVersionRow {
  id: string;
  expert_id: string;
  version: string;
  lifecycle_status: ExpertLifecycleStatus;
  schema_version: string;
  definition: ExpertDefinitionV1;
  definition_hash: string;
  mission: string | null;
  purpose: string | null;
  professional_standards_summary: string | null;
  supersedes_version_id: string | null;
  change_summary: string | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpertVersionEventRow {
  id: string;
  expert_version_id: string;
  event_type: ExpertVersionEventType;
  details: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

/** Future reference type for reviews/workflows — not wired in Phase 1. */
export interface ExpertVersionRef {
  expert_version_id: string;
  expert_key: string;
  version: string;
  definition_hash: string;
}
