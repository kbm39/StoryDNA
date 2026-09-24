import {
  isArchivistFactType,
  type ArchivistEntityAmbiguity,
  type ArchivistEvidenceRecord,
} from "../contracts.ts";
import { CANON_ENTITY_TYPES } from "@/lib/canon/types.ts";
import {
  ARCHIVIST_SEGMENT_CONTRACT_VERSION,
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA,
  CERTIFIED_ARCHIVIST_MODEL,
  CERTIFIED_ARCHIVIST_PROVIDER,
} from "./constants.ts";
import type {
  ArchivistSegmentObservation,
  PlannedSegment,
  SegmentObservationFact,
} from "./types.ts";

const FACT_GROUPS = [
  "candidate_facts",
  "events",
  "state_transitions",
  "relationships",
  "injuries",
  "appearance",
  "age",
  "rank_title",
  "alive_status",
  "knowledge",
  "locations",
  "chronology",
  "possessions",
  "unique_objects",
  "weapons_equipment",
  "vehicles",
  "organizations",
] as const;

export function emptySegmentObservation(segmentId: string): ArchivistSegmentObservation {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA,
    segment_id: segmentId,
    entities: [],
    aliases: [],
    candidate_facts: [],
    events: [],
    state_transitions: [],
    relationships: [],
    injuries: [],
    appearance: [],
    age: [],
    rank_title: [],
    alive_status: [],
    knowledge: [],
    locations: [],
    chronology: [],
    possessions: [],
    unique_objects: [],
    weapons_equipment: [],
    vehicles: [],
    organizations: [],
    local_continuity_concerns: [],
    evidence_references: [],
    entity_ambiguities: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function factHasModelEntityId(fact: SegmentObservationFact): boolean {
  return "entity_id" in fact && Boolean((fact as { entity_id?: unknown }).entity_id);
}

export function validateSegmentObservation(
  value: unknown,
  expectedSegmentId?: string,
): { ok: true; observation: ArchivistSegmentObservation } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["observation must be an object"] };
  if (record.schema !== ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA) {
    errors.push("schema must be archivist_segment_observation@v1");
  }
  if (typeof record.segment_id !== "string" || !record.segment_id.trim()) {
    errors.push("segment_id is required");
  } else if (expectedSegmentId && record.segment_id !== expectedSegmentId) {
    errors.push("segment_id does not match planned segment");
  }
  if (record.status === "accepted") {
    errors.push("observation cannot carry accepted canon status");
  }
  if (!Array.isArray(record.entities)) errors.push("entities must be an array");
  for (const entity of Array.isArray(record.entities) ? record.entities : []) {
    const row = asRecord(entity);
    if (!row) {
      errors.push("entity must be an object");
      continue;
    }
    if (row.entity_id) errors.push("model cannot create canonical entity IDs");
    if (typeof row.alias !== "string" || !row.alias.trim()) errors.push("entity alias is required");
    if (!CANON_ENTITY_TYPES.includes(row.entity_type as never)) {
      errors.push(`unsupported entity_type ${String(row.entity_type)}`);
    }
  }
  for (const group of FACT_GROUPS) {
    const rows = record[group];
    if (rows !== undefined && !Array.isArray(rows)) {
      errors.push(`${group} must be an array`);
      continue;
    }
    for (const fact of Array.isArray(rows) ? rows : []) {
      const row = fact as SegmentObservationFact;
      if (factHasModelEntityId(row)) errors.push("model cannot create canonical entity IDs");
      if (row.fact_type && !isArchivistFactType(String(row.fact_type))) {
        errors.push(`unsupported fact_type ${String(row.fact_type)}`);
      }
      if ((row as { status?: string }).status === "accepted") {
        errors.push("segment facts cannot be accepted canon");
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, observation: record as unknown as ArchivistSegmentObservation };
}

export function attachStoryDnaObservationProvenance(
  observation: ArchivistSegmentObservation,
  args: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
    segment: PlannedSegment;
  },
): ArchivistSegmentObservation {
  return {
    ...observation,
    manuscript_id: args.manuscript_id,
    manuscript_version_id: args.manuscript_version_id,
    content_hash: args.content_hash,
    segment_coordinates: {
      start_offset: args.segment.start_offset,
      end_offset: args.segment.end_offset,
      source_hash: args.segment.source_hash,
    },
    provider: CERTIFIED_ARCHIVIST_PROVIDER,
    model: CERTIFIED_ARCHIVIST_MODEL,
    contract_version: ARCHIVIST_SEGMENT_CONTRACT_VERSION,
  };
}

export function allObservationFacts(
  observation: ArchivistSegmentObservation,
): SegmentObservationFact[] {
  return FACT_GROUPS.flatMap((group) => observation[group] ?? []);
}

export function observationAmbiguities(
  observation: ArchivistSegmentObservation,
): ArchivistEntityAmbiguity[] {
  return observation.entity_ambiguities ?? [];
}

export function observationEvidence(
  observation: ArchivistSegmentObservation,
): ArchivistEvidenceRecord[] {
  return observation.evidence_references ?? [];
}
