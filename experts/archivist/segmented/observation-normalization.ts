/**
 * Deterministic representation recovery for segment observations.
 * Does not invent aliases, locators, excerpts, or accepted canon.
 */

import { isArchivistFactType } from "../contracts.ts";
import { emptySegmentObservation, FACT_GROUPS } from "./observation-contract.ts";

export const FACT_TYPE_REPRESENTATION_ALIASES = {
  knowledge: "knowledge_state",
} as const;

export type ObservationQuarantineReason =
  | "missing_locator"
  | "missing_value"
  | "missing_identity"
  | "unsupported_fact_type"
  | "unusable_optional";

export interface ObservationQuarantine {
  segment_id: string;
  fact_id?: string;
  group?: string;
  reason: ObservationQuarantineReason;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function observedIdentity(row: Record<string, unknown>): string {
  if (typeof row.alias === "string" && row.alias.trim()) return row.alias.trim();
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  if (typeof row.entity_name === "string" && row.entity_name.trim()) return row.entity_name.trim();
  if (typeof row.name_surface === "string" && row.name_surface.trim()) return row.name_surface.trim();
  if (typeof row.entity === "string" && row.entity.trim()) return row.entity.trim();
  if (typeof row.entity1 === "string" && row.entity1.trim()) return row.entity1.trim();
  const nested = asRecord(row.alias);
  if (typeof nested?.name === "string" && nested.name.trim()) return nested.name.trim();
  return "";
}

function normalizeFactType(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const mapped =
    value === "knowledge"
      ? FACT_TYPE_REPRESENTATION_ALIASES.knowledge
      : value;
  return isArchivistFactType(mapped) ? mapped : null;
}

export function locatorFromRepresentation(value: unknown): { locator: string; chapter?: string } | null {
  if (typeof value === "string" && value.trim()) {
    return { locator: value.trim() };
  }
  const row = asRecord(value);
  if (!row) return null;
  if (typeof row.locator === "string" && row.locator.trim()) {
    return {
      locator: row.locator.trim(),
      ...(typeof row.chapter === "string" ? { chapter: row.chapter } : {}),
    };
  }
  if (typeof row.location === "string" && row.location.trim()) {
    return { locator: row.location.trim() };
  }
  if (typeof row.chapter === "string" && row.chapter.trim()) {
    return { locator: row.chapter.trim(), chapter: row.chapter.trim() };
  }
  return null;
}

const GROUP_DEFAULT_FACT_TYPE: Partial<Record<(typeof FACT_GROUPS)[number], string>> = {
  injuries: "injury",
  relationships: "relationship",
  appearance: "appearance",
  age: "age",
  rank_title: "rank_title",
  alive_status: "alive_status",
  knowledge: "knowledge_state",
  locations: "location",
  chronology: "chronology",
  possessions: "possession",
  events: "other",
  state_transitions: "other",
  unique_objects: "other",
  weapons_equipment: "other",
  vehicles: "other",
  organizations: "other",
};

const FACT_TYPE_TO_GROUP: Record<string, string> = {
  appearance: "appearance",
  injury: "injuries",
  alive_status: "alive_status",
  age: "age",
  rank_title: "rank_title",
  relationship: "relationships",
  location: "locations",
  possession: "possessions",
  knowledge_state: "knowledge",
  chronology: "chronology",
  travel: "candidate_facts",
  presence: "candidate_facts",
  other: "candidate_facts",
};

const UNSAFE_AUTHORITIES = new Set([
  "series_bible_accepted",
  "author_approved_exception",
  "prior_volume_canon",
]);

export function flattenNestedEntityFacts(
  value: unknown,
  segmentId: string,
): { observation: unknown; quarantined: ObservationQuarantine[]; nested_facts_discovered: number } {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.entities)) {
    return { observation: value, quarantined: [], nested_facts_discovered: 0 };
  }
  const quarantined: ObservationQuarantine[] = [];
  let discovered = 0;
  const additions: Record<string, Record<string, unknown>[]> = {};
  const entities = record.entities.map((item) => {
    const row = asRecord(item);
    if (!row) return item;
    const alias = observedIdentity(row);
    const nestedFacts = Array.isArray(row.facts) ? row.facts : [];
    discovered += nestedFacts.length;
    if (!alias && nestedFacts.length) {
      quarantined.push({ segment_id: segmentId, group: "entities.facts", reason: "missing_identity" });
    } else {
      for (const factItem of nestedFacts) {
        const fact = asRecord(factItem);
        if (!fact) continue;
        const factId = typeof fact.fact_id === "string" ? fact.fact_id : typeof fact.id === "string" ? fact.id : undefined;
        if (fact.status === "accepted") {
          quarantined.push({ segment_id: segmentId, fact_id: factId, group: "entities.facts", reason: "unusable_optional" });
          continue;
        }
        if (typeof fact.proposed_authority === "string" && UNSAFE_AUTHORITIES.has(fact.proposed_authority)) {
          quarantined.push({ segment_id: segmentId, fact_id: factId, group: "entities.facts", reason: "unusable_optional" });
          continue;
        }
        if (typeof fact.excerpt !== "string" || !fact.excerpt.trim()) {
          quarantined.push({ segment_id: segmentId, fact_id: factId, group: "entities.facts", reason: "unusable_optional" });
          continue;
        }
        const locator = locatorFromRepresentation(fact.locator) ?? locatorFromRepresentation(fact.location);
        if (!locator) {
          quarantined.push({ segment_id: segmentId, fact_id: factId, group: "entities.facts", reason: "missing_locator" });
          continue;
        }
        const fact_type = normalizeFactType(fact.fact_type);
        if (!fact_type) {
          quarantined.push({ segment_id: segmentId, fact_id: factId, group: "entities.facts", reason: "unsupported_fact_type" });
          continue;
        }
        const group = FACT_TYPE_TO_GROUP[fact_type] ?? "candidate_facts";
        const flattened: Record<string, unknown> = {
          id: factId ?? `${segmentId}-nested-${alias}`,
          alias,
          entity_type: row.entity_type ?? row.type ?? "person",
          fact_type,
          excerpt: fact.excerpt.trim(),
          locator,
          inferred: typeof fact.inferred === "boolean" ? fact.inferred : false,
        };
        if (fact.value && typeof fact.value === "object" && !Array.isArray(fact.value)) {
          flattened.value = fact.value;
        } else if (typeof fact.value === "string" || typeof fact.value === "number" || typeof fact.value === "boolean") {
          flattened.value = { emitted: fact.value };
        }
        if (fact.temporal_scope && typeof fact.temporal_scope === "object") {
          flattened.temporal_scope = fact.temporal_scope;
        }
        if (typeof fact.confidence === "string" && fact.confidence.trim()) {
          flattened.confidence = fact.confidence.trim();
        }
        additions[group] = additions[group] ?? [];
        additions[group]!.push(flattened);
      }
    }
    const rest = { ...row };
    delete rest.entity_id;
    delete rest.facts;
    return rest;
  });
  const merged: Record<string, unknown> = { ...record, entities };
  for (const [group, rows] of Object.entries(additions)) {
    const existing = Array.isArray(merged[group]) ? (merged[group] as unknown[]) : [];
    merged[group] = [...rows, ...existing];
  }
  return { observation: merged, quarantined, nested_facts_discovered: discovered };
}

export function normalizeSegmentObservation(
  value: unknown,
  segmentId: string,
): {
  observation: unknown;
  quarantined: ObservationQuarantine[];
} {
  const flattened = flattenNestedEntityFacts(value, segmentId);
  if (!flattened.observation || typeof flattened.observation !== "object" || Array.isArray(flattened.observation)) {
    return { observation: flattened.observation, quarantined: flattened.quarantined };
  }
  const record = flattened.observation as Record<string, unknown>;
  const quarantined: ObservationQuarantine[] = [...flattened.quarantined];

  const entities = (Array.isArray(record.entities) ? record.entities : [])
    .map((item) => {
      const row = asRecord(item) ?? {};
      const alias = observedIdentity(row);
      if (!alias) {
        quarantined.push({ segment_id: segmentId, reason: "missing_identity", group: "entities" });
        return null;
      }
      const rest = { ...row };
      delete rest.entity_id;
      return {
        ...rest,
        alias,
        entity_type: row.entity_type ?? row.type ?? "person",
        local_mentions: Array.isArray(row.local_mentions) ? row.local_mentions : [alias],
      };
    })
    .filter(Boolean);

  const aliases = (Array.isArray(record.aliases) ? record.aliases : [])
    .map((item) => {
      const row = asRecord(item) ?? {};
      const alias = observedIdentity(row);
      return alias ? { alias, entity_type: row.entity_type ?? row.type ?? "person" } : null;
    })
    .filter(Boolean);

  const coerced: Record<string, unknown> = {
    ...emptySegmentObservation(segmentId),
    ...record,
    schema: "archivist_segment_observation@v1",
    segment_id: segmentId,
    entities,
    aliases,
  };

  for (const group of FACT_GROUPS) {
    const rows = Array.isArray(record[group]) ? record[group] : [];
    const kept: Record<string, unknown>[] = [];
    for (const item of rows) {
      const row = asRecord(item);
      if (!row) continue;
      const locator = locatorFromRepresentation(row.locator) ?? locatorFromRepresentation(row.location);
      const excerpt = typeof row.excerpt === "string" ? row.excerpt.trim() : "";
      const fact_type =
        normalizeFactType(row.fact_type) ??
        (excerpt && locator ? normalizeFactType(GROUP_DEFAULT_FACT_TYPE[group]) : null);
      if (!fact_type) {
        quarantined.push({
          segment_id: segmentId,
          fact_id: typeof row.id === "string" ? row.id : typeof row.fact_id === "string" ? row.fact_id : undefined,
          group,
          reason: "unsupported_fact_type",
        });
        continue;
      }
      const alias = observedIdentity(row);
      if (!alias) {
        quarantined.push({
          segment_id: segmentId,
          fact_id: typeof row.id === "string" ? row.id : typeof row.fact_id === "string" ? row.fact_id : undefined,
          group,
          reason: "missing_identity",
        });
        continue;
      }
      const rest = { ...row };
      const factStatus = rest.status;
      delete rest.entity_id;
      delete rest.status;
      if (factStatus === "accepted") {
        quarantined.push({
          segment_id: segmentId,
          fact_id: typeof row.id === "string" ? row.id : typeof row.fact_id === "string" ? row.fact_id : undefined,
          group,
          reason: "unusable_optional",
        });
        continue;
      }
      kept.push({
        ...rest,
        id: typeof row.id === "string" ? row.id : typeof row.fact_id === "string" ? row.fact_id : `${segmentId}-${group}-${kept.length + 1}`,
        alias,
        fact_type,
        ...(locator ? { locator } : {}),
      });
    }
    coerced[group] = kept;
  }

  return { observation: coerced, quarantined };
}

export function observationNeedsPaidRepair(
  value: unknown,
  segmentId: string,
): boolean {
  const { observation } = normalizeSegmentObservation(value, segmentId);
  const record = asRecord(observation);
  if (!record) return true;
  if (record.schema !== "archivist_segment_observation@v1") return true;
  if (record.segment_id !== segmentId) return true;
  if (record.status === "accepted") return true;
  if (!Array.isArray(record.entities)) return true;
  return false;
}
