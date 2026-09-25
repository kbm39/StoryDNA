/**
 * Internal fixture-only V2 provider.
 * provider=none, model=none. Never calls Anthropic or OpenAI.
 */

import { RULE8_V2_COVERAGE_MATRIX } from "./coverage-matrix.ts";
import { RULE8_V2_FIXTURE_OBSERVATIONS } from "./fixtures.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "./constants.ts";
import type { V2Observation } from "./types.ts";

export const V2_FIXTURE_PROVIDER = "none" as const;
export const V2_FIXTURE_MODEL = "none" as const;
export const V2_FIXTURE_PROVIDER_CALLS = 0;

function casePrefix(benchmarkId: string): string {
  return `${benchmarkId.toLowerCase()}-`;
}

export function fixtureObservationsForCase(benchmarkId: string): V2Observation[] {
  const row = RULE8_V2_COVERAGE_MATRIX.find((item) => item.benchmark_id === benchmarkId);
  if (!row) return [];
  const required = new Set(row.required_observations.map((item) => item.id));
  const prefix = casePrefix(benchmarkId);
  const byId = new Map(RULE8_V2_FIXTURE_OBSERVATIONS.map((item) => [item.id, item]));
  const selected = new Map<string, V2Observation>();
  for (const observation of RULE8_V2_FIXTURE_OBSERVATIONS) {
    if (observation.id.startsWith(prefix) || required.has(observation.id)) {
      selected.set(observation.id, structuredClone(observation));
    }
  }
  for (const id of required) {
    const observation = byId.get(id);
    if (observation && !selected.has(id)) selected.set(id, structuredClone(observation));
  }
  return [...selected.values()];
}

export function requiredObservationIdsForCase(benchmarkId: string): string[] {
  const row = RULE8_V2_COVERAGE_MATRIX.find((item) => item.benchmark_id === benchmarkId);
  return row ? row.required_observations.map((item) => item.id) : [];
}

export function simulateV2FixtureProviderOutput(benchmarkId: string): {
  provider: typeof V2_FIXTURE_PROVIDER;
  model: typeof V2_FIXTURE_MODEL;
  provider_calls: 0;
  raw: string;
  parsed: Record<string, unknown>;
  observations: V2Observation[];
} {
  const observations = fixtureObservationsForCase(benchmarkId);
  const parsed = {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: `seg-${benchmarkId.toLowerCase()}`,
    entities: [],
    observations,
    local_continuity_concerns: [],
    entity_ambiguities: [],
  };
  return {
    provider: V2_FIXTURE_PROVIDER,
    model: V2_FIXTURE_MODEL,
    provider_calls: 0,
    raw: JSON.stringify(parsed),
    parsed,
    observations,
  };
}
