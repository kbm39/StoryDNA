/**
 * In-code Expert Runtime Registry (Phase 1).
 *
 * Prepares for future DB-backed registry; no database reads in Phase 1.
 */

import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  type ExpertCapability,
  type ExpertRuntimeDefinition,
  type ExpertRuntimeRegistryEntry,
  type ReviewRuntimeVersionSet,
  hashExpertRuntimeDefinition,
} from "../types.ts";
import { validateExpertRuntimeDefinition } from "../validate-runtime-definition.ts";

export class ExpertRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpertRegistryError";
  }
}

const definitionsByKey = new Map<string, ExpertRuntimeRegistryEntry>();
const versionIndex = new Map<string, Set<string>>();

function versionIndexKey(expertKey: string, expertVersion: string): string {
  return `${expertKey}@${expertVersion}`;
}

export function registerExpertRuntimeDefinition(def: ExpertRuntimeDefinition): ExpertRuntimeRegistryEntry {
  const validation = validateExpertRuntimeDefinition(def);
  if (!validation.ok) {
    throw new ExpertRegistryError(`Invalid runtime definition: ${validation.errors.join("; ")}`);
  }

  if (definitionsByKey.has(def.expert_key)) {
    throw new ExpertRegistryError(`Duplicate expert_key: ${def.expert_key}`);
  }

  const vKey = versionIndexKey(def.expert_key, def.expert_version);
  if (versionIndex.has(vKey)) {
    throw new ExpertRegistryError(`Duplicate expert version: ${vKey}`);
  }

  const frozen = Object.freeze(structuredClone(def)) as ExpertRuntimeDefinition;
  const entry: ExpertRuntimeRegistryEntry = Object.freeze({
    definition: frozen,
    definitionHash: validation.definitionHash,
    registeredAt: new Date().toISOString(),
  });

  definitionsByKey.set(def.expert_key, entry);
  versionIndex.set(vKey, new Set([def.expert_key]));

  return entry;
}

/** Reset registry — tests only. */
export function clearExpertRuntimeRegistryForTests(): void {
  definitionsByKey.clear();
  versionIndex.clear();
}

export function bootstrapExpertRuntimeRegistry(): void {
  if (definitionsByKey.size > 0) return;
  registerExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
}

export function listExpertRuntimeDefinitions(options?: {
  includeDisabled?: boolean;
}): readonly ExpertRuntimeRegistryEntry[] {
  bootstrapExpertRuntimeRegistry();
  const includeDisabled = options?.includeDisabled ?? false;
  return [...definitionsByKey.values()].filter(
    (e) => includeDisabled || e.definition.enabled,
  );
}

export function getExpertRuntimeDefinition(
  expertKey: string,
  options?: { includeDisabled?: boolean },
): ExpertRuntimeRegistryEntry | null {
  bootstrapExpertRuntimeRegistry();
  const entry = definitionsByKey.get(expertKey) ?? null;
  if (!entry) return null;
  if (!entry.definition.enabled && !options?.includeDisabled) return null;
  return entry;
}

export function resolveExpertsByCapability(
  capability: ExpertCapability,
  options?: { includeDisabled?: boolean },
): readonly ExpertRuntimeRegistryEntry[] {
  bootstrapExpertRuntimeRegistry();
  const includeDisabled = options?.includeDisabled ?? false;
  return listExpertRuntimeDefinitions({ includeDisabled }).filter((e) =>
    e.definition.capabilities.includes(capability),
  );
}

export function getExpertRuntimeVersionMetadata(expertKey: string): ReviewRuntimeVersionSet | null {
  const entry = getExpertRuntimeDefinition(expertKey, { includeDisabled: true });
  return entry?.definition.runtime_versions ?? null;
}

export function computeDefinitionHashForExpert(expertKey: string): string | null {
  const entry = getExpertRuntimeDefinition(expertKey, { includeDisabled: true });
  if (!entry) return null;
  return hashExpertRuntimeDefinition(entry.definition);
}

export type { ReviewRuntimeVersionSet };
