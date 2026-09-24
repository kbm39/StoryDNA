/**
 * Small explicit fact-persistence policy for Archivist continuity.
 *
 * Persistent facts remain contradictory across time unless transition
 * evidence exists. Changeable facts may both be valid when chronology
 * and a transition are present.
 */

import type { ArchivistIssueType, CanonFactType } from "./contracts.ts";

export const ARCHIVIST_FACT_PERSISTENCE_CLASSES = ["persistent", "changeable"] as const;
export type ArchivistFactPersistenceClass = (typeof ARCHIVIST_FACT_PERSISTENCE_CLASSES)[number];

export const ARCHIVIST_CHANGEABLE_FACT_TYPES = [
  "age",
  "alive_status",
  "rank_title",
  "location",
  "possession",
  "injury",
  "relationship",
  "knowledge_state",
  "travel",
  "presence",
] as const satisfies readonly CanonFactType[];

export const ARCHIVIST_PERSISTENT_FACT_TYPES = [
  "family_history",
  "chronology",
] as const satisfies readonly string[];

const CHANGEABLE_APPEARANCE_ATTRIBUTES = [
  "hair",
  "hair_color",
  "hair_style",
  "clothing",
  "clothes",
  "disguise",
  "makeup",
  "wig",
] as const;

const PERSISTENT_APPEARANCE_ATTRIBUTES = [
  "eye",
  "eyes",
  "eye_color",
  "birthmark",
  "scar_identity",
] as const;

const CHANGEABLE_FACT_TYPE_SET = new Set<string>(ARCHIVIST_CHANGEABLE_FACT_TYPES);

export function appearanceAttributeFromValue(
  value: Record<string, unknown> | undefined,
  hints: string,
): string | null {
  const keys = Object.keys(value ?? {}).map((key) => key.toLowerCase());
  const joined = `${keys.join(" ")} ${hints}`.toLowerCase();
  for (const attribute of CHANGEABLE_APPEARANCE_ATTRIBUTES) {
    if (joined.includes(attribute.replace("_", " ")) || joined.includes(attribute)) {
      return attribute;
    }
  }
  for (const attribute of PERSISTENT_APPEARANCE_ATTRIBUTES) {
    if (joined.includes(attribute.replace("_", " ")) || joined.includes(attribute)) {
      return attribute;
    }
  }
  return null;
}

export function classifyFactPersistence(args: {
  factType?: string;
  issueType?: ArchivistIssueType | string;
  proposedFactValue?: Record<string, unknown>;
  textHints?: string;
}): ArchivistFactPersistenceClass {
  const factType = args.factType ?? args.issueType ?? "other";
  const hints = args.textHints ?? "";
  if (factType === "appearance") {
    const attribute = appearanceAttributeFromValue(args.proposedFactValue, hints);
    if (attribute && (CHANGEABLE_APPEARANCE_ATTRIBUTES as readonly string[]).includes(attribute)) {
      return "changeable";
    }
    return "persistent";
  }
  if ((ARCHIVIST_PERSISTENT_FACT_TYPES as readonly string[]).includes(factType)) {
    return "persistent";
  }
  if (CHANGEABLE_FACT_TYPE_SET.has(factType) || factType === "family_history") {
    return factType === "family_history" ? "persistent" : "changeable";
  }
  if (factType === "other" || factType === "entity_ambiguity" || factType === "object_continuity") {
    return "changeable";
  }
  return "persistent";
}
