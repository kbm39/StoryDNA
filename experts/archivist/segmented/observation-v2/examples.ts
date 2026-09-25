/**
 * Sanitized V2 output examples for selected Rule 8 cases.
 * Fixtures only. Excerpts are placeholders — no copyrighted passages.
 */

import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "./constants.ts";
import { fixtureObservationsForCase } from "./fixture-provider.ts";
import type { ArchivistSegmentObservationV2, V2Observation } from "./types.ts";

export const V2_SANITIZED_EXAMPLE_CASES = [
  "R8-010",
  "R8-011",
  "R8-013",
  "R8-020",
  "R8-025",
  "R8-029",
  "R8-042",
] as const;

function sanitizeObservation(observation: V2Observation): V2Observation {
  return {
    ...observation,
    evidence: {
      ...observation.evidence,
      excerpt: "[contiguous excerpt]",
      manuscript_id: undefined,
      manuscript_version_id: undefined,
      content_hash: undefined,
    },
  };
}

export function sanitizedV2Example(benchmarkId: string): ArchivistSegmentObservationV2 {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: `seg-${benchmarkId.toLowerCase()}-example`,
    entities: [],
    observations: fixtureObservationsForCase(benchmarkId).map(sanitizeObservation),
    local_continuity_concerns: [],
    entity_ambiguities: [],
    contract_version: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  };
}

export function sanitizedV2Examples(): Record<(typeof V2_SANITIZED_EXAMPLE_CASES)[number], ArchivistSegmentObservationV2> {
  return {
    "R8-010": sanitizedV2Example("R8-010"),
    "R8-011": sanitizedV2Example("R8-011"),
    "R8-013": sanitizedV2Example("R8-013"),
    "R8-020": sanitizedV2Example("R8-020"),
    "R8-025": sanitizedV2Example("R8-025"),
    "R8-029": sanitizedV2Example("R8-029"),
    "R8-042": sanitizedV2Example("R8-042"),
  };
}
