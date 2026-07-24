/**
 * Read-only adapter from Phase 1 in-code registry to P2-10 ExpertRuntimeRegistry.
 *
 * Does not mutate registry state or execute expert modules.
 */

import {
  expertRegistryError,
  type ExpertRegistryResult,
  type ExpertRuntimeRegistry,
  type ExpertRuntimeRegistryEntryV2,
} from "./multi-version-contract.ts";
import {
  bootstrapExpertRuntimeRegistry,
  getExpertRuntimeDefinition,
  listExpertRuntimeDefinitions,
} from "./in-code.ts";
import type { ExpertRuntimeRegistryEntry } from "../types.ts";

function toRegistryEntryV2(entry: ExpertRuntimeRegistryEntry): ExpertRuntimeRegistryEntryV2 {
  return Object.freeze({
    definition: entry.definition,
    definitionHash: entry.definitionHash,
    registeredAt: entry.registeredAt,
    expertVersionId: null,
    lifecycleStatus: "active" as const,
    isActive: entry.definition.enabled,
  });
}

function findByDefinitionHash(
  definitionHash: string,
  includeDisabled: boolean,
): ExpertRegistryResult<ExpertRuntimeRegistryEntryV2> {
  bootstrapExpertRuntimeRegistry();
  const normalized = definitionHash.trim().toLowerCase();
  for (const entry of listExpertRuntimeDefinitions({ includeDisabled })) {
    if (entry.definitionHash === normalized) {
      return { ok: true, value: toRegistryEntryV2(entry) };
    }
  }
  return expertRegistryError("definition_hash_not_found", "No expert runtime for definition hash", {
    definition_hash: normalized,
  });
}

export function createInCodeExpertRuntimeRegistry(): ExpertRuntimeRegistry {
  return {
    getActiveExpertRuntime(expertKey, options) {
      bootstrapExpertRuntimeRegistry();
      const entry = getExpertRuntimeDefinition(expertKey, {
        includeDisabled: options?.includeDisabled,
      });
      if (!entry) {
        return expertRegistryError("expert_not_found", "Expert not found in in-code registry", {
          expert_key: expertKey,
        });
      }
      return { ok: true, value: toRegistryEntryV2(entry) };
    },

    getExpertRuntimeByKeyAndVersion(expertKey, expertVersion, options) {
      bootstrapExpertRuntimeRegistry();
      const entry = getExpertRuntimeDefinition(expertKey, {
        includeDisabled: options?.includeDisabled,
      });
      if (!entry) {
        return expertRegistryError("expert_not_found", "Expert not found in in-code registry", {
          expert_key: expertKey,
        });
      }
      if (entry.definition.expert_version !== expertVersion) {
        return expertRegistryError("version_not_found", "Expert version not found in in-code registry", {
          expert_key: expertKey,
          expert_version: expertVersion,
        });
      }
      return { ok: true, value: toRegistryEntryV2(entry) };
    },

    getExpertRuntimeByDefinitionHash(definitionHash, options) {
      return findByDefinitionHash(definitionHash, options?.includeDisabled ?? false);
    },

    listExpertRuntimeVersions(expertKey, options) {
      bootstrapExpertRuntimeRegistry();
      const entry = getExpertRuntimeDefinition(expertKey, {
        includeDisabled: options?.includeDisabled,
      });
      if (!entry) {
        return expertRegistryError("expert_not_found", "Expert not found in in-code registry", {
          expert_key: expertKey,
        });
      }
      return {
        ok: true,
        value: [
          {
            expertKey: entry.definition.expert_key,
            expertVersion: entry.definition.expert_version,
            definitionHash: entry.definitionHash,
            lifecycleStatus: "active" as const,
            enabled: entry.definition.enabled,
            registeredAt: entry.registeredAt,
            expertVersionId: null,
          },
        ],
      };
    },

    existsExpertRuntime(query) {
      if (query.definitionHash) {
        const byHash = findByDefinitionHash(query.definitionHash, true);
        return { ok: true, value: byHash.ok };
      }
      if (query.expertKey && query.expertVersion) {
        const byVersion = this.getExpertRuntimeByKeyAndVersion(
          query.expertKey,
          query.expertVersion,
          { includeDisabled: true },
        );
        return { ok: true, value: byVersion.ok };
      }
      if (query.expertKey) {
        const byKey = this.getActiveExpertRuntime(query.expertKey, { includeDisabled: true });
        return { ok: true, value: byKey.ok };
      }
      return expertRegistryError("invalid_lookup", "Insufficient lookup query");
    },

    registerExpertRuntimeDefinition() {
      return expertRegistryError(
        "invalid_lookup",
        "In-code registry adapter is read-only",
      );
    },

    resolveExpertVersionId() {
      return { ok: true, value: null };
    },
  };
}
