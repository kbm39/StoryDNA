import type {
  ArchivistCanonDelta,
  ArchivistEntityAmbiguity,
  ArchivistEvidenceRecord,
  ArchivistFinding,
  ArchivistLocation,
} from "@/experts/archivist/contracts.ts";
import type { TemporalScope } from "@/lib/canon/types.ts";
import {
  ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE,
  ARCHIVIST_DRY_RUN_FUTURE_ACTIONS,
  ARCHIVIST_DRY_RUN_SCENARIO_VALUES,
  DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO,
  type ArchivistDryRunScenario,
  type PresentedCanonCandidate,
  type PresentedEntityAmbiguity,
  type PresentedEvidence,
  type PresentedFinding,
} from "./types.ts";

export const ARCHIVIST_DRY_RUN_SCENARIO_OPTIONS = [
  { value: "confirmed_within_book", label: "Confirmed contradiction" },
  { value: "explained_temporal_non_conflict", label: "Explained temporal change" },
  { value: "author_verification_needed", label: "Author verification needed" },
  { value: "ambiguous_alias", label: "Ambiguous alias" },
  { value: "candidate_canon_delta", label: "Candidate canon" },
  { value: "clean_no_conflict", label: "Clean / no conflict" },
] as const satisfies ReadonlyArray<{ value: ArchivistDryRunScenario; label: string }>;

const CLASSIFICATION_LABELS: Record<string, string> = {
  confirmed_contradiction: "CONFIRMED CONTRADICTION",
  possible_continuity_conflict: "POSSIBLE CONTINUITY CONFLICT",
  author_verification_needed: "AUTHOR VERIFICATION NEEDED",
};

export function resolveArchivistDryRunScenario(
  value: unknown,
): { ok: true; scenario: ArchivistDryRunScenario } | { ok: false } {
  if (value == null || value === "") {
    return { ok: true, scenario: DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO };
  }
  if (typeof value !== "string") return { ok: false };
  if ((ARCHIVIST_DRY_RUN_SCENARIO_VALUES as readonly string[]).includes(value)) {
    return { ok: true, scenario: value as ArchivistDryRunScenario };
  }
  return { ok: false };
}

export function humanizeKey(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function classificationLabel(classification: string): string {
  return CLASSIFICATION_LABELS[classification] ?? humanizeKey(classification).toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function formatLocation(location: unknown): string {
  if (!location) return "Not specified";
  if (typeof location === "string") return location;
  if (!isRecord(location)) return "Not specified";
  const loc = location as unknown as ArchivistLocation;
  const parts = [
    text(loc.locator),
    loc.chapter ? `Chapter ${loc.chapter}` : "",
    loc.scene ? `Scene ${loc.scene}` : "",
    loc.book_order != null ? `Book ${loc.book_order}` : "",
    text(loc.narrative_time),
  ].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(" · ") : "Not specified";
}

function formatTemporalScope(scope: TemporalScope | undefined): string {
  if (!scope) return "Not specified";
  const parts = [
    scope.kind && scope.kind !== "unknown" ? humanizeKey(scope.kind) : "",
    scope.book_order != null ? `book ${scope.book_order}` : "",
    scope.chapter ? `chapter ${scope.chapter}` : "",
    scope.narrative_time ?? "",
    scope.from ? `from ${scope.from}` : "",
    scope.to ? `to ${scope.to}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

function formatEvidence(records: unknown): PresentedEvidence[] {
  if (!Array.isArray(records)) return [];
  return records.map((record) => {
    const row = isRecord(record) ? (record as unknown as ArchivistEvidenceRecord) : null;
    return {
      location: text(row?.locator, "Not specified"),
      excerpt: text(row?.excerpt, "No excerpt"),
      source: humanizeKey(text(row?.source_kind, "manuscript")),
    };
  });
}

function formatProposedValue(value: unknown): string {
  if (value == null) return "Not specified";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (!isRecord(value)) return "Not specified";
  const parts = Object.entries(value).map(([key, item]) => `${humanizeKey(key)}: ${String(item)}`);
  return parts.length > 0 ? parts.join("; ") : "Not specified";
}

export function presentFinding(raw: unknown): PresentedFinding | null {
  if (!isRecord(raw)) return null;
  const finding = raw as unknown as ArchivistFinding;
  const classification = text(finding.classification, "unknown");
  return {
    id: text(finding.id, "finding"),
    issue_type_label: humanizeKey(text(finding.issue_type, "other")),
    classification,
    classification_label: classificationLabel(classification),
    severity: humanizeKey(text(finding.severity, "unspecified")),
    confidence: humanizeKey(text(finding.confidence, "unspecified")),
    current_location: formatLocation(finding.current_location),
    current_evidence: formatEvidence(finding.current_evidence),
    conflicting_location: formatLocation(finding.conflicting_location),
    conflicting_source: humanizeKey(text(finding.conflicting_source, "manuscript")),
    conflicting_evidence: formatEvidence(finding.conflicting_evidence),
    temporal_analysis: text(finding.temporal_analysis?.explanation, "No temporal analysis provided."),
    explanation: text(finding.explanation, "No explanation provided."),
    suggested_resolution: text(finding.suggested_resolution, "No suggested resolution."),
    is_confirmed_contradiction: classification === "confirmed_contradiction",
  };
}

export function presentCanonCandidate(raw: unknown): PresentedCanonCandidate | null {
  if (!isRecord(raw)) return null;
  const delta = raw as unknown as ArchivistCanonDelta;
  const entityName =
    text(delta.entity?.canonical_name) || text(delta.entity?.alias) || "Unnamed entity";
  return {
    id: text(delta.id, "candidate"),
    entity: entityName,
    entity_type: humanizeKey(text(delta.entity_type, "unknown")),
    fact_type: humanizeKey(text(delta.fact_type, "unknown")),
    proposed_value: formatProposedValue(delta.proposed_fact_value),
    temporal_scope: formatTemporalScope(delta.temporal_scope),
    source_location: formatLocation(delta.source_location),
    evidence: formatEvidence(delta.evidence),
    confidence: humanizeKey(text(delta.confidence, "unspecified")),
    proposed_authority: humanizeKey(text(delta.proposed_authority, "current_observation")),
    status: "candidate",
  };
}

export function presentEntityAmbiguity(raw: unknown): PresentedEntityAmbiguity | null {
  if (!isRecord(raw)) return null;
  const row = raw as unknown as ArchivistEntityAmbiguity;
  const candidates = Array.isArray(row.candidate_entities)
    ? row.candidate_entities.map((candidate) =>
        text(candidate.canonical_name) || text(candidate.entity_id) || "Unknown candidate",
      )
    : [];
  return {
    id: text(row.id, "ambiguity"),
    alias: text(row.alias, "Unknown alias"),
    candidate_entities: candidates,
    context: text(row.context, "No additional context."),
    confidence: humanizeKey(text(row.confidence, "unspecified")),
    recommended_author_verification: text(
      row.recommended_author_verification,
      "Please confirm which character this name refers to. StoryDNA did not guess.",
    ),
    did_not_guess: true,
  };
}

export function presentFindings(values: unknown[]): PresentedFinding[] {
  return values.map(presentFinding).filter((row): row is PresentedFinding => row != null);
}

export function presentCanonCandidates(values: unknown[]): PresentedCanonCandidate[] {
  return values
    .map(presentCanonCandidate)
    .filter((row): row is PresentedCanonCandidate => row != null);
}

export function presentEntityAmbiguities(values: unknown[]): PresentedEntityAmbiguity[] {
  return values
    .map(presentEntityAmbiguity)
    .filter((row): row is PresentedEntityAmbiguity => row != null);
}

export function futureAuthorActionsPreview() {
  return ARCHIVIST_DRY_RUN_FUTURE_ACTIONS.map((action) => ({
    key: action.key,
    label: action.label,
    disabled: true as const,
    note: ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE,
  }));
}
