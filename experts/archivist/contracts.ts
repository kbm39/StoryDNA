/**
 * Archivist output contract — draft, not runtime-wired, no live generation.
 */

import {
  CANON_AUTHORITIES,
  CANON_CONFIDENCE_LEVELS,
  CANON_CONFLICT_CLASSIFICATIONS,
  CANON_CONFLICT_DISPOSITIONS,
  CANON_ENTITY_TYPES,
  CANON_EVIDENCE_ROLES,
  CANON_EVIDENCE_VERIFICATION_STATUSES,
  CANON_FACT_STATUSES,
  CANON_FACT_TYPES,
  type CanonAuthority,
  type CanonConfidence,
  type CanonConflictClassification,
  type CanonConflictDisposition,
  type CanonCreatedBy,
  type CanonEntityType,
  type CanonEvidenceRole,
  type CanonEvidenceVerificationStatus,
  type CanonFactStatus,
  type CanonFactType,
  type TemporalRelation,
  type TemporalScope,
} from "@/lib/canon/types.ts";

/** Observation time — not continuity compatibility. */
export const ARCHIVIST_OBSERVATION_TEMPORAL_RELATIONS = [
  "same_time",
  "earlier_later",
  "overlapping",
  "unknown",
] as const;

export type ArchivistObservationTemporalRelation =
  (typeof ARCHIVIST_OBSERVATION_TEMPORAL_RELATIONS)[number];

export const ARCHIVIST_CONTINUITY_COMPATIBILITIES = [
  "compatible_change",
  "unexplained_change",
  "incompatible",
  "insufficient_evidence",
] as const;

export type ArchivistContinuityCompatibility =
  (typeof ARCHIVIST_CONTINUITY_COMPATIBILITIES)[number];

export const ARCHIVIST_EXPERT_KEY = "archivist" as const;

export const ARCHIVIST_DISPLAY_NAME = "Archivist" as const;

export const ARCHIVIST_CATEGORY = "archivist_continuity" as const;

export const ARCHIVIST_VERSION = "v1.0.0-draft" as const;

export const ARCHIVIST_DEFINITION_VERSION = "archivist_review@v1-draft" as const;

export const ARCHIVIST_REVIEW_SCHEMA = "archivist_review@v1" as const;

export const ARCHIVIST_LIFECYCLE = "draft" as const;

export const ARCHIVIST_CERTIFICATION_STATUS = "draft_not_certified" as const;

export type ArchivistCertificationStatus = typeof ARCHIVIST_CERTIFICATION_STATUS;

export const ARCHIVIST_ISSUE_TYPES = [
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
  "object_continuity",
  "weapon_equipment_continuity",
  "vehicle_continuity",
  "organization_affiliation",
  "prior_event_reference",
  "family_history",
  "entity_ambiguity",
  "other",
] as const;

export type ArchivistIssueType = (typeof ARCHIVIST_ISSUE_TYPES)[number];

export const ARCHIVIST_CLASSIFICATIONS = CANON_CONFLICT_CLASSIFICATIONS;
export type ArchivistClassification = CanonConflictClassification;

export const ARCHIVIST_SEVERITY_LEVELS = ["critical", "major", "moderate", "minor"] as const;
export type ArchivistSeverity = (typeof ARCHIVIST_SEVERITY_LEVELS)[number];

export const ARCHIVIST_CONFIDENCE_LEVELS = CANON_CONFIDENCE_LEVELS;
export type ArchivistConfidence = CanonConfidence;

export const ARCHIVIST_AUTHOR_ACTIONS = CANON_CONFLICT_DISPOSITIONS;
export type ArchivistAuthorAction = CanonConflictDisposition;

export const ARCHIVIST_ENTITY_TYPES = CANON_ENTITY_TYPES;
export const ARCHIVIST_FACT_TYPES = CANON_FACT_TYPES;
export const ARCHIVIST_AUTHORITIES = CANON_AUTHORITIES;
export const ARCHIVIST_FACT_STATUSES = CANON_FACT_STATUSES;
export const ARCHIVIST_EVIDENCE_ROLES = CANON_EVIDENCE_ROLES;
export const ARCHIVIST_EVIDENCE_VERIFICATION_STATUSES = CANON_EVIDENCE_VERIFICATION_STATUSES;

/** Model output may only propose these authorities. Higher ranks require author/bible action. */
export const ARCHIVIST_MODEL_PROPOSABLE_AUTHORITIES = [
  "current_observation",
  "inferred",
  "uncertain_observation",
] as const satisfies readonly CanonAuthority[];

export type ArchivistModelProposableAuthority =
  (typeof ARCHIVIST_MODEL_PROPOSABLE_AUTHORITIES)[number];

export const ARCHIVIST_ENTITY_RESOLUTIONS = [
  "resolved",
  "ambiguous",
  "not_found",
  "unresolved",
] as const;

export type ArchivistEntityResolution = (typeof ARCHIVIST_ENTITY_RESOLUTIONS)[number];

export const ARCHIVIST_EVIDENCE_SOURCE_KINDS = [
  "manuscript",
  "series_bible",
  "prior_volume_canon",
  "author_approved_exception",
] as const;

export type ArchivistEvidenceSourceKind = (typeof ARCHIVIST_EVIDENCE_SOURCE_KINDS)[number];

export const ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS = 40;

export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface ArchivistLocation {
  locator: string;
  chapter?: string;
  scene?: string;
  book_order?: number | null;
  narrative_time?: string | null;
}

export interface ArchivistEvidenceRecord {
  excerpt: string;
  locator: string;
  evidence_role: CanonEvidenceRole;
  verification_status: CanonEvidenceVerificationStatus;
  source_kind: ArchivistEvidenceSourceKind;
  manuscript_id?: string;
  manuscript_version_id?: string;
  content_hash?: string;
  canon_fact_id?: string;
}

export interface ArchivistTemporalAnalysis {
  relation: ArchivistObservationTemporalRelation;
  /** StoryDNA-owned. Model explanations may inform it; the model does not author it. */
  continuity_compatibility?: ArchivistContinuityCompatibility;
  explanation: string;
  current_scope: TemporalScope;
  conflicting_scope?: TemporalScope;
}

export const ARCHIVIST_CONFIRMATION_ELIGIBILITIES = [
  "eligible",
  "ineligible",
  "insufficient_evidence",
] as const;

export type ArchivistConfirmationEligibility =
  (typeof ARCHIVIST_CONFIRMATION_ELIGIBILITIES)[number];

export interface ArchivistFinding {
  id: string;
  issue_type: ArchivistIssueType;
  /** Final StoryDNA classification after deterministic eligibility. */
  classification: ArchivistClassification;
  /** Advisory model classification before StoryDNA adjustment. */
  model_classification?: ArchivistClassification;
  final_classification?: ArchivistClassification;
  confirmation_eligibility?: ArchivistConfirmationEligibility;
  classification_adjustment_reason?: string;
  severity: ArchivistSeverity;
  confidence: ArchivistConfidence;
  current_location: ArchivistLocation;
  current_evidence: ArchivistEvidenceRecord[];
  conflicting_source?: ArchivistEvidenceSourceKind;
  conflicting_location?: ArchivistLocation;
  conflicting_evidence: ArchivistEvidenceRecord[];
  conflicting_canon_fact_id?: string;
  conflicting_canon_status?: CanonFactStatus;
  conflicting_authority?: CanonAuthority;
  temporal_analysis: ArchivistTemporalAnalysis;
  explanation: string;
  suggested_resolution: string;
  author_action: ArchivistAuthorAction;
  author_challenge_supported: true;
}

export interface ArchivistEntityRef {
  resolution: ArchivistEntityResolution;
  alias: string;
  entity_type: CanonEntityType;
  /** StoryDNA-owned after deterministic resolution. Model-emitted IDs are stripped. */
  entity_id?: string;
  canonical_name?: string;
  candidates?: Array<{ entity_id: string; canonical_name: string }>;
}

export interface ArchivistCanonDelta {
  id: string;
  entity: ArchivistEntityRef;
  entity_type: CanonEntityType;
  fact_type: CanonFactType;
  proposed_fact_value: Record<string, unknown>;
  temporal_scope: TemporalScope;
  source_location: ArchivistLocation;
  evidence: ArchivistEvidenceRecord[];
  confidence: ArchivistConfidence;
  proposed_authority: CanonAuthority;
  status: "candidate";
  inferred: boolean;
  created_by?: CanonCreatedBy;
}

export interface ArchivistEntityAmbiguity {
  id: string;
  alias: string;
  candidate_entities: Array<{
    entity_id: string;
    canonical_name: string;
    entity_type: CanonEntityType;
    evidence: ArchivistEvidenceRecord[];
  }>;
  context: string;
  confidence: ArchivistConfidence;
  recommended_author_verification: string;
}

export interface ArchivistReviewSummary {
  confirmed_contradiction_count: number;
  possible_conflict_count: number;
  author_verification_count: number;
  narrative: string;
}

export interface ArchivistReviewMetrics {
  finding_count: number;
  confirmed_contradiction_count: number;
  possible_conflict_count: number;
  author_verification_count: number;
  canon_delta_count: number;
  entity_ambiguity_count: number;
  evidence_record_count: number;
}

export interface ArchivistGenerationMetadata {
  provider: "none";
  model: "none";
  prompt_version: string;
  validator_version: string;
  normalization_version: string;
  definition_hash: string;
}

export interface ArchivistReview {
  schema: typeof ARCHIVIST_REVIEW_SCHEMA;
  expert_key: typeof ARCHIVIST_EXPERT_KEY;
  expert_version: typeof ARCHIVIST_VERSION;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  series_id?: string | null;
  summary: ArchivistReviewSummary;
  findings: ArchivistFinding[];
  canon_delta: ArchivistCanonDelta[];
  entity_ambiguities: ArchivistEntityAmbiguity[];
  metrics: ArchivistReviewMetrics;
  generation: ArchivistGenerationMetadata;
  author_challenge_supported: true;
}

export interface ArchivistValidationResult {
  ok: boolean;
  errors: string[];
}

export function isArchivistIssueType(value: string): value is ArchivistIssueType {
  return (ARCHIVIST_ISSUE_TYPES as readonly string[]).includes(value);
}

export function isArchivistClassification(value: string): value is ArchivistClassification {
  return (ARCHIVIST_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isArchivistSeverity(value: string): value is ArchivistSeverity {
  return (ARCHIVIST_SEVERITY_LEVELS as readonly string[]).includes(value);
}

export function isArchivistConfidence(value: string): value is ArchivistConfidence {
  return (ARCHIVIST_CONFIDENCE_LEVELS as readonly string[]).includes(value);
}

export function isArchivistFactType(value: string): value is CanonFactType {
  return (ARCHIVIST_FACT_TYPES as readonly string[]).includes(value);
}

export function isArchivistAuthority(value: string): value is CanonAuthority {
  return (ARCHIVIST_AUTHORITIES as readonly string[]).includes(value);
}

export function isModelProposableAuthority(
  value: string,
): value is ArchivistModelProposableAuthority {
  return (ARCHIVIST_MODEL_PROPOSABLE_AUTHORITIES as readonly string[]).includes(value);
}

export type {
  CanonAuthority,
  CanonConfidence,
  CanonCreatedBy,
  CanonEntityType,
  CanonEvidenceRole,
  CanonEvidenceVerificationStatus,
  CanonFactStatus,
  CanonFactType,
  TemporalRelation,
  TemporalScope,
};
