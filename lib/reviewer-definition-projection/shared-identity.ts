/**
 * Shared ReviewerDefinition → immutable identity projection (P2-09).
 *
 * Single allowlisted projection consumed by runtime and registry adapters.
 * Deep-clones all nested arrays/objects — never returns LITERARY_AGENT references.
 */

import type {
  ReviewerDefinitionPrioritySource,
  ReviewerDefinitionSharedInput,
  ReviewerFailureConditionProjection,
  ReviewerKnowledgeDomainProjection,
  ReviewerPersonalityProjection,
  ReviewerPrerequisiteProjection,
  ReviewerTriggerConditionProjection,
  SharedReviewerIdentityProjection,
} from "./types.ts";

function cloneStringList(values: readonly string[]): string[] {
  return [...values];
}

function clonePersonality(
  personality: ReviewerPersonalityProjection,
): ReviewerPersonalityProjection {
  return {
    archetype: personality.archetype,
    traits: cloneStringList(personality.traits),
    directness: personality.directness,
    warmth: personality.warmth,
    humor: personality.humor,
    voiceNotes: personality.voiceNotes,
  };
}

function cloneKnowledgeDomains(
  domains: readonly ReviewerKnowledgeDomainProjection[],
): ReviewerKnowledgeDomainProjection[] {
  return domains.map((domain) => ({
    name: domain.name,
    authorities: cloneStringList(domain.authorities),
    keyConcepts: cloneStringList(domain.keyConcepts),
    commonErrors: cloneStringList(domain.commonErrors),
  }));
}

function cloneTriggerConditions(
  triggers: readonly ReviewerTriggerConditionProjection[],
): ReviewerTriggerConditionProjection[] {
  return triggers.map((trigger) => ({
    key: trigger.key,
    description: trigger.description,
    signal: trigger.signal,
    match: trigger.match,
    weight: trigger.weight,
  }));
}

function clonePrerequisites(
  prerequisites: readonly ReviewerPrerequisiteProjection[],
): ReviewerPrerequisiteProjection[] {
  return prerequisites.map((prerequisite) => ({
    key: prerequisite.key,
    description: prerequisite.description,
    requires: prerequisite.requires,
    onUnmet: prerequisite.onUnmet,
  }));
}

function clonePrioritySource(
  priority: ReviewerDefinitionPrioritySource,
): ReviewerDefinitionPrioritySource {
  const cloned: ReviewerDefinitionPrioritySource = {
    tier: priority.tier,
    base: priority.base,
  };
  if (priority.runOrder !== undefined) {
    cloned.runOrder = priority.runOrder;
  }
  return cloned;
}

function cloneFailureConditions(
  failureConditions: ReviewerDefinitionSharedInput["failureConditions"],
): ReviewerFailureConditionProjection[] {
  return failureConditions.map((failure) => ({
    key: failure.key,
    condition: failure.condition,
    severity: failure.severity as ReviewerFailureConditionProjection["severity"],
    disclosure: failure.disclosure,
  }));
}

function deriveRecommendationValues(def: ReviewerDefinitionSharedInput): string[] {
  if (def.recommendation?.values.length) {
    return def.recommendation.values.map((entry) => entry.value);
  }
  const decisionField = def.outputContract.requiredFields.find((field) => field.key === "Decision");
  return decisionField?.values ? [...decisionField.values] : [];
}

/** Allowlisted runtime priority — excludes ReviewerDefinition-only orchestration fields. */
export function projectRuntimePriority(
  priority: ReviewerDefinitionPrioritySource,
): { tier: ReviewerDefinitionPrioritySource["tier"]; base: number } {
  return {
    tier: priority.tier,
    base: priority.base,
  };
}

export function projectSharedReviewerIdentity(
  def: ReviewerDefinitionSharedInput,
): SharedReviewerIdentityProjection {
  const prerequisites = clonePrerequisites(def.prerequisites);

  return {
    expert_key: def.id,
    display_name: def.reviewer,
    perspective: def.perspective,
    mission: def.mission,
    personality: clonePersonality(def.personality),
    knowledge_domains: cloneKnowledgeDomains(def.knowledgeDomains),
    trigger_conditions: cloneTriggerConditions(def.triggers),
    prerequisites,
    prerequisite_keys: prerequisites.map((prerequisite) => prerequisite.key),
    priority_source: clonePrioritySource(def.priority),
    failure_conditions: cloneFailureConditions(def.failureConditions),
    expertise_in_scope: cloneStringList(def.expertise.inScope),
    expertise_out_of_scope: cloneStringList(def.expertise.outOfScope),
    recommendation_field_keys: def.outputContract.requiredFields.map((field) => field.key),
    recommendation_values: deriveRecommendationValues(def),
  };
}
