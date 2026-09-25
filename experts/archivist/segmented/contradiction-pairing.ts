import type { ArchivistIssueType } from "../contracts.ts";
import { diagnoseCandidateFactPair } from "./comparison-eligibility.ts";
import type { ArchivistBookGraph, BookGraphFact, ContradictionPair } from "./types.ts";

function pairId(left: BookGraphFact, right: BookGraphFact, kind: string): string {
  return `${kind}:${left.id}:${right.id}`;
}

function issueForPair(left: BookGraphFact, reason: string): ArchivistIssueType {
  if (reason === "knowledge_before_acquisition") return "knowledge_state";
  if (reason === "injury_laterality_conflict") return "injury";
  if (reason === "unique_object_simultaneous_possession") return "possession";
  if (left.fact_type === "knowledge_state") return "knowledge_state";
  if (left.fact_type === "alive_status") return "alive_status";
  if (left.fact_type === "rank_title") return "rank_title";
  if (left.fact_type === "relationship") return "relationship";
  if (left.fact_type === "injury") return "injury";
  if (left.fact_type === "appearance") return "appearance";
  if (left.fact_type === "age") return "age";
  if (left.fact_type === "possession") return "possession";
  if (left.fact_type === "location" || left.fact_type === "travel") return left.fact_type;
  return "other";
}

function kindForReason(reason: string, factType: string): ContradictionPair["kind"] {
  if (reason === "knowledge_before_acquisition") return "knowledge_before_acquisition";
  if (reason === "injury_laterality_conflict") return "injury_laterality";
  if (reason === "unique_object_simultaneous_possession") return "unique_object_possession";
  if (reason === "same_time_location_conflict") return "travel_timeline";
  if (factType === "age") return "age_contradiction";
  if (factType === "rank_title") return "rank_title_chronology";
  if (factType === "relationship") return "relationship_history";
  if (factType === "alive_status") return "alive_dead_chronology";
  if (factType === "appearance") return "appearance_unexplained";
  return "persistent_value_mismatch";
}

export function pairDeterministicContradictions(
  graph: ArchivistBookGraph,
): ContradictionPair[] {
  const pairs: ContradictionPair[] = [];
  const facts = graph.candidate_facts;
  const ambiguousAliases = graph.unresolved_ambiguities
    .map((item) => item.alias)
    .filter((alias): alias is string => Boolean(alias?.trim()));
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const left = facts[i]!;
      const right = facts[j]!;
      const diagnosis = diagnoseCandidateFactPair(left, right, {
        ambiguous_aliases: ambiguousAliases,
      });
      if (diagnosis.eligibility !== "comparable") continue;
      const kind = kindForReason(diagnosis.reason, left.fact_type);
      pairs.push({
        id: pairId(left, right, kind),
        kind,
        issue_type: issueForPair(left, diagnosis.reason),
        entity_key: left.entity_key,
        left,
        right,
        explanation: diagnosis.explanation,
        comparison_key: `${diagnosis.left_key.attribute}|${diagnosis.left_key.counterpart ?? ""}|${diagnosis.left_key.dimension ?? ""}`,
        comparison_eligibility: diagnosis.eligibility,
        comparison_reason: diagnosis.reason,
        display_entity: diagnosis.left_key.display_entity,
        display_attribute: diagnosis.left_key.display_attribute,
        identity_status: diagnosis.identity_status,
        confirmation_blocked: diagnosis.confirmation_blocked,
        comparison_interface: left.fact_type,
      });
    }
  }
  return pairs;
}
