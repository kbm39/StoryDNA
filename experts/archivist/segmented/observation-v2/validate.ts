import { CANON_ENTITY_TYPES } from "@/lib/canon/types.ts";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "../../contracts.ts";
import { countExcerptWords } from "../../evidence.ts";
import {
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V1,
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  V2_CAPABILITY_SOURCES,
  V2_CAPABILITY_STATES,
  V2_KNOWLEDGE_PERSPECTIVES,
  V2_KNOWLEDGE_STATES,
  V2_LATERALITIES,
  V2_OBSERVATION_KINDS,
  V2_POLARITIES,
  V2_PRESENCE_STATES,
  V2_RELATIONSHIP_STATES,
  V2_SOURCE_KINDS,
} from "./constants.ts";
import type {
  ArchivistSegmentObservationV2,
  V2Evidence,
  V2Observation,
  V2Proposition,
} from "./types.ts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function included(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function requireString(row: Record<string, unknown>, key: string, errors: string[], prefix: string): void {
  if (typeof row[key] !== "string" || !String(row[key]).trim()) {
    errors.push(`${prefix}: ${key} is required`);
  }
}

function validateProposition(value: unknown, prefix: string, errors: string[]): void {
  const row = asRecord(value);
  if (!row) {
    errors.push(`${prefix}: proposition is required`);
    return;
  }
  requireString(row, "subject", errors, prefix);
  requireString(row, "predicate", errors, prefix);
  requireString(row, "object", errors, prefix);
  if (!included(row.polarity, V2_POLARITIES)) {
    errors.push(`${prefix}: polarity must be true|false|unknown`);
  }
  if (!included(row.source_kind, V2_SOURCE_KINDS)) {
    errors.push(`${prefix}: source_kind must be narration|dialogue|event|inference`);
  }
}

function validateEvidence(value: unknown, prefix: string, errors: string[]): void {
  const row = asRecord(value);
  if (!row) {
    errors.push(`${prefix}: evidence is required`);
    return;
  }
  requireString(row, "locator", errors, prefix);
  requireString(row, "source_segment", errors, prefix);
  const excerpt = typeof row.excerpt === "string" ? row.excerpt.trim() : "";
  if (excerpt.length < 8) errors.push(`${prefix}: excerpt must be at least 8 characters`);
  if (countExcerptWords(excerpt) > ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS) {
    errors.push(`${prefix}: excerpt exceeds ${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words`);
  }
}

function validateTimestamp(payload: Record<string, unknown>, prefix: string, errors: string[]): void {
  requireString(payload, "raw_expression", errors, prefix);
  const raw = String(payload.raw_expression ?? "");
  const clock = payload.clock_time;
  if (clock !== undefined) {
    if (typeof clock !== "string" || !clock.trim()) {
      errors.push(`${prefix}: clock_time must be a non-empty string when present`);
    } else {
      const rawDigits = raw.replace(/\D/g, "").replace(/^0+/, "");
      const clockDigits = clock.replace(/\D/g, "").replace(/^0+/, "");
      if (!clockDigits) {
        errors.push(`${prefix}: clock_time must contain digits`);
      } else if (!rawDigits || (rawDigits !== clockDigits && !rawDigits.includes(clockDigits) && !clockDigits.includes(rawDigits))) {
        errors.push(`${prefix}: clock_time is not supported by raw_expression`);
      }
    }
  }
}

function validateKnowledge(payload: Record<string, unknown>, prefix: string, errors: string[]): void {
  requireString(payload, "entity", errors, prefix);
  requireString(payload, "topic", errors, prefix);
  if (!included(payload.knowledge_state, V2_KNOWLEDGE_STATES)) {
    errors.push(`${prefix}: knowledge_state is invalid`);
  }
  if (!included(payload.perspective, V2_KNOWLEDGE_PERSPECTIVES)) {
    errors.push(`${prefix}: perspective is invalid`);
  }
  if (
    payload.knowledge_state === "known" &&
    payload.perspective === "narration"
  ) {
    errors.push(`${prefix}: narration naming is not character knowledge`);
  }
}

function validateInjury(payload: Record<string, unknown>, prefix: string, errors: string[]): void {
  requireString(payload, "entity", errors, prefix);
  requireString(payload, "body_region", errors, prefix);
  if (!included(payload.laterality, V2_LATERALITIES)) {
    errors.push(`${prefix}: laterality must be left|right|bilateral|unspecified`);
  }
  const region = String(payload.body_region ?? "");
  if (/ and |,|;|\//i.test(region)) {
    errors.push(`${prefix}: body_region must be a single region`);
  }
}

function validateTravel(payload: Record<string, unknown>, prefix: string, errors: string[]): void {
  requireString(payload, "traveler", errors, prefix);
  if (payload.distance_if_explicit !== undefined && typeof payload.distance_if_explicit !== "string") {
    errors.push(`${prefix}: distance_if_explicit must be a manuscript string`);
  }
}

function validateKindPayload(obs: Record<string, unknown>, prefix: string, errors: string[]): void {
  const kind = obs.kind;
  const payload = asRecord(obs.payload);
  if (!payload) {
    errors.push(`${prefix}: payload is required`);
    return;
  }
  if (kind === "timestamp") validateTimestamp(payload, prefix, errors);
  if (kind === "event") requireString(payload, "action", errors, prefix);
  if (kind === "statement") {
    requireString(payload, "speaker", errors, prefix);
    requireString(payload, "proposition_topic", errors, prefix);
    if (!included(payload.polarity, V2_POLARITIES)) errors.push(`${prefix}: statement polarity is invalid`);
  }
  if (kind === "knowledge") validateKnowledge(payload, prefix, errors);
  if (kind === "travel_leg") validateTravel(payload, prefix, errors);
  if (kind === "operational_capability") {
    requireString(payload, "entity", errors, prefix);
    requireString(payload, "capability_type", errors, prefix);
    if (!included(payload.state, V2_CAPABILITY_STATES)) errors.push(`${prefix}: capability state is invalid`);
    if (!included(payload.source, V2_CAPABILITY_SOURCES)) errors.push(`${prefix}: capability source is invalid`);
  }
  if (kind === "injury") validateInjury(payload, prefix, errors);
  if (kind === "relationship") {
    requireString(payload, "subject", errors, prefix);
    requireString(payload, "counterparty", errors, prefix);
    requireString(payload, "relationship_type", errors, prefix);
    if (!included(payload.state, V2_RELATIONSHIP_STATES)) {
      errors.push(`${prefix}: relationship state is invalid`);
    }
  }
  if (kind === "identity") {
    requireString(payload, "surface_name", errors, prefix);
    if (!included(payload.identity_claim, ["also_known_as", "role", "same_as", "unlinked"])) {
      errors.push(`${prefix}: identity_claim is invalid`);
    }
  }
  if (kind === "location_presence") {
    requireString(payload, "entity", errors, prefix);
    requireString(payload, "location", errors, prefix);
    if (!included(payload.presence, V2_PRESENCE_STATES)) errors.push(`${prefix}: presence is invalid`);
  }
  if (kind === "object_equipment") requireString(payload, "object", errors, prefix);
}

export function validateSegmentObservationV2(
  value: unknown,
  expectedSegmentId?: string,
): { ok: true; observation: ArchivistSegmentObservationV2 } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["observation must be an object"] };
  if (record.schema === ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V1) {
    return { ok: false, errors: ["v1 observations cannot be reinterpreted as v2"] };
  }
  if (record.schema !== ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2) {
    errors.push("schema must be archivist_segment_observation@v2");
  }
  if (typeof record.segment_id !== "string" || !record.segment_id.trim()) {
    errors.push("segment_id is required");
  } else if (expectedSegmentId && record.segment_id !== expectedSegmentId) {
    errors.push("segment_id does not match planned segment");
  }
  if (record.status === "accepted") errors.push("observation cannot carry accepted canon status");
  if (!Array.isArray(record.entities)) errors.push("entities must be an array");
  for (const entity of Array.isArray(record.entities) ? record.entities : []) {
    const row = asRecord(entity);
    if (!row) {
      errors.push("entity must be an object");
      continue;
    }
    if (row.entity_id) errors.push("model cannot create canonical entity IDs");
    requireString(row, "alias", errors, "entity");
    if (!CANON_ENTITY_TYPES.includes(row.entity_type as never)) {
      errors.push(`unsupported entity_type ${String(row.entity_type)}`);
    }
  }
  if (!Array.isArray(record.observations)) {
    errors.push("observations must be an array");
  } else {
    for (const item of record.observations) {
      const row = asRecord(item);
      if (!row) {
        errors.push("observation row must be an object");
        continue;
      }
      const prefix = typeof row.id === "string" ? row.id : "observation";
      requireString(row, "id", errors, prefix);
      if (!included(row.kind, V2_OBSERVATION_KINDS)) errors.push(`${prefix}: unsupported kind`);
      if (row.entity_id) errors.push(`${prefix}: model cannot create canonical entity IDs`);
      if (row.status === "accepted") errors.push(`${prefix}: cannot be accepted canon`);
      validateProposition(row.proposition, prefix, errors);
      validateEvidence(row.evidence, prefix, errors);
      validateKindPayload(row, prefix, errors);
      if (row.inferred !== false && row.inferred !== true) {
        errors.push(`${prefix}: inferred must be boolean`);
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, observation: record as unknown as ArchivistSegmentObservationV2 };
}

export function emptySegmentObservationV2(segmentId: string): ArchivistSegmentObservationV2 {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: segmentId,
    entities: [],
    observations: [],
    local_continuity_concerns: [],
    entity_ambiguities: [],
    contract_version: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  };
}

export function observationIsConfirmationGrade(observation: V2Observation): boolean {
  const evidence = observation.evidence;
  return (
    Boolean(evidence.locator?.trim()) &&
    evidence.excerpt.trim().length >= 8 &&
    countExcerptWords(evidence.excerpt) <= ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS &&
    Boolean(evidence.source_segment?.trim()) &&
    Boolean(evidence.manuscript_id) &&
    Boolean(evidence.manuscript_version_id) &&
    Boolean(evidence.content_hash)
  );
}

export function assertProposition(value: V2Proposition): V2Proposition {
  return value;
}

export function assertEvidence(value: V2Evidence): V2Evidence {
  return value;
}
