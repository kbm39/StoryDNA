/**
 * Validates ExpertRuntimeDefinition before registry registration.
 */

import {
  EXPERT_CAPABILITIES,
  EXPERT_RUNTIME_SCHEMA_VERSION,
  type ExpertCapability,
  type ExpertRuntimeDefinition,
  hashExpertRuntimeDefinition,
  validateReviewRuntimeVersionSet,
} from "./types.ts";
import { validateEditorInChiefRelationshipRules } from "./expert-relationships.ts";
import { validateExpertScoringWeights } from "./scoring-weights.ts";

const EXPERT_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateOptionalModuleExportPair(
  label: string,
  moduleId: string | undefined,
  exportName: string | undefined,
): string | null {
  const hasModule = Boolean(moduleId?.trim());
  const hasExport = Boolean(exportName?.trim());
  if (hasModule !== hasExport) {
    return `${label}: moduleId and exportName must both be set or both be absent`;
  }
  return null;
}

export function isExpertCapability(value: string): value is ExpertCapability {
  return (EXPERT_CAPABILITIES as readonly string[]).includes(value);
}

export function validateExpertRuntimeDefinition(
  def: ExpertRuntimeDefinition,
): { ok: true; definitionHash: string } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (def.schema_version !== EXPERT_RUNTIME_SCHEMA_VERSION) {
    errors.push(`Invalid schema_version: ${def.schema_version}`);
  }

  if (!def.expert_key || !EXPERT_KEY_PATTERN.test(def.expert_key)) {
    errors.push("Invalid expert_key");
  }

  if (!def.expert_version?.trim()) {
    errors.push("Missing expert_version");
  }

  if (!def.display_name?.trim()) errors.push("Missing display_name");
  if (!def.department?.trim()) errors.push("Missing department");
  if (!def.role?.trim()) errors.push("Missing role");
  if (!def.purpose?.trim()) errors.push("Missing purpose");

  if (!Array.isArray(def.capabilities) || def.capabilities.length === 0) {
    errors.push("capabilities must be non-empty");
  } else {
    for (const cap of def.capabilities) {
      if (!isExpertCapability(cap)) {
        errors.push(`Unknown capability: ${cap}`);
      }
    }
  }

  if (!def.generation_profile?.id?.trim()) {
    errors.push("Missing generation_profile.id");
  }
  if (!Array.isArray(def.generation_profile?.calls) || def.generation_profile.calls.length === 0) {
    errors.push("generation_profile.calls must be non-empty");
  }

  if (!def.prompt_builder?.reviewerDefinitionModuleId) {
    errors.push("Missing prompt_builder.reviewerDefinitionModuleId");
  }

  if (!def.publishing_policy?.rpcName) {
    errors.push("Missing publishing_policy.rpcName");
  }

  if (!def.passage_verification_policy?.payloadBuilderModuleId) {
    errors.push("Missing passage_verification_policy");
  }

  const rubricPairError = validateOptionalModuleExportPair(
    "rubric_definition",
    def.rubric_definition.moduleId,
    def.rubric_definition.exportName,
  );
  if (rubricPairError) errors.push(rubricPairError);

  const docxPairError = validateOptionalModuleExportPair(
    "export_policy",
    def.export_policy.docxModuleId,
    def.export_policy.docxExportName,
  );
  if (docxPairError) errors.push(docxPairError);

  errors.push(
    ...validateEditorInChiefRelationshipRules(def.expert_key, def.editor_in_chief_rules),
  );

  const scoringWeightsCheck = validateExpertScoringWeights(def.scoring_weights);
  if (!scoringWeightsCheck.ok) {
    errors.push(...scoringWeightsCheck.errors);
  }

  const versionCheck = validateReviewRuntimeVersionSet(def.runtime_versions);
  if (!versionCheck.ok) {
    errors.push(...versionCheck.errors);
  }

  const computedHash = hashExpertRuntimeDefinition(def);
  if (def.runtime_versions.definition_hash !== computedHash) {
    errors.push("runtime_versions.definition_hash does not match computed definition hash");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, definitionHash: computedHash };
}
