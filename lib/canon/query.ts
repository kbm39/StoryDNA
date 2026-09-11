import { authorityRank, effectiveAuthority } from "./authority.ts";
import { unresolvedConflicts } from "./conflicts.ts";
import type {
  CanonFactStatus,
  CanonQuery,
  CanonQueryResult,
  CanonStore,
} from "./types.ts";

function temporalMatches(fact: { temporal_scope: { book_order?: number | null } }, bookOrder?: number): boolean {
  if (bookOrder == null) return true;
  const scopeOrder = fact.temporal_scope.book_order;
  if (scopeOrder == null) return true;
  return scopeOrder === bookOrder;
}

export function queryCanon(store: CanonStore, query: CanonQuery): CanonQueryResult {
  const minRank = query.min_authority ? authorityRank(query.min_authority) : null;
  const statusFilter: Set<CanonFactStatus> | null = query.statuses
    ? new Set(query.statuses)
    : query.include_historical
      ? null
      : new Set<CanonFactStatus>(["accepted"]);

  const facts = store.facts.filter((fact) => {
    if (query.series_id !== undefined && fact.series_id !== query.series_id) return false;
    if (query.manuscript_id && fact.source_manuscript_id !== query.manuscript_id) return false;
    if (query.entity_id && fact.entity_id !== query.entity_id) return false;
    if (query.fact_types && !query.fact_types.includes(fact.fact_type)) return false;
    const reviewManuscriptId = query.as_of_manuscript_id ?? query.manuscript_id;
    const authority = effectiveAuthority(
      fact,
      store,
      reviewManuscriptId ? { manuscript_id: reviewManuscriptId } : undefined,
    );
    if (minRank != null && authorityRank(authority) < minRank) return false;
    if (statusFilter && !statusFilter.has(fact.status)) return false;
    if (!temporalMatches(fact, query.temporal_book_order)) return false;
    return true;
  });

  const unresolved = unresolvedConflicts(store, query.manuscript_id).filter((conflict) => {
    if (query.series_id !== undefined && conflict.series_id !== query.series_id) return false;
    return true;
  });

  return {
    facts,
    unresolved_conflicts: unresolved,
  };
}
