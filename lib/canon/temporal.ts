import {
  TIME_VARYING_EXCLUSIVE_FACT_TYPES,
  type CanonConflictClassification,
  type CanonFact,
  type TemporalRelation,
  type TemporalScope,
} from "./types.ts";

export function isTimeVaryingExclusiveFactType(factType: CanonFact["fact_type"]): boolean {
  return (TIME_VARYING_EXCLUSIVE_FACT_TYPES as readonly string[]).includes(factType);
}

export function factValuesEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return stableJson(left) === stableJson(right);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(",")}}`;
}

export function parseChapterNumber(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function scopesIdentical(left: TemporalScope, right: TemporalScope): boolean {
  return (
    left.kind === right.kind &&
    (left.book_order ?? null) === (right.book_order ?? null) &&
    (left.chapter ?? null) === (right.chapter ?? null) &&
    (left.narrative_time ?? null) === (right.narrative_time ?? null) &&
    (left.from ?? null) === (right.from ?? null) &&
    (left.to ?? null) === (right.to ?? null)
  );
}

type ResolvedInterval =
  | { status: "unknown"; book: number | null }
  | { status: "interval"; book: number | null; start: number; end: number };

function resolveInterval(scope: TemporalScope): ResolvedInterval {
  const book = scope.book_order ?? null;
  if (scope.kind === "unknown") return { status: "unknown", book };

  const chapter = parseChapterNumber(scope.chapter);
  const from = parseChapterNumber(scope.from);
  const to = parseChapterNumber(scope.to);

  if (scope.kind === "at") {
    const point = chapter ?? from;
    if (point == null) return { status: "unknown", book };
    return { status: "interval", book, start: point, end: point };
  }

  if (scope.kind === "from_to") {
    const start = from ?? chapter;
    if (start == null && to == null) return { status: "unknown", book };
    return {
      status: "interval",
      book,
      start: start ?? Number.NEGATIVE_INFINITY,
      end: to ?? Number.POSITIVE_INFINITY,
    };
  }

  if (chapter != null && from == null && to == null) {
    return { status: "interval", book, start: chapter, end: chapter };
  }
  if (from != null || to != null) {
    return {
      status: "interval",
      book,
      start: from ?? chapter ?? Number.NEGATIVE_INFINITY,
      end: to ?? Number.POSITIVE_INFINITY,
    };
  }
  return { status: "unknown", book };
}

/**
 * Compare two temporal scopes.
 * Unknown / book-only as_of_book does not claim overlap or disjointness
 * inside the same book — that requires chapter or from/to bounds.
 */
export function compareTemporalScopes(left: TemporalScope, right: TemporalScope): TemporalRelation {
  const a = resolveInterval(left);
  const b = resolveInterval(right);

  if (a.book != null && b.book != null && a.book !== b.book) return "disjoint";

  if (scopesIdentical(left, right) && a.status === "interval" && b.status === "interval") {
    return "identical";
  }

  if (
    left.narrative_time &&
    right.narrative_time &&
    left.narrative_time !== right.narrative_time &&
    (a.status === "unknown" || b.status === "unknown")
  ) {
    return "unknown";
  }

  if (a.status === "unknown" || b.status === "unknown") return "unknown";
  if (a.end < b.start || b.end < a.start) return "disjoint";
  if (a.start === b.start && a.end === b.end && scopesIdentical(left, right)) return "identical";
  return "overlap";
}

export type TemporalFactCompatibility =
  | { kind: "compatible"; relation: TemporalRelation }
  | { kind: "redundant"; relation: TemporalRelation }
  | {
      kind: "conflict";
      relation: TemporalRelation;
      classification: CanonConflictClassification;
    };

export function temporalFactCompatibility(
  existing: Pick<CanonFact, "fact_value" | "temporal_scope">,
  incoming: Pick<CanonFact, "fact_value" | "temporal_scope">,
): TemporalFactCompatibility {
  const relation = compareTemporalScopes(existing.temporal_scope, incoming.temporal_scope);
  const valuesEqual = factValuesEqual(existing.fact_value, incoming.fact_value);

  if (valuesEqual && (relation === "identical" || relation === "overlap" || relation === "unknown")) {
    return { kind: "redundant", relation };
  }
  if (relation === "disjoint") {
    return { kind: "compatible", relation };
  }
  if (!valuesEqual && (relation === "identical" || relation === "overlap")) {
    return { kind: "conflict", relation, classification: "confirmed_contradiction" };
  }
  return { kind: "conflict", relation, classification: "author_verification_needed" };
}

export function acceptedPeersForFact(facts: CanonFact[], fact: CanonFact): CanonFact[] {
  return facts.filter(
    (row) =>
      row.id !== fact.id &&
      row.entity_id === fact.entity_id &&
      row.fact_type === fact.fact_type &&
      row.status === "accepted",
  );
}

export function detectAcceptedTemporalConflicts(facts: CanonFact[]): Array<{
  left: CanonFact;
  right: CanonFact;
  classification: CanonConflictClassification;
  relation: TemporalRelation;
}> {
  const exclusive = facts.filter(
    (fact) => fact.status === "accepted" && isTimeVaryingExclusiveFactType(fact.fact_type),
  );
  const results: Array<{
    left: CanonFact;
    right: CanonFact;
    classification: CanonConflictClassification;
    relation: TemporalRelation;
  }> = [];
  for (let i = 0; i < exclusive.length; i += 1) {
    for (let j = i + 1; j < exclusive.length; j += 1) {
      const left = exclusive[i]!;
      const right = exclusive[j]!;
      if (left.entity_id !== right.entity_id || left.fact_type !== right.fact_type) continue;
      const compatibility = temporalFactCompatibility(left, right);
      if (compatibility.kind !== "conflict") continue;
      results.push({
        left,
        right,
        classification: compatibility.classification,
        relation: compatibility.relation,
      });
    }
  }
  return results;
}
