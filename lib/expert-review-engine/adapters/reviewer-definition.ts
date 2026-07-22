/**
 * Adapter: ReviewerDefinition (code) → ExpertRuntimeDefinition identity fields.
 *
 * Does not alter ReviewerDefinition behavior — read-only projection for parity tests.
 */

import type { ExpertRuntimeDefinition } from "../types.ts";

/** Minimal ReviewerDefinition shape for adapter input (matches certified LITERARY_AGENT). */
export interface ReviewerDefinitionSource {
  id: string;
  reviewer: string;
  perspective: string;
  mission: string;
  personality: ExpertRuntimeDefinition["personality"];
  expertise: { inScope: string[]; outOfScope: string[] };
  knowledgeDomains: ExpertRuntimeDefinition["knowledge_domains"];
  triggers: ExpertRuntimeDefinition["trigger_conditions"];
  prerequisites: Array<{ key: string; description: string; requires: string; onUnmet: string }>;
  priority: ExpertRuntimeDefinition["priority"];
  failureConditions: Array<{
    key: string;
    condition: string;
    severity: string;
    disclosure: string;
  }>;
  outputContract: {
    requiredFields: Array<{ key: string; description: string; values?: string[] }>;
  };
  recommendation?: {
    field: string;
    values: Array<{ value: string; meaning: string }>;
  };
}

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

export function reviewerDefinitionToRuntimeIdentity(
  def: ReviewerDefinitionSource,
): ReviewerRuntimeIdentityProjection {
  const recommendationValues =
    def.recommendation?.values.map((v) => v.value) ??
    def.outputContract.requiredFields.find((f) => f.key === "Decision")?.values ??
    [];

  return {
    expert_key: def.id,
    display_name: def.reviewer,
    role: def.perspective,
    purpose: def.mission,
    personality: def.personality,
    knowledge_domains: def.knowledgeDomains,
    prerequisites: def.prerequisites.map((p) => p.key),
    trigger_conditions: def.triggers,
    priority: def.priority,
    failure_conditions: def.failureConditions.map((f) => ({
      key: f.key,
      condition: f.condition,
      severity: f.severity as "abort" | "degrade" | "warn",
      disclosure: f.disclosure,
    })),
    recommendation_field_keys: def.outputContract.requiredFields.map((f) => f.key),
    recommendation_values: recommendationValues,
  };
}
