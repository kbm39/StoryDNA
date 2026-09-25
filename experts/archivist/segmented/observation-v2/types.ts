import type { CanonEntityType } from "@/lib/canon/types.ts";
import type { ArchivistConfidence } from "../../contracts.ts";
import type {
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  V2_CAPABILITY_SOURCES,
  V2_CAPABILITY_STATES,
  V2_KNOWLEDGE_PERSPECTIVES,
  V2_KNOWLEDGE_STATES,
  V2_LATERALITIES,
  V2_OBSERVATION_KINDS,
  V2_PAIRING_INTERFACES,
  V2_POLARITIES,
  V2_PRESENCE_STATES,
  V2_RELATIONSHIP_STATES,
  V2_SOURCE_KINDS,
} from "./constants.ts";

export type V2ObservationKind = (typeof V2_OBSERVATION_KINDS)[number];
export type V2SourceKind = (typeof V2_SOURCE_KINDS)[number];
export type V2Polarity = (typeof V2_POLARITIES)[number];
export type V2KnowledgeState = (typeof V2_KNOWLEDGE_STATES)[number];
export type V2KnowledgePerspective = (typeof V2_KNOWLEDGE_PERSPECTIVES)[number];
export type V2CapabilityState = (typeof V2_CAPABILITY_STATES)[number];
export type V2CapabilitySource = (typeof V2_CAPABILITY_SOURCES)[number];
export type V2Laterality = (typeof V2_LATERALITIES)[number];
export type V2RelationshipState = (typeof V2_RELATIONSHIP_STATES)[number];
export type V2PresenceState = (typeof V2_PRESENCE_STATES)[number];
export type V2PairingInterface = (typeof V2_PAIRING_INTERFACES)[number];

export interface V2Proposition {
  subject: string;
  predicate: string;
  object: string;
  polarity: V2Polarity;
  temporal_scope?: string;
  source_kind: V2SourceKind;
}

export interface V2Evidence {
  locator: string;
  excerpt: string;
  source_segment: string;
  manuscript_id?: string;
  manuscript_version_id?: string;
  content_hash?: string;
  evidence_status?: "verified" | "unverified";
  evidence_match_method?: "exact" | "unicode_punctuation_equivalent";
  normalized_punctuation?: boolean;
  raw_source_match_window?: string;
}

export interface V2TimestampPayload {
  raw_expression: string;
  clock_time?: string;
  date?: string;
  day_reference?: string;
  relative_time?: string;
  duration?: string;
  time_window?: string;
  sequence_marker?: string;
  attached_event_id?: string;
}

export interface V2EventPayload {
  event_type?: string;
  actor?: string;
  action: string;
  object?: string;
  location?: string;
  time_reference_id?: string;
  result?: string;
  participants?: string[];
  equipment?: string;
}

export interface V2StatementPayload {
  speaker: string;
  proposition_topic: string;
  polarity: V2Polarity;
  claim_value?: string;
  target?: string;
  time_reference_id?: string;
  context?: string;
}

export interface V2KnowledgePayload {
  entity: string;
  topic: string;
  knowledge_state: V2KnowledgeState;
  perspective: V2KnowledgePerspective;
  acquisition_source?: string;
  acquisition_event_id?: string;
  acquisition_time_id?: string;
  assertion_time_id?: string;
}

export interface V2TravelLegPayload {
  traveler: string;
  origin?: string;
  destination?: string;
  departure_time_id?: string;
  arrival_time_id?: string;
  stated_duration?: string;
  mode?: string;
  distance_if_explicit?: string;
}

export interface V2OperationalCapabilityPayload {
  entity: string;
  capability_type: string;
  state: V2CapabilityState;
  quantity?: string;
  time_scope?: string;
  location_or_operation?: string;
  source: V2CapabilitySource;
}

export interface V2InjuryPayload {
  entity: string;
  injury_event_id?: string;
  body_region: string;
  laterality: V2Laterality;
  injury_type?: string;
  diagnosis?: string;
  condition?: string;
  severity?: string;
  cause?: string;
  time_reference_id?: string;
}

export interface V2RelationshipPayload {
  subject: string;
  counterparty: string;
  relationship_type: string;
  state: V2RelationshipState;
  time_scope?: string;
}

export interface V2IdentityPayload {
  surface_name: string;
  identity_claim: "also_known_as" | "role" | "same_as" | "unlinked";
  alias?: string;
  role?: string;
  canonical_candidate?: string;
}

export interface V2LocationPresencePayload {
  entity: string;
  location: string;
  presence: V2PresenceState;
  time_reference_id?: string;
  event_context?: string;
}

export interface V2ObjectEquipmentPayload {
  entity?: string;
  object: string;
  object_identity?: string;
  action_or_state?: string;
  quantity?: string;
  location?: string;
  time_reference_id?: string;
}

export type V2ObservationPayload =
  | { kind: "timestamp"; payload: V2TimestampPayload }
  | { kind: "event"; payload: V2EventPayload }
  | { kind: "statement"; payload: V2StatementPayload }
  | { kind: "knowledge"; payload: V2KnowledgePayload }
  | { kind: "travel_leg"; payload: V2TravelLegPayload }
  | { kind: "operational_capability"; payload: V2OperationalCapabilityPayload }
  | { kind: "injury"; payload: V2InjuryPayload }
  | { kind: "relationship"; payload: V2RelationshipPayload }
  | { kind: "identity"; payload: V2IdentityPayload }
  | { kind: "location_presence"; payload: V2LocationPresencePayload }
  | { kind: "object_equipment"; payload: V2ObjectEquipmentPayload };

export type V2Observation = V2ObservationPayload & {
  id: string;
  proposition: V2Proposition;
  evidence: V2Evidence;
  confidence: ArchivistConfidence;
  inferred: boolean;
};

export interface V2ObservationEntity {
  alias: string;
  entity_type: CanonEntityType;
  local_mentions: string[];
}

export interface ArchivistSegmentObservationV2 {
  schema: typeof ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2;
  segment_id: string;
  entities: V2ObservationEntity[];
  observations: V2Observation[];
  local_continuity_concerns: Array<{
    id: string;
    explanation: string;
    locator: string;
    excerpt: string;
  }>;
  entity_ambiguities: Array<{
    alias: string;
    reason: string;
  }>;
  manuscript_id?: string;
  manuscript_version_id?: string;
  content_hash?: string;
  contract_version?: typeof ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2;
}

export interface V2RequiredObservation {
  id: string;
  kind: V2ObservationKind;
  role: "side_a" | "side_b" | "support";
  purpose: string;
}

export interface V2CoverageRow {
  benchmark_id: string;
  required_reasoning: V2PairingInterface;
  required_observations: V2RequiredObservation[];
  representable: boolean;
  missing_contract_feature: string | null;
}

export interface V2RepresentabilityReport {
  total_verified: number;
  representable: number;
  not_representable: string[];
  missing_features: string[];
}
