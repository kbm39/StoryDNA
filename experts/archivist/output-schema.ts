/**
 * Typed Archivist review schema constants — draft, no live generation.
 */

import {
  ARCHIVIST_REVIEW_SCHEMA,
  type ArchivistReview,
} from "./contracts.ts";

export const ARCHIVIST_OUTPUT_SCHEMA_VERSION = "archivist_output@v1-draft" as const;

export const ARCHIVIST_MODEL_OUTPUT_TOP_LEVEL_KEYS = [
  "summary",
  "findings",
  "canon_delta",
  "entity_ambiguities",
] as const;

export const ARCHIVIST_REVIEW_TOP_LEVEL_KEYS = [
  "schema",
  "expert_key",
  "expert_version",
  "manuscript_id",
  "manuscript_version_id",
  "content_hash",
  "series_id",
  "summary",
  "findings",
  "canon_delta",
  "entity_ambiguities",
  "metrics",
  "generation",
  "author_challenge_supported",
] as const;

export const ARCHIVIST_FINDING_REQUIRED_KEYS = [
  "id",
  "issue_type",
  "classification",
  "severity",
  "confidence",
  "current_location",
  "current_evidence",
  "conflicting_evidence",
  "temporal_analysis",
  "explanation",
  "suggested_resolution",
  "author_action",
  "author_challenge_supported",
] as const;

export const ARCHIVIST_CANON_DELTA_REQUIRED_KEYS = [
  "id",
  "entity",
  "entity_type",
  "fact_type",
  "proposed_fact_value",
  "temporal_scope",
  "source_location",
  "evidence",
  "confidence",
  "proposed_authority",
  "status",
] as const;

export const ARCHIVIST_ENTITY_AMBIGUITY_REQUIRED_KEYS = [
  "id",
  "alias",
  "candidate_entities",
  "context",
  "confidence",
  "recommended_author_verification",
] as const;

export type ArchivistReviewShape = ArchivistReview;

export { ARCHIVIST_REVIEW_SCHEMA };
