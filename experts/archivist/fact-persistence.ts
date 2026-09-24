/**
 * Small explicit fact-persistence policy for Archivist continuity.
 *
 * Persistence answers how a fact may change, not whether two excerpts
 * exist. StoryDNA owns this classification. The model does not.
 *
 * persistent
 *   Identity-bearing facts that stay contradictory across time unless
 *   explicit transition evidence exists (eye color, parentage, chronology).
 *
 * stateful_changeable
 *   May change when chronology plus a valid transition exist
 *   (hair, rank, relationship status, injury condition, unique-object
 *   possession after transfer, knowledge after acquisition).
 *
 * event_attribute
 *   Persistent for a specific event/history (injury laterality of one
 *   wound). Condition of that event may still change.
 *
 * ephemeral
 *   Ordinary moving state (location, presence, travel). Same-time
 *   overlap can still be incompatible.
 *
 * unknown
 *   Persistence is not established. Do not confirm from this alone.
 */

import type { ArchivistIssueType, CanonFactType } from "./contracts.ts";

export const ARCHIVIST_FACT_PERSISTENCE_CLASSES = [
  "persistent",
  "stateful_changeable",
  "event_attribute",
  "ephemeral",
  "unknown",
] as const;
export type ArchivistFactPersistenceClass = (typeof ARCHIVIST_FACT_PERSISTENCE_CLASSES)[number];

export const ARCHIVIST_PERSISTENCE_POLICY = {
  eye_color: "persistent",
  family_history: "persistent",
  chronology: "persistent",
  injury_laterality: "event_attribute",
  injury_condition: "stateful_changeable",
  injury_presence: "stateful_changeable",
  knowledge_acquisition: "stateful_changeable",
  unique_object_possession: "stateful_changeable",
  rank_title: "stateful_changeable",
  relationship_status: "stateful_changeable",
  age: "stateful_changeable",
  alive_status: "stateful_changeable",
  location: "ephemeral",
  travel: "ephemeral",
  presence: "ephemeral",
} as const;

export const ARCHIVIST_STATEFUL_CHANGEABLE_FACT_TYPES = [
  "age",
  "alive_status",
  "rank_title",
  "possession",
  "injury",
  "relationship",
  "knowledge_state",
] as const satisfies readonly CanonFactType[];

export const ARCHIVIST_EPHEMERAL_FACT_TYPES = [
  "location",
  "travel",
  "presence",
] as const satisfies readonly CanonFactType[];

export const ARCHIVIST_PERSISTENT_FACT_TYPES = [
  "family_history",
  "chronology",
] as const satisfies readonly string[];

/** @deprecated Use ARCHIVIST_STATEFUL_CHANGEABLE_FACT_TYPES. */
export const ARCHIVIST_CHANGEABLE_FACT_TYPES = ARCHIVIST_STATEFUL_CHANGEABLE_FACT_TYPES;

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

const STATEFUL_SET = new Set<string>(ARCHIVIST_STATEFUL_CHANGEABLE_FACT_TYPES);
const EPHEMERAL_SET = new Set<string>(ARCHIVIST_EPHEMERAL_FACT_TYPES);

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
      return "stateful_changeable";
    }
    return "persistent";
  }
  if ((ARCHIVIST_PERSISTENT_FACT_TYPES as readonly string[]).includes(factType)) {
    return "persistent";
  }
  if (factType === "family_history") return "persistent";
  if (EPHEMERAL_SET.has(factType)) return "ephemeral";
  if (STATEFUL_SET.has(factType)) return "stateful_changeable";
  if (factType === "object_continuity" || factType === "weapon_equipment_continuity") {
    return "stateful_changeable";
  }
  if (factType === "entity_ambiguity" || factType === "other") return "unknown";
  return "persistent";
}

export function persistenceAllowsUnexplainedConfirm(
  persistence: ArchivistFactPersistenceClass,
): boolean {
  return (
    persistence === "persistent" ||
    persistence === "event_attribute" ||
    persistence === "stateful_changeable"
  );
}
