/**
 * storydna_capability_propagation_review@v1
 * Machine-readable contract for Capability Propagation Review (Amendment 001).
 */

export const CAPABILITY_PROPAGATION_CONTRACT_VERSION =
  "storydna_capability_propagation_review@v1" as const;

export const CAPABILITY_CLASSIFICATIONS = [
  "expert_specific",
  "expert_family",
  "editorial_board_shared",
  "editor_in_chief_owned",
  "platform_wide",
] as const;

export type CapabilityClassification = (typeof CAPABILITY_CLASSIFICATIONS)[number];

export const CAPABILITY_REVIEW_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "approved_with_conditions",
  "rejected",
  "deferred",
  "superseded",
] as const;

export type CapabilityReviewStatus = (typeof CAPABILITY_REVIEW_STATUSES)[number];

export const PROPAGATION_DECISIONS = [
  "keep_expert_specific",
  "propagate_to_expert_family",
  "propagate_to_all_experts",
  "move_to_editor_in_chief",
  "move_to_platform",
  "split_capability",
  "defer_pending_certification",
  "reject_capability",
] as const;

export type PropagationDecision = (typeof PROPAGATION_DECISIONS)[number];

/** Known StoryDNA experts for retrospective review sections. */
export const STORYDNA_EXPERT_KEYS = [
  "literary_agent",
  "military_expert",
  "developmental_editor",
  "thriller_editor",
  "combat_medicine_expert",
  "medical_expert",
  "financial_crimes_expert",
  "intelligence_expert",
  "character_expert",
  "timeline_expert",
  "continuity_expert",
  "archivist",
  "line_editor",
  "psychologist",
  "research_librarian",
  "security_construction_expert",
] as const;

export type StoryDnaExpertKey = (typeof STORYDNA_EXPERT_KEYS)[number];

export type RetrospectiveExpertAssessment = {
  expert_key: StoryDnaExpertKey;
  applicable: "yes" | "no" | "later";
  reason: string;
  implementation_status?: string;
  certification_status?: string;
  required_migration?: string;
  required_tests?: string;
};

export type CapabilityPropagationReviewV1 = {
  contract_version: typeof CAPABILITY_PROPAGATION_CONTRACT_VERSION;
  capability_id: string;
  capability_name: string;
  capability_description: string;
  source_expert_key: string;
  source_feature: string;
  introduced_in_commit: string;
  introduced_at: string;
  current_implementation_scope: string;
  proposed_classification: CapabilityClassification;
  final_classification: CapabilityClassification;
  affected_existing_experts: string[];
  affected_future_expert_families: string[];
  editor_in_chief_impact: string;
  platform_impact: string;
  author_experience_impact: string;
  report_impact: string;
  revision_board_impact: string;
  series_continuity_impact: string;
  publication_state_impact: string;
  canon_impact: string;
  cost_impact: string;
  runtime_impact: string;
  safety_impact: string;
  certification_impact: string;
  schema_impact: string;
  migration_required: boolean;
  backward_compatibility_impact: string;
  historical_data_impact: string;
  propagation_decision: PropagationDecision;
  propagation_reason: string;
  exclusions: string[];
  required_follow_up_tasks: string[];
  constitution_sections: string[];
  retrospective_expert_assessments?: RetrospectiveExpertAssessment[];
  isolation_reason?: string;
  reviewed_by: string;
  reviewed_at: string;
  status: CapabilityReviewStatus;
  version: number;
};

export type CapabilityRegistryEntry = {
  capability_id: string;
  name: string;
  first_implementation: string;
  current_classification: CapabilityClassification;
  experts_using: string[];
  experts_evaluated_excluded: string[];
  constitutional_review_status: CapabilityReviewStatus | "pending_retrospective";
  certification_status: string;
  source_documentation: string;
};

export type CapabilityRegistryV1 = {
  registry_version: "storydna_capability_registry@v1";
  constitution_version: "1.0";
  amendment_version: "1.1.0";
  updated_at: string;
  capabilities: CapabilityRegistryEntry[];
};

/** Front-matter block for design docs declaring no new capability. */
export type NoNewCapabilityDeclaration = {
  no_new_capability: true;
  rationale: string;
};

/** Required Constitution Compliance block in feature PRDs. */
export type ConstitutionComplianceBlock = {
  applicable_sections: string[];
  compliance_explanation: string;
  amendment_required: "Yes" | "No";
  backward_compatibility_impact: string;
  certification_impact: string;
};

/** Parsed Capability Propagation Review block from markdown front matter or JSON. */
export type CapabilityPropagationReviewBlock = {
  new_capability_introduced: string;
  existing_capability_modified: string;
  classification: CapabilityClassification;
  existing_experts_evaluated: string[];
  future_experts_affected: string[];
  editor_in_chief_impact: string;
  platform_impact: string;
  certification_impact: string;
  propagation_decision: PropagationDecision;
  review_artifact_path: string;
};
