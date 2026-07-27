/**
 * Kevin Track expert execution classification — separate from commercial registry.
 */

import { getExpertCatalogEntry, type ExpertCatalogKey } from "@/lib/expert-catalog.ts";
import { classifyStudioExpertTier, studioExecutionAllowed } from "./execution-policy.ts";

export type ExpertExecutionClass = "READY" | "EXPERIMENTAL" | "PLACEHOLDER" | "BLOCKED";

export type MilitaryStudioVerdict =
  | "MILITARY_STUDIO_EXECUTABLE"
  | "MILITARY_STUDIO_BLOCKED"
  | "MILITARY_STUDIO_PLACEHOLDER";

const PLACEHOLDER_KEYS = new Set([
  "show_vs_tell_editor",
  "character_expert",
  "dialogue_expert",
  "continuity_expert",
  "police_expert",
]);

const CATALOG_KEYS = new Set<ExpertCatalogKey>([
  "literary_agent",
  "developmental_editor",
  "line_editor",
  "psychologist",
  "librarian",
  "military_expert",
]);

export function classifyExpertExecution(key: string): ExpertExecutionClass {
  if (PLACEHOLDER_KEYS.has(key)) return "PLACEHOLDER";
  if (!CATALOG_KEYS.has(key as ExpertCatalogKey)) return "PLACEHOLDER";

  const entry = getExpertCatalogEntry(key as ExpertCatalogKey);
  if (!entry) return "PLACEHOLDER";

  if (key === "literary_agent" && entry.selectionEnabled && entry.availability === "available") {
    return "READY";
  }

  if (key === "military_expert") {
    return "EXPERIMENTAL";
  }

  if (entry.availability === "coming_soon" || entry.certificationStatus === "planned") {
    return "PLACEHOLDER";
  }

  return "BLOCKED";
}

export function isExpertLaunchableInStudio(input: {
  readonly expertKey: string;
  readonly privateUseAcknowledged: boolean;
}): boolean {
  if (classifyExpertExecution(input.expertKey) !== "READY") return false;
  const entry = getExpertCatalogEntry(input.expertKey as ExpertCatalogKey);
  if (!entry) return false;
  const tier = classifyStudioExpertTier(entry);
  return studioExecutionAllowed({
    entry,
    tier,
    context: { routeNamespace: "/studio", privateUseAcknowledged: input.privateUseAcknowledged },
  });
}

/** Military Expert studio boundary — advisory harness only; no production launch path. */
export function militaryExpertStudioVerdict(): MilitaryStudioVerdict {
  return "MILITARY_STUDIO_BLOCKED";
}

export function militaryExpertBlockReasons(): readonly string[] {
  return Object.freeze([
    "Draft runtime definition only — not registered in production bootstrap",
    "No canonical editorial workflow type for military_expert_review",
    "Global executionAllowed remains false on Expert Review Engine",
    "Commercial selectionEnabled remains false",
    "Studio policy permits advisory acknowledgment only — no wired launch path in K3",
  ]);
}

export function listExpertsByClass(): Record<ExpertExecutionClass, readonly string[]> {
  const keys = [
    "literary_agent",
    "developmental_editor",
    "line_editor",
    "show_vs_tell_editor",
    "character_expert",
    "dialogue_expert",
    "continuity_expert",
    "military_expert",
    "police_expert",
    "psychologist",
    "librarian",
  ];
  const result: Record<ExpertExecutionClass, string[]> = {
    READY: [],
    EXPERIMENTAL: [],
    PLACEHOLDER: [],
    BLOCKED: [],
  };
  for (const key of keys) {
    result[classifyExpertExecution(key)].push(key);
  }
  return Object.freeze({
    READY: Object.freeze(result.READY),
    EXPERIMENTAL: Object.freeze(result.EXPERIMENTAL),
    PLACEHOLDER: Object.freeze(result.PLACEHOLDER),
    BLOCKED: Object.freeze(result.BLOCKED),
  });
}
