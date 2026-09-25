/**
 * Deterministic V2 compact-proposition recovery.
 * Synthesizes the representation object `proposition` only from typed fields
 * already present on the SAME observation. Does not invent semantics.
 */

import { V2_OBSERVATION_KINDS, V2_POLARITIES, V2_SOURCE_KINDS } from "./constants.ts";
import type { V2ObservationKind, V2Polarity, V2Proposition, V2SourceKind } from "./types.ts";

export const V2_PROPOSITION_RECOVERY_VERSION = "archivist_v2_proposition_recovery@v1" as const;

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
    const subject = text(payload.entity);
    const predicate = text(payload.action_or_state);
    const object = text(payload.object);
    if (!subject || !predicate || !object) {
      return { error: "object_equipment entity/action_or_state/object required" };
    }
    return {
      proposition: { subject, predicate, object, polarity: "true", source_kind: "narration" },
      rule: "object_equipment_typed_payload",
      fields_used: ["entity", "action_or_state", "object"],
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
    if (existing && args.kind === "operational_capability" && capabilityStateConflict(existing, args.payload)) {
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
    "operational_capability",
    "event",
    "statement",
    "knowledge",
    "relationship",
    "identity",
    "location_presence",
    "object_equipment",
  ].includes(kind);
  const reasons: Record<V2ObservationKind, string> = {
    timestamp: "typed payload has raw_expression but no unambiguous subject/predicate pair",
    event: "actor + action + object/target/result are a complete proposition",
    statement: "speaker + proposition_topic + claim_value/target + polarity are complete; missing speaker stays fail-closed",
    knowledge: "entity + knowledge_state + topic are complete typed fields",
    travel_leg: "origin/destination/mode are present but no emitted predicate; would invent 'travels'",
    operational_capability: "entity + capability_type + state are a complete proposition",
    injury: "entity + body_region are present but no emitted predicate; would invent 'injured'",
    relationship: "subject + relationship_type + counterparty + state are complete",
    identity: "surface_name + identity_claim + alias/role are complete",
    location_presence: "entity + presence + location are complete",
    object_equipment: "only when entity + action_or_state + object are all emitted",
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
