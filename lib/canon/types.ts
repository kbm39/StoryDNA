/**
 * Archivist canon domain contracts.
 * Persistence rows live in migration 0025; these types are the application contract.
 * Model-output DTOs for future Archivist generation are not defined here.
 */

export const CANON_ENTITY_TYPES = [
  "person",
  "place",
  "object",
  "vehicle",
  "weapon",
  "event",
  "organization",
  "other",
] as const;
export type CanonEntityType = (typeof CANON_ENTITY_TYPES)[number];

export const CANON_FACT_TYPES = [
  "age",
  "appearance",
  "injury",
  "alive_status",
  "rank_title",
  "relationship",
  "location",
  "possession",
  "knowledge_state",
  "chronology",
  "travel",
  "presence",
  "other",
] as const;
export type CanonFactType = (typeof CANON_FACT_TYPES)[number];

/**
 * Mutually exclusive time-varying attributes. Multiple accepted rows are
 * allowed when temporal scopes are disjoint. Overlap is a domain conflict,
 * not a database unique constraint.
 */
export const TIME_VARYING_EXCLUSIVE_FACT_TYPES = [
  "age",
  "appearance",
  "alive_status",
  "rank_title",
] as const satisfies readonly CanonFactType[];

/** @deprecated Use TIME_VARYING_EXCLUSIVE_FACT_TYPES. Book-order uniqueness was too coarse. */
export const SINGLETON_CANON_FACT_TYPES = TIME_VARYING_EXCLUSIVE_FACT_TYPES;

/**
 * Fact types Military Expert should later request without knowing Archivist internals.
 * rank → rank_title; training → knowledge_state; weapons/equipment → possession.
 */
export const MILITARY_CANON_QUERY_FACT_TYPES = [
  "rank_title",
  "knowledge_state",
  "injury",
  "possession",
  "age",
  "chronology",
  "location",
] as const satisfies readonly CanonFactType[];

/** Fact types Developmental Editor should later request. */
export const DEVELOPMENTAL_CANON_QUERY_FACT_TYPES = [
  "chronology",
  "relationship",
  "knowledge_state",
  "presence",
  "alive_status",
  "location",
] as const satisfies readonly CanonFactType[];

/**
 * Authority hierarchy. Rank is documented here — not an unexplained DB integer.
 * Higher rank wins. Lower-authority facts must not silently overwrite higher ones.
 */
export const CANON_AUTHORITIES = [
  "author_approved_exception",
  "series_bible_accepted",
  "prior_volume_canon",
  "current_observation",
  "inferred",
  "uncertain_observation",
] as const;
export type CanonAuthority = (typeof CANON_AUTHORITIES)[number];

export const CANON_AUTHORITY_RANK: Record<CanonAuthority, number> = {
  author_approved_exception: 6,
  series_bible_accepted: 5,
  prior_volume_canon: 4,
  current_observation: 3,
  inferred: 2,
  uncertain_observation: 1,
};

export const CANON_FACT_STATUSES = [
  "candidate",
  "accepted",
  "superseded",
  "rejected",
] as const;
export type CanonFactStatus = (typeof CANON_FACT_STATUSES)[number];

export const CANON_CONFIDENCE_LEVELS = ["high", "medium", "low", "insufficient"] as const;
export type CanonConfidence = (typeof CANON_CONFIDENCE_LEVELS)[number];

export const CANON_CREATED_BY = ["extraction", "author", "bible_import", "inferred"] as const;
export type CanonCreatedBy = (typeof CANON_CREATED_BY)[number];

export const CANON_CONFLICT_CLASSIFICATIONS = [
  "confirmed_contradiction",
  "possible_continuity_conflict",
  "author_verification_needed",
] as const;
export type CanonConflictClassification = (typeof CANON_CONFLICT_CLASSIFICATIONS)[number];

export const CANON_CONFLICT_DISPOSITIONS = [
  "pending",
  "accept_correction",
  "mark_intentional",
  "update_canon",
  "dismiss",
  "comment",
] as const;
export type CanonConflictDisposition = (typeof CANON_CONFLICT_DISPOSITIONS)[number];

export const CANON_SEVERITIES = [
  "critical",
  "major",
  "moderate",
  "minor",
  "informational",
] as const;
export type CanonSeverity = (typeof CANON_SEVERITIES)[number];

export const CANON_EVIDENCE_ROLES = [
  "current_observation",
  "conflicting_canon",
  "supporting",
  "contrary",
] as const;
export type CanonEvidenceRole = (typeof CANON_EVIDENCE_ROLES)[number];

export const CANON_EVIDENCE_VERIFICATION_STATUSES = [
  "unverified",
  "located",
  "not_found",
  "skipped",
] as const;
export type CanonEvidenceVerificationStatus =
  (typeof CANON_EVIDENCE_VERIFICATION_STATUSES)[number];

export const CANON_TRANSITION_KINDS = [
  "promotion",
  "supersession",
  "retcon",
  "rejection",
] as const;
export type CanonTransitionKind = (typeof CANON_TRANSITION_KINDS)[number];

export const SERIES_BIBLE_REVISION_STATUSES = ["draft", "accepted", "superseded"] as const;
export type SeriesBibleRevisionStatus = (typeof SERIES_BIBLE_REVISION_STATUSES)[number];

export interface TemporalScope {
  kind: "at" | "from_to" | "as_of_book" | "unknown";
  book_order?: number | null;
  chapter?: string | null;
  narrative_time?: string | null;
  from?: string | null;
  to?: string | null;
}

export type TemporalRelation = "identical" | "overlap" | "disjoint" | "unknown";

export interface CanonEntity {
  id: string;
  series_id: string | null;
  standalone_manuscript_id: string | null;
  entity_type: CanonEntityType;
  canonical_name: string;
  created_at: string;
  updated_at: string;
}

export type EntityResolutionResult =
  | { status: "resolved"; entity_id: string; entity: CanonEntity }
  | { status: "ambiguous"; candidates: CanonEntity[] }
  | { status: "not_found" };

export type CanonEntityScope =
  | { series_id: string; standalone_manuscript_id?: null }
  | { series_id?: null; standalone_manuscript_id: string };

export interface CanonEntityAlias {
  id: string;
  entity_id: string;
  alias: string;
  alias_normalized: string;
  created_at: string;
}

export interface CanonFact {
  id: string;
  series_id: string | null;
  entity_id: string;
  fact_type: CanonFactType;
  fact_value: Record<string, unknown>;
  temporal_scope: TemporalScope;
  source_manuscript_id: string;
  source_version_id: string;
  source_content_hash: string;
  locator: string | null;
  confidence: CanonConfidence;
  authority: CanonAuthority;
  status: CanonFactStatus;
  superseded_by_fact_id: string | null;
  created_by: CanonCreatedBy;
  created_at: string;
  updated_at: string;
}

export interface CanonEvidence {
  id: string;
  fact_id: string | null;
  conflict_id: string | null;
  evidence_role: CanonEvidenceRole;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  locator: string | null;
  excerpt: string | null;
  normalized_excerpt: string | null;
  verification_status: CanonEvidenceVerificationStatus;
  created_at: string;
}

export interface CanonConflict {
  id: string;
  series_id: string | null;
  manuscript_id: string;
  classification: CanonConflictClassification;
  severity: CanonSeverity;
  confidence: CanonConfidence;
  current_observation_fact_id: string;
  conflicting_canon_fact_id: string | null;
  explanation: string;
  suggested_resolution: string | null;
  author_action: CanonConflictDisposition;
  author_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanonFactTransition {
  id: string;
  from_fact_id: string;
  to_fact_id: string | null;
  kind: CanonTransitionKind;
  reason: string | null;
  created_by: "author" | "bible_import" | "system";
  created_at: string;
}

export interface SeriesBibleRevision {
  id: string;
  series_id: string;
  revision_number: number;
  status: SeriesBibleRevisionStatus;
  supersedes_revision_id: string | null;
  notes: string | null;
  created_by: "author" | "bible_import" | "system";
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
  fact_ids: string[];
}

export interface CanonConflictEvent {
  id: string;
  conflict_id: string;
  author_action: CanonConflictDisposition;
  comment: string | null;
  created_by: "author" | "bible_import" | "system";
  created_at: string;
}

export interface CanonQuery {
  /** Series scope. Null matches standalone (no series) facts. */
  series_id?: string | null;
  /**
   * Provenance filter: facts whose source_manuscript_id matches.
   * Series-wide expert queries omit this and pass series_id.
   */
  manuscript_id?: string;
  /**
   * Review context for derived authority. Accepted facts from other
   * manuscripts are treated as prior_volume_canon. Does not filter rows;
   * use manuscript_id for source provenance.
   */
  as_of_manuscript_id?: string;
  entity_id?: string;
  fact_types?: readonly CanonFactType[];
  min_authority?: CanonAuthority;
  statuses?: readonly CanonFactStatus[];
  include_historical?: boolean;
  temporal_book_order?: number;
}

export interface CanonQueryResult {
  facts: CanonFact[];
  unresolved_conflicts: CanonConflict[];
}

export interface CanonStore {
  entities: CanonEntity[];
  aliases: CanonEntityAlias[];
  facts: CanonFact[];
  evidence: CanonEvidence[];
  conflicts: CanonConflict[];
  conflict_events: CanonConflictEvent[];
  transitions: CanonFactTransition[];
  bible_revisions: SeriesBibleRevision[];
}

export class CanonDomainError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "CanonDomainError";
    this.code = code;
  }
}

export function isCanonFactType(value: string): value is CanonFactType {
  return (CANON_FACT_TYPES as readonly string[]).includes(value);
}
