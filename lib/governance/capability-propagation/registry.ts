/**
 * File-based capability registry loader.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapabilityRegistry } from "./validate.ts";
import type { CapabilityRegistryV1 } from "./types.ts";

const DEFAULT_REGISTRY_RELATIVE = "docs/governance/capabilities/CAPABILITY_REGISTRY.json";

export function resolveCapabilityRegistryPath(customPath?: string): string {
  if (customPath) return path.resolve(customPath);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../", DEFAULT_REGISTRY_RELATIVE);
}

export function loadCapabilityRegistry(customPath?: string): CapabilityRegistryV1 {
  const registryPath = resolveCapabilityRegistryPath(customPath);
  const raw = JSON.parse(readFileSync(registryPath, "utf8")) as unknown;
  const result = validateCapabilityRegistry(raw);
  if (!result.ok) {
    throw new Error(
      `Invalid capability registry at ${registryPath}:\n${result.errors.join("\n")}`,
    );
  }
  return result.value;
}

export function assertRegistryIdsUnique(registry: CapabilityRegistryV1): void {
  const ids = registry.capabilities.map((c) => c.capability_id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error("Capability registry contains duplicate capability_id values");
  }
}
