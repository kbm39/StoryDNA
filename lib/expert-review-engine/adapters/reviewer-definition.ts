/**
 * Adapter: ReviewerDefinition (code) → ExpertRuntimeDefinition identity fields.
 *
 * Consumes the shared reviewer identity projection; applies runtime-specific mapping only.
 */

import {
  projectRuntimePriority,
  projectSharedReviewerIdentity,
} from "@/lib/reviewer-definition-projection/shared-identity.ts";
import type {
  ReviewerDefinitionPrioritySource,
  ReviewerDefinitionSharedInput,
} from "@/lib/reviewer-definition-projection/types.ts";
import type { ExpertRuntimeDefinition } from "../types.ts";

export type { ReviewerDefinitionPrioritySource, ReviewerDefinitionSharedInput as ReviewerDefinitionSource };

export interface ReviewerRuntimeIdentityProjection {
  expert_key: string;
  display_name: string;
  role: string;
  purpose: string;
  personality: ExpertRuntimeDefinition["personality"];
  knowledge_domains: ExpertRuntimeDefinition["knowledge_domains"];
  prerequisites: string[];
  trigger_conditions: ExpertRuntimeDefinition["trigger_conditions"];
  priority: ExpertRuntimeDefinition["priority"];
  failure_conditions: ExpertRuntimeDefinition["failure_conditions"];
  recommendation_field_keys: string[];
  recommendation_values: string[];
}

export { projectRuntimePriority };

export function reviewerDefinitionToRuntimeIdentity(
  def: ReviewerDefinitionSharedInput,
): ReviewerRuntimeIdentityProjection {
  const shared = projectSharedReviewerIdentity(def);

  return {
    expert_key: shared.expert_key,
    display_name: shared.display_name,
    role: shared.perspective,
    purpose: shared.mission,
    personality: shared.personality,
    knowledge_domains: shared.knowledge_domains,
    prerequisites: shared.prerequisite_keys,
    trigger_conditions: shared.trigger_conditions,
    priority: projectRuntimePriority(shared.priority_source),
    failure_conditions: shared.failure_conditions,
    recommendation_field_keys: shared.recommendation_field_keys,
    recommendation_values: shared.recommendation_values,
  };
}
