/**
 * Deterministic V2 provider-output adapter.
 * Experimental/candidate. Does not call a provider. Does not write canon.
 */

import { isArchivistConfidence, type ArchivistConfidence } from "../../contracts.ts";
import { CANON_ENTITY_TYPES } from "@/lib/canon/types.ts";
import { estimateJsonTokens, suppressDuplicateObservations } from "./compactness.ts";
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
} from "./constants.ts";
import type {
  ArchivistSegmentObservationV2,
  V2Evidence,
  V2Observation,
  V2ObservationEntity,
  V2ObservationKind,
  V2Polarity,
  V2Proposition,
} from "./types.ts";
import {
  applySafeEnumNormalizations,
  type V2NormalizationAudit,
} from "./enum-normalization.ts";
import { recoverV2PropositionFromTypedPayload } from "./proposition-recovery.ts";
import { applySegmentEvidenceGate, type V2EvidenceStatus } from "./evidence-contiguity.ts";
import {
  emptyV2TruncationRecoveryAudit,
  recoverV2TruncatedObservations,
  type V2TruncationRecoveryAudit,
} from "./truncated-prefix-recovery.ts";
import {
  emptySegmentObservationV2,
  observationIsConfirmationGrade,
  validateSegmentObservationV2,
} from "./validate.ts";

export const V2_ADAPTER_VERSION = "archivist_v2_compact_adapter@v1" as const;
export const V2_ADAPTER_STATUS = "experimental_candidate" as const;
export const V2_ADAPTER_WIRED_TO_PAID_PATH = false;

export type V2AdapterHardFailure =
  | "invalid_json"
  | "v1_cannot_be_reinterpreted"
  | "unsupported_schema"
  | "accepted_canon"
  | "unsafe_authority";

export type V2QuarantineReason =
  | "unsupported_kind"
  | "invalid_payload"
  | "invalid_evidence"
  | "invented_clock"
  | "combined_injury_region"
  | "narration_as_knowledge"
  | "missing_required_field"
  | "editorial_output"
  | "duplicate"
  | "invalid_polarity"
  | "missing_proposition"
  | "calculated_distance"
  | "insufficient_evidence"
  | "non_contiguous_evidence"
  | "laterality_evidence_conflict"
  | "proposition_payload_conflict";

export interface V2ObservationQuarantine {
  observation_id?: string;
  reason: V2QuarantineReason;
  detail: string;
  excerpt?: string;
  locator?: string;
  kind?: V2ObservationKind;
  observation?: V2Observation;
  evidence_status?: V2EvidenceStatus;
}

export interface V2AdapterResult {
  ok: boolean;
  hard_failure: V2AdapterHardFailure | null;
  hard_failure_detail: string | null;
  document: ArchivistSegmentObservationV2 | null;
  retained: V2Observation[];
  quarantined: V2ObservationQuarantine[];
  suppressed_duplicates: number;
  entity_ids_stripped: number;
  diagnostics: string[];
  normalizations: V2NormalizationAudit[];
  confirmation_grade_count: number;
  evidence_gate_applied: boolean;
  evidence_verified_count: number;
  compactness: {
    output_tokens: number;
    observation_count: number;
  };
  truncation_recovery: V2TruncationRecoveryAudit;
}

const KIND_ALIASES: Record<string, V2ObservationKind> = {
  timestamp: "timestamp",
  time: "timestamp",
  time_stamp: "timestamp",
  clock: "timestamp",
  event: "event",
  action: "event",
  occurrence: "event",
  statement: "statement",
  claim: "statement",
  dialogue: "statement",
  speech: "statement",
  knowledge: "knowledge",
  knowledge_state: "knowledge",
  travel_leg: "travel_leg",
  travel: "travel_leg",
  journey: "travel_leg",
  operational_capability: "operational_capability",
  capability: "operational_capability",
  operational: "operational_capability",
  injury: "injury",
  wound: "injury",
  relationship: "relationship",
  relation: "relationship",
  kinship: "relationship",
  identity: "identity",
  identity_claim: "identity",
  location_presence: "location_presence",
  location: "location_presence",
  presence: "location_presence",
  object_equipment: "object_equipment",
  object: "object_equipment",
  equipment: "object_equipment",
  possession: "object_equipment",
};

const KIND_FIELDS: Record<V2ObservationKind, readonly string[]> = {
  timestamp: [
    "raw_expression",
    "clock_time",
    "date",
    "day_reference",
    "relative_time",
    "duration",
    "time_window",
    "sequence_marker",
    "attached_event_id",
  ],
  event: [
    "event_type",
    "actor",
    "action",
    "object",
    "location",
    "time_reference_id",
    "result",
    "participants",
    "equipment",
  ],
  statement: [
    "speaker",
    "proposition_topic",
    "polarity",
    "claim_value",
    "target",
    "time_reference_id",
    "context",
  ],
  knowledge: [
    "entity",
    "topic",
    "knowledge_state",
    "perspective",
    "acquisition_source",
    "acquisition_event_id",
    "acquisition_time_id",
    "assertion_time_id",
  ],
  travel_leg: [
    "traveler",
    "origin",
    "destination",
    "departure_time_id",
    "arrival_time_id",
    "stated_duration",
    "mode",
    "distance_if_explicit",
  ],
  operational_capability: [
    "entity",
    "capability_type",
    "state",
    "quantity",
    "time_scope",
    "location_or_operation",
    "source",
  ],
  injury: [
    "entity",
    "injury_event_id",
    "body_region",
    "laterality",
    "injury_type",
    "diagnosis",
    "condition",
    "severity",
    "cause",
    "time_reference_id",
  ],
  relationship: ["subject", "counterparty", "relationship_type", "state", "time_scope"],
  identity: ["surface_name", "identity_claim", "alias", "role", "canonical_candidate"],
  location_presence: ["entity", "location", "presence", "time_reference_id", "event_context"],
  object_equipment: [
    "entity",
    "object",
    "object_identity",
    "action_or_state",
    "quantity",
    "location",
    "time_reference_id",
  ],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapFence(raw: string): string {
  const trimmed = raw.trim();
  const closed = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (closed) return closed[1]!.trim();
  const open = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/i);
  if (open) return open[1]!.trim();
  return trimmed;
}

function parseProviderJson(raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw && typeof raw === "object") return { ok: true, value: raw };
  if (typeof raw !== "string") return { ok: false, error: "provider output must be JSON object or string" };
  try {
    return { ok: true, value: JSON.parse(unwrapFence(raw)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid JSON" };
  }
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function omitEmpty<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out as T;
}

function firstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = nonEmptyString(row[key]);
    if (value) return value;
  }
  return undefined;
}

function normalizeKind(value: unknown): V2ObservationKind | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return KIND_ALIASES[key] ?? null;
}

function normalizePolarity(value: unknown): V2Polarity | null {
  if (value === true || value === 1) return "true";
  if (value === false || value === 0) return "false";
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (["true", "yes", "affirmative", "asserted"].includes(key)) return "true";
  if (["false", "no", "negated", "denied"].includes(key)) return "false";
  if (["unknown", "unclear", "unspecified"].includes(key)) return "unknown";
  return V2_POLARITIES.includes(key as V2Polarity) ? (key as V2Polarity) : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === undefined) return false;
  if (value === true || value === 1 || value === "true" || value === "1") return true;
  if (value === false || value === 0 || value === "false" || value === "0") return false;
  return null;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], aliases: Record<string, T> = {}): T | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (aliases[key]) return aliases[key];
  return allowed.includes(key as T) ? (key as T) : undefined;
}

function hasUnsafeAuthority(record: Record<string, unknown>): string | null {
  if (record.status === "accepted") return "status accepted";
  if (record.authority === "accepted") return "authority accepted";
  if (record.persist_canon === true || record.write_canon === true || record.persist_accepted_canon === true) {
    return "canon write requested";
  }
  if (record.canon_status === "accepted" || record.accepted_canon === true) return "accepted canon";
  return null;
}

function resolveProposition(
  kind: V2ObservationKind,
  row: Record<string, unknown>,
  payload: Record<string, unknown>,
):
  | { ok: true; proposition: V2Proposition; audit: V2NormalizationAudit | null }
  | { ok: false; error: string } {
  if (row.polarity !== undefined && normalizePolarity(row.polarity) === null && asRecord(row.proposition)?.polarity === undefined) {
    return { ok: false, error: "invalid polarity" };
  }
  const recovered = recoverV2PropositionFromTypedPayload({
    kind,
    payload,
    existingProposition: asRecord(row.proposition) ?? {
      subject: row.subject,
      predicate: row.predicate,
      object: row.object ?? row.value,
      polarity: row.polarity,
      source_kind: row.source_kind,
      temporal_scope: row.temporal_scope,
    },
  });
  if (recovered.conflict) return { ok: false, error: "proposition_payload_conflict" };
  if (!recovered.proposition) {
    return { ok: false, error: recovered.error ?? "proposition requires subject, predicate, and object" };
  }
  return {
    ok: true,
    proposition: recovered.proposition,
    audit: recovered.recovered && recovered.audit
      ? {
          field: "proposition",
          original: null,
          normalized: recovered.proposition,
          rule: recovered.audit.recovery_rule,
          reason: `typed_payload_recovery fields=${recovered.audit.fields_used.join(",")}`,
        }
      : null,
  };
}

function normalizeEvidence(
  row: Record<string, unknown>,
  document: Record<string, unknown>,
): V2Evidence | { error: string } {
  const nested = asRecord(row.evidence) ?? {};
  const locatorRaw = nested.locator ?? row.locator;
  const locator =
    nonEmptyString(locatorRaw) ??
    (asRecord(locatorRaw) ? firstString(asRecord(locatorRaw)!, ["locator", "chapter"]) : undefined);
  const excerpt = firstString(nested, ["excerpt", "quote"]) ?? firstString(row, ["excerpt", "quote"]);
  const sourceSegment =
    firstString(nested, ["source_segment", "segment_id"]) ??
    firstString(row, ["source_segment"]) ??
    nonEmptyString(document.segment_id);
  if (!locator || !excerpt || !sourceSegment) {
    return { error: "evidence requires locator, excerpt, and source_segment" };
  }
  return omitEmpty({
    locator,
    excerpt,
    source_segment: sourceSegment,
    manuscript_id: firstString(nested, ["manuscript_id"]) ?? nonEmptyString(document.manuscript_id),
    manuscript_version_id:
      firstString(nested, ["manuscript_version_id"]) ?? nonEmptyString(document.manuscript_version_id),
    content_hash: firstString(nested, ["content_hash"]) ?? nonEmptyString(document.content_hash),
  }) as V2Evidence;
}

function applyFieldAliases(kind: V2ObservationKind, raw: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    raw: "raw_expression",
    raw_time: "raw_expression",
    expression: "raw_expression",
    clock: "clock_time",
    time_of_day: "clock_time",
    speaker_name: "speaker",
    claim: "claim_value",
    body: "body_region",
    region: "body_region",
    from_location: "origin",
    to_location: "destination",
    traveler_name: "traveler",
    capability: "capability_type",
    name: kind === "identity" ? "surface_name" : "name",
    claim_type: "identity_claim",
    presence_state: "presence",
    object_name: "object",
    departure_timestamp: "departure_time_id",
    arrival_timestamp: "arrival_time_id",
    acquisition_event: "acquisition_event_id",
    acquisition_time: "acquisition_time_id",
    assertion_time: "assertion_time_id",
    use_time: "assertion_time_id",
  };
  if (kind === "statement") aliases.topic = "proposition_topic";
  const out: Record<string, unknown> = { ...raw };
  for (const [from, to] of Object.entries(aliases)) {
    if (out[to] === undefined && out[from] !== undefined) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

function collectPayload(kind: V2ObservationKind, row: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(row.payload) ?? {};
  const merged = applyFieldAliases(kind, { ...row, ...nested });
  const payload: Record<string, unknown> = {};
  for (const key of KIND_FIELDS[kind]) {
    if (merged[key] !== undefined && merged[key] !== null && merged[key] !== "") {
      payload[key] = merged[key];
    }
  }
  if (kind === "event" && payload.object === undefined) {
    const target = nonEmptyString(merged.target);
    if (target) payload.object = target;
  }
  if (kind === "timestamp" && typeof payload.clock_time === "string") {
    payload.clock_time = payload.clock_time.trim();
  }
  if (kind === "object_equipment" && !nonEmptyString(payload.object) && nonEmptyString(payload.object_identity)) {
    payload.object = payload.object_identity;
  }
  if (kind === "timestamp" && (payload.raw_expression === undefined || payload.raw_expression === "")) {
    for (const field of [
      "clock_time",
      "date",
      "day_reference",
      "relative_time",
      "duration",
      "time_window",
      "sequence_marker",
    ] as const) {
      const value = nonEmptyString(payload[field]);
      if (value) {
        payload.raw_expression = value;
        break;
      }
    }
  }
  if (kind === "injury") {
    const laterality = pickEnum(payload.laterality ?? merged.side, V2_LATERALITIES);
    if (laterality) payload.laterality = laterality;
  }
  if (kind === "knowledge") {
    const state = pickEnum(payload.knowledge_state, V2_KNOWLEDGE_STATES);
    const perspective = pickEnum(payload.perspective, V2_KNOWLEDGE_PERSPECTIVES);
    if (state) payload.knowledge_state = state;
    if (perspective) payload.perspective = perspective;
  }
  if (kind === "operational_capability") {
    const state = pickEnum(payload.state, V2_CAPABILITY_STATES);
    const source = pickEnum(payload.source, V2_CAPABILITY_SOURCES);
    if (state) payload.state = state;
    if (source) payload.source = source;
  }
  if (kind === "relationship") {
    const state = pickEnum(payload.state, V2_RELATIONSHIP_STATES);
    if (state) payload.state = state;
  }
  if (kind === "location_presence") {
    const presence = pickEnum(payload.presence, V2_PRESENCE_STATES);
    if (presence) payload.presence = presence;
  }
  if (kind === "identity") {
    const claim = pickEnum(payload.identity_claim, ["also_known_as", "role", "same_as", "unlinked"] as const, {
      aka: "also_known_as",
      alias: "also_known_as",
    });
    if (claim) payload.identity_claim = claim;
  }
  if (kind === "travel_leg" && typeof payload.distance_if_explicit === "number") {
    payload.distance_if_explicit = payload.distance_if_explicit;
  }
  return omitEmpty(payload);
}

function quarantineReasonFromErrors(errors: string[]): V2QuarantineReason {
  const text = errors.join("; ");
  if (text.includes("clock_time is not supported")) return "invented_clock";
  if (text.includes("body_region must be a single region")) return "combined_injury_region";
  if (text.includes("narration naming is not character knowledge")) return "narration_as_knowledge";
  if (text.includes("excerpt") || text.includes("locator") || text.includes("evidence")) {
    return "invalid_evidence";
  }
  if (text.includes("polarity")) return "invalid_polarity";
  if (text.includes("proposition_payload_conflict")) return "proposition_payload_conflict";
  if (text.includes("proposition")) return "missing_proposition";
  return "invalid_payload";
}

function validateOne(observation: V2Observation, segmentId: string): string[] {
  const document = emptySegmentObservationV2(segmentId);
  document.observations = [observation];
  const result = validateSegmentObservationV2(document);
  return result.ok ? [] : result.errors;
}

function hardFail(
  reason: V2AdapterHardFailure,
  detail: string,
  diagnostics: string[],
  truncationRecovery?: V2TruncationRecoveryAudit,
): V2AdapterResult {
  return {
    ok: false,
    hard_failure: reason,
    hard_failure_detail: detail,
    document: null,
    retained: [],
    quarantined: [],
    suppressed_duplicates: 0,
    entity_ids_stripped: 0,
    diagnostics: [...diagnostics, detail],
    normalizations: [],
    confirmation_grade_count: 0,
    evidence_gate_applied: false,
    evidence_verified_count: 0,
    compactness: { output_tokens: 0, observation_count: 0 },
    truncation_recovery: truncationRecovery ?? emptyV2TruncationRecoveryAudit(),
  };
}

export interface V2AdapterOptions {
  segmentText?: string;
  finishReason?: string | null;
}

export function adaptV2ProviderOutput(
  raw: unknown,
  expectedSegmentId?: string,
  options?: V2AdapterOptions,
): V2AdapterResult {
  const diagnostics: string[] = [];
  let truncationRecovery = emptyV2TruncationRecoveryAudit(options?.finishReason);
  let parsed = parseProviderJson(raw);
  if (!parsed.ok) {
    if (typeof raw === "string") {
      const recovered = recoverV2TruncatedObservations(raw, { finishReason: options?.finishReason });
      truncationRecovery = recovered.audit;
      if (!recovered.invoked) {
        return hardFail("invalid_json", parsed.error, diagnostics, truncationRecovery);
      }
      if (!recovered.ok || !recovered.value) {
        return hardFail(
          "invalid_json",
          recovered.error ?? "truncated observations[] unrecoverable",
          diagnostics,
          truncationRecovery,
        );
      }
      parsed = { ok: true, value: recovered.value };
      diagnostics.push(
        `truncated_prefix_recovery: ${recovered.audit.complete_objects_recovered} complete objects recovered`,
      );
    } else {
      return hardFail("invalid_json", parsed.error, diagnostics, truncationRecovery);
    }
  }

  const record = asRecord(parsed.value);
  if (!record) return hardFail("invalid_json", "provider output must be an object", diagnostics, truncationRecovery);

  if (record.schema === ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V1) {
    return hardFail(
      "v1_cannot_be_reinterpreted",
      "v1 observations cannot be reinterpreted as v2",
      diagnostics,
      truncationRecovery,
    );
  }
  if (record.schema !== ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2) {
    return hardFail(
      "unsupported_schema",
      `schema must be ${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}`,
      diagnostics,
      truncationRecovery,
    );
  }

  const authority = hasUnsafeAuthority(record);
  if (authority) return hardFail("accepted_canon", authority, diagnostics, truncationRecovery);

  const segmentId = nonEmptyString(record.segment_id) ?? expectedSegmentId;
  if (!segmentId) {
    return hardFail("unsupported_schema", "segment_id is required", diagnostics, truncationRecovery);
  }
  if (expectedSegmentId && segmentId !== expectedSegmentId) {
    return hardFail("unsupported_schema", "segment_id does not match planned segment", diagnostics, truncationRecovery);
  }

  if (!Array.isArray(record.observations)) {
    return hardFail("unsupported_schema", "observations must be an array", diagnostics, truncationRecovery);
  }

  let entityIdsStripped = 0;
  const entities: V2ObservationEntity[] = [];
  for (const item of Array.isArray(record.entities) ? record.entities : []) {
    const row = asRecord(item);
    if (!row) continue;
    if (row.entity_id !== undefined) {
      delete row.entity_id;
      entityIdsStripped += 1;
      diagnostics.push("entity_id_stripped");
    }
    const alias = nonEmptyString(row.alias);
    if (!alias) continue;
    if (!CANON_ENTITY_TYPES.includes(row.entity_type as never)) continue;
    entities.push({
      alias,
      entity_type: row.entity_type as V2ObservationEntity["entity_type"],
      local_mentions: Array.isArray(row.local_mentions)
        ? row.local_mentions.filter((value): value is string => typeof value === "string")
        : [alias],
    });
  }

  const quarantined: V2ObservationQuarantine[] = [];
  const retained: V2Observation[] = [];
  const normalizations: V2NormalizationAudit[] = [];

  if (Array.isArray(record.local_continuity_concerns) && record.local_continuity_concerns.length) {
    diagnostics.push("editorial_output_stripped");
    quarantined.push({
      reason: "editorial_output",
      detail: "local_continuity_concerns are editorial and were dropped",
    });
  }

  for (const item of record.observations) {
    const row = asRecord(item);
    if (!row) {
      quarantined.push({ reason: "invalid_payload", detail: "observation row must be an object" });
      continue;
    }
    const id = firstString(row, ["id", "observation_id"]) ?? "observation";
    if (hasUnsafeAuthority(row)) {
      return hardFail("accepted_canon", `${id}: accepted canon`, diagnostics, truncationRecovery);
    }
    if (row.entity_id !== undefined) {
      delete row.entity_id;
      entityIdsStripped += 1;
      diagnostics.push(`${id}: entity_id_stripped`);
    }
    const kind = normalizeKind(row.kind);
    if (!kind || !V2_OBSERVATION_KINDS.includes(kind)) {
      quarantined.push({ observation_id: id, reason: "unsupported_kind", detail: `kind ${String(row.kind)}` });
      continue;
    }
    const payload = collectPayload(kind, row);
    if (kind === "travel_leg" && typeof payload.distance_if_explicit === "number") {
      quarantined.push({
        observation_id: id,
        reason: "calculated_distance",
        detail: "distance_if_explicit must be an explicit manuscript string",
      });
      continue;
    }
    const proposition = resolveProposition(kind, row, payload);
    if (!proposition.ok) {
      const reason = proposition.error.includes("polarity")
        ? "invalid_polarity"
        : proposition.error.includes("proposition_payload_conflict")
          ? "proposition_payload_conflict"
          : "missing_proposition";
      quarantined.push({
        observation_id: id,
        reason,
        detail: proposition.error,
      });
      continue;
    }
    if (proposition.audit) {
      normalizations.push({ observation_id: id, ...proposition.audit });
      diagnostics.push(
        `${id}: ${proposition.audit.rule} proposition recovered (${proposition.audit.reason})`,
      );
    }
    const evidence = normalizeEvidence(row, record);
    if ("error" in evidence) {
      quarantined.push({
        observation_id: id,
        reason: "insufficient_evidence",
        detail: evidence.error,
      });
      continue;
    }
    const inferred = normalizeBoolean(row.inferred);
    if (inferred === null) {
      quarantined.push({ observation_id: id, reason: "invalid_payload", detail: "inferred must be boolean" });
      continue;
    }
    const confidenceRaw = firstString(row, ["confidence"]);
    const confidence: ArchivistConfidence =
      confidenceRaw && isArchivistConfidence(confidenceRaw.toLowerCase())
        ? (confidenceRaw.toLowerCase() as ArchivistConfidence)
        : "medium";

    const normalized = applySafeEnumNormalizations({
      observationId: id,
      kind,
      payload,
      proposition: proposition.proposition,
      excerpt: evidence.excerpt,
    });
    if (normalized.error) {
      const reason = normalized.error.includes("laterality")
        ? "laterality_evidence_conflict"
        : normalized.error.includes("polarity")
          ? "invalid_polarity"
          : "invalid_payload";
      quarantined.push({
        observation_id: id,
        reason,
        detail: normalized.error,
        excerpt: evidence.excerpt,
        locator: evidence.locator,
        kind,
      });
      continue;
    }
    normalizations.push(...normalized.audits);
    for (const audit of normalized.audits) {
      diagnostics.push(
        `${id}: ${audit.rule} ${String(audit.field)} ${JSON.stringify(audit.original)}→${JSON.stringify(audit.normalized)} (${audit.reason})`,
      );
    }

    const observation = {
      id,
      kind,
      payload: normalized.payload,
      proposition: normalized.proposition,
      evidence,
      confidence,
      inferred,
    } as unknown as V2Observation;

    const errors = validateOne(observation, segmentId);
    if (errors.length) {
      quarantined.push({
        observation_id: id,
        reason: quarantineReasonFromErrors(errors),
        detail: errors.join("; "),
        excerpt: evidence.excerpt,
        locator: evidence.locator,
        kind,
        observation,
      });
      continue;
    }

    const gate = applySegmentEvidenceGate({
      excerpt: evidence.excerpt,
      segmentText: options?.segmentText,
    });
    if (gate.applied) {
      observation.evidence = {
        ...evidence,
        evidence_status: gate.evidence_status,
        evidence_match_method: gate.evidence_match_method ?? undefined,
        normalized_punctuation: gate.normalized_punctuation,
        raw_source_match_window: gate.raw_source_match_window ?? undefined,
      };
      if (!gate.contiguous) {
        quarantined.push({
          observation_id: id,
          reason: "non_contiguous_evidence",
          detail: "excerpt is not an exact contiguous substring of the supplied segment",
          excerpt: evidence.excerpt,
          locator: evidence.locator,
          kind,
          observation,
          evidence_status: "unverified",
        });
        continue;
      }
    }
    retained.push(observation);
  }

  const deduped = suppressDuplicateObservations(retained);
  for (const observation of retained) {
    if (!deduped.kept.includes(observation)) {
      quarantined.push({
        observation_id: observation.id,
        reason: "duplicate",
        detail: "exact semantic duplicate suppressed",
      });
    }
  }

  const ambiguities = Array.isArray(record.entity_ambiguities)
    ? record.entity_ambiguities.flatMap((item) => {
        const row = asRecord(item);
        if (!row) return [];
        if (row.entity_id !== undefined) {
          entityIdsStripped += 1;
          delete row.entity_id;
        }
        const alias = nonEmptyString(row.alias);
        const reason = nonEmptyString(row.reason);
        return alias && reason ? [{ alias, reason }] : [];
      })
    : [];

  const document: ArchivistSegmentObservationV2 = {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: segmentId,
    entities,
    observations: deduped.kept,
    local_continuity_concerns: [],
    entity_ambiguities: ambiguities,
    manuscript_id: nonEmptyString(record.manuscript_id),
    manuscript_version_id: nonEmptyString(record.manuscript_version_id),
    content_hash: nonEmptyString(record.content_hash),
    contract_version: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  };

  const validated = validateSegmentObservationV2(document, expectedSegmentId);
  if (!validated.ok) {
    return hardFail("unsupported_schema", validated.errors.join("; "), diagnostics, truncationRecovery);
  }

  return {
    ok: true,
    hard_failure: null,
    hard_failure_detail: null,
    document: validated.observation,
    retained: validated.observation.observations,
    quarantined,
    suppressed_duplicates: deduped.suppressed,
    entity_ids_stripped: entityIdsStripped,
    diagnostics,
    normalizations,
    confirmation_grade_count: validated.observation.observations.filter(observationIsConfirmationGrade).length,
    evidence_gate_applied: options?.segmentText !== undefined,
    evidence_verified_count: validated.observation.observations.filter(
      (item) => item.evidence.evidence_status === "verified",
    ).length,
    compactness: {
      output_tokens: estimateJsonTokens(validated.observation),
      observation_count: validated.observation.observations.length,
    },
    truncation_recovery: truncationRecovery,
  };
}
