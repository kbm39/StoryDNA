/**
 * Safe deterministic Archivist normalization.
 *
 * May: enum casing, trim, locator trim, dedupe identical findings/candidates, sort evidence.
 * Must not: invent evidence, manufacture conflicting canon, invent fact values,
 * upgrade confidence, upgrade possible→confirmed, merge ambiguous entities.
 */

import {
  ARCHIVIST_SEVERITY_LEVELS,
  type ArchivistCanonDelta,
  type ArchivistEntityAmbiguity,
  type ArchivistEvidenceRecord,
  type ArchivistFinding,
  type ArchivistReview,
} from "./contracts.ts";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "./contracts.ts";

const SEVERITY_RANK: Record<(typeof ARCHIVIST_SEVERITY_LEVELS)[number], number> = {
  critical: 0,
  major: 1,
  moderate: 2,
  minor: 3,
};

function trim(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function trimLocator(locator: string): string {
  return locator.replace(/\s+/g, " ").trim();
}

function truncateExcerpt(excerpt: string): string {
  const words = excerpt.trim().split(/\s+/).filter(Boolean);
  if (words.length <= ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS) return words.join(" ");
  return words.slice(0, ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS).join(" ");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(",")}}`;
}

function normalizeEvidence(records: ArchivistEvidenceRecord[]): ArchivistEvidenceRecord[] {
  const normalized = records.map((record) => ({
    ...record,
    excerpt: truncateExcerpt(record.excerpt ?? ""),
    locator: trimLocator(record.locator ?? ""),
    manuscript_id: record.manuscript_id ? trim(record.manuscript_id) : undefined,
    manuscript_version_id: record.manuscript_version_id
      ? trim(record.manuscript_version_id)
      : undefined,
    content_hash: record.content_hash ? trim(record.content_hash) : undefined,
    canon_fact_id: record.canon_fact_id ? trim(record.canon_fact_id) : undefined,
  }));
  normalized.sort(
    (a, b) => a.locator.localeCompare(b.locator) || a.excerpt.localeCompare(b.excerpt),
  );
  const seen = new Set<string>();
  const deduped: ArchivistEvidenceRecord[] = [];
  for (const record of normalized) {
    const key = `${record.evidence_role}|${record.locator}|${record.excerpt}|${record.source_kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }
  return deduped;
}

function findingKey(finding: ArchivistFinding): string {
  return [
    finding.issue_type,
    finding.classification,
    finding.current_location.locator,
    finding.conflicting_location?.locator ?? "",
    finding.explanation,
  ].join("|");
}

function deltaKey(delta: ArchivistCanonDelta): string {
  return [
    delta.entity.alias.toLowerCase(),
    delta.fact_type,
    stableJson(delta.proposed_fact_value),
    stableJson(delta.temporal_scope),
  ].join("|");
}

function normalizeFinding(finding: ArchivistFinding, index: number): ArchivistFinding {
  return {
    ...finding,
    id: trim(finding.id) || `finding-${index + 1}`,
    current_location: {
      ...finding.current_location,
      locator: trimLocator(finding.current_location.locator),
      chapter: finding.current_location.chapter
        ? trim(finding.current_location.chapter)
        : undefined,
      scene: finding.current_location.scene ? trim(finding.current_location.scene) : undefined,
      narrative_time: finding.current_location.narrative_time
        ? trim(finding.current_location.narrative_time)
        : undefined,
    },
    conflicting_location: finding.conflicting_location
      ? {
          ...finding.conflicting_location,
          locator: trimLocator(finding.conflicting_location.locator),
          chapter: finding.conflicting_location.chapter
            ? trim(finding.conflicting_location.chapter)
            : undefined,
          scene: finding.conflicting_location.scene
            ? trim(finding.conflicting_location.scene)
            : undefined,
        }
      : undefined,
    current_evidence: normalizeEvidence(finding.current_evidence ?? []),
    conflicting_evidence: normalizeEvidence(finding.conflicting_evidence ?? []),
    explanation: trim(finding.explanation),
    suggested_resolution: trim(finding.suggested_resolution),
    temporal_analysis: {
      ...finding.temporal_analysis,
      explanation: trim(finding.temporal_analysis.explanation),
    },
    conflicting_canon_fact_id: finding.conflicting_canon_fact_id
      ? trim(finding.conflicting_canon_fact_id)
      : undefined,
  };
}

function normalizeDelta(delta: ArchivistCanonDelta, index: number): ArchivistCanonDelta {
  return {
    ...delta,
    id: trim(delta.id) || `canon-delta-${index + 1}`,
    entity: {
      ...delta.entity,
      alias: trim(delta.entity.alias),
      entity_id: delta.entity.entity_id ? trim(delta.entity.entity_id) : undefined,
      canonical_name: delta.entity.canonical_name ? trim(delta.entity.canonical_name) : undefined,
    },
    source_location: {
      ...delta.source_location,
      locator: trimLocator(delta.source_location.locator),
    },
    evidence: normalizeEvidence(delta.evidence ?? []),
    inferred: delta.inferred === true || delta.proposed_authority === "inferred",
  };
}

function normalizeAmbiguity(
  item: ArchivistEntityAmbiguity,
  index: number,
): ArchivistEntityAmbiguity {
  return {
    ...item,
    id: trim(item.id) || `entity-ambiguity-${index + 1}`,
    alias: trim(item.alias),
    context: trim(item.context),
    recommended_author_verification: trim(item.recommended_author_verification),
    candidate_entities: item.candidate_entities.map((candidate) => ({
      ...candidate,
      entity_id: trim(candidate.entity_id),
      canonical_name: trim(candidate.canonical_name),
      evidence: normalizeEvidence(candidate.evidence ?? []),
    })),
  };
}

function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function countEvidence(review: Pick<ArchivistReview, "findings" | "canon_delta" | "entity_ambiguities">): number {
  const findingEvidence = review.findings.reduce(
    (sum, finding) =>
      sum + (finding.current_evidence?.length ?? 0) + (finding.conflicting_evidence?.length ?? 0),
    0,
  );
  const deltaEvidence = review.canon_delta.reduce(
    (sum, delta) => sum + (delta.evidence?.length ?? 0),
    0,
  );
  const ambiguityEvidence = review.entity_ambiguities.reduce(
    (sum, item) =>
      sum +
      item.candidate_entities.reduce((inner, candidate) => inner + (candidate.evidence?.length ?? 0), 0),
    0,
  );
  return findingEvidence + deltaEvidence + ambiguityEvidence;
}

export function normalizeArchivistReview(review: ArchivistReview): ArchivistReview {
  const findings = dedupeByKey(
    [...review.findings]
      .map((finding, index) => normalizeFinding(finding, index))
      .sort((a, b) => {
        const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (severityDelta !== 0) return severityDelta;
        return a.id.localeCompare(b.id);
      }),
    findingKey,
  );
  const canon_delta = dedupeByKey(
    review.canon_delta.map((delta, index) => normalizeDelta(delta, index)),
    deltaKey,
  );
  const entity_ambiguities = review.entity_ambiguities.map((item, index) =>
    normalizeAmbiguity(item, index),
  );

  const confirmed = findings.filter((finding) => finding.classification === "confirmed_contradiction");
  const possible = findings.filter(
    (finding) => finding.classification === "possible_continuity_conflict",
  );
  const verification = findings.filter(
    (finding) => finding.classification === "author_verification_needed",
  );

  return {
    ...review,
    manuscript_id: trim(review.manuscript_id),
    manuscript_version_id: trim(review.manuscript_version_id),
    content_hash: trim(review.content_hash).toLowerCase(),
    series_id: review.series_id ? trim(review.series_id) : review.series_id,
    summary: {
      ...review.summary,
      narrative: trim(review.summary.narrative),
      confirmed_contradiction_count: confirmed.length,
      possible_conflict_count: possible.length,
      author_verification_count: verification.length,
    },
    findings,
    canon_delta,
    entity_ambiguities,
    metrics: {
      finding_count: findings.length,
      confirmed_contradiction_count: confirmed.length,
      possible_conflict_count: possible.length,
      author_verification_count: verification.length,
      canon_delta_count: canon_delta.length,
      entity_ambiguity_count: entity_ambiguities.length,
      evidence_record_count: countEvidence({ findings, canon_delta, entity_ambiguities }),
    },
  };
}
