/**
 * Deterministic prior-canon locator and source-identity attachment.
 *
 * The model may emit semantic reference and evidence. StoryDNA attaches
 * known fixture or canon-store source identity. Fabricated model source
 * IDs are ignored. Missing prior locator or source identity must never
 * remain a confirmed contradiction.
 */

import type { CanonFact, CanonStore } from "@/lib/canon/types.ts";
import type {
  ArchivistEvidenceRecord,
  ArchivistFinding,
  ArchivistReview,
} from "./contracts.ts";
import { isArchivistFactType } from "./contracts.ts";
import type { ArchivistPriorSourceIdentity } from "./prior-source-catalog.ts";

export const ARCHIVIST_ISSUE_TYPE_FACT_TYPE_ALIASES: Record<string, string> = {
  prior_event_reference: "relationship",
  family_history: "relationship",
  object_continuity: "possession",
  weapon_equipment_continuity: "possession",
  vehicle_continuity: "travel",
  organization_affiliation: "other",
  entity_ambiguity: "other",
};

const FACT_ID_PATTERN = /canon-fact-[\w-]+/g;

export interface PriorCanonProvenanceContext {
  canonStore?: CanonStore;
  priorSources?: readonly ArchivistPriorSourceIdentity[];
  currentManuscriptId?: string;
  currentVersionId?: string;
}

export function mapIssueTypeToFactType(value: string): string {
  const alias = ARCHIVIST_ISSUE_TYPE_FACT_TYPE_ALIASES[value];
  return alias ?? value;
}

export function isPriorCanonFinding(finding: ArchivistFinding): boolean {
  if (finding.conflicting_source === "prior_volume_canon" || finding.conflicting_source === "series_bible") {
    return true;
  }
  if (finding.issue_type === "prior_event_reference") return true;
  return (finding.conflicting_evidence ?? []).some(
    (record) => record.source_kind === "prior_volume_canon" || record.source_kind === "series_bible",
  );
}

export function priorCanonEvidenceRecords(finding: ArchivistFinding): ArchivistEvidenceRecord[] {
  return (finding.conflicting_evidence ?? []).filter(
    (record) => record.source_kind === "prior_volume_canon" || record.source_kind === "series_bible",
  );
}

export function hasPriorCanonLocator(finding: ArchivistFinding): boolean {
  const location = finding.conflicting_location?.locator?.trim();
  const evidence = priorCanonEvidenceRecords(finding).some((record) => Boolean(record.locator?.trim()));
  if (priorCanonEvidenceRecords(finding).length === 0) {
    return Boolean(location);
  }
  return Boolean(location && evidence);
}

export function hasPriorCanonSourceIdentity(finding: ArchivistFinding): boolean {
  if (finding.conflicting_canon_fact_id?.trim() && finding.conflicting_source) return true;
  return priorCanonEvidenceRecords(finding).some(
    (record) =>
      Boolean(record.canon_fact_id?.trim()) ||
      (Boolean(record.manuscript_id?.trim()) && Boolean(record.manuscript_version_id?.trim())),
  );
}

function mentionedFactIds(finding: ArchivistFinding): string[] {
  const haystack = [
    finding.conflicting_canon_fact_id,
    finding.conflicting_location?.locator,
    finding.explanation,
    ...(finding.conflicting_evidence ?? []).map((record) => `${record.locator} ${record.excerpt} ${record.canon_fact_id ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ");
  return [...haystack.matchAll(FACT_ID_PATTERN)].map((match) => match[0]);
}

function excerptOverlaps(left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = a.split(/\s+/).filter((word) => word.length > 3);
  const hits = words.filter((word) => b.includes(word));
  return hits.length >= 3;
}

function issueMatchesFactType(issueType: string, factType: string): boolean {
  if (issueType === factType) return true;
  return mapIssueTypeToFactType(issueType) === factType;
}

function sourceFromFact(fact: CanonFact): ArchivistPriorSourceIdentity {
  return {
    source_id: fact.id,
    source_manuscript_id: fact.source_manuscript_id,
    source_version_id: fact.source_version_id,
    source_content_hash: fact.source_content_hash,
    source_label: "canon store prior source",
    book_order: fact.temporal_scope.book_order ?? 1,
    chapter: fact.temporal_scope.chapter ?? undefined,
    locator: fact.locator ?? "",
    canon_fact_id: fact.id,
    fact_type: fact.fact_type,
    excerpt: typeof fact.fact_value.history === "string"
      ? fact.fact_value.history
      : JSON.stringify(fact.fact_value),
    source_kind: "prior_volume_canon",
    status: "accepted",
    authority: "prior_volume_canon",
  };
}

function knownSourceIds(context: PriorCanonProvenanceContext | undefined): Set<string> {
  const known = new Set<string>();
  if (context?.currentManuscriptId) known.add(context.currentManuscriptId);
  if (context?.currentVersionId) known.add(context.currentVersionId);
  for (const fact of context?.canonStore?.facts ?? []) {
    if (fact.id) known.add(fact.id);
    if (fact.source_manuscript_id) known.add(fact.source_manuscript_id);
    if (fact.source_version_id) known.add(fact.source_version_id);
  }
  for (const source of context?.priorSources ?? []) {
    known.add(source.canon_fact_id);
    known.add(source.source_manuscript_id);
    known.add(source.source_version_id);
    known.add(source.source_id);
  }
  return known;
}

function matchPriorSource(
  finding: ArchivistFinding,
  context: PriorCanonProvenanceContext | undefined,
): ArchivistPriorSourceIdentity | null {
  const registry = context?.priorSources ?? [];
  const storeFacts = (context?.canonStore?.facts ?? []).filter((fact) => fact.status === "accepted");
  const mentioned = mentionedFactIds(finding);

  for (const id of mentioned) {
    const storeHit = storeFacts.find((fact) => fact.id === id);
    if (storeHit) return sourceFromFact(storeHit);
    const registryHit = registry.find((item) => item.canon_fact_id === id);
    if (registryHit) return registryHit;
  }

  const excerpts = [
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
    finding.explanation,
  ].filter(Boolean);

  const storeByExcerpt = storeFacts.filter((fact) => {
    if (!issueMatchesFactType(finding.issue_type, fact.fact_type)) return false;
    const value = JSON.stringify(fact.fact_value);
    return excerpts.some((excerpt) => excerptOverlaps(excerpt, value) || excerptOverlaps(excerpt, fact.locator ?? ""));
  });
  if (storeByExcerpt.length === 1 && storeByExcerpt[0]) return sourceFromFact(storeByExcerpt[0]);

  const registryByExcerpt = registry.filter((item) => {
    if (!issueMatchesFactType(finding.issue_type, item.fact_type)) return false;
    return excerpts.some((excerpt) => excerptOverlaps(excerpt, item.excerpt) || excerptOverlaps(excerpt, item.locator));
  });
  if (registryByExcerpt.length === 1 && registryByExcerpt[0]) return registryByExcerpt[0];

  const typedStore = storeFacts.filter((fact) => issueMatchesFactType(finding.issue_type, fact.fact_type));
  if (typedStore.length === 1 && typedStore[0]) return sourceFromFact(typedStore[0]);
  const typedRegistry = registry.filter((item) => issueMatchesFactType(finding.issue_type, item.fact_type));
  if (typedRegistry.length === 1 && typedRegistry[0]) return typedRegistry[0];
  return null;
}

function stripFabricatedSourceIds(
  record: ArchivistEvidenceRecord,
  known: Set<string>,
): ArchivistEvidenceRecord {
  if (record.source_kind !== "prior_volume_canon" && record.source_kind !== "series_bible") {
    return record;
  }
  return {
    ...record,
    manuscript_id:
      record.manuscript_id && known.has(record.manuscript_id) ? record.manuscript_id : undefined,
    manuscript_version_id:
      record.manuscript_version_id && known.has(record.manuscript_version_id)
        ? record.manuscript_version_id
        : undefined,
    content_hash: record.content_hash && /^[a-f0-9]{64}$/.test(record.content_hash)
      ? record.content_hash
      : undefined,
    canon_fact_id: record.canon_fact_id && known.has(record.canon_fact_id)
      ? record.canon_fact_id
      : undefined,
  };
}

function attachSourceToRecord(
  record: ArchivistEvidenceRecord,
  source: ArchivistPriorSourceIdentity,
): ArchivistEvidenceRecord {
  if (record.source_kind !== "prior_volume_canon" && record.source_kind !== "series_bible") {
    return record;
  }
  return {
    ...record,
    manuscript_id: source.source_manuscript_id,
    manuscript_version_id: source.source_version_id,
    content_hash: source.source_content_hash,
    canon_fact_id: source.canon_fact_id,
    locator: record.locator?.trim() ? record.locator : source.locator,
  };
}

function attachFindingProvenance(
  finding: ArchivistFinding,
  context: PriorCanonProvenanceContext | undefined,
): ArchivistFinding {
  const known = knownSourceIds(context);
  const stripped: ArchivistFinding = {
    ...finding,
    conflicting_evidence: (finding.conflicting_evidence ?? []).map((record) =>
      stripFabricatedSourceIds(record, known),
    ),
    conflicting_canon_fact_id:
      finding.conflicting_canon_fact_id && known.has(finding.conflicting_canon_fact_id)
        ? finding.conflicting_canon_fact_id
        : undefined,
  };

  if (!isPriorCanonFinding(stripped)) return stripped;
  const source = matchPriorSource(stripped, context);
  if (!source) return stripped;

  const conflictingEvidence = (stripped.conflicting_evidence ?? []).map((record) =>
    attachSourceToRecord(record, source),
  );
  return {
    ...stripped,
    conflicting_source: stripped.conflicting_source ?? "prior_volume_canon",
    conflicting_canon_fact_id: source.canon_fact_id,
    conflicting_canon_status: stripped.conflicting_canon_status ?? source.status,
    conflicting_authority: stripped.conflicting_authority ?? source.authority,
    conflicting_location: {
      locator: stripped.conflicting_location?.locator?.trim()
        ? stripped.conflicting_location.locator
        : source.locator,
      chapter: stripped.conflicting_location?.chapter ?? source.chapter,
      book_order: stripped.conflicting_location?.book_order ?? source.book_order,
      scene: stripped.conflicting_location?.scene,
      narrative_time: stripped.conflicting_location?.narrative_time,
    },
    conflicting_evidence: conflictingEvidence,
  };
}

export function applyPriorCanonProvenance(
  review: ArchivistReview,
  context?: PriorCanonProvenanceContext,
): ArchivistReview {
  return {
    ...review,
    findings: review.findings.map((finding) => attachFindingProvenance(finding, context)),
    canon_delta: review.canon_delta.map((delta) => {
      const mapped = mapIssueTypeToFactType(String(delta.fact_type));
      return {
        ...delta,
        fact_type: (isArchivistFactType(mapped) ? mapped : delta.fact_type) as typeof delta.fact_type,
      };
    }),
  };
}
