import { FACT_GROUPS } from "@/experts/archivist/segmented/observation-contract.ts";
import type { ObservationFieldSupport } from "./types.ts";

export interface ObservationSchemaGapRow {
  capability: string;
  support: ObservationFieldSupport;
  current_home: string;
  missing_fields: string[];
}

export const RULE8_OBSERVATION_SCHEMA_GAPS: ObservationSchemaGapRow[] = [
  {
    capability: "TIMESTAMPS",
    support: "MISSING",
    current_home: "chronology.event free text; no clock, date, duration, or window fields",
    missing_fields: ["clock_time", "date", "relative_duration", "deadline_or_window"],
  },
  {
    capability: "EVENTS",
    support: "WEAKLY_SUPPORTED",
    current_home: "events[] exists on the observation but every REVISED-13 segment persisted events: []",
    missing_fields: ["actor", "action", "object", "location", "time", "result"],
  },
  {
    capability: "TRAVEL_LEGS",
    support: "MISSING",
    current_home: "location facts are place+context only; location_travel_histories stayed empty",
    missing_fields: [
      "origin",
      "destination",
      "departure_time",
      "arrival_time",
      "duration",
      "transport_mode",
      "distance_if_known",
    ],
  },
  {
    capability: "KNOWLEDGE_STATE",
    support: "WEAKLY_SUPPORTED",
    current_home: "knowledge[] / knowledge_state with freeform state or knowledge strings",
    missing_fields: [
      "proposition_or_topic",
      "known_or_not_known",
      "acquisition_event",
      "acquisition_time",
      "use_or_assertion_time",
    ],
  },
  {
    capability: "STATEMENTS_CLAIMS",
    support: "MISSING",
    current_home: "no speaker/proposition type",
    missing_fields: ["speaker", "proposition", "time", "context"],
  },
  {
    capability: "OPERATIONAL_CAPABILITY",
    support: "MISSING",
    current_home: "no air-support / strike-package / availability window type",
    missing_fields: [
      "capability",
      "available_or_unavailable",
      "time_window",
      "air_support",
      "strike_package",
      "drone_support",
    ],
  },
  {
    capability: "INJURY",
    support: "WEAKLY_SUPPORTED",
    current_home: "injuries[] and injury facts; laterality is optional and often mixed across regions",
    missing_fields: ["event_identity", "single_body_region", "exclusive_laterality", "diagnosis", "subsequent_state"],
  },
  {
    capability: "RELATIONSHIPS_FAMILY",
    support: "WEAKLY_SUPPORTED",
    current_home: "relationships[] with type/other; existence and temporal scope are not required",
    missing_fields: ["counterparty", "relationship_type", "existence_or_state", "temporal_scope"],
  },
];

export function currentFactGroups(): readonly string[] {
  return FACT_GROUPS;
}
