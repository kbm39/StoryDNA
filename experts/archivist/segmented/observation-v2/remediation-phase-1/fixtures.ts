/**
 * B0 contiguous-evidence fixtures from already-consumed official outputs.
 * Does not rewrite excerpts. Does not change the evidence gate.
 * Valid retain forms use short synthetic supporting text that contains the
 * official contiguous sentence — not held-out manuscript windows.
 */

import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "../constants.ts";

export const PHASE1_R8012_DAUGHTER_STITCH_EXCERPT =
  "Lior had a daughter. She had seen the drawing taped inside his cubicle, a stick family under a yellow sun, the kind every analyst's child makes." as const;

export const PHASE1_R8012_DAUGHTER_VALID_EXCERPT = "Lior had a daughter." as const;

export const PHASE1_R8012_VALID_SEGMENT = [
  "The cubicle note stood alone.",
  "Lior had a daughter.",
  "No other family claim followed in this fixture.",
].join(" ");

export const PHASE1_R8010_MISSILE_STITCH_EXCERPT =
  "I have two missiles. Copy. Engaging. Thirty seconds later the horizon to the north lit orange, a double flash." as const;

export const PHASE1_R8010_USED_VALID_EXCERPT = "I have two missiles." as const;

export const PHASE1_R8010_VALID_SEGMENT = [
  "The radio stayed open.",
  "I have two missiles.",
  "The operator waited for the word.",
].join(" ");

export const PHASE1_R8025_LONG_TRAVEL_EXCERPT =
  "somewhere over the Aegean, leaning across the cabin so she could hear him over the rotors, his voice pitched low and careful, the register people use around a sleeping child. Turkish command had offered the nearest friendly strip and nothing further, which was more than enough: Izmir, the same NATO base" as const;

export const PHASE1_R8007_OUT_OF_WINDOW_EXCERPT = "We haven't recovered a body." as const;

export const PHASE1_R8007_WINDOW_SEGMENT =
  "Cyrus escaped into a launch. The staged exfil boat was named Zodiac." as const;

export const PHASE1_FIXTURE_CASE_IDS = ["R8-007", "R8-010", "R8-012", "R8-025"] as const;

function relationshipDoc(args: { excerpt: string; segmentId: string }) {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: args.segmentId,
    observations: [
      {
        observation_id: "obs-daughter",
        kind: "relationship",
        subject: "Lior Benzvi",
        counterparty: "daughter",
        relationship_type: "parent",
        state: "exists",
        proposition: {
          subject: "Lior Benzvi",
          predicate: "has_daughter",
          object: "daughter",
          polarity: "true",
          source_kind: "narration",
        },
        locator: "CHAPTER EIGHT",
        excerpt: args.excerpt,
        source_segment: args.segmentId,
        confidence: "high",
        inferred: false,
      },
    ],
  };
}

function usedCapabilityDoc(args: { excerpt: string; segmentId: string }) {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: args.segmentId,
    observations: [
      {
        observation_id: "obs-used",
        kind: "operational_capability",
        entity: "Hank",
        capability_type: "missile",
        state: "used",
        source: "event",
        proposition: {
          subject: "Hank",
          predicate: "missile",
          object: "used",
          polarity: "true",
          source_kind: "event",
        },
        locator: "CHAPTER MISSILE",
        excerpt: args.excerpt,
        source_segment: args.segmentId,
        confidence: "high",
        inferred: false,
      },
    ],
  };
}

export function phase1R8012DaughterStitchDocument() {
  return relationshipDoc({
    excerpt: PHASE1_R8012_DAUGHTER_STITCH_EXCERPT,
    segmentId: "seg-phase1-r8-012-stitch",
  });
}

export function phase1R8012DaughterValidDocument() {
  return relationshipDoc({
    excerpt: PHASE1_R8012_DAUGHTER_VALID_EXCERPT,
    segmentId: "seg-phase1-r8-012-valid",
  });
}

export function phase1R8010MissileStitchDocument() {
  return usedCapabilityDoc({
    excerpt: PHASE1_R8010_MISSILE_STITCH_EXCERPT,
    segmentId: "seg-phase1-r8-010-stitch",
  });
}

export function phase1R8010UsedValidDocument() {
  return usedCapabilityDoc({
    excerpt: PHASE1_R8010_USED_VALID_EXCERPT,
    segmentId: "seg-phase1-r8-010-valid",
  });
}

export function phase1R8025LongTravelDocument() {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: "seg-phase1-r8-025-long",
    observations: [
      {
        observation_id: "obs-travel",
        kind: "travel_leg",
        traveler: "Turkish Sikorskys",
        origin: "Istanbul",
        destination: "Izmir",
        mode: "Sikorsky",
        proposition: {
          subject: "Turkish Sikorskys",
          predicate: "travel_route",
          object: "to Izmir",
          polarity: "true",
          source_kind: "narration",
        },
        locator: "CHAPTER TWENTY-ONE",
        excerpt: PHASE1_R8025_LONG_TRAVEL_EXCERPT,
        source_segment: "seg-phase1-r8-025-long",
        confidence: "high",
        inferred: false,
      },
    ],
  };
}

export function phase1R8007OutOfWindowDocument() {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: "seg-phase1-r8-007-window",
    observations: [
      {
        observation_id: "obs-body",
        kind: "knowledge",
        entity: "Hank",
        topic: "Cyrus body recovery status",
        knowledge_state: "known",
        perspective: "character",
        proposition: {
          subject: "Hank",
          predicate: "known",
          object: "Cyrus body recovery status",
          polarity: "true",
          source_kind: "dialogue",
        },
        locator: "CHAPTER TWENTY-SEVEN",
        excerpt: PHASE1_R8007_OUT_OF_WINDOW_EXCERPT,
        source_segment: "seg-phase1-r8-007-window",
        confidence: "high",
        inferred: false,
      },
    ],
  };
}
