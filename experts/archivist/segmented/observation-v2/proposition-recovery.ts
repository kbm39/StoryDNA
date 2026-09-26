/**
 * Deterministic V2 compact-proposition recovery.
 * Synthesizes the representation object `proposition` only from typed fields
 * already present on the SAME observation. Does not invent semantics.
 */

import { V2_OBSERVATION_KINDS, V2_POLARITIES, V2_SOURCE_KINDS } from "./constants.ts";
import type { V2ObservationKind, V2Polarity, V2Proposition, V2SourceKind } from "./types.ts";

export const V2_PROPOSITION_RECOVERY_VERSION = "archivist_v2_proposition_recovery@v2" as const;

/**
 * Architecture (documented, not a silent schema change):
 * A future model-facing V2 contract revision should make nested `proposition`
 * optional when the typed payload is already semantically complete.
 * The validated envelope may still require `proposition` AFTER this recovery.
 * This freeze does not bump `archivist_segment_observation@v2`.
 */

export interface V2PropositionRecoveryAudit {
  proposition_source: "typed_payload_recovery";
  recovery_rule: string;
  original_proposition_present: false;
  fields_used: string[];
}

export interface V2PropositionRecoveryResult {
  proposition: V2Proposition | null;
  recovered: boolean;
  error: string | null;
  conflict: boolean;
  audit: V2PropositionRecoveryAudit | null;
}

export interface V2KindRecoveryMatrixRow {
  kind: V2ObservationKind;
  proposition_required: true;
  typed_payload_sufficient: boolean;
  safe_deterministic_recovery: boolean;
  implemented: boolean;
  reason: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function polarityOf(value: unknown): V2Polarity | null {
  if (value === true || value === 1) return "true";
  if (value === false || value === 0) return "false";
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (["true", "yes", "affirmative", "asserted"].includes(key)) return "true";
  if (["false", "no", "negated", "denied"].includes(key)) return "false";
  if (["unknown", "unclear", "unspecified"].includes(key)) return "unknown";
  return V2_POLARITIES.includes(key as V2Polarity) ? (key as V2Polarity) : null;
}

function sourceKindOf(value: unknown): V2SourceKind | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  if (key === "statement") return "dialogue";
  if (V2_SOURCE_KINDS.includes(key as V2SourceKind)) return key as V2SourceKind;
  return undefined;
}

function existingProposition(value: unknown): V2Proposition | null {
  const row = asRecord(value);
  if (!row) return null;
  const subject = text(row.subject);
  const predicate = text(row.predicate);
  const object = text(row.object);
  if (!subject || !predicate || !object) return null;
  return {
    subject,
    predicate,
    object,
    polarity: polarityOf(row.polarity) ?? "unknown",
    source_kind: sourceKindOf(row.source_kind) ?? "narration",
    ...(text(row.temporal_scope) ? { temporal_scope: text(row.temporal_scope) } : {}),
  };
}

function clockDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

function timestampSemantic(payload: Record<string, unknown>): { field: string; value: string } | null {
  const order = [
    "clock_time",
    "date",
    "day_reference",
    "relative_time",
    "duration",
    "time_window",
    "sequence_marker",
    "raw_expression",
  ] as const;
  for (const field of order) {
    const value = text(payload[field]);
    if (value) return { field, value };
  }
  return null;
}

const TIMESTAMP_PREDICATES = new Set([
  "clock_time",
  "date",
  "day_reference",
  "relative_time",
  "duration",
  "time_window",
  "sequence_marker",
  "raw_expression",
]);

function timestampConflict(existing: V2Proposition, payload: Record<string, unknown>): boolean {
  if (!TIMESTAMP_PREDICATES.has(existing.predicate)) return false;
  const clock = text(payload.clock_time) ?? text(payload.date);
  if (!clock) return false;
  const payloadDigits = clockDigits(clock);
  const existingDigits = clockDigits(existing.object);
  return Boolean(payloadDigits && existingDigits && payloadDigits !== existingDigits);
}

function objectIdentityOf(payload: Record<string, unknown>): string | undefined {
  return text(payload.object) ?? text(payload.object_identity);
}

function objectEquipmentConflict(existing: V2Proposition, payload: Record<string, unknown>): boolean {
  const payloadObject = text(payload.object);
  if (!payloadObject || text(payload.object_identity)) return false;
  const a = norm(payloadObject);
  const b = norm(existing.object);
  if (a === b || a.includes(b) || b.includes(a)) return false;
  const subject = norm(existing.subject);
  if (subject === a || subject.includes(a) || a.includes(subject)) return false;
  return true;
}

function capabilityStateConflict(existing: V2Proposition, payload: Record<string, unknown>): boolean {
  const object = norm(existing.object);
  const state = text(payload.state)?.toLowerCase();
  const states = new Set(["available", "unavailable", "unknown", "used"]);
  return Boolean(state && states.has(object) && states.has(state) && object !== state);
}

function capabilityPolarity(state: string): V2Polarity | null {
  if (state === "unavailable") return "false";
  if (state === "available" || state === "used") return "true";
  if (state === "unknown") return "unknown";
  return null;
}

function fromTypedPayload(
  kind: V2ObservationKind,
  payload: Record<string, unknown>,
): { proposition: V2Proposition; rule: string; fields_used: string[] } | { error: string } {
  if (kind === "operational_capability") {
    const subject = text(payload.entity);
    const predicate = text(payload.capability_type);
    const object = text(payload.state);
    if (!subject) return { error: "capability entity is required" };
    if (!predicate) return { error: "capability_type is required" };
    if (!object) return { error: "capability state is required" };
    const polarity = capabilityPolarity(object);
    if (!polarity) return { error: "capability state is not a typed enum" };
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity,
        source_kind: sourceKindOf(payload.source) ?? "narration",
        ...(text(payload.time_scope) ? { temporal_scope: text(payload.time_scope) } : {}),
      },
      rule: "operational_capability_typed_payload",
      fields_used: ["entity", "capability_type", "state", ...(payload.source ? ["source"] : [])],
    };
  }
  if (kind === "event") {
    const subject = text(payload.actor);
    const predicate = text(payload.action);
    const object = text(payload.object) ?? text(payload.target) ?? text(payload.result);
    if (!subject) return { error: "event actor is required" };
    if (!predicate) return { error: "event action is required" };
    if (!object) return { error: "event object/target/result is required" };
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity: "true",
        source_kind: "event",
      },
      rule: "event_typed_payload",
      fields_used: ["actor", "action", object === text(payload.object) ? "object" : text(payload.target) ? "target" : "result"],
    };
  }
  if (kind === "statement") {
    const subject = text(payload.speaker);
    const predicate = text(payload.proposition_topic);
    const object = text(payload.claim_value) ?? text(payload.target);
    const polarity = polarityOf(payload.polarity);
    if (!subject) return { error: "statement speaker is required" };
    if (!predicate) return { error: "statement proposition_topic is required" };
    if (!object) return { error: "statement claim_value/target is required" };
    if (!polarity) return { error: "statement polarity is required" };
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity,
        source_kind: "dialogue",
      },
      rule: "statement_typed_payload",
      fields_used: ["speaker", "proposition_topic", text(payload.claim_value) ? "claim_value" : "target", "polarity"],
    };
  }
  if (kind === "knowledge") {
    const subject = text(payload.entity);
    const predicate = text(payload.knowledge_state);
    const object = text(payload.topic);
    if (!subject || !predicate || !object) return { error: "knowledge entity/topic/knowledge_state required" };
    const polarity =
      predicate === "unknown" ? "false" : predicate === "inferred" ? "unknown" : "true";
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity,
        source_kind: text(payload.perspective) === "narration" ? "narration" : "dialogue",
      },
      rule: "knowledge_typed_payload",
      fields_used: ["entity", "knowledge_state", "topic"],
    };
  }
  if (kind === "relationship") {
    const subject = text(payload.subject);
    const predicate = text(payload.relationship_type);
    const object = text(payload.counterparty);
    const state = text(payload.state);
    if (!subject || !predicate || !object || !state) {
      return { error: "relationship subject/type/counterparty/state required" };
    }
    const polarity =
      state === "exists" ? "true" : state === "does_not_exist" ? "false" : "unknown";
    return {
      proposition: { subject, predicate, object, polarity, source_kind: "narration" },
      rule: "relationship_typed_payload",
      fields_used: ["subject", "relationship_type", "counterparty", "state"],
    };
  }
  if (kind === "identity") {
    const subject = text(payload.surface_name);
    const predicate = text(payload.identity_claim);
    const object = text(payload.alias) ?? text(payload.role) ?? predicate;
    if (!subject || !predicate || !object) return { error: "identity surface_name/identity_claim required" };
    return {
      proposition: { subject, predicate, object, polarity: "true", source_kind: "narration" },
      rule: "identity_typed_payload",
      fields_used: ["surface_name", "identity_claim", text(payload.alias) ? "alias" : "role"],
    };
  }
  if (kind === "location_presence") {
    const subject = text(payload.entity);
    const predicate = text(payload.presence);
    const object = text(payload.location);
    if (!subject || !predicate || !object) return { error: "location_presence entity/presence/location required" };
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity: predicate === "absent" ? "false" : "true",
        source_kind: "narration",
      },
      rule: "location_presence_typed_payload",
      fields_used: ["entity", "presence", "location"],
    };
  }
  if (kind === "object_equipment") {
    const identity = objectIdentityOf(payload);
    const predicate = text(payload.action_or_state);
    if (!identity) return { error: "object_equipment object/object_identity is required" };
    if (!predicate) return { error: "object_equipment action_or_state is required" };
    const subject = text(payload.entity) ?? identity;
    const fields_used = [
      ...(text(payload.entity) ? ["entity"] : []),
      text(payload.object) ? "object" : "object_identity",
      "action_or_state",
    ];
    return {
      proposition: {
        subject,
        predicate,
        object: identity,
        polarity: "true",
        source_kind: "narration",
      },
      rule: "object_equipment_typed_payload",
      fields_used,
    };
  }
  if (kind === "injury") {
    const subject = text(payload.entity);
    const object = text(payload.body_region);
    const predicate =
      text(payload.condition) ?? text(payload.diagnosis) ?? text(payload.injury_type) ?? "injured";
    if (!subject) return { error: "injury entity is required" };
    if (!object) return { error: "injury body_region is required" };
    const fields_used = [
      "entity",
      "body_region",
      ...(text(payload.condition)
        ? (["condition"] as const)
        : text(payload.diagnosis)
          ? (["diagnosis"] as const)
          : text(payload.injury_type)
            ? (["injury_type"] as const)
            : []),
      ...(text(payload.laterality) ? (["laterality"] as const) : []),
    ];
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity: "true",
        source_kind: "narration",
      },
      rule: "injury_typed_payload",
      fields_used: [...fields_used],
    };
  }
  if (kind === "travel_leg") {
    const subject = text(payload.traveler);
    const object = text(payload.destination);
    const mode = text(payload.mode);
    if (!subject) return { error: "travel_leg traveler is required" };
    if (!object) return { error: "travel_leg destination is required" };
    const predicate = mode ?? "travels";
    const fields_used = [
      "traveler",
      "destination",
      ...(mode ? (["mode"] as const) : []),
      ...(text(payload.origin) ? (["origin"] as const) : []),
    ];
    return {
      proposition: {
        subject,
        predicate,
        object,
        polarity: "true",
        source_kind: "narration",
      },
      rule: "travel_leg_typed_payload",
      fields_used: [...fields_used],
    };
  }
  if (kind === "timestamp") {
    const semantic = timestampSemantic(payload);
    if (!semantic) return { error: "timestamp has no safe typed-payload proposition mapping" };
    const fields_used = [semantic.field];
    if (semantic.field !== "raw_expression" && text(payload.raw_expression)) fields_used.push("raw_expression");
    return {
      proposition: {
        subject: "timestamp",
        predicate: semantic.field,
        object: semantic.value,
        polarity: "true",
        source_kind: "narration",
        ...(text(payload.raw_expression) && semantic.field !== "raw_expression"
          ? { temporal_scope: text(payload.raw_expression) }
          : {}),
      },
      rule: "timestamp_typed_payload",
      fields_used,
    };
  }
  return { error: `${kind} has no safe typed-payload proposition mapping` };
}

export function recoverV2PropositionFromTypedPayload(args: {
  kind: V2ObservationKind;
  payload: Record<string, unknown>;
  existingProposition?: unknown;
}): V2PropositionRecoveryResult {
  const existing = existingProposition(args.existingProposition);
  const derived = fromTypedPayload(args.kind, args.payload);
  if ("proposition" in derived) {
    const conflict =
      (args.kind === "operational_capability" && existing && capabilityStateConflict(existing, args.payload)) ||
      (args.kind === "timestamp" && existing && timestampConflict(existing, args.payload)) ||
      (args.kind === "object_equipment" && existing && objectEquipmentConflict(existing, args.payload));
    if (conflict) {
      return {
        proposition: null,
        recovered: false,
        error: "proposition_payload_conflict",
        conflict: true,
        audit: null,
      };
    }
    if (existing) {
      return { proposition: existing, recovered: false, error: null, conflict: false, audit: null };
    }
    return {
      proposition: derived.proposition,
      recovered: true,
      error: null,
      conflict: false,
      audit: {
        proposition_source: "typed_payload_recovery",
        recovery_rule: derived.rule,
        original_proposition_present: false,
        fields_used: derived.fields_used,
      },
    };
  }
  if (existing) {
    return { proposition: existing, recovered: false, error: null, conflict: false, audit: null };
  }
  return {
    proposition: null,
    recovered: false,
    error: derived.error,
    conflict: false,
    audit: null,
  };
}

export const V2_PROPOSITION_RECOVERY_MATRIX: V2KindRecoveryMatrixRow[] = V2_OBSERVATION_KINDS.map((kind) => {
  const implemented = [
    "timestamp",
    "operational_capability",
    "event",
    "statement",
    "knowledge",
    "relationship",
    "identity",
    "location_presence",
    "object_equipment",
    "injury",
    "travel_leg",
  ].includes(kind);
  const reasons: Record<V2ObservationKind, string> = {
    timestamp: "same-row clock_time/date/day_reference/relative_time/duration/time_window/sequence_marker/raw_expression; no invented clocks",
    event: "actor + action + object/target/result are a complete proposition",
    statement: "speaker + proposition_topic + claim_value/target + polarity are complete; missing speaker stays fail-closed",
    knowledge: "entity + knowledge_state + topic are complete typed fields",
    travel_leg: "traveler + destination; predicate is mode or kind-default travels; origin stays on typed payload",
    operational_capability: "entity + capability_type + state are a complete proposition",
    injury: "entity + body_region; predicate is condition/diagnosis/injury_type or kind-default injured",
    relationship: "subject + relationship_type + counterparty + state are complete",
    identity: "surface_name + identity_claim + alias/role are complete",
    location_presence: "entity + presence + location are complete",
    object_equipment: "object/object_identity + action_or_state; entity/location only when already present",
  };
  return {
    kind,
    proposition_required: true,
    typed_payload_sufficient: implemented,
    safe_deterministic_recovery: implemented,
    implemented,
    reason: reasons[kind],
  };
});
