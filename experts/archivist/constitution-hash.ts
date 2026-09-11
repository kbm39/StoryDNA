/**
 * Archivist constitution definition hash via reviewerDefinitionToExpertDefinition adapter.
 */

import { ARCHIVIST } from "./definition.ts";
import { reviewerDefinitionToExpertDefinition } from "@/lib/expert-registry/adapters/reviewer-definition.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import type { ExpertDefinitionV1 } from "@/lib/expert-registry/types.ts";
import { ARCHIVIST_CONSTITUTION } from "./constitution.ts";

export const ARCHIVIST_CONSTITUTION_ADAPTER_OPTIONS: {
  category: ExpertDefinitionV1["identity"]["category"];
  department: string;
  version: string;
  lifecycleStatus: ExpertDefinitionV1["versioning"]["lifecycle_status"];
  evidenceProfileRefs: string[];
  changeSummary: string;
  registryMetadata: ExpertDefinitionV1["registry_metadata"];
} = {
  category: "archivist_continuity",
  department: "Research",
  version: "v1.0.0-draft",
  lifecycleStatus: "draft",
  evidenceProfileRefs: ["EDITORIAL", "RESEARCH"],
  changeSummary: "Initial Archivist registry definition — draft, not runtime-wired, not seeded.",
  registryMetadata: {
    execution_wired: false,
    notes: "Draft Archivist — not certified, not seeded, not production-enabled.",
  },
};

export function computeArchivistConstitutionDefinitionHash(): string {
  return hashExpertDefinition(
    reviewerDefinitionToExpertDefinition(ARCHIVIST, ARCHIVIST_CONSTITUTION_ADAPTER_OPTIONS),
  );
}

export function computeArchivistConstitutionObjectHash(): string {
  return hashExpertDefinition(ARCHIVIST_CONSTITUTION);
}

export const ARCHIVIST_CONSTITUTION_DEFINITION_HASH =
  computeArchivistConstitutionDefinitionHash();

export const ARCHIVIST_CONSTITUTION_OBJECT_HASH = computeArchivistConstitutionObjectHash();
