/**
 * Deterministic V2 observation comparability.
 * Asks whether two observations are comparable before asking whether they conflict.
 * Does not call a provider. Does not confirm contradictions. Does not write canon.
 */

import { chapterOrdinalFromLocator } from "../comparison-key.ts";
import { v2AliveDeadState, v2ObservationEntityKey } from "./entity-resolution.ts";
import type { V2Observation, V2PairingInterface } from "./types.ts";
import { classifyV2PairingInterface } from "./pairing-interface.ts";

export const V2_OBSERVATION_COMPARISON_VERSION = "archivist_v2_observation_comparison@v1" as const;

export const V2_COMPARISON_ELIGIBILITIES = [
  "comparable",
  "equivalent",
  "not_comparable",
  "insufficient_semantic_specificity",
] as const;
export type V2ComparisonEligibility = (typeof V2_COMPARISON_ELIGIBILITIES)[number];

export type V2IdentityStatus = "resolved" | "explicit_alias" | "ambiguous" | "unresolved";

export interface V2ComparisonContext {
  ambiguous_aliases?: readonly string[];
  resolved_aliases?: readonly string[];
  explicit_alias_links?: ReadonlyArray<readonly [string, string]>;
}

export interface V2ComparisonDiagnosis {
  left_id: string;
  right_id: string;
  pairing_interface: V2PairingInterface | "alive_dead" | "rank_role" | "chronology" | "not_comparable";
  eligibility: V2ComparisonEligibility;
  reason: string;
  explanation: string;
  identity_status: V2IdentityStatus;
  confirmation_blocked: boolean;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function payload(observation: V2Observation): Record<string, unknown> {
  return observation.payload as unknown as Record<string, unknown>;
}

function entityOf(observation: V2Observation): string {
  return v2ObservationEntityKey(observation);
}

function topicOf(observation: V2Observation): string {
  const row = payload(observation);
  return norm(
    text(row.proposition_topic) ??
      text(row.topic) ??
      text(row.capability_type) ??
      text(row.object) ??
      text(row.action) ??
      observation.proposition.predicate,
  );
}

function clockDigits(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

function clockFrom(observation: V2Observation): string {
  const row = payload(observation);
  return clockDigits(
    text(row.clock_time) ??
      text(row.date) ??
      text(row.claim_value) ??
      text(row.duration) ??
      observation.proposition.object,
  );
}

function locatorOrder(observation: V2Observation): number | null {
  return chapterOrdinalFromLocator(observation.evidence.locator);
}

function aliasSet(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map((item) => norm(item)).filter(Boolean));
}

function identityStatusFor(
  leftEntity: string,
  rightEntity: string,
  context: V2ComparisonContext | undefined,
): V2IdentityStatus {
  const ambiguous = aliasSet(context?.ambiguous_aliases);
  if (ambiguous.has(leftEntity) || ambiguous.has(rightEntity)) return "ambiguous";
  const links = context?.explicit_alias_links ?? [];
  const linked = links.some(([a, b]) => {
    const left = norm(a);
    const right = norm(b);
    return (
      (left === leftEntity && right === rightEntity) ||
      (left === rightEntity && right === leftEntity)
    );
  });
  if (linked) return "explicit_alias";
  if (leftEntity && rightEntity && leftEntity === rightEntity) return "resolved";
  const resolved = aliasSet(context?.resolved_aliases);
  if (resolved.has(leftEntity) && resolved.has(rightEntity)) return "resolved";
  return "unresolved";
}

function entitiesAlign(
  left: V2Observation,
  right: V2Observation,
  context: V2ComparisonContext | undefined,
): boolean {
  const a = entityOf(left);
  const b = entityOf(right);
  if (a && b && a === b) return true;
  const links = context?.explicit_alias_links ?? [];
  return links.some(([leftName, rightName]) => {
    const x = norm(leftName);
    const y = norm(rightName);
    return (x === a && y === b) || (x === b && y === a);
  });
}

function sharedTimeAnchor(left: V2Observation, right: V2Observation): boolean {
  const a = payload(left);
  const b = payload(right);
  const keys = ["attached_event_id", "time_reference_id", "assertion_time_id", "departure_time_id", "arrival_time_id"];
  for (const key of keys) {
    const leftId = text(a[key]);
    const rightId = text(b[key]);
    if (leftId && rightId && leftId === rightId) return true;
  }
  const leftSeq = text(a.sequence_marker);
  const rightSeq = text(b.sequence_marker);
  if (leftSeq && rightSeq && norm(leftSeq) === norm(rightSeq)) return true;
  const leftWindow = text(a.time_window) ?? text(a.time_scope);
  const rightWindow = text(b.time_window) ?? text(b.time_scope);
  return Boolean(leftWindow && rightWindow && norm(leftWindow) === norm(rightWindow));
}

function diagnoseClock(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  if (!sharedTimeAnchor(left, right)) {
    return {
      pairing_interface: "clock_vs_clock",
      eligibility: "not_comparable",
      reason: "unrelated_timestamps",
      explanation: "Timestamps do not share an event, sequence, or time window.",
    };
  }
  const leftClock = clockFrom(left);
  const rightClock = clockFrom(right);
  if (!leftClock || !rightClock) {
    return {
      pairing_interface: "clock_vs_clock",
      eligibility: "insufficient_semantic_specificity",
      reason: "missing_clock_digits",
      explanation: "A shared time anchor exists but no explicit clock/date digits are present.",
    };
  }
  if (leftClock === rightClock) {
    return {
      pairing_interface: "clock_vs_clock",
      eligibility: "equivalent",
      reason: "same_clock",
      explanation: "Shared-event clocks restate the same digits.",
    };
  }
  return {
    pairing_interface: "clock_vs_clock",
    eligibility: "comparable",
    reason: "competing_clock",
    explanation: "Shared-event clocks have different explicit digits.",
  };
}

function diagnoseStatementEvent(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftTopic = topicOf(left);
  const rightTopic = topicOf(right);
  if (!leftTopic || !rightTopic || !(leftTopic.includes(rightTopic) || rightTopic.includes(leftTopic))) {
    return {
      pairing_interface: "statement_vs_event",
      eligibility: "not_comparable",
      reason: "different_topic",
      explanation: "Statement and event do not share a topic.",
    };
  }
  const statement = left.kind === "statement" ? left : right;
  const event = left.kind === "event" ? left : right;
  const polarity = statement.proposition.polarity;
  const eventAffirms = event.proposition.polarity !== "false";
  if ((polarity === "false" && eventAffirms) || (polarity === "true" && event.proposition.polarity === "false")) {
    return {
      pairing_interface: "statement_vs_event",
      eligibility: "comparable",
      reason: "statement_event_polarity_conflict",
      explanation: "A claim and an event on the same topic have incompatible polarity.",
    };
  }
  return {
    pairing_interface: "statement_vs_event",
    eligibility: "equivalent",
    reason: "statement_event_agree",
    explanation: "Statement and event agree on the same topic.",
  };
}

function diagnoseKnowledge(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftTopic = norm(text(payload(left).topic) ?? "");
  const rightTopic = norm(text(payload(right).topic) ?? "");
  if (!leftTopic || !rightTopic || leftTopic !== rightTopic) {
    return {
      pairing_interface: "knowledge_acquisition_vs_use",
      eligibility: "not_comparable",
      reason: "different_topic",
      explanation: "Knowledge observations do not share a topic.",
    };
  }
  const leftState = text(payload(left).knowledge_state);
  const rightState = text(payload(right).knowledge_state);
  const use = leftState === "known" || leftState === "claimed" ? left : rightState === "known" || rightState === "claimed" ? right : null;
  const learned = leftState === "learned" ? left : rightState === "learned" ? right : null;
  if (use && learned && use.id !== learned.id) {
    const useChapter = use.evidence.locator;
    const learnedChapter = learned.evidence.locator;
    if (useChapter && learnedChapter && useChapter !== learnedChapter) {
      return {
        pairing_interface: "knowledge_acquisition_vs_use",
        eligibility: "comparable",
        reason: "knowledge_before_acquisition",
        explanation: "Use/claim and later acquisition of the same topic are comparable.",
      };
    }
  }
  if (leftState === rightState) {
    return {
      pairing_interface: "knowledge_acquisition_vs_use",
      eligibility: "equivalent",
      reason: "same_knowledge_state",
      explanation: "Knowledge observations restate the same state of the same topic.",
    };
  }
  if ((leftState === "unknown" && rightState === "learned") || (rightState === "unknown" && leftState === "learned")) {
    return {
      pairing_interface: "knowledge_acquisition_vs_use",
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Unknown then learned is a compatible knowledge transition.",
    };
  }
  return {
    pairing_interface: "knowledge_acquisition_vs_use",
    eligibility: "comparable",
    reason: "competing_knowledge_state",
    explanation: "The same topic has competing knowledge states.",
  };
}

function diagnoseTravel(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const a = payload(left);
  const b = payload(right);
  const leftOrigin = text(a.origin);
  const rightOrigin = text(b.origin);
  const leftDest = text(a.destination);
  const rightDest = text(b.destination);
  if (!leftOrigin || !rightOrigin || !leftDest || !rightDest) {
    return {
      pairing_interface: "travel_leg",
      eligibility: "insufficient_semantic_specificity",
      reason: "incomplete_route",
      explanation: "A travel leg is missing origin or destination.",
    };
  }
  if (norm(leftOrigin) === norm(rightOrigin) && norm(leftDest) === norm(rightDest)) {
    const leftDuration = text(a.stated_duration);
    const rightDuration = text(b.stated_duration);
    if (leftDuration && rightDuration && norm(leftDuration) !== norm(rightDuration)) {
      return {
        pairing_interface: "travel_leg",
        eligibility: "comparable",
        reason: "competing_duration",
        explanation: "The same route has competing explicit durations.",
      };
    }
    return {
      pairing_interface: "travel_leg",
      eligibility: "equivalent",
      reason: "same_route",
      explanation: "Travel legs restate the same origin and destination.",
    };
  }
  if (sharedTimeAnchor(left, right)) {
    return {
      pairing_interface: "travel_leg",
      eligibility: "comparable",
      reason: "competing_same_time_route",
      explanation: "Same-time travel legs have incompatible routes.",
    };
  }
  return {
    pairing_interface: "travel_leg",
    eligibility: "not_comparable",
    reason: "different_trips",
    explanation: "Different routes at different times are ordinary travel.",
  };
}

function diagnoseInjury(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftRegion = norm(text(payload(left).body_region) ?? "");
  const rightRegion = norm(text(payload(right).body_region) ?? "");
  if (!leftRegion || !rightRegion || leftRegion !== rightRegion) {
    return {
      pairing_interface: "injury_state",
      eligibility: "not_comparable",
      reason: "different_body_region",
      explanation: "Injuries do not share a body region.",
    };
  }
  const leftSide = text(payload(left).laterality) ?? "unspecified";
  const rightSide = text(payload(right).laterality) ?? "unspecified";
  if (leftSide === "unspecified" || rightSide === "unspecified") {
    return {
      pairing_interface: "injury_state",
      eligibility: "insufficient_semantic_specificity",
      reason: "unspecified_laterality",
      explanation: "Unspecified laterality cannot become left or right.",
    };
  }
  if (leftSide !== rightSide) {
    return {
      pairing_interface: "injury_state",
      eligibility: "comparable",
      reason: "injury_laterality_conflict",
      explanation: "The same body region has incompatible laterality.",
    };
  }
  const leftCondition = norm(text(payload(left).condition) ?? text(payload(left).diagnosis) ?? "");
  const rightCondition = norm(text(payload(right).condition) ?? text(payload(right).diagnosis) ?? "");
  if (leftCondition && rightCondition && leftCondition !== rightCondition) {
    if (leftCondition.includes("heal") || rightCondition.includes("heal") || leftCondition.includes("recover") || rightCondition.includes("recover")) {
      return {
        pairing_interface: "injury_state",
        eligibility: "not_comparable",
        reason: "compatible_state_transition",
        explanation: "Injury condition may change from wounded to healed.",
      };
    }
    return {
      pairing_interface: "injury_state",
      eligibility: "comparable",
      reason: "competing_injury_state",
      explanation: "The same injury region has competing conditions.",
    };
  }
  return {
    pairing_interface: "injury_state",
    eligibility: "equivalent",
    reason: "same_injury",
    explanation: "Injury observations restate the same region and laterality.",
  };
}

function diagnoseRelationship(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftType = norm(text(payload(left).relationship_type) ?? "");
  const rightType = norm(text(payload(right).relationship_type) ?? "");
  const leftOther = norm(text(payload(left).counterparty) ?? "");
  const rightOther = norm(text(payload(right).counterparty) ?? "");
  if (!leftType || !rightType || !leftOther || !rightOther) {
    return {
      pairing_interface: "relationship_state",
      eligibility: "insufficient_semantic_specificity",
      reason: "incomplete_relationship",
      explanation: "Relationship type or counterparty is missing.",
    };
  }
  if (leftOther !== rightOther || leftType !== rightType) {
    return {
      pairing_interface: "relationship_state",
      eligibility: "not_comparable",
      reason: leftOther !== rightOther ? "different_counterparty" : "different_relationship_type",
      explanation: "Relationship edges are not the same subject/type/counterparty.",
    };
  }
  const leftState = text(payload(left).state);
  const rightState = text(payload(right).state);
  if (leftState && rightState && leftState !== rightState) {
    return {
      pairing_interface: "relationship_state",
      eligibility: "comparable",
      reason: "competing_relationship_state",
      explanation: "The same relationship edge has incompatible states.",
    };
  }
  return {
    pairing_interface: "relationship_state",
    eligibility: "equivalent",
    reason: "same_relationship",
    explanation: "Relationship observations restate the same edge.",
  };
}

function diagnoseIdentity(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftName = norm(text(payload(left).surface_name) ?? "");
  const rightName = norm(text(payload(right).surface_name) ?? "");
  if (!leftName || !rightName || leftName !== rightName) {
    return {
      pairing_interface: "identity",
      eligibility: "not_comparable",
      reason: "different_surface_name",
      explanation: "Identity claims do not share a surface name and are not silently merged.",
    };
  }
  const leftClaim = text(payload(left).identity_claim);
  const rightClaim = text(payload(right).identity_claim);
  if (leftClaim === "unlinked" || rightClaim === "unlinked") {
    return {
      pairing_interface: "identity",
      eligibility: "comparable",
      reason: "unlinked_vs_named",
      explanation: "An unlinked identity claim competes with a named identity claim.",
    };
  }
  const leftAlias = norm(text(payload(left).alias) ?? text(payload(left).role) ?? "");
  const rightAlias = norm(text(payload(right).alias) ?? text(payload(right).role) ?? "");
  if (leftClaim === rightClaim && leftAlias && rightAlias && leftAlias !== rightAlias && leftClaim === "role") {
    return {
      pairing_interface: "rank_role",
      eligibility: "not_comparable",
      reason: "different_role_dimension",
      explanation: "Role claims are different dimensions unless they name the same role.",
    };
  }
  if (leftAlias && rightAlias && leftAlias !== rightAlias) {
    return {
      pairing_interface: "identity",
      eligibility: "comparable",
      reason: "competing_identity_claim",
      explanation: "The same surface name has competing identity claims.",
    };
  }
  return {
    pairing_interface: "identity",
    eligibility: "equivalent",
    reason: "same_identity_claim",
    explanation: "Identity claims restate the same surface name.",
  };
}

function diagnoseLocation(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  if (!sharedTimeAnchor(left, right)) {
    return {
      pairing_interface: "location_presence",
      eligibility: "not_comparable",
      reason: "different_time",
      explanation: "Different locations at different times are not conflicts.",
    };
  }
  const leftPlace = norm(text(payload(left).location) ?? "");
  const rightPlace = norm(text(payload(right).location) ?? "");
  if (!leftPlace || !rightPlace) {
    return {
      pairing_interface: "location_presence",
      eligibility: "insufficient_semantic_specificity",
      reason: "missing_location",
      explanation: "A location presence observation is missing an explicit place.",
    };
  }
  if (leftPlace === rightPlace) {
    return {
      pairing_interface: "location_presence",
      eligibility: "equivalent",
      reason: "same_place",
      explanation: "Same-time presence observations restate the same place.",
    };
  }
  return {
    pairing_interface: "location_presence",
    eligibility: "comparable",
    reason: "same_time_location_conflict",
    explanation: "Same-time presence observations name incompatible places.",
  };
}

function diagnoseObject(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftId = text(payload(left).object_identity);
  const rightId = text(payload(right).object_identity);
  if (!leftId || !rightId) {
    return {
      pairing_interface: "object_equipment",
      eligibility: "insufficient_semantic_specificity",
      reason: "generic_object",
      explanation: "Generic objects without stable identity are not compared.",
    };
  }
  if (norm(leftId) !== norm(rightId)) {
    return {
      pairing_interface: "object_equipment",
      eligibility: "not_comparable",
      reason: "different_object_identity",
      explanation: "Object observations do not share a stable identity.",
    };
  }
  const leftState = norm(text(payload(left).action_or_state) ?? "");
  const rightState = norm(text(payload(right).action_or_state) ?? "");
  if (leftState && rightState && leftState !== rightState && sharedTimeAnchor(left, right)) {
    return {
      pairing_interface: "object_equipment",
      eligibility: "comparable",
      reason: "competing_object_state",
      explanation: "The same object identity has competing same-time states.",
    };
  }
  return {
    pairing_interface: "object_equipment",
    eligibility: "equivalent",
    reason: "object_state_transition_or_restatement",
    explanation: "Same-object states at different times are continuation, not automatic conflict.",
  };
}

function diagnoseCapability(left: V2Observation, right: V2Observation): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> {
  const leftCap = norm(text(payload(left).capability_type) ?? "");
  const rightCap = norm(text(payload(right).capability_type) ?? "");
  if (!leftCap || !rightCap || leftCap !== rightCap) {
    return {
      pairing_interface: "operational_capability",
      eligibility: "not_comparable",
      reason: "different_capability",
      explanation: "Operational capabilities are not the same type.",
    };
  }
  const leftScope = norm(text(payload(left).time_scope) ?? text(payload(left).location_or_operation) ?? "");
  const rightScope = norm(text(payload(right).time_scope) ?? text(payload(right).location_or_operation) ?? "");
  if (leftScope && rightScope && leftScope !== rightScope && !sharedTimeAnchor(left, right)) {
    return {
      pairing_interface: "operational_capability",
      eligibility: "not_comparable",
      reason: "different_operation_scope",
      explanation: "The same capability type belongs to different operations or times.",
    };
  }
  const leftState = text(payload(left).state);
  const rightState = text(payload(right).state);
  if (leftState && rightState && leftState !== rightState) {
    if ((leftState === "unavailable" && rightState === "used") || (leftState === "used" && rightState === "unavailable")) {
      return {
        pairing_interface: "operational_capability",
        eligibility: "comparable",
        reason: "unavailable_vs_used",
        explanation: "The same capability is unavailable in one observation and used in another.",
      };
    }
  }
  if (leftState === rightState) {
    return {
      pairing_interface: "operational_capability",
      eligibility: "equivalent",
      reason: "same_capability_state",
      explanation: "Capability observations restate the same state.",
    };
  }
  return {
    pairing_interface: "operational_capability",
    eligibility: "comparable",
    reason: "competing_capability_state",
    explanation: "The same capability has competing states.",
  };
}

function diagnoseAliveOrChronology(
  left: V2Observation,
  right: V2Observation,
): Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked"> | null {
  const leftState = v2AliveDeadState(left);
  const rightState = v2AliveDeadState(right);
  const leftAlive = leftState === "alive";
  const rightAlive = rightState === "alive";
  const leftDead = leftState === "dead";
  const rightDead = rightState === "dead";
  if ((leftAlive && rightDead) || (rightAlive && leftDead)) {
    const leftOrd = locatorOrder(left);
    const rightOrd = locatorOrder(right);
    if (leftOrd != null && rightOrd != null) {
      const earlierDead = leftOrd <= rightOrd ? leftDead : rightDead;
      const laterAlive = leftOrd <= rightOrd ? rightAlive : leftAlive;
      if (!earlierDead && laterAlive === false) {
        return {
          pairing_interface: "alive_dead",
          eligibility: "not_comparable",
          reason: "compatible_state_transition",
          explanation: "Alive then later dead is an ordinary transition.",
        };
      }
      if (earlierDead && laterAlive) {
        return {
          pairing_interface: "alive_dead",
          eligibility: "comparable",
          reason: "dead_then_alive",
          explanation: "Dead then later alive is a candidate conflict unless resurrection or misidentification applies.",
        };
      }
    }
    return {
      pairing_interface: "alive_dead",
      eligibility: "comparable",
      reason: "alive_vs_dead",
      explanation: "Alive and dead claims for the same entity are comparable when temporal order is unresolved.",
    };
  }
  const leftSeq = text(payload(left).sequence_marker) ?? text(left.proposition.temporal_scope);
  const rightSeq = text(payload(right).sequence_marker) ?? text(right.proposition.temporal_scope);
  if (
    left.kind === "event" &&
    right.kind === "event" &&
    leftSeq &&
    rightSeq &&
    sharedTimeAnchor(left, right) &&
    norm(leftSeq) !== norm(rightSeq)
  ) {
    return {
      pairing_interface: "chronology",
      eligibility: "comparable",
      reason: "competing_sequence",
      explanation: "Events impose competing order or time constraints on the same anchor.",
    };
  }
  return null;
}

export function diagnoseV2ObservationPair(
  left: V2Observation,
  right: V2Observation,
  context?: V2ComparisonContext,
): V2ComparisonDiagnosis {
  const identity_status = identityStatusFor(entityOf(left), entityOf(right), context);
  const confirmation_blocked = identity_status === "ambiguous" || identity_status === "unresolved";
  const iface = classifyV2PairingInterface(left, right);
  const extras = diagnoseAliveOrChronology(left, right);
  const allowCrossEntity =
    iface === "identity" ||
    iface === "statement_vs_event" ||
    iface === "clock_vs_clock" ||
    iface === "object_equipment";
  if (!entitiesAlign(left, right, context) && !allowCrossEntity) {
    return {
      left_id: left.id,
      right_id: right.id,
      pairing_interface: iface === "not_comparable" && extras ? extras.pairing_interface : iface,
      eligibility: "not_comparable",
      reason: "different_subject",
      explanation: "Observations do not share a resolved or explicitly linked entity.",
      identity_status,
      confirmation_blocked: true,
    };
  }
  let core: Omit<V2ComparisonDiagnosis, "left_id" | "right_id" | "identity_status" | "confirmation_blocked">;
  if (iface === "clock_vs_clock") core = diagnoseClock(left, right);
  else if (iface === "statement_vs_event") core = diagnoseStatementEvent(left, right);
  else if (iface === "knowledge_acquisition_vs_use") core = diagnoseKnowledge(left, right);
  else if (iface === "travel_leg") core = diagnoseTravel(left, right);
  else if (iface === "injury_state") core = diagnoseInjury(left, right);
  else if (iface === "relationship_state") core = diagnoseRelationship(left, right);
  else if (iface === "identity") core = diagnoseIdentity(left, right);
  else if (iface === "location_presence") core = diagnoseLocation(left, right);
  else if (iface === "object_equipment") core = diagnoseObject(left, right);
  else if (iface === "operational_capability") core = diagnoseCapability(left, right);
  else if (extras) core = extras;
  else {
    core = {
      pairing_interface: "not_comparable",
      eligibility: "not_comparable",
      reason: "no_comparison_interface",
      explanation: "No V2 comparison interface applies.",
    };
  }
  return {
    left_id: left.id,
    right_id: right.id,
    ...core,
    identity_status,
    confirmation_blocked: confirmation_blocked || core.eligibility !== "comparable",
  };
}

export function pairV2Observations(
  observations: readonly V2Observation[],
  context?: V2ComparisonContext,
): V2ComparisonDiagnosis[] {
  const rows: V2ComparisonDiagnosis[] = [];
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      rows.push(diagnoseV2ObservationPair(observations[i]!, observations[j]!, context));
    }
  }
  return rows;
}

export function summarizeV2Comparisons(rows: readonly V2ComparisonDiagnosis[]) {
  const byInterface: Record<string, number> = {};
  for (const row of rows.filter((item) => item.eligibility === "comparable")) {
    byInterface[row.pairing_interface] = (byInterface[row.pairing_interface] ?? 0) + 1;
  }
  return {
    considered: rows.length,
    comparable: rows.filter((row) => row.eligibility === "comparable").length,
    equivalent: rows.filter((row) => row.eligibility === "equivalent").length,
    not_comparable: rows.filter((row) => row.eligibility === "not_comparable").length,
    insufficient_semantic_specificity: rows.filter(
      (row) => row.eligibility === "insufficient_semantic_specificity",
    ).length,
    comparable_by_interface: byInterface,
  };
}
