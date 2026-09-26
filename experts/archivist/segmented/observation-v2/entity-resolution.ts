/**
 * Shared V2 entity labeling for pairing.
 * Does not merge aliases. Does not write canon.
 */

import type { V2Observation } from "./types.ts";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function payloadOf(observation: V2Observation): Record<string, unknown> {
  return observation.payload as unknown as Record<string, unknown>;
}

function haystack(observation: V2Observation): string {
  const row = payloadOf(observation);
  return [
    text(row.proposition_topic),
    text(row.claim_value),
    observation.proposition.predicate,
    observation.proposition.object,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const DEAD_RE = /\b(dead|killed|died|deceased|executed)\b/;
const ALIVE_RE = /\balive\b/;

export function v2AliveDeadState(observation: V2Observation): "alive" | "dead" | null {
  const row = payloadOf(observation);
  if (observation.kind === "statement") {
    const polarity = text(row.polarity) ?? observation.proposition.polarity;
    const topic = haystack(observation);
    const dead = DEAD_RE.test(topic);
    const alive = ALIVE_RE.test(topic);
    if (alive && polarity === "false") return "dead";
    if (dead && polarity === "false" && !alive) return null;
    if (dead && polarity !== "false") return "dead";
    if (alive && polarity === "true") return "alive";
    if (dead) return "dead";
    return null;
  }
  const topic = `${observation.proposition.object} ${observation.proposition.predicate}`.toLowerCase();
  const dead = DEAD_RE.test(topic);
  const alive = ALIVE_RE.test(topic);
  if (dead && !alive) return "dead";
  if (alive && !dead) return "alive";
  if (dead && alive) return observation.proposition.polarity === "false" ? "alive" : "dead";
  return null;
}

function statementAliveDeadTarget(observation: V2Observation): string | undefined {
  if (observation.kind !== "statement") return undefined;
  if (!v2AliveDeadState(observation)) return undefined;
  const target = text(payloadOf(observation).target);
  if (!target) return undefined;
  return target;
}

export function v2ObservationEntityLabel(observation: V2Observation): string {
  const row = payloadOf(observation);
  return (
    statementAliveDeadTarget(observation) ??
    text(row.entity) ??
    text(row.speaker) ??
    text(row.actor) ??
    text(row.subject) ??
    text(row.traveler) ??
    text(row.surface_name) ??
    observation.proposition.subject
  );
}

export function v2ObservationEntityKey(observation: V2Observation): string {
  return v2ObservationEntityLabel(observation).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

const LOCAL_MODEL_ID = /^o\d+$/i;

export function namespacedObservationId(observation: V2Observation): string {
  const id = observation.id.trim();
  if (!LOCAL_MODEL_ID.test(id)) return id;
  const source = observation.evidence.source_segment?.trim();
  if (!source) return id;
  if (id.startsWith(`${source}:`)) return id;
  return `${source}:${id}`;
}

export function withNamespacedObservationId(observation: V2Observation): V2Observation {
  const id = namespacedObservationId(observation);
  return id === observation.id ? observation : { ...observation, id };
}
