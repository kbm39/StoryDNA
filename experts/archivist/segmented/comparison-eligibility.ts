/**
 * Deterministic comparison eligibility for Archivist pairing.
 *
 * Only competing values of the same attribute / relationship edge / state
 * dimension may become contradiction candidates. Equivalence and compatible
 * transitions fail closed to "no finding" rather than a noisy pair.
 */
import type { BookGraphFact } from "./types.ts";
import {
  type ComparisonEligibility,
  type ComparisonKey,
  type ComparisonReason,
  buildComparisonKey,
  chapterOrdinalFromFact,
  comparisonKeyId,
  distinctiveTokens,
  flattenValueText,
  normalizeAliveState,
} from "./comparison-key.ts";

export interface FactComparisonContext {
  unresolved_aliases?: readonly string[];
  ambiguous_aliases?: readonly string[];
}

export interface ComparisonDiagnosis {
  left: BookGraphFact;
  right: BookGraphFact;
  left_key: ComparisonKey;
  right_key: ComparisonKey;
  eligibility: ComparisonEligibility;
  reason: ComparisonReason;
  explanation: string;
  identity_status: "resolved" | "explicit_alias" | "ambiguous" | "unresolved";
  confirmation_blocked: boolean;
}

type ComparisonCore = Omit<ComparisonDiagnosis, "identity_status" | "confirmation_blocked">;

const CONFLICTING_TOKEN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["blue", "green"],
  ["blue", "brown"],
  ["green", "brown"],
  ["left", "right"],
  ["alive", "dead"],
  ["married", "divorced"],
  ["lieutenant", "captain"],
];

function dimensionsCompatible(left: string | null, right: string | null): boolean {
  if (!left || !right) return true;
  if (left === right) return true;
  const [leftSide, leftRegion] = left.split(":");
  const [rightSide, rightRegion] = right.split(":");
  if (leftRegion && rightRegion && leftRegion !== rightRegion) return false;
  if (leftSide === "any" || rightSide === "any") return true;
  return left === right;
}

function lateralityConflict(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const [leftSide, leftRegion] = left.split(":");
  const [rightSide, rightRegion] = right.split(":");
  if (!leftRegion || !rightRegion || leftRegion !== rightRegion) return false;
  return Boolean(leftSide && rightSide && leftSide !== "any" && rightSide !== "any" && leftSide !== rightSide);
}

function hasConflictingTokens(left: Set<string>, right: Set<string>): boolean {
  for (const [a, b] of CONFLICTING_TOKEN_PAIRS) {
    if ((left.has(a) && right.has(b)) || (left.has(b) && right.has(a))) return true;
  }
  return false;
}

export function valuesAreEquivalentRestatement(left: BookGraphFact, right: BookGraphFact): boolean {
  const leftTokens = distinctiveTokens(`${flattenValueText(left.value)} ${left.alias}`);
  const rightTokens = distinctiveTokens(`${flattenValueText(right.value)} ${right.alias}`);
  if (hasConflictingTokens(leftTokens, rightTokens)) return false;
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  if (intersection.length === 0) return false;
  const subset =
    [...leftTokens].every((token) => rightTokens.has(token)) ||
    [...rightTokens].every((token) => leftTokens.has(token));
  if (subset && Math.min(leftTokens.size, rightTokens.size) >= 2) return true;
  const union = new Set([...leftTokens, ...rightTokens]);
  const jaccard = intersection.length / union.size;
  return jaccard >= 0.7 && intersection.length >= 3;
}

function knowledgeKind(fact: BookGraphFact): "usage" | "acquisition" | null {
  const raw = String(fact.value.kind ?? fact.value.state ?? fact.value.value ?? "").toLowerCase();
  if (raw.includes("use") || raw.includes("usage") || raw === "known" || raw === "claimed") {
    return "usage";
  }
  if (raw.includes("learn") || raw.includes("acqui") || raw.includes("told") || raw.includes("discover") || raw === "unknown") {
    return "acquisition";
  }
  return null;
}

function possessor(fact: BookGraphFact): string | null {
  const raw = fact.value.possessor ?? fact.value.holder ?? fact.value.owner;
  return typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : null;
}

function numericAge(fact: BookGraphFact): number | null {
  const raw = fact.value.age ?? fact.value.value ?? fact.value.years;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const match = String(flattenValueText(fact.value)).match(/(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

function locationValue(fact: BookGraphFact): string {
  return flattenValueText(fact.value).toLowerCase();
}

function identityStatusForFacts(
  left: BookGraphFact,
  right: BookGraphFact,
  context?: FactComparisonContext,
): ComparisonDiagnosis["identity_status"] {
  const aliases = [left.alias, right.alias].map((item) => item.trim().toLowerCase()).filter(Boolean);
  const ambiguous = new Set((context?.ambiguous_aliases ?? []).map((item) => item.trim().toLowerCase()));
  const unresolved = new Set((context?.unresolved_aliases ?? []).map((item) => item.trim().toLowerCase()));
  if (aliases.some((alias) => ambiguous.has(alias))) return "ambiguous";
  if (aliases.some((alias) => unresolved.has(alias))) return "unresolved";
  if (left.entity_id && right.entity_id && left.entity_id === right.entity_id) return "resolved";
  if (left.entity_id || right.entity_id) return "resolved";
  return "unresolved";
}

function withIdentity(
  diagnosis: ComparisonCore,
  identity_status: ComparisonDiagnosis["identity_status"],
): ComparisonDiagnosis {
  return {
    ...diagnosis,
    identity_status,
    confirmation_blocked:
      identity_status === "ambiguous" ||
      identity_status === "unresolved" ||
      diagnosis.eligibility !== "comparable",
  };
}

export function diagnoseCandidateFactPair(
  left: BookGraphFact,
  right: BookGraphFact,
  context?: FactComparisonContext,
): ComparisonDiagnosis {
  const leftKey = buildComparisonKey(left);
  const rightKey = buildComparisonKey(right);
  const identity_status = identityStatusForFacts(left, right, context);
  const base = { left, right, left_key: leftKey, right_key: rightKey };
  return withIdentity(((): ComparisonCore => {

  if (left.entity_key !== right.entity_key) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_subject",
      explanation: "Facts belong to different resolved entities.",
    };
  }
  if (left.fact_type !== right.fact_type) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_attribute",
      explanation: "Facts do not share a fact type.",
    };
  }
  if (leftKey.specificity === "insufficient" || rightKey.specificity === "insufficient") {
    return {
      ...base,
      eligibility: "insufficient_semantic_specificity",
      reason: "insufficient_subtype",
      explanation: "A subtype, counterpart, or topic could not be determined safely.",
    };
  }
  if (leftKey.subject !== rightKey.subject) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_subject",
      explanation: "Alive/dead or event subjects are not the same person.",
    };
  }
  if (leftKey.attribute !== rightKey.attribute) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: left.fact_type === "rank_title" || left.fact_type === "other"
        ? "different_role_dimension"
        : "different_attribute",
      explanation: `Attributes ${leftKey.attribute} and ${rightKey.attribute} are not comparable.`,
    };
  }
  if (
    left.fact_type === "relationship" &&
    leftKey.counterpart &&
    rightKey.counterpart &&
    leftKey.counterpart !== rightKey.counterpart
  ) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_counterparty",
      explanation: "Relationship edges have different counterparties.",
    };
  }
  if (
    left.fact_type === "relationship" &&
    leftKey.dimension &&
    rightKey.dimension &&
    leftKey.dimension !== rightKey.dimension
  ) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_relationship_type",
      explanation: "Relationship edges have different types.",
    };
  }
  if (!dimensionsCompatible(leftKey.dimension, rightKey.dimension) && left.fact_type !== "injury") {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_attribute",
      explanation: "Comparison dimensions do not overlap.",
    };
  }

  if (left.fact_type === "alive_status") {
    return diagnoseAlive(base, leftKey, rightKey);
  }
  if (left.fact_type === "knowledge_state") {
    return diagnoseKnowledge(base);
  }
  if (left.fact_type === "injury") {
    return diagnoseInjury(base, leftKey, rightKey);
  }
  if (left.fact_type === "possession") {
    return diagnosePossession(base);
  }
  if (left.fact_type === "location" || left.fact_type === "travel" || left.fact_type === "presence") {
    return diagnoseLocation(base);
  }
  if (left.fact_type === "rank_title") {
    return diagnoseRank(base);
  }
  if (left.fact_type === "age") {
    return diagnoseAge(base);
  }

  if (valuesAreEquivalentRestatement(left, right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Values are equivalent restatements of the same observation.",
    };
  }
  if (lateralityConflict(leftKey.dimension, rightKey.dimension)) {
    return {
      ...base,
      eligibility: "comparable",
      reason: "injury_laterality_conflict",
      explanation: "Same attribute has incompatible laterality.",
    };
  }
  if (left.fact_type === "appearance" && leftKey.attribute === "injury_mark") {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Injury-mark descriptions occupy the same attribute and are restatements unless laterality conflicts.",
    };
  }
  if (left.fact_type === "appearance" && leftKey.attribute === "eye_color") {
    return {
      ...base,
      eligibility: "comparable",
      reason: "competing_same_attribute",
      explanation: "Persistent appearance attribute has competing values.",
    };
  }
  if (left.fact_type === "relationship") {
    return {
      ...base,
      eligibility: "comparable",
      reason: "competing_same_attribute",
      explanation: "The same relationship edge has incompatible states.",
    };
  }

  const leftOrd = chapterOrdinalFromFact(left);
  const rightOrd = chapterOrdinalFromFact(right);
  if (leftOrd != null && rightOrd != null && leftOrd !== rightOrd) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Different chapters describe a compatible state change or distinct events.",
    };
  }

  return {
    ...base,
    eligibility: "comparable",
    reason: "competing_same_attribute",
    explanation: "Competing values of the same attribute.",
  };
  })(), identity_status);
}

function diagnoseAlive(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
  leftKey: ComparisonKey,
  rightKey: ComparisonKey,
): ComparisonCore {
  if (leftKey.subject !== rightKey.subject) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_subject",
      explanation: "Alive/dead observations refer to different subjects.",
    };
  }
  const leftState = normalizeAliveState(base.left);
  const rightState = normalizeAliveState(base.right);
  if (leftState === rightState) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "same_value_context_only",
      explanation: "Alive/dead state is the same; extra context is not a new value.",
    };
  }
  const uncertain = new Set(["presumed_dead", "unknown"]);
  if (uncertain.has(leftState) && uncertain.has(rightState)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "compatible_uncertainty",
      explanation: "Unconfirmed/presumed-dead descriptions are compatible uncertainty.",
    };
  }
  if (
    (uncertain.has(leftState) && rightState === "dead") ||
    (uncertain.has(rightState) && leftState === "dead")
  ) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_uncertainty",
      explanation: "Presumed-dead or unconfirmed does not contradict a death report.",
    };
  }
  const leftOrd = chapterOrdinalFromFact(base.left);
  const rightOrd = chapterOrdinalFromFact(base.right);
  const earlier = leftOrd != null && rightOrd != null && leftOrd <= rightOrd ? leftState : rightState;
  const later = leftOrd != null && rightOrd != null && leftOrd <= rightOrd ? rightState : leftState;
  if (earlier === "alive" && later === "dead") {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Alive then later dead is an ordinary transition.",
    };
  }
  if (earlier === "dead" && later === "alive") {
    return {
      ...base,
      eligibility: "comparable",
      reason: "competing_same_attribute",
      explanation: "Dead then later alive requires investigation.",
    };
  }
  if (leftState === "alive" && rightState === "alive") {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "same_value_context_only",
      explanation: "Both observations are alive.",
    };
  }
  return {
    ...base,
    eligibility: "not_comparable",
    reason: "compatible_uncertainty",
    explanation: "Alive/dead states are not a confirmed competing pair.",
  };
}

function diagnoseKnowledge(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
): ComparisonCore {
  if (base.left_key.dimension !== base.right_key.dimension) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_attribute",
      explanation: "Knowledge topics are not the same proposition.",
    };
  }
  const leftKind = knowledgeKind(base.left);
  const rightKind = knowledgeKind(base.right);
  const leftOrd = chapterOrdinalFromFact(base.left);
  const rightOrd = chapterOrdinalFromFact(base.right);
  if (leftKind && rightKind && leftKind !== rightKind && leftOrd != null && rightOrd != null) {
    const usage = leftKind === "usage" ? base.left : base.right;
    const acquisition = leftKind === "acquisition" ? base.left : base.right;
    const usageOrd = chapterOrdinalFromFact(usage);
    const acquisitionOrd = chapterOrdinalFromFact(acquisition);
    if (usageOrd != null && acquisitionOrd != null && usageOrd < acquisitionOrd) {
      return {
        ...base,
        eligibility: "comparable",
        reason: "knowledge_before_acquisition",
        explanation: "Knowledge is used before the evidenced acquisition.",
      };
    }
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Acquisition before usage is compatible.",
    };
  }
  if (valuesAreEquivalentRestatement(base.left, base.right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Knowledge observations restate the same proposition.",
    };
  }
  return {
    ...base,
    eligibility: "comparable",
    reason: "competing_same_attribute",
    explanation: "Same knowledge topic has competing values.",
  };
}

function diagnoseInjury(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
  leftKey: ComparisonKey,
  rightKey: ComparisonKey,
): ComparisonCore {
  if (!dimensionsCompatible(leftKey.dimension, rightKey.dimension) && !lateralityConflict(leftKey.dimension, rightKey.dimension)) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "different_attribute",
      explanation: "Injury regions are not the same event.",
    };
  }
  if (lateralityConflict(leftKey.dimension, rightKey.dimension)) {
    return {
      ...base,
      eligibility: "comparable",
      reason: "injury_laterality_conflict",
      explanation: "Same injury region has incompatible laterality.",
    };
  }
  const hay = `${flattenValueText(base.left.value)} ${flattenValueText(base.right.value)}`.toLowerCase();
  if (/\b(heal|healed|healing|recovered)\b/.test(hay)) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Injury condition may change from wounded to healed.",
    };
  }
  if (valuesAreEquivalentRestatement(base.left, base.right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Injury descriptions restate the same wound.",
    };
  }
  return {
    ...base,
    eligibility: "not_comparable",
    reason: "compatible_state_transition",
    explanation: "Same-region injury observations are not an unexplained laterality conflict.",
  };
}

function diagnosePossession(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
): ComparisonCore {
  if (base.left.value.unique !== true || base.right.value.unique !== true) {
    return {
      ...base,
      eligibility: "insufficient_semantic_specificity",
      reason: "insufficient_subtype",
      explanation: "Generic objects are not compared.",
    };
  }
  const leftHolder = possessor(base.left);
  const rightHolder = possessor(base.right);
  if (leftHolder && rightHolder && leftHolder !== rightHolder) {
    return {
      ...base,
      eligibility: "comparable",
      reason: "unique_object_simultaneous_possession",
      explanation: "The same unique object has two possessors without an evidenced transfer.",
    };
  }
  return {
    ...base,
    eligibility: "equivalent",
    reason: "equivalent_restated_fact",
    explanation: "Unique-object possession observations do not compete.",
  };
}

function diagnoseLocation(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
): ComparisonCore {
  const leftOrd = chapterOrdinalFromFact(base.left);
  const rightOrd = chapterOrdinalFromFact(base.right);
  if (leftOrd == null || rightOrd == null || leftOrd !== rightOrd) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Different-time locations are ordinary travel.",
    };
  }
  if (valuesAreEquivalentRestatement(base.left, base.right) || locationValue(base.left) === locationValue(base.right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Same-time location observations restate the same place.",
    };
  }
  return {
    ...base,
    eligibility: "comparable",
    reason: "same_time_location_conflict",
    explanation: "Same-time location observations conflict.",
  };
}

function diagnoseRank(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
): ComparisonCore {
  if (valuesAreEquivalentRestatement(base.left, base.right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Rank/role values restate the same dimension.",
    };
  }
  const leftOrd = chapterOrdinalFromFact(base.left);
  const rightOrd = chapterOrdinalFromFact(base.right);
  if (leftOrd != null && rightOrd != null && leftOrd !== rightOrd) {
    return {
      ...base,
      eligibility: "not_comparable",
      reason: "compatible_state_transition",
      explanation: "Rank or role may change across chapters.",
    };
  }
  return {
    ...base,
    eligibility: "comparable",
    reason: "competing_same_attribute",
    explanation: "Same rank/role dimension has incompatible same-time values.",
  };
}

function diagnoseAge(
  base: { left: BookGraphFact; right: BookGraphFact; left_key: ComparisonKey; right_key: ComparisonKey },
): ComparisonCore {
  const leftAge = numericAge(base.left);
  const rightAge = numericAge(base.right);
  if (leftAge != null && rightAge != null && leftAge === rightAge) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Age values are the same.",
    };
  }
  if (leftAge != null && rightAge != null && leftAge !== rightAge) {
    return {
      ...base,
      eligibility: "comparable",
      reason: "competing_same_attribute",
      explanation: "Age values conflict.",
    };
  }
  if (valuesAreEquivalentRestatement(base.left, base.right)) {
    return {
      ...base,
      eligibility: "equivalent",
      reason: "equivalent_restated_fact",
      explanation: "Age observations restate the same value.",
    };
  }
  return {
    ...base,
    eligibility: "insufficient_semantic_specificity",
    reason: "insufficient_subtype",
    explanation: "Age values were not specific enough to compare.",
  };
}

export function inventoryFactComparisons(facts: readonly BookGraphFact[]): ComparisonDiagnosis[] {
  const rows: ComparisonDiagnosis[] = [];
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const left = facts[i]!;
      const right = facts[j]!;
      if (left.entity_key !== right.entity_key || left.fact_type !== right.fact_type) continue;
      rows.push(diagnoseCandidateFactPair(left, right));
    }
  }
  return rows;
}

export function summarizeComparisonInventory(rows: readonly ComparisonDiagnosis[]) {
  return {
    comparable: rows.filter((row) => row.eligibility === "comparable").length,
    equivalent: rows.filter((row) => row.eligibility === "equivalent").length,
    not_comparable: rows.filter((row) => row.eligibility === "not_comparable").length,
    insufficient_semantic_specificity: rows.filter(
      (row) => row.eligibility === "insufficient_semantic_specificity",
    ).length,
  };
}

export function comparisonKeyFor(fact: BookGraphFact): string {
  return comparisonKeyId(buildComparisonKey(fact));
}
