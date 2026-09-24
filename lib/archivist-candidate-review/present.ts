import { ARCHIVIST_REVIEW_SCHEMA } from "@/experts/archivist/contracts.ts";
import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import { humanizeKey } from "@/lib/archivist-dry-run/present.ts";
import {
  ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTION_NOTE,
  ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTIONS,
  type ArchivistCandidateReviewUiModel,
  type PresentedCandidateCanonFact,
  type PresentedCandidateFinding,
  type PresentedEvidenceSide,
} from "./types.ts";

const CLASSIFICATION_LABELS: Record<string, string> = {
  confirmed_contradiction: "Confirmed contradiction",
  possible_continuity_conflict: "Possible continuity conflict",
  author_verification_needed: "Author verification needed",
};

const UNVERIFIED_MESSAGE = "Evidence could not be verified against the manuscript.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function classificationLabel(classification: string): string {
  return CLASSIFICATION_LABELS[classification] ?? humanizeKey(classification);
}

export function formatLocation(location: unknown): string {
  if (!location) return "Not specified";
  if (typeof location === "string") return location;
  if (!isRecord(location)) return "Not specified";
  const locator = text(location.locator);
  const chapter = text(location.chapter);
  if (locator && chapter && locator !== chapter) return `${locator} · ${chapter}`;
  return locator || chapter || "Not specified";
}

function formatTemporalScope(scope: unknown): string {
  if (!isRecord(scope)) return "Not specified";
  const parts = [
    text(scope.kind) && text(scope.kind) !== "unknown" ? humanizeKey(text(scope.kind)) : "",
    text(scope.chapter),
    text(scope.narrative_time),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Not specified";
}

function formatProposedValue(value: unknown): string {
  if (value == null) return "Not specified";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatProposedValue(item)).filter((item) => item !== "Not specified").join(", ");
  }
  if (!isRecord(value)) return "Not specified";
  const parts = Object.entries(value)
    .filter(([, item]) => item != null && String(item).trim() && String(item) !== "[object Object]")
    .map(([key, item]) => `${humanizeKey(key)}: ${formatProposedValue(item)}`);
  return parts.length > 0 ? parts.join("; ") : "Not specified";
}

export function presentEvidenceSide(
  records: unknown,
  fallbackLocation: string,
): PresentedEvidenceSide {
  const list = Array.isArray(records) ? records.filter(isRecord) : [];
  const quoted = list.find((record) => {
    return (
      text(record.source_kind, "manuscript") === "manuscript" &&
      text(record.verification_status) === "located" &&
      text(record.excerpt).length > 0
    );
  });
  if (quoted) {
    return {
      kind: "quoted",
      location: text(quoted.locator, fallbackLocation),
      excerpt: text(quoted.excerpt),
    };
  }
  return {
    kind: "unverified",
    location: fallbackLocation,
    message: UNVERIFIED_MESSAGE,
  };
}

function presentFinding(raw: unknown): PresentedCandidateFinding | null {
  if (!isRecord(raw)) return null;
  const classification = text(raw.final_classification ?? raw.classification, "unknown");
  const model = text(raw.model_classification ?? raw.classification, classification);
  const currentLocation = formatLocation(raw.current_location);
  const conflictingLocation = formatLocation(raw.conflicting_location);
  const issue = text(raw.issue_type, "other");
  return {
    id: text(raw.id, "finding"),
    subject: humanizeKey(issue),
    issue_type_label: humanizeKey(issue),
    classification,
    classification_label: classificationLabel(classification),
    severity: humanizeKey(text(raw.severity, "unspecified")),
    confidence: humanizeKey(text(raw.confidence, "unspecified")),
    current_location: currentLocation,
    conflicting_location: conflictingLocation,
    current_evidence: presentEvidenceSide(raw.current_evidence, currentLocation),
    conflicting_evidence: presentEvidenceSide(raw.conflicting_evidence, conflictingLocation),
    explanation: text(raw.explanation, "No explanation provided."),
    temporal_analysis: isRecord(raw.temporal_analysis)
      ? text(raw.temporal_analysis.explanation, "No temporal analysis provided.")
      : "No temporal analysis provided.",
    suggested_resolution: text(raw.suggested_resolution, "No suggested resolution."),
    model_classification: model,
    model_classification_label: classificationLabel(model),
    final_classification: classification,
    final_classification_label: classificationLabel(classification),
    confirmation_eligibility: humanizeKey(text(raw.confirmation_eligibility, "unspecified")),
    classification_adjustment_reason: text(
      raw.classification_adjustment_reason,
      "StoryDNA did not change this assessment.",
    ),
    classification_changed: model !== classification,
  };
}

function presentCanonFact(raw: unknown): PresentedCandidateCanonFact | null {
  if (!isRecord(raw)) return null;
  if (text(raw.status, "candidate") !== "candidate") return null;
  const entity = isRecord(raw.entity)
    ? text(raw.entity.canonical_name) || text(raw.entity.alias) || "Unnamed"
    : "Unnamed";
  const location = formatLocation(raw.source_location);
  return {
    id: text(raw.id, "candidate"),
    entity,
    entity_type: humanizeKey(text(raw.entity_type, "unknown")),
    fact_type: humanizeKey(text(raw.fact_type, "other")),
    fact_type_key: text(raw.fact_type, "other"),
    proposed_value: formatProposedValue(raw.proposed_fact_value),
    temporal_scope: formatTemporalScope(raw.temporal_scope),
    source_location: location,
    evidence: presentEvidenceSide(raw.evidence, location),
    confidence: humanizeKey(text(raw.confidence, "unspecified")),
    status: "candidate",
  };
}

export function presentCandidateReview(args: {
  review: unknown;
  workflow: {
    id: string;
    status: string;
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash?: string;
  };
  coverage?: {
    unique_words_covered?: number;
    canonical_manuscript_words?: number;
    coverage_percentage?: number;
    complete?: boolean;
    unit_count?: number;
    units_represented?: number;
    segment_count?: number;
    uncovered_ranges?: unknown[];
  } | null;
  cost?: {
    historical_paid_usd: number;
    paid_calls: number;
    provider: string;
    model: string;
  };
  withheld_graph_ambiguity_count?: number;
}): ArchivistCandidateReviewUiModel | null {
  if (!isRecord(args.review)) return null;
  if (text(args.review.schema) !== ARCHIVIST_REVIEW_SCHEMA) return null;
  if (!Array.isArray(args.review.findings) || !Array.isArray(args.review.canon_delta)) return null;
  if (text(args.review.manuscript_id) !== args.workflow.manuscript_id) return null;

  const findings = args.review.findings.map(presentFinding).filter((row): row is PresentedCandidateFinding => row != null);
  const canonFacts = args.review.canon_delta
    .map(presentCanonFact)
    .filter((row): row is PresentedCandidateCanonFact => row != null);
  const groups = new Map<string, PresentedCandidateCanonFact[]>();
  for (const fact of canonFacts) {
    const list = groups.get(fact.entity) ?? [];
    list.push(fact);
    groups.set(fact.entity, list);
  }

  const confirmed = findings.filter((item) => item.classification === "confirmed_contradiction");
  const possible = findings.filter((item) => item.classification === "possible_continuity_conflict");
  const author = findings.filter((item) => item.classification === "author_verification_needed");
  const changed = findings.filter((item) => item.classification_changed);
  const promotions = changed.filter((item) => item.final_classification === "confirmed_contradiction").length;
  const downgrades = changed.filter((item) => item.model_classification === "confirmed_contradiction").length;

  const coverage = args.coverage ?? {};
  const wordsCovered = Number(coverage.unique_words_covered ?? 0);
  const wordsTotal = Number(coverage.canonical_manuscript_words ?? 0);
  const sourceLabel =
    args.workflow.manuscript_id === RECKONING_REVISED_13_SOURCE_PIN.manuscript_id
      ? "REVISED-13"
      : "Candidate manuscript";

  const summary = isRecord(args.review.summary) ? args.review.summary : {};
  const ambiguities = Array.isArray(args.review.entity_ambiguities)
    ? args.review.entity_ambiguities.filter(isRecord).flatMap((row) => {
        const alias = text(row.alias);
        const candidates = Array.isArray(row.candidate_entities) ? row.candidate_entities : [];
        if (!alias || candidates.length < 2) return [];
        return [{
          id: text(row.id, alias),
          alias,
          candidate_entities: candidates.map((candidate) =>
            isRecord(candidate)
              ? text(candidate.canonical_name) || text(candidate.entity_id) || "Unknown"
              : "Unknown",
          ),
          context: text(row.context, "No additional context."),
          confidence: humanizeKey(text(row.confidence, "unspecified")),
          recommended_author_verification: text(
            row.recommended_author_verification,
            "Please confirm which character this name refers to.",
          ),
        }];
      })
    : [];

  return {
    manuscript_id: args.workflow.manuscript_id,
    manuscript_version_id: args.workflow.manuscript_version_id,
    workflow_id: args.workflow.id,
    source_label: sourceLabel,
    review_status: "candidate_review_validated",
    historical_workflow_status:
      args.workflow.status === "failed" ||
      args.workflow.status === "completed" ||
      args.workflow.status === "running" ||
      args.workflow.status === "pending" ||
      args.workflow.status === "cancelled"
        ? args.workflow.status
        : "failed",
    coverage: {
      units_completed: Number(coverage.units_represented ?? 0),
      units_total: Number(coverage.unit_count ?? 0),
      segments_completed: Number(coverage.segment_count ?? 0),
      segments_total: Number(coverage.segment_count ?? 0),
      words_covered: wordsCovered,
      words_total: wordsTotal,
      percentage: Number(coverage.coverage_percentage ?? 0),
      gaps: Array.isArray(coverage.uncovered_ranges) ? coverage.uncovered_ranges.length : 0,
    },
    cost: {
      historical_paid_usd: args.cost?.historical_paid_usd ?? 0,
      remediation_usd: 0,
      provider: args.cost?.provider ?? "anthropic",
      model: args.cost?.model ?? RECKONING_REVISED_13_SOURCE_PIN.model,
      paid_calls: args.cost?.paid_calls ?? 0,
    },
    summary: {
      narrative: text(
        summary.narrative,
        "Validated candidate Archivist review. Candidate-only. No accepted canon.",
      ),
      confirmed_contradiction_count: confirmed.length,
      possible_conflict_count: possible.length,
      author_verification_count: author.length,
    },
    findings: {
      confirmed_contradiction: confirmed,
      possible_continuity_conflict: possible,
      author_verification_needed: author,
    },
    candidate_canon: [...groups.entries()].map(([entity, facts]) => ({ entity, facts })),
    candidate_canon_count: canonFacts.length,
    ambiguities,
    withheld_graph_ambiguity_count: args.withheld_graph_ambiguity_count ?? 0,
    model_vs_final: {
      promotions,
      downgrades,
      changed_findings: changed.length,
    },
    audit: {
      content_hash: text(args.review.content_hash, args.workflow.content_hash ?? ""),
      original_workflow_status: args.workflow.status,
      candidate_review_validation_status: "validated",
      fabricated_evidence: 0,
      note:
        "Initial paid assembly failed strict evidence verification. StoryDNA later rebuilt this candidate review at $0 using verified contiguous manuscript passages. The original workflow failure remains preserved in the audit history.",
    },
    future_actions: ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTIONS.map((action) => ({
      ...action,
      disabled: true as const,
      note: ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTION_NOTE,
    })),
  };
}

export function futureCandidateReviewActions() {
  return ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTIONS.map((action) => ({
    ...action,
    disabled: true as const,
    note: ARCHIVIST_CANDIDATE_REVIEW_FUTURE_ACTION_NOTE,
  }));
}
