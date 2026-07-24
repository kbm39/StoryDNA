/**
 * Canonical Literary Agent constitution definition hash for runtime version linkage.
 *
 * Single source of truth — do not duplicate this hash literal elsewhere.
 */
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { reviewerDefinitionToExpertDefinition } from "@/lib/expert-registry/adapters/reviewer-definition.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import type { ExpertDefinitionV1 } from "@/lib/expert-registry/types.ts";

/** Adapter options used for runtime constitution linkage (adapter-only projection). */
export const LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS: {
  category: ExpertDefinitionV1["identity"]["category"];
  department: string;
  version: string;
  lifecycleStatus: ExpertDefinitionV1["versioning"]["lifecycle_status"];
  evidenceProfileRefs: string[];
} = {
  category: "literary_agent",
  department: "Editorial",
  version: "v1-registry-mirror",
  lifecycleStatus: "draft",
  evidenceProfileRefs: ["COMMERCIAL", "EDITORIAL", "PUBLISHING"],
};

export function computeLiteraryAgentConstitutionDefinitionHash(): string {
  return hashExpertDefinition(
    reviewerDefinitionToExpertDefinition(LITERARY_AGENT, LITERARY_AGENT_CONSTITUTION_ADAPTER_OPTIONS),
  );
}

/** Canonical constitution-side hash referenced by Literary Agent runtime_versions. */
export const LITERARY_AGENT_CONSTITUTION_DEFINITION_HASH =
  computeLiteraryAgentConstitutionDefinitionHash();
