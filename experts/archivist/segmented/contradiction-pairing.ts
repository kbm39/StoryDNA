import type { ArchivistIssueType, CanonFactType } from "../contracts.ts";
import { classifyFactPersistence } from "../fact-persistence.ts";
import { CHAPTER_WORD_NAMES } from "./constants.ts";
import type { ArchivistBookGraph, BookGraphFact, ContradictionPair } from "./types.ts";

function valueKey(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

const CHAPTER_NAME_TO_NUMBER = new Map(
  CHAPTER_WORD_NAMES.map((name, index) => [name, index + 1]),
);

function chapterOrdinal(fact: BookGraphFact): number | null {
  const fromScope = fact.temporal_scope.chapter;
  const fromLocator = fact.locators[0]?.chapter ?? fact.locators[0]?.locator;
  for (const candidate of [fromScope, fromLocator]) {
    if (!candidate) continue;
    if (/prologue/i.test(String(candidate))) return 0;
    const match = String(candidate).match(/(\d+)/);
    if (match) return Number(match[1]);
    const named = String(candidate).toUpperCase().match(/CHAPTER\s+([A-Z][A-Z\s-]+)/);
    if (named) {
      const token = named[1]!.trim().replace(/\s+/g, "-");
      const number = CHAPTER_NAME_TO_NUMBER.get(token as (typeof CHAPTER_WORD_NAMES)[number]);
      if (number) return number;
    }
  }
  return null;
}

function laterality(value: Record<string, unknown>): string | null {
  const raw = String(value.laterality ?? value.side ?? value.value ?? "").toLowerCase();
  if (raw.includes("left")) return "left";
  if (raw.includes("right")) return "right";
  return null;
}

function knowledgeKind(value: Record<string, unknown>): "usage" | "acquisition" | null {
  const raw = String(value.kind ?? value.state ?? value.value ?? "").toLowerCase();
  if (raw.includes("use") || raw.includes("usage") || raw.includes("whisper") || raw.includes("recit")) {
    return "usage";
  }
  if (raw.includes("learn") || raw.includes("acqui") || raw.includes("told") || raw.includes("discover")) {
    return "acquisition";
  }
  return null;
}

function possessor(value: Record<string, unknown>): string | null {
  const raw = value.possessor ?? value.holder ?? value.owner;
  return typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : null;
}

function pairId(left: BookGraphFact, right: BookGraphFact, kind: string): string {
  return `${kind}:${left.id}:${right.id}`;
}

function issueForFactType(factType: CanonFactType): ArchivistIssueType {
  if (factType === "knowledge_state") return "knowledge_state";
  if (factType === "alive_status") return "alive_status";
  if (factType === "rank_title") return "rank_title";
  if (factType === "relationship") return "relationship";
  if (factType === "injury") return "injury";
  if (factType === "appearance") return "appearance";
  if (factType === "age") return "age";
  if (factType === "possession") return "possession";
  if (factType === "location" || factType === "travel") return factType;
  return "other";
}

export function pairDeterministicContradictions(
  graph: ArchivistBookGraph,
): ContradictionPair[] {
  const pairs: ContradictionPair[] = [];
  const facts = graph.candidate_facts;
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const left = facts[i]!;
      const right = facts[j]!;
      if (left.entity_key !== right.entity_key) continue;
      if (left.fact_type !== right.fact_type) continue;
      if (valueKey(left.value) === valueKey(right.value)) continue;

      const leftOrd = chapterOrdinal(left);
      const rightOrd = chapterOrdinal(right);
      const persistence = classifyFactPersistence({
        factType: left.fact_type,
        issueType: issueForFactType(left.fact_type),
        proposedFactValue: left.value,
      });

      const leftLat = laterality(left.value);
      const rightLat = laterality(right.value);
      if (left.fact_type === "injury" && leftLat && rightLat && leftLat !== rightLat) {
        pairs.push({
          id: pairId(left, right, "injury_laterality"),
          kind: "injury_laterality",
          issue_type: "injury",
          entity_key: left.entity_key,
          left,
          right,
          explanation: `Injury laterality differs (${leftLat} vs ${rightLat}) without a second-injury transition.`,
        });
        continue;
      }

      const leftKnow = knowledgeKind(left.value);
      const rightKnow = knowledgeKind(right.value);
      if (left.fact_type === "knowledge_state" && leftKnow && rightKnow && leftKnow !== rightKnow) {
        const usage = leftKnow === "usage" ? left : right;
        const acquisition = leftKnow === "acquisition" ? left : right;
        const usageOrd = chapterOrdinal(usage);
        const acquisitionOrd = chapterOrdinal(acquisition);
        if (usageOrd != null && acquisitionOrd != null && usageOrd < acquisitionOrd) {
          pairs.push({
            id: pairId(left, right, "knowledge_before_acquisition"),
            kind: "knowledge_before_acquisition",
            issue_type: "knowledge_state",
            entity_key: left.entity_key,
            left,
            right,
            explanation: "Knowledge is used before the evidenced acquisition.",
          });
          continue;
        }
      }

      if (left.fact_type === "possession") {
        const leftHolder = possessor(left.value);
        const rightHolder = possessor(right.value);
        if (leftHolder && rightHolder && leftHolder !== rightHolder && left.value.unique === true) {
          pairs.push({
            id: pairId(left, right, "unique_object_possession"),
            kind: "unique_object_possession",
            issue_type: "possession",
            entity_key: left.entity_key,
            left,
            right,
            explanation: "Unique object cannot have two possessors without an evidenced transfer.",
          });
          continue;
        }
      }

      if (left.fact_type === "appearance") {
        pairs.push({
          id: pairId(left, right, "appearance_unexplained"),
          kind: "appearance_unexplained",
          issue_type: "appearance",
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Appearance values differ without an evidenced transition.",
        });
        continue;
      }

      if (left.fact_type === "age") {
        pairs.push({
          id: pairId(left, right, "age_contradiction"),
          kind: "age_contradiction",
          issue_type: "age",
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Age values conflict.",
        });
        continue;
      }

      if (left.fact_type === "rank_title") {
        pairs.push({
          id: pairId(left, right, "rank_title_chronology"),
          kind: "rank_title_chronology",
          issue_type: "rank_title",
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Rank/title history differs.",
        });
        continue;
      }

      if (left.fact_type === "relationship") {
        pairs.push({
          id: pairId(left, right, "relationship_history"),
          kind: "relationship_history",
          issue_type: "relationship",
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Relationship history conflicts.",
        });
        continue;
      }

      if (left.fact_type === "alive_status") {
        pairs.push({
          id: pairId(left, right, "alive_dead_chronology"),
          kind: "alive_dead_chronology",
          issue_type: "alive_status",
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Alive/dead chronology conflicts.",
        });
        continue;
      }

      if (
        (left.fact_type === "location" || left.fact_type === "travel") &&
        leftOrd != null &&
        rightOrd != null &&
        leftOrd === rightOrd
      ) {
        pairs.push({
          id: pairId(left, right, "travel_timeline"),
          kind: "travel_timeline",
          issue_type: left.fact_type,
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Same-time location/travel observations conflict.",
        });
        continue;
      }

      if (persistence === "persistent") {
        pairs.push({
          id: pairId(left, right, "persistent_value_mismatch"),
          kind: "persistent_value_mismatch",
          issue_type: issueForFactType(left.fact_type),
          entity_key: left.entity_key,
          left,
          right,
          explanation: "Persistent fact has conflicting values.",
        });
      }
    }
  }
  return pairs;
}
