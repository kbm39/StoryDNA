import type { CanonEntityType, CanonFactType, TemporalScope } from "@/lib/canon/types.ts";
import type { ExpertCostCall } from "@/lib/execute-expert/cost.ts";
import type {
  ArchivistCanonDelta,
  ArchivistConfidence,
  ArchivistEntityAmbiguity,
  ArchivistEvidenceRecord,
  ArchivistIssueType,
  ArchivistLocation,
  ArchivistReview,
} from "../contracts.ts";
import type {
  SegmentCheckpointState,
  SegmentedCallRole,
} from "./constants.ts";

export type SegmentRole = "primary" | "overlap";

export interface ManuscriptSourceLocator {
  kind: "char_range";
  start: number;
  end: number;
  unit_id?: string;
  heading?: string;
}

export interface StructuralManuscriptUnit {
  unit_id: string;
  ordinal: number;
  heading: string;
  heading_kind: "prologue" | "chapter";
  chapter_number: number | null;
  start_offset: number;
  end_offset: number;
  word_count: number;
  approximate_token_count: number;
  part_index: number;
  part_count: number;
  locator: ManuscriptSourceLocator;
}

export interface SegmentUnitAssignment {
  unit_id: string;
  heading: string;
  role: SegmentRole;
  start_offset: number;
  end_offset: number;
  word_count: number;
}

export interface PlannedSegment {
  segment_id: string;
  ordinal: number;
  primary_unit_ids: string[];
  overlap_unit_ids: string[];
  assignments: SegmentUnitAssignment[];
  start_offset: number;
  end_offset: number;
  unique_word_count: number;
  overlap_word_count: number;
  approximate_input_tokens: number;
  source_hash: string;
}

export interface SegmentPlan {
  planner_version: string;
  plan_fingerprint: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  unit_count: number;
  segment_count: number;
  units: StructuralManuscriptUnit[];
  segments: PlannedSegment[];
}

export interface CoverageRange {
  start: number;
  end: number;
  segment_id?: string;
  unit_id?: string;
  kind: "unique" | "overlap" | "uncovered" | "duplicated";
}

export interface SegmentCoverageRow {
  segment_id: string;
  start_offset: number;
  end_offset: number;
  words_assigned: number;
  unique_words: number;
  overlap_words: number;
}

export interface FullNovelCoverageReport {
  schema: "archivist_full_novel_coverage@v1";
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  canonical_manuscript_words: number;
  unit_count: number;
  units_represented: number;
  segment_count: number;
  segments: SegmentCoverageRow[];
  unique_words_covered: number;
  overlap_words: number;
  uncovered_ranges: CoverageRange[];
  duplicated_ranges: CoverageRange[];
  coverage_percentage: number;
  complete: boolean;
}

export interface SegmentObservationEntity {
  alias: string;
  entity_type: CanonEntityType;
  local_mentions: string[];
}

export interface SegmentObservationFact {
  id: string;
  alias: string;
  entity_type: CanonEntityType;
  fact_type: CanonFactType;
  value: Record<string, unknown>;
  temporal_scope: TemporalScope;
  locator: ArchivistLocation;
  excerpt: string;
  confidence: ArchivistConfidence;
  inferred: boolean;
}

export interface SegmentLocalConcern {
  id: string;
  issue_type: ArchivistIssueType;
  explanation: string;
  locator: ArchivistLocation;
  excerpt: string;
}

export interface ArchivistSegmentObservation {
  schema: "archivist_segment_observation@v1";
  segment_id: string;
  entities: SegmentObservationEntity[];
  aliases: Array<{ alias: string; entity_type: CanonEntityType }>;
  candidate_facts: SegmentObservationFact[];
  events: SegmentObservationFact[];
  state_transitions: SegmentObservationFact[];
  relationships: SegmentObservationFact[];
  injuries: SegmentObservationFact[];
  appearance: SegmentObservationFact[];
  age: SegmentObservationFact[];
  rank_title: SegmentObservationFact[];
  alive_status: SegmentObservationFact[];
  knowledge: SegmentObservationFact[];
  locations: SegmentObservationFact[];
  chronology: SegmentObservationFact[];
  possessions: SegmentObservationFact[];
  unique_objects: SegmentObservationFact[];
  weapons_equipment: SegmentObservationFact[];
  vehicles: SegmentObservationFact[];
  organizations: SegmentObservationFact[];
  local_continuity_concerns: SegmentLocalConcern[];
  evidence_references: ArchivistEvidenceRecord[];
  entity_ambiguities: ArchivistEntityAmbiguity[];
  manuscript_id?: string;
  manuscript_version_id?: string;
  content_hash?: string;
  segment_coordinates?: {
    start_offset: number;
    end_offset: number;
    source_hash: string;
  };
  provider?: string;
  model?: string;
  contract_version?: string;
}

export interface SegmentCheckpointPins {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  archivist_version: string;
  archivist_definition_hash: string;
  segment_contract_version: string;
  plan_fingerprint: string;
  segment_id: string;
  segment_source_hash: string;
  start_offset: number;
  end_offset: number;
  provider: string;
  model: string;
}

export interface SegmentCheckpoint extends SegmentCheckpointPins {
  status: SegmentCheckpointState;
  observation?: ArchivistSegmentObservation;
  error?: string;
  repair_used: boolean;
}

export interface BookGraphEntity {
  alias: string;
  entity_type: CanonEntityType;
  entity_id?: string;
  canonical_name?: string;
  resolution: "resolved" | "ambiguous" | "not_found" | "unresolved";
  candidates: Array<{ entity_id: string; canonical_name: string; entity_type: CanonEntityType }>;
  aliases: string[];
  source_segment_ids: string[];
}

export interface BookGraphFact {
  id: string;
  entity_key: string;
  alias: string;
  entity_type: CanonEntityType;
  entity_id?: string;
  fact_type: CanonFactType;
  value: Record<string, unknown>;
  temporal_scope: TemporalScope;
  evidence: ArchivistEvidenceRecord[];
  locators: ArchivistLocation[];
  source_segment_ids: string[];
  confidence: ArchivistConfidence;
}

export interface ArchivistBookGraph {
  schema: "archivist_book_graph@v1";
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  entities: BookGraphEntity[];
  unresolved_ambiguities: ArchivistEntityAmbiguity[];
  candidate_facts: BookGraphFact[];
  temporal_fact_history: BookGraphFact[];
  events: BookGraphFact[];
  relationships: BookGraphFact[];
  injury_histories: BookGraphFact[];
  knowledge_histories: BookGraphFact[];
  location_travel_histories: BookGraphFact[];
  possessions: BookGraphFact[];
  unique_objects: BookGraphFact[];
  organizations: BookGraphFact[];
  evidence_references: ArchivistEvidenceRecord[];
}

export interface ContradictionPair {
  id: string;
  kind:
    | "persistent_value_mismatch"
    | "injury_laterality"
    | "knowledge_before_acquisition"
    | "age_contradiction"
    | "rank_title_chronology"
    | "relationship_history"
    | "alive_dead_chronology"
    | "unique_object_possession"
    | "travel_timeline"
    | "appearance_unexplained";
  issue_type: ArchivistIssueType;
  entity_key: string;
  left: BookGraphFact;
  right: BookGraphFact;
  explanation: string;
  comparison_key?: string;
  comparison_eligibility?: "comparable";
  comparison_reason?: string;
  display_entity?: string;
  display_attribute?: string;
  identity_status?: "resolved" | "explicit_alias" | "ambiguous" | "unresolved";
  confirmation_blocked?: boolean;
  comparison_interface?: string;
}

export interface ReconciliationItem {
  schema: "archivist_global_reconciliation@v1";
  pair_id: string;
  entity_identity: {
    alias: string;
    entity_id?: string;
    canonical_name?: string;
    entity_type: CanonEntityType;
  };
  fact_history: BookGraphFact[];
  temporal_relationship: "earlier_later" | "same_time" | "unknown";
  locators: ArchivistLocation[];
  excerpts: string[];
  comparison: {
    fact_type: CanonFactType;
    left_value: Record<string, unknown>;
    right_value: Record<string, unknown>;
    kind: ContradictionPair["kind"];
    comparison_interface?: string;
  };
  identity_status?: "resolved" | "explicit_alias" | "ambiguous" | "unresolved";
  confirmation_blocked?: boolean;
}

export interface ReconciliationBatch {
  batch_id: string;
  items: ReconciliationItem[];
}

export interface PinnedManuscriptSnapshot {
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number;
  is_current: boolean;
  content_hash: string;
  source_filename: string;
  source_docx_sha256: string;
  analytical_word_count: number;
  extracted_text: string;
}

export interface PinnedManuscriptStore {
  loadPinnedVersion(args: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  }): Promise<PinnedManuscriptSnapshot | null> | PinnedManuscriptSnapshot | null;
}

export interface SegmentedRunCostProjection {
  segment_count: number;
  unique_manuscript_words: number;
  overlap_words: number;
  estimated_input_tokens: number;
  expected_segment_output_tokens: number;
  reconciliation_pair_count: number;
  expected_reconciliation_calls: number;
  repair_allowance: number;
  expected_provider_calls: number;
  low_usd: number;
  expected_usd: number;
  high_usd: number;
  recommended_hard_ceiling_usd: number;
  runtime_estimate_minutes: { low: number; expected: number; high: number };
  hypothetical_calls: Array<{
    role: SegmentedCallRole;
    estimated_input_tokens: number;
    estimated_output_tokens: number;
  }>;
}

export interface SegmentedSimulationResult {
  ok: boolean;
  execution_scope: "full_manuscript" | "incomplete";
  coverage: FullNovelCoverageReport;
  plan: SegmentPlan;
  checkpoints: SegmentCheckpoint[];
  book_graph: ArchivistBookGraph;
  contradiction_pairs: ContradictionPair[];
  reconciliation_batches: ReconciliationBatch[];
  candidate_canon: ArchivistCanonDelta[];
  review: ArchivistReview | null;
  cost_projection: SegmentedRunCostProjection;
  cost_calls: readonly ExpertCostCall[];
  provider_calls: 0;
  canon_writes: 0;
  diagnostics: string[];
}
