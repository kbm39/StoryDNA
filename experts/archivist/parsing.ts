/**
 * Deterministic Archivist JSON parsing — fail-closed, no model repair.
 */

import {
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
  type ArchivistCanonDelta,
  type ArchivistEntityAmbiguity,
  type ArchivistEvidenceRecord,
  type ArchivistFinding,
  type ArchivistReview,
  type ArchivistReviewMetrics,
  type ArchivistReviewSummary,
} from "./contracts.ts";
import { normalizeArchivistEnumValue, type ArchivistEnumNormalizationAudit } from "./enum-normalization.ts";
import { mapArchivistTemporalRelation } from "./temporal-continuity.ts";

export type ArchivistParseFailureCode =
  | "malformed_json"
  | "not_an_object"
  | "schema_invalid"
  | "unexpected_parse_failure";

export interface ArchivistParseSuccess {
  ok: true;
  review: ArchivistReview;
  enumNormalizationAudits: readonly ArchivistEnumNormalizationAudit[];
}

export interface ArchivistParseFailure {
  ok: false;
  code: ArchivistParseFailureCode;
  message: string;
}

export type ArchivistParseResult = ArchivistParseSuccess | ArchivistParseFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: unknown): { ok: true; value: unknown } | ArchivistParseFailure {
  if (typeof raw !== "string") return { ok: true, value: raw };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, code: "malformed_json", message: "Archivist output is not valid JSON" };
  }
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject);
}

function foldEvidence(
  value: unknown,
  path: string,
  audits: ArchivistEnumNormalizationAudit[],
): ArchivistEvidenceRecord[] {
  return asRecordArray(value).map((record, index) => ({
    excerpt: typeof record.excerpt === "string" ? record.excerpt : "",
    locator: typeof record.locator === "string" ? record.locator : "",
    evidence_role: normalizeArchivistEnumValue(
      record.evidence_role,
      "evidence_role",
      `${path}[${index}].evidence_role`,
      audits,
    ) as ArchivistEvidenceRecord["evidence_role"],
    verification_status: normalizeArchivistEnumValue(
      record.verification_status,
      "verification_status",
      `${path}[${index}].verification_status`,
      audits,
    ) as ArchivistEvidenceRecord["verification_status"],
    source_kind: normalizeArchivistEnumValue(
      record.source_kind,
      "source_kind",
      `${path}[${index}].source_kind`,
      audits,
    ) as ArchivistEvidenceRecord["source_kind"],
    manuscript_id: typeof record.manuscript_id === "string" ? record.manuscript_id : undefined,
    manuscript_version_id:
      typeof record.manuscript_version_id === "string" ? record.manuscript_version_id : undefined,
    content_hash: typeof record.content_hash === "string" ? record.content_hash : undefined,
    canon_fact_id: typeof record.canon_fact_id === "string" ? record.canon_fact_id : undefined,
  }));
}

function foldTemporalScope(value: unknown): ArchivistFinding["temporal_analysis"]["current_scope"] {
  if (!isObject(value)) return { kind: "unknown" };
  const kind = value.kind;
  if (kind === "at" || kind === "from_to" || kind === "as_of_book" || kind === "unknown") {
    return {
      kind,
      book_order: typeof value.book_order === "number" ? value.book_order : null,
      chapter: typeof value.chapter === "string" ? value.chapter : null,
      narrative_time: typeof value.narrative_time === "string" ? value.narrative_time : null,
      from: typeof value.from === "string" ? value.from : null,
      to: typeof value.to === "string" ? value.to : null,
    };
  }
  return { kind: "unknown" };
}

function foldLocation(value: unknown): ArchivistFinding["current_location"] {
  if (!isObject(value)) {
    return { locator: "" };
  }
  return {
    locator: typeof value.locator === "string" ? value.locator : "",
    chapter: typeof value.chapter === "string" ? value.chapter : undefined,
    scene: typeof value.scene === "string" ? value.scene : undefined,
    book_order: typeof value.book_order === "number" ? value.book_order : null,
    narrative_time: typeof value.narrative_time === "string" ? value.narrative_time : undefined,
  };
}

function foldFinding(
  value: Record<string, unknown>,
  index: number,
  audits: ArchivistEnumNormalizationAudit[],
): ArchivistFinding {
  const prefix = `findings[${index}]`;
  const temporal = isObject(value.temporal_analysis) ? value.temporal_analysis : {};
  return {
    id: typeof value.id === "string" ? value.id : "",
    issue_type: normalizeArchivistEnumValue(
      value.issue_type,
      "issue_type",
      `${prefix}.issue_type`,
      audits,
    ) as ArchivistFinding["issue_type"],
    classification: normalizeArchivistEnumValue(
      value.classification,
      "classification",
      `${prefix}.classification`,
      audits,
    ) as ArchivistFinding["classification"],
    severity: normalizeArchivistEnumValue(
      value.severity,
      "severity",
      `${prefix}.severity`,
      audits,
    ) as ArchivistFinding["severity"],
    confidence: normalizeArchivistEnumValue(
      value.confidence,
      "confidence",
      `${prefix}.confidence`,
      audits,
    ) as ArchivistFinding["confidence"],
    current_location: foldLocation(value.current_location),
    current_evidence: foldEvidence(value.current_evidence, `${prefix}.current_evidence`, audits),
    conflicting_source: value.conflicting_source
      ? (normalizeArchivistEnumValue(
          value.conflicting_source,
          "source_kind",
          `${prefix}.conflicting_source`,
          audits,
        ) as ArchivistFinding["conflicting_source"])
      : undefined,
    conflicting_location: value.conflicting_location
      ? foldLocation(value.conflicting_location)
      : undefined,
    conflicting_evidence: foldEvidence(
      value.conflicting_evidence,
      `${prefix}.conflicting_evidence`,
      audits,
    ),
    conflicting_canon_fact_id:
      typeof value.conflicting_canon_fact_id === "string"
        ? value.conflicting_canon_fact_id
        : undefined,
    conflicting_canon_status: value.conflicting_canon_status
      ? (normalizeArchivistEnumValue(
          value.conflicting_canon_status,
          "fact_status",
          `${prefix}.conflicting_canon_status`,
          audits,
        ) as ArchivistFinding["conflicting_canon_status"])
      : undefined,
    conflicting_authority: value.conflicting_authority
      ? (normalizeArchivistEnumValue(
          value.conflicting_authority,
          "authority",
          `${prefix}.conflicting_authority`,
          audits,
        ) as ArchivistFinding["conflicting_authority"])
      : undefined,
    temporal_analysis: {
      relation: mapArchivistTemporalRelation(temporal.relation) as ArchivistFinding["temporal_analysis"]["relation"],
      continuity_compatibility:
        typeof temporal.continuity_compatibility === "string"
          ? (temporal.continuity_compatibility.trim().toLowerCase() as
              | ArchivistFinding["temporal_analysis"]["continuity_compatibility"])
          : undefined,
      explanation: typeof temporal.explanation === "string" ? temporal.explanation : "",
      current_scope: foldTemporalScope(temporal.current_scope),
      conflicting_scope: temporal.conflicting_scope
        ? foldTemporalScope(temporal.conflicting_scope)
        : undefined,
    },
    explanation: typeof value.explanation === "string" ? value.explanation : "",
    suggested_resolution: typeof value.suggested_resolution === "string" ? value.suggested_resolution : "",
    author_action: normalizeArchivistEnumValue(
      value.author_action,
      "author_action",
      `${prefix}.author_action`,
      audits,
    ) as ArchivistFinding["author_action"],
    author_challenge_supported: value.author_challenge_supported as true,
  };
}

function foldDelta(
  value: Record<string, unknown>,
  index: number,
  audits: ArchivistEnumNormalizationAudit[],
): ArchivistCanonDelta {
  const prefix = `canon_delta[${index}]`;
  const entity = isObject(value.entity) ? value.entity : {};
  return {
    id: typeof value.id === "string" ? value.id : "",
    entity: {
      resolution: normalizeArchivistEnumValue(
        entity.resolution,
        "entity_resolution",
        `${prefix}.entity.resolution`,
        audits,
      ) as ArchivistCanonDelta["entity"]["resolution"],
      alias: typeof entity.alias === "string" ? entity.alias : "",
      entity_type: normalizeArchivistEnumValue(
        entity.entity_type ?? value.entity_type,
        "entity_type",
        `${prefix}.entity.entity_type`,
        audits,
      ) as ArchivistCanonDelta["entity"]["entity_type"],
      // Model-emitted IDs are captured then stripped during StoryDNA resolution.
      entity_id: typeof entity.entity_id === "string" ? entity.entity_id : undefined,
      canonical_name: typeof entity.canonical_name === "string" ? entity.canonical_name : undefined,
      candidates: Array.isArray(entity.candidates)
        ? entity.candidates.filter(isObject).map((candidate) => ({
            entity_id: typeof candidate.entity_id === "string" ? candidate.entity_id : "",
            canonical_name:
              typeof candidate.canonical_name === "string" ? candidate.canonical_name : "",
          }))
        : undefined,
    },
    entity_type: normalizeArchivistEnumValue(
      value.entity_type ?? entity.entity_type,
      "entity_type",
      `${prefix}.entity_type`,
      audits,
    ) as ArchivistCanonDelta["entity_type"],
    fact_type: normalizeArchivistEnumValue(
      value.fact_type,
      "fact_type",
      `${prefix}.fact_type`,
      audits,
    ) as ArchivistCanonDelta["fact_type"],
    proposed_fact_value: isObject(value.proposed_fact_value) ? value.proposed_fact_value : {},
    temporal_scope: foldTemporalScope(value.temporal_scope),
    source_location: foldLocation(value.source_location),
    evidence: foldEvidence(value.evidence, `${prefix}.evidence`, audits),
    confidence: normalizeArchivistEnumValue(
      value.confidence,
      "confidence",
      `${prefix}.confidence`,
      audits,
    ) as ArchivistCanonDelta["confidence"],
    proposed_authority: normalizeArchivistEnumValue(
      value.proposed_authority,
      "authority",
      `${prefix}.proposed_authority`,
      audits,
    ) as ArchivistCanonDelta["proposed_authority"],
    status: (typeof value.status === "string" ? value.status : "candidate") as "candidate",
    inferred: value.inferred === true,
    created_by: typeof value.created_by === "string" ? (value.created_by as ArchivistCanonDelta["created_by"]) : undefined,
  };
}

function foldAmbiguity(
  value: Record<string, unknown>,
  index: number,
  audits: ArchivistEnumNormalizationAudit[],
): ArchivistEntityAmbiguity {
  const prefix = `entity_ambiguities[${index}]`;
  return {
    id: typeof value.id === "string" ? value.id : "",
    alias: typeof value.alias === "string" ? value.alias : "",
    candidate_entities: asRecordArray(value.candidate_entities).map((candidate) => ({
      entity_id: typeof candidate.entity_id === "string" ? candidate.entity_id : "",
      canonical_name: typeof candidate.canonical_name === "string" ? candidate.canonical_name : "",
      entity_type: normalizeArchivistEnumValue(
        candidate.entity_type,
        "entity_type",
        `${prefix}.candidate_entities.entity_type`,
        audits,
      ) as ArchivistEntityAmbiguity["candidate_entities"][number]["entity_type"],
      evidence: foldEvidence(candidate.evidence, `${prefix}.candidate_entities.evidence`, audits),
    })),
    context: typeof value.context === "string" ? value.context : "",
    confidence: normalizeArchivistEnumValue(
      value.confidence,
      "confidence",
      `${prefix}.confidence`,
      audits,
    ) as ArchivistEntityAmbiguity["confidence"],
    recommended_author_verification:
      typeof value.recommended_author_verification === "string"
        ? value.recommended_author_verification
        : "",
  };
}

function foldSummary(value: unknown, findings: ArchivistFinding[]): ArchivistReviewSummary {
  const obj = isObject(value) ? value : {};
  return {
    confirmed_contradiction_count:
      typeof obj.confirmed_contradiction_count === "number"
        ? obj.confirmed_contradiction_count
        : findings.filter((finding) => finding.classification === "confirmed_contradiction").length,
    possible_conflict_count:
      typeof obj.possible_conflict_count === "number"
        ? obj.possible_conflict_count
        : findings.filter((finding) => finding.classification === "possible_continuity_conflict")
            .length,
    author_verification_count:
      typeof obj.author_verification_count === "number"
        ? obj.author_verification_count
        : findings.filter((finding) => finding.classification === "author_verification_needed")
            .length,
    narrative: typeof obj.narrative === "string" ? obj.narrative : "",
  };
}

function foldMetrics(value: unknown): ArchivistReviewMetrics {
  const obj = isObject(value) ? value : {};
  return {
    finding_count: typeof obj.finding_count === "number" ? obj.finding_count : 0,
    confirmed_contradiction_count:
      typeof obj.confirmed_contradiction_count === "number" ? obj.confirmed_contradiction_count : 0,
    possible_conflict_count:
      typeof obj.possible_conflict_count === "number" ? obj.possible_conflict_count : 0,
    author_verification_count:
      typeof obj.author_verification_count === "number" ? obj.author_verification_count : 0,
    canon_delta_count: typeof obj.canon_delta_count === "number" ? obj.canon_delta_count : 0,
    entity_ambiguity_count:
      typeof obj.entity_ambiguity_count === "number" ? obj.entity_ambiguity_count : 0,
    evidence_record_count:
      typeof obj.evidence_record_count === "number" ? obj.evidence_record_count : 0,
  };
}

export function parseArchivistReview(raw: unknown): ArchivistParseResult {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  if (!isObject(parsed.value)) {
    return { ok: false, code: "not_an_object", message: "Archivist output must be an object" };
  }

  const audits: ArchivistEnumNormalizationAudit[] = [];
  const input = parsed.value;
  const findings = asRecordArray(input.findings).map((finding, index) =>
    foldFinding(finding, index, audits),
  );
  const generation = isObject(input.generation) ? input.generation : {};

  try {
    const review: ArchivistReview = {
      schema: (typeof input.schema === "string" ? input.schema : ARCHIVIST_REVIEW_SCHEMA) as typeof ARCHIVIST_REVIEW_SCHEMA,
      expert_key: (typeof input.expert_key === "string" ? input.expert_key : ARCHIVIST_EXPERT_KEY) as typeof ARCHIVIST_EXPERT_KEY,
      expert_version: (typeof input.expert_version === "string"
        ? input.expert_version
        : ARCHIVIST_VERSION) as typeof ARCHIVIST_VERSION,
      manuscript_id: typeof input.manuscript_id === "string" ? input.manuscript_id : "",
      manuscript_version_id:
        typeof input.manuscript_version_id === "string" ? input.manuscript_version_id : "",
      content_hash: typeof input.content_hash === "string" ? input.content_hash : "",
      series_id: typeof input.series_id === "string" ? input.series_id : input.series_id === null ? null : undefined,
      summary: foldSummary(input.summary, findings),
      findings,
      canon_delta: asRecordArray(input.canon_delta).map((delta, index) =>
        foldDelta(delta, index, audits),
      ),
      entity_ambiguities: asRecordArray(input.entity_ambiguities).map((item, index) =>
        foldAmbiguity(item, index, audits),
      ),
      metrics: foldMetrics(input.metrics),
      generation: {
        provider: (generation.provider === "none" ? "none" : generation.provider) as "none",
        model: (generation.model === "none" ? "none" : generation.model) as "none",
        prompt_version: typeof generation.prompt_version === "string" ? generation.prompt_version : "",
        validator_version:
          typeof generation.validator_version === "string" ? generation.validator_version : "",
        normalization_version:
          typeof generation.normalization_version === "string"
            ? generation.normalization_version
            : "",
        definition_hash:
          typeof generation.definition_hash === "string" ? generation.definition_hash : "",
      },
      author_challenge_supported: input.author_challenge_supported as true,
    };
    return { ok: true, review, enumNormalizationAudits: audits };
  } catch (error) {
    return {
      ok: false,
      code: "unexpected_parse_failure",
      message: error instanceof Error ? error.message : "Unexpected parse failure",
    };
  }
}
