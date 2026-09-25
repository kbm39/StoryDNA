import type { ArchivistSegmentObservationV2, V2Observation } from "./types.ts";

function payloadSubject(observation: V2Observation): string {
  const payload = observation.payload as unknown as Record<string, unknown>;
  return String(
    payload.speaker ??
      payload.entity ??
      payload.actor ??
      payload.subject ??
      payload.traveler ??
      payload.surface_name ??
      observation.proposition.subject,
  );
}

function payloadTopic(observation: V2Observation): string {
  const payload = observation.payload as unknown as Record<string, unknown>;
  return String(
    payload.proposition_topic ??
      payload.topic ??
      payload.action ??
      payload.predicate ??
      payload.capability_type ??
      payload.relationship_type ??
      payload.object ??
      payload.body_region ??
      payload.raw_expression ??
      observation.proposition.predicate,
  );
}

/** One observation occupies one identity. Same kind+subject+topic+value+locator is a duplicate. */
export function observationIdentityKey(observation: V2Observation): string {
  return [
    observation.kind,
    payloadSubject(observation).toLowerCase(),
    payloadTopic(observation).toLowerCase(),
    observation.proposition.object.toLowerCase(),
    observation.proposition.polarity,
    observation.evidence.locator,
  ].join("|");
}

export function suppressDuplicateObservations(
  observations: V2Observation[],
): { kept: V2Observation[]; suppressed: number } {
  const seen = new Set<string>();
  const kept: V2Observation[] = [];
  let suppressed = 0;
  for (const observation of observations) {
    const key = observationIdentityKey(observation);
    if (seen.has(key)) {
      suppressed += 1;
      continue;
    }
    seen.add(key);
    kept.push(observation);
  }
  return { kept, suppressed };
}

export function compactSegmentObservationV2(
  observation: ArchivistSegmentObservationV2,
): ArchivistSegmentObservationV2 {
  const { kept } = suppressDuplicateObservations(observation.observations);
  return { ...observation, observations: kept };
}

/** Rough output-token estimate: JSON chars / 4. Used only for $0 design comparison. */
export function estimateJsonTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}
