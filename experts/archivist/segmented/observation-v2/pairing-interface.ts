import type { V2Observation, V2PairingInterface } from "./types.ts";

function topicOf(observation: V2Observation): string {
  const payload = observation.payload as unknown as Record<string, unknown>;
  return String(
    payload.proposition_topic ??
      payload.topic ??
      payload.capability_type ??
      payload.object ??
      payload.body_region ??
      payload.relationship_type ??
      observation.proposition.predicate,
  ).toLowerCase();
}

function entityOf(observation: V2Observation): string {
  const payload = observation.payload as unknown as Record<string, unknown>;
  return String(
    payload.entity ??
      payload.speaker ??
      payload.actor ??
      payload.subject ??
      payload.traveler ??
      payload.surface_name ??
      observation.proposition.subject,
  ).toLowerCase();
}

/**
 * Future pairing consumes two V2 observations through one of these interfaces.
 * This does not decide contradiction eligibility. It only names the comparison.
 */
export function classifyV2PairingInterface(
  left: V2Observation,
  right: V2Observation,
): V2PairingInterface | "not_comparable" {
  const kinds = new Set([left.kind, right.kind]);
  if (kinds.size === 1 && left.kind === "timestamp") return "clock_vs_clock";
  if (kinds.has("statement") && kinds.has("timestamp")) return "clock_vs_clock";
  if (kinds.has("statement") && kinds.has("event")) return "statement_vs_event";
  if (kinds.has("object_equipment") && kinds.has("location_presence")) return "object_equipment";
  if (
    kinds.has("statement") &&
    kinds.has("operational_capability") &&
    topicOf(left) === topicOf(right)
  ) {
    return "operational_capability";
  }
  if (kinds.size === 1 && left.kind === "operational_capability") return "operational_capability";
  if (kinds.size === 1 && left.kind === "travel_leg") return "travel_leg";
  if (
    kinds.has("travel_leg") &&
    kinds.has("timestamp")
  ) {
    return "travel_leg";
  }
  if (kinds.size === 1 && left.kind === "knowledge" && topicOf(left) === topicOf(right)) {
    return "knowledge_acquisition_vs_use";
  }
  if (kinds.size === 1 && left.kind === "injury" && entityOf(left) === entityOf(right)) {
    return "injury_state";
  }
  if (kinds.size === 1 && left.kind === "relationship") return "relationship_state";
  if (kinds.has("relationship") && kinds.has("statement")) return "relationship_state";
  if (kinds.size === 1 && left.kind === "identity") return "identity";
  if (kinds.size === 1 && left.kind === "location_presence" && entityOf(left) === entityOf(right)) {
    return "location_presence";
  }
  if (kinds.has("statement") && kinds.has("location_presence")) return "location_presence";
  if (kinds.size === 1 && left.kind === "object_equipment") return "object_equipment";
  if (kinds.has("object_equipment") && kinds.has("statement")) return "object_equipment";
  if (kinds.size === 1 && left.kind === "statement" && topicOf(left) === topicOf(right)) {
    return "statement_vs_event";
  }
  if (kinds.has("event") && kinds.has("timestamp")) return "clock_vs_clock";
  return "not_comparable";
}

export const V2_PAIRING_INTERFACE_CONTRACT = {
  statement_vs_event: "Compare a speaker proposition to a structured event with the same topic.",
  clock_vs_clock: "Compare two timestamp observations on the same event or sequence.",
  travel_leg: "Compare origin/departure to destination/arrival, including attached clocks and mode.",
  knowledge_acquisition_vs_use:
    "Compare a learned/unknown knowledge observation to a later known/claimed use of the same topic.",
  injury_state:
    "Compare two injuries for the same entity and same injury_event_id or same single body_region.",
  relationship_state:
    "Compare relationship existence/state for the same subject, counterparty, and type.",
  identity: "Compare identity claims. Do not silently merge surface names.",
  location_presence:
    "Compare presence only when time_reference matches. Different times are not automatic conflicts.",
  object_equipment: "Compare object_identity and action/state at a time/location.",
  operational_capability:
    "Compare a capability statement (available/unavailable) to an event or used capability.",
} as const;
