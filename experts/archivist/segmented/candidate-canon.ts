import type { ArchivistCanonDelta } from "../contracts.ts";
import type { ArchivistBookGraph } from "./types.ts";

export function candidateCanonFromBookGraph(graph: ArchivistBookGraph): ArchivistCanonDelta[] {
  return graph.candidate_facts.map((fact, index) => ({
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
    source_location: fact.locators[0] ?? { locator: `graph:${fact.id}` },
    evidence: fact.evidence,
    confidence: fact.confidence,
    proposed_authority: "current_observation",
    status: "candidate",
    inferred: false,
    created_by: "extraction",
  }));
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
