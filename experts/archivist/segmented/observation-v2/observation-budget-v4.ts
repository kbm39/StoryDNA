/**
 * Deterministic V4 observation budget.
 * Applies the @v4 hard cap and same-segment injury/travel dedupe to already-retained rows.
 * Does not call a provider. Does not rewrite excerpts. Not wired into adaptV2ProviderOutput.
 */

import { V4_OBSERVATION_HARD_CAP } from "./prompt-v4.ts";
import type { V2Observation } from "./types.ts";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function injuryKey(observation: V2Observation): string | null {
  if (observation.kind !== "injury") return null;
  const payload = observation.payload as unknown as Record<string, unknown>;
  const entity = text(payload.entity);
  const region = text(payload.body_region);
  if (!entity || !region) return null;
  return `injury:${norm(entity)}|${norm(region)}`;
}

function travelKey(observation: V2Observation): string | null {
  if (observation.kind !== "travel_leg") return null;
  const payload = observation.payload as unknown as Record<string, unknown>;
  const traveler = text(payload.traveler);
  const origin = text(payload.origin) ?? "";
  const destination = text(payload.destination);
  if (!traveler || !destination) return null;
  return `travel:${norm(traveler)}|${norm(origin)}|${norm(destination)}`;
}

export function applyV4ObservationBudget(
  observations: readonly V2Observation[],
): { kept: V2Observation[]; dropped_duplicate: number; dropped_over_cap: number } {
  const seen = new Set<string>();
  const deduped: V2Observation[] = [];
  let dropped_duplicate = 0;
  for (const observation of observations) {
    const key = injuryKey(observation) ?? travelKey(observation);
    if (key && seen.has(key)) {
      dropped_duplicate += 1;
      continue;
    }
    if (key) seen.add(key);
    deduped.push(observation);
  }
  if (deduped.length <= V4_OBSERVATION_HARD_CAP) {
    return { kept: deduped, dropped_duplicate, dropped_over_cap: 0 };
  }
  return {
    kept: deduped.slice(0, V4_OBSERVATION_HARD_CAP),
    dropped_duplicate,
    dropped_over_cap: deduped.length - V4_OBSERVATION_HARD_CAP,
  };
}
