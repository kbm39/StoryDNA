export const ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V1 =
  "archivist_segment_observation@v1" as const;

export const ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 =
  "archivist_segment_observation@v2" as const;

export const ARCHIVIST_SEGMENT_CONTRACT_VERSION_V2 =
  "archivist_segment_observation@v2" as const;

export const V2_OBSERVATION_KINDS = [
  "timestamp",
  "event",
  "statement",
  "knowledge",
  "travel_leg",
  "operational_capability",
  "injury",
  "relationship",
  "identity",
  "location_presence",
  "object_equipment",
] as const;

export const V2_SOURCE_KINDS = ["narration", "dialogue", "event", "inference"] as const;

export const V2_POLARITIES = ["true", "false", "unknown"] as const;

export const V2_KNOWLEDGE_STATES = [
  "known",
  "unknown",
  "learned",
  "inferred",
  "claimed",
] as const;

export const V2_KNOWLEDGE_PERSPECTIVES = [
  "character",
  "narration",
  "unspecified",
] as const;

export const V2_CAPABILITY_STATES = [
  "available",
  "unavailable",
  "unknown",
  "used",
] as const;

export const V2_CAPABILITY_SOURCES = ["statement", "event", "narration"] as const;

export const V2_LATERALITIES = ["left", "right", "bilateral", "unspecified"] as const;

export const V2_RELATIONSHIP_STATES = ["exists", "does_not_exist", "uncertain"] as const;

export const V2_PRESENCE_STATES = ["present", "arriving", "departing", "absent"] as const;

export const V2_PAIRING_INTERFACES = [
  "statement_vs_event",
  "clock_vs_clock",
  "travel_leg",
  "knowledge_acquisition_vs_use",
  "injury_state",
  "relationship_state",
  "identity",
  "location_presence",
  "object_equipment",
  "operational_capability",
] as const;

/** Frozen Rule 8 v1 baseline. Do not change these numbers when adding V2. */
export const RULE8_V1_FROZEN_BASELINE = {
  total_verified_defects: 24,
  detected: 0,
  extracted_but_missed: 1,
  partially_extracted: 2,
  not_extracted: 21,
  end_to_end_recall: 0,
  extraction_coverage: 1 / 24,
} as const;
