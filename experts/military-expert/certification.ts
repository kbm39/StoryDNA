/**
 * Draft Military Expert certification harness — reports draft_not_certified.
 */

import { deepFreeze } from "@/lib/expert-review-engine/deep-freeze.ts";
import { validateExpertRuntimeDefinition } from "@/lib/expert-review-engine/validate-runtime-definition.ts";
import { verifyAdvertisedModuleRefs } from "@/lib/expert-review-engine/verify-module-refs.ts";
import { validateExpertDefinition } from "@/lib/expert-registry/schema.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH,
} from "@/lib/expert-review-engine/literary-agent-constitution-hash.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import { militaryExpertRegistryDefinitionV1 } from "@/lib/expert-registry/seed/military-expert-registry.v1.ts";
import { MILITARY_EXPERT } from "./definition.ts";
import {
  MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH,
  computeMilitaryExpertConstitutionDefinitionHash,
} from "./military-expert-constitution-hash.ts";
import { buildValidMilitaryExpertReview, buildInvalidMilitaryExpertReview } from "./fixtures.ts";
import { normalizeMilitaryExpertReview } from "./normalization.ts";
import { validateMilitaryExpertReview } from "./validation.ts";
import { militaryExpertRuntimeDefinition } from "./runtime-definition.ts";

const EXPECTED_LA_RUNTIME_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";
const EXPECTED_LA_CONSTITUTION_HASH =
  "8f8b56a9de6c7d68f96fd7913645905ee2afb8ce7d0c066faba2c28106fe94f5";
const EXPECTED_LA_REGISTRY_SEED_HASH =
  "f6b79bc07d7ba9630fb532c67c31c4b80bac2886002696e25290d163e4b44671";

export type MilitaryExpertCertificationStatus = "draft_not_certified";

export interface MilitaryExpertDraftCertificationReport {
  certification_status: MilitaryExpertCertificationStatus;
  expert_key: string;
  expert_version: string;
  constitution_definition_hash: string;
  runtime_definition_hash: string;
  registry_definition_hash: string;
  definition_validation_ok: boolean;
  runtime_validation_ok: boolean;
  module_refs_ok: boolean;
  valid_review_passes: boolean;
  invalid_review_fails_closed: boolean;
  normalization_deterministic: boolean;
  literary_agent_runtime_hash_unchanged: boolean;
  literary_agent_constitution_hash_unchanged: boolean;
  literary_agent_registry_seed_hash_unchanged: boolean;
  errors: string[];
}

export async function runMilitaryExpertDraftCertification(): Promise<MilitaryExpertDraftCertificationReport> {
  const errors: string[] = [];
  const runtime = militaryExpertRuntimeDefinition();
  const registryDefinition = militaryExpertRegistryDefinitionV1();

  const definitionValidation = validateExpertDefinition(registryDefinition);
  if (!definitionValidation.ok) {
    errors.push(...definitionValidation.errors);
  }

  const runtimeValidation = validateExpertRuntimeDefinition(runtime);
  if (!runtimeValidation.ok) {
    errors.push(...runtimeValidation.errors);
  }

  const moduleRefs = await verifyAdvertisedModuleRefs(runtime);
  if (!moduleRefs.ok) {
    errors.push(...moduleRefs.failures.map((failure) => failure.reason));
  }

  const validReview = normalizeMilitaryExpertReview(buildValidMilitaryExpertReview());
  validReview.definition_hash = runtime.runtime_versions.definition_hash;
  const validResult = validateMilitaryExpertReview(validReview, {
    expectedDefinitionHash: runtime.runtime_versions.definition_hash,
  });

  const invalidReview = buildInvalidMilitaryExpertReview();
  const invalidResult = validateMilitaryExpertReview(invalidReview);

  const normalizedOnce = normalizeMilitaryExpertReview(validReview);
  const normalizedTwice = normalizeMilitaryExpertReview(normalizeMilitaryExpertReview(validReview));
  const normalizationDeterministic =
    JSON.stringify(normalizedOnce) === JSON.stringify(normalizedTwice);

  const constitutionHash = computeMilitaryExpertConstitutionDefinitionHash();
  const runtimeHash = hashExpertRuntimeDefinition(runtime);
  const registryHash = hashExpertDefinition(registryDefinition);

  const laRuntimeHash = hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
  const laConstitutionHash = LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH;
  const laRegistrySeedHash = hashExpertDefinition(literaryAgentRegistryDefinitionV1());

  deepFreeze(structuredClone(MILITARY_EXPERT));
  deepFreeze(structuredClone(runtime));

  if (constitutionHash !== MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH) {
    errors.push("constitution hash mismatch against canonical export");
  }

  if (runtimeHash !== runtime.runtime_versions.definition_hash) {
    errors.push("runtime hash mismatch against runtime_versions.definition_hash");
  }

  return {
    certification_status: "draft_not_certified",
    expert_key: runtime.expert_key,
    expert_version: runtime.expert_version,
    constitution_definition_hash: constitutionHash,
    runtime_definition_hash: runtimeHash,
    registry_definition_hash: registryHash,
    definition_validation_ok: definitionValidation.ok,
    runtime_validation_ok: runtimeValidation.ok,
    module_refs_ok: moduleRefs.ok,
    valid_review_passes: validResult.ok,
    invalid_review_fails_closed: !invalidResult.ok,
    normalization_deterministic: normalizationDeterministic,
    literary_agent_runtime_hash_unchanged: laRuntimeHash === EXPECTED_LA_RUNTIME_HASH,
    literary_agent_constitution_hash_unchanged: laConstitutionHash === EXPECTED_LA_CONSTITUTION_HASH,
    literary_agent_registry_seed_hash_unchanged: laRegistrySeedHash === EXPECTED_LA_REGISTRY_SEED_HASH,
    errors,
  };
}
