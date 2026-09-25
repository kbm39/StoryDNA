export const ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION =
  "archivist_reckoning_rule8_benchmark@v1" as const;

export type ReckoningRule8Applicability =
  | "VERIFIED_IN_REVISED_13"
  | "PARTIALLY_PRESENT_IN_REVISED_13"
  | "NOT_PRESENT_IN_REVISED_13"
  | "AMBIGUOUS_VERSION_MAPPING"
  | "LEDGER_CONFORMANCE_ONLY"
  | "OUT_OF_SCOPE";

export type ReckoningRule8PrimaryOutcome =
  | "DETECTED"
  | "EXTRACTED_BUT_MISSED"
  | "PARTIALLY_EXTRACTED"
  | "NOT_EXTRACTED";

export type ReckoningRule8VersionOutcome =
  | "VERSION_NOT_PRESENT"
  | "VERSION_PARTIAL"
  | "VERSION_AMBIGUOUS";

export type ReckoningRule8ReasoningType =
  | "ATTRIBUTE_CONTRADICTION"
  | "TEMPORAL_CONTRADICTION"
  | "CLOCK_TIME_CONTRADICTION"
  | "TRAVEL_TIME_IMPOSSIBILITY"
  | "KNOWLEDGE_BEFORE_ACQUISITION"
  | "STATEMENT_VS_EVENT"
  | "EVENT_VS_EVENT"
  | "INJURY_CONTINUITY"
  | "RELATIONSHIP_CONTINUITY"
  | "ALIVE_DEAD_CONTINUITY"
  | "OBJECT_POSSESSION"
  | "OPERATIONAL_CAPABILITY"
  | "IDENTITY_CONTINUITY"
  | "BIOGRAPHICAL_CONTINUITY"
  | "OTHER";

export type ReckoningRule8RootCause =
  | "IDENTITY_RESOLUTION"
  | "OBSERVATION_SCHEMA"
  | "FACT_EXTRACTION"
  | "EVENT_EXTRACTION"
  | "TIMESTAMP_EXTRACTION"
  | "TRAVEL_LEG_EXTRACTION"
  | "KNOWLEDGE_STATE_EXTRACTION"
  | "ATTRIBUTE_NORMALIZATION"
  | "PAIRING"
  | "TEMPORAL_REASONING"
  | "PHYSICAL_REALISM_REASONING"
  | "EVIDENCE_REHYDRATION"
  | "OTHER";

export type ObservationFieldSupport = "SUPPORTED" | "WEAKLY_SUPPORTED" | "MISSING";

export interface ReckoningRule8EvidenceSide {
  locator: string;
  excerpt: string;
  proposition: string;
}

export interface ReckoningRule8InventoryItem {
  benchmark_id: string;
  rule8_section: string;
  rule8_description: string;
  rule8_severity: string | null;
  rule8_source_wording: string;
  characters: string[];
  locations: string[];
  objects: string[];
  stated_paragraph_refs: string[];
  first_side_proposition: string;
  second_side_proposition: string;
  continuity_dimension: string;
  rule8_suggested_correction: string | null;
  applicability: ReckoningRule8Applicability;
  version_outcome?: ReckoningRule8VersionOutcome;
}

export interface ReckoningRule8VerifiedCase {
  benchmark_id: string;
  dimension: ReckoningRule8ReasoningType;
  entities: string[];
  attribute_event_or_topic: string;
  side_a: ReckoningRule8EvidenceSide;
  side_b: ReckoningRule8EvidenceSide;
  why_incompatible: string;
  required_reasoning_type: ReckoningRule8ReasoningType;
  expected_outcome: "continuity_defect";
  primary_outcome: ReckoningRule8PrimaryOutcome;
  root_causes: ReckoningRule8RootCause[];
  extracted_side_a: boolean;
  extracted_side_b: boolean;
  relevant_retained_fact_count: number;
  notes: string;
}

export interface ReckoningRule8VersionCase {
  benchmark_id: string;
  version_outcome: ReckoningRule8VersionOutcome;
  reason: string;
}

export interface ReckoningRule8Metrics {
  total_verified_defects: number;
  detected: number;
  extracted_but_missed: number;
  partially_extracted: number;
  not_extracted: number;
  end_to_end_recall: number;
  extraction_coverage: number;
  reasoning_recall_given_sufficient_extraction: number | null;
  by_reasoning_type: Record<
    string,
    {
      total: number;
      detected: number;
      extracted_but_missed: number;
      partially_extracted: number;
      not_extracted: number;
      end_to_end_recall: number;
      extraction_coverage: number;
    }
  >;
}

export interface ReckoningRule8FactMap {
  retained_fact_count: number;
  relevant_fact_count: number;
  irrelevant_fact_count: number;
  relevant_fact_signatures: string[];
  defects_with_zero_relevant_facts: string[];
}
