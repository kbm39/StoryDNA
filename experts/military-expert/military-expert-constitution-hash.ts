/**
 * Military Expert constitution definition hash via reviewerDefinitionToExpertDefinition adapter.
 */

import { MILITARY_EXPERT } from "./definition.ts";
import { reviewerDefinitionToExpertDefinition } from "@/lib/expert-registry/adapters/reviewer-definition.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import type { ExpertDefinitionV1 } from "@/lib/expert-registry/types.ts";

export const MILITARY_EXPERT_CONSTITUTION_ADAPTER_OPTIONS: {
  category: ExpertDefinitionV1["identity"]["category"];
  department: string;
  version: string;
  lifecycleStatus: ExpertDefinitionV1["versioning"]["lifecycle_status"];
  evidenceProfileRefs: string[];
  changeSummary: string;
  registryMetadata: ExpertDefinitionV1["registry_metadata"];
} = {
  category: "military_expert",
  department: "Research",
  version: "v1.0.0-draft",
  lifecycleStatus: "draft",
  evidenceProfileRefs: ["EDITORIAL", "RESEARCH"],
  changeSummary: "Initial Military Expert registry definition — draft, not runtime-wired.",
  registryMetadata: {
    execution_wired: false,
    notes: "Draft Military Expert — not certified or production-enabled.",
  },
};

export function computeMilitaryExpertConstitutionDefinitionHash(): string {
  return hashExpertDefinition(
    reviewerDefinitionToExpertDefinition(MILITARY_EXPERT, MILITARY_EXPERT_CONSTITUTION_ADAPTER_OPTIONS),
  );
}

export const MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH =
  computeMilitaryExpertConstitutionDefinitionHash();
