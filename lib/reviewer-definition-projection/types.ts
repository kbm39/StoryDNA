/**
 * Shared ReviewerDefinition projection types (P2-09).
 *
 * Common input/output shapes consumed by both runtime and registry adapters.
 * Does not include runtime module refs, registry lifecycle, or hash fields.
 */

export interface ReviewerDefinitionPrioritySource {
  tier: "core" | "standard" | "specialist";
  base: number;
  runOrder?: number;
}

export interface ReviewerPersonalityProjection {
  archetype: string;
  traits: string[];
  directness: string;
  warmth: string;
  humor: string;
  voiceNotes: string;
}

export interface ReviewerKnowledgeDomainProjection {
  name: string;
  authorities: string[];
  keyConcepts: string[];
  commonErrors: string[];
}

export interface ReviewerTriggerConditionProjection {
  key: string;
  description: string;
  signal: string;
  match: string;
  weight: number;
}

export interface ReviewerPrerequisiteProjection {
  key: string;
  description: string;
  requires: string;
  onUnmet: string;
}

export interface ReviewerFailureConditionProjection {
  key: string;
  condition: string;
  severity: "abort" | "degrade" | "warn";
  disclosure: string;
}

export interface ReviewerOutputRequiredFieldProjection {
  key: string;
  description: string;
  values?: string[];
}

/** Fields both adapters read from ReviewerDefinition for shared identity projection. */
export interface ReviewerDefinitionSharedInput {
  id: string;
  reviewer: string;
  perspective: string;
  mission: string;
  personality: ReviewerPersonalityProjection;
  expertise: { inScope: string[]; outOfScope: string[] };
  knowledgeDomains: ReviewerKnowledgeDomainProjection[];
  triggers: ReviewerTriggerConditionProjection[];
  prerequisites: ReviewerPrerequisiteProjection[];
  priority: ReviewerDefinitionPrioritySource;
  failureConditions: Array<{
    key: string;
    condition: string;
    severity: string;
    disclosure: string;
  }>;
  outputContract: {
    requiredFields: ReviewerOutputRequiredFieldProjection[];
  };
  recommendation?: {
    field: string;
    values: Array<{ value: string; meaning: string }>;
  };
}

/** Immutable shared identity projection — deep-owned nested data only. */
export interface SharedReviewerIdentityProjection {
  expert_key: string;
  display_name: string;
  perspective: string;
  mission: string;
  personality: ReviewerPersonalityProjection;
  knowledge_domains: ReviewerKnowledgeDomainProjection[];
  trigger_conditions: ReviewerTriggerConditionProjection[];
  prerequisites: ReviewerPrerequisiteProjection[];
  prerequisite_keys: string[];
  priority_source: ReviewerDefinitionPrioritySource;
  failure_conditions: ReviewerFailureConditionProjection[];
  expertise_in_scope: string[];
  expertise_out_of_scope: string[];
  recommendation_field_keys: string[];
  recommendation_values: string[];
}
