import type { ArchivistCanonDelta } from "../contracts.ts";
import { recoverContiguousManuscriptPassage } from "./contiguous-passage-recovery.ts";
import type { ArchivistBookGraph } from "./types.ts";

export function candidateCanonFromBookGraph(
  graph: ArchivistBookGraph,
  manuscriptText?: string,
): ArchivistCanonDelta[] {
  const ambiguousAliases = new Set(
    graph.unresolved_ambiguities
      .map((item) => item.alias?.trim().toLowerCase())
      .filter((alias): alias is string => Boolean(alias)),
  );
  return graph.candidate_facts
    .filter((fact) =>
      fact.locators[0]?.locator &&
      fact.alias?.trim() &&
      fact.value &&
      Object.keys(fact.value).length > 0 &&
      !ambiguousAliases.has(fact.alias.trim().toLowerCase()),
    )
    .map((fact, index) => {
      const evidence = (fact.evidence ?? []).map((record) => {
        if (!manuscriptText || !record.excerpt) return record;
        const recovered = recoverContiguousManuscriptPassage({
          excerpt: record.excerpt,
          locator: record.locator ?? fact.locators[0]?.locator,
          manuscriptText,
          value: fact.value,
        });
        if (recovered.class === "C") {
          return null;
        }
        return { ...record, excerpt: recovered.excerpt };
      }).filter((record): record is NonNullable<typeof record> => record !== null);
      return {
        id: fact.id || `candidate-${index + 1}`,
        entity: {
          resolution: fact.entity_id ? "resolved" : "unresolved",
          alias: fact.alias,
          entity_type: fact.entity_type,
          entity_id: fact.entity_id,
          canonical_name: fact.entity_id ? fact.alias : undefined,
        },
        entity_type: fact.entity_type,
        fact_type: fact.fact_type,
        proposed_fact_value: fact.value,
        temporal_scope: fact.temporal_scope,
        source_location: fact.locators[0]!,
        evidence,
        confidence: fact.confidence,
        proposed_authority: "current_observation" as const,
        status: "candidate" as const,
        inferred: false,
        created_by: "extraction" as const,
      };
    });
}

export function assertCandidateOnlyCanon(deltas: readonly ArchivistCanonDelta[]): void {
  for (const delta of deltas) {
    if (delta.status !== "candidate") {
      throw new Error("accepted canon is blocked in segmented assembly");
    }
    if (
      delta.proposed_authority === "series_bible_accepted" ||
      delta.proposed_authority === "author_approved_exception" ||
      delta.proposed_authority === "prior_volume_canon"
    ) {
      throw new Error("unsafe canon authority is blocked in segmented assembly");
    }
  }
}
