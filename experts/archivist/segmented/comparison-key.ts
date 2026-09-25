/**
 * Deterministic comparison keys for Archivist contradiction pairing.
 *
 * A key identifies the semantic attribute being compared, not merely the
 * broad fact_type. Unknown subtypes fail closed (insufficient specificity)
 * instead of pairing against every fact in the same category.
 */
import type { BookGraphFact } from "./types.ts";
import { CHAPTER_WORD_NAMES } from "./constants.ts";

export const COMPARISON_ELIGIBILITIES = [
  "comparable",
  "not_comparable",
  "equivalent",
  "insufficient_semantic_specificity",
] as const;
export type ComparisonEligibility = (typeof COMPARISON_ELIGIBILITIES)[number];

export const COMPARISON_REASONS = [
  "different_attribute",
  "different_counterparty",
  "different_relationship_type",
  "same_value_context_only",
  "compatible_state_transition",
  "compatible_uncertainty",
  "different_subject",
  "different_role_dimension",
  "equivalent_restated_fact",
  "insufficient_subtype",
  "competing_same_attribute",
  "knowledge_before_acquisition",
  "injury_laterality_conflict",
  "unique_object_simultaneous_possession",
  "same_time_location_conflict",
] as const;
export type ComparisonReason = (typeof COMPARISON_REASONS)[number];

export interface ComparisonKey {
  entity_key: string;
  fact_type: string;
  attribute: string;
  counterpart: string | null;
  dimension: string | null;
  subject: string;
  specificity: "specific" | "insufficient";
  display_entity: string;
  display_attribute: string;
}

const CHAPTER_NAME_TO_NUMBER = new Map(
  CHAPTER_WORD_NAMES.map((name, index) => [name, index + 1]),
);

const STOPWORDS = new Set([
  "the", "a", "an", "of", "on", "in", "from", "with", "his", "her", "their",
  "and", "into", "over", "at", "to", "for", "by", "as", "or", "was", "were",
  "had", "has", "been", "this", "that", "inside", "up",
]);

const SYNONYMS: Record<string, string> = {
  married: "spouse",
  marriage: "spouse",
  wife: "spouse",
  husband: "spouse",
  widow: "spouse",
  spouse: "spouse",
  sibling: "sibling",
  brother: "sibling",
  sister: "sibling",
  inked: "tattoo",
  ink: "tattoo",
  tattoo: "tattoo",
};

export function chapterOrdinalFromLocator(value: string | undefined | null): number | null {
  if (!value) return null;
  if (/prologue/i.test(String(value))) return 0;
  const match = String(value).match(/(\d+)/);
  if (match) return Number(match[1]);
  const named = String(value).toUpperCase().match(/CHAPTER\s+([A-Z][A-Z\s-]+)/);
  if (named) {
    const token = named[1]!.trim().replace(/\s+/g, "-");
    const number = CHAPTER_NAME_TO_NUMBER.get(token as (typeof CHAPTER_WORD_NAMES)[number]);
    if (number) return number;
  }
  return null;
}

export function chapterOrdinalFromFact(fact: BookGraphFact): number | null {
  const fromScope = fact.temporal_scope?.chapter;
  const fromLocator = fact.locators[0]?.chapter ?? fact.locators[0]?.locator;
  for (const candidate of [fromScope, fromLocator]) {
    const ordinal = chapterOrdinalFromLocator(candidate);
    if (ordinal != null) return ordinal;
  }
  return null;
}

export function factHaystack(fact: BookGraphFact): string {
  return [
    JSON.stringify(fact.value ?? {}),
    fact.alias,
    ...fact.evidence.map((record) => record.excerpt ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

export function displayEntityName(fact: BookGraphFact): string {
  const raw = fact.alias?.trim() || fact.entity_key.replace(/^[^:]+:/, "");
  return raw
    .split(/[\s:_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function flattenValueText(value: Record<string, unknown> | undefined): string {
  if (!value) return "";
  const parts: string[] = [];
  const walk = (item: unknown) => {
    if (item == null) return;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      parts.push(String(item));
      return;
    }
    if (Array.isArray(item)) {
      for (const entry of item) walk(entry);
      return;
    }
    if (typeof item === "object") {
      for (const entry of Object.values(item as Record<string, unknown>)) walk(entry);
    }
  };
  walk(value);
  return parts.join(" ");
}

export function normalizeToken(token: string): string {
  const folded = SYNONYMS[token] ?? token;
  return folded;
}

export function distinctiveTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function firstString(value: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase();
  }
  return null;
}

function appearanceAttribute(fact: BookGraphFact): { attribute: string; dimension: string | null; specificity: ComparisonKey["specificity"] } {
  const value = fact.value ?? {};
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  const hay = `${keys.join(" ")} ${flattenValueText(value)} ${factHaystack(fact)}`;

  if (keys.includes("eye_color") || /\b(eye color|eyes? (?:are|were|had)|iris|irises)\b/.test(hay)) {
    if (!/\b(split|gash|wound|blood|bruise|stitches)\b/.test(hay) || /\b(blue|green|brown|hazel|gray|grey|azure)\b/.test(hay)) {
      return { attribute: "eye_color", dimension: null, specificity: "specific" };
    }
  }
  if (/\b(tattoo|inked)\b/.test(hay) && !/\b(split|gash|wound)\b/.test(hay)) {
    const laterality = /\bleft\b/.test(hay) ? "left" : /\bright\b/.test(hay) ? "right" : "any";
    const region = /\bwrist\b/.test(hay)
      ? "wrist"
      : /\barm\b/.test(hay)
        ? "arm"
        : /\bneck\b/.test(hay)
          ? "neck"
          : "body";
    return { attribute: "tattoo", dimension: `${laterality}:${region}`, specificity: "specific" };
  }
  if (/\b(split|gash|wound|bruise|stitches|blood.*eye|eye.*blood)\b/.test(hay)) {
    const laterality = /\bleft\b/.test(hay) ? "left" : /\bright\b/.test(hay) ? "right" : "any";
    const region = /\beye\b/.test(hay)
      ? "eye"
      : /\bshoulder\b/.test(hay)
        ? "shoulder"
        : /\bknee\b/.test(hay)
          ? "knee"
          : "injury";
    return { attribute: "injury_mark", dimension: `${laterality}:${region}`, specificity: "specific" };
  }
  if (/\bscar\b/.test(hay)) {
    return { attribute: "scar", dimension: null, specificity: "specific" };
  }
  if (keys.includes("hair_color") || /\bhair\b/.test(hay)) {
    return { attribute: "hair_color", dimension: null, specificity: "specific" };
  }
  if (/\bheight\b/.test(hay)) return { attribute: "height", dimension: null, specificity: "specific" };
  if (/\bbuild\b/.test(hay)) return { attribute: "build", dimension: null, specificity: "specific" };
  if (/\b(clothing|clothes|coat|uniform|disguise)\b/.test(hay)) {
    return { attribute: "clothing", dimension: null, specificity: "specific" };
  }
  if (/\b(beard|mustache|moustache|stubble)\b/.test(hay)) {
    return { attribute: "facial_hair", dimension: null, specificity: "specific" };
  }
  return { attribute: "unknown_appearance", dimension: null, specificity: "insufficient" };
}

function relationshipParts(fact: BookGraphFact): {
  counterpart: string | null;
  dimension: string | null;
  specificity: ComparisonKey["specificity"];
} {
  const value = fact.value ?? {};
  const counterpart = firstString(value, [
    "other",
    "related_entity",
    "counterpart",
    "target",
    "object",
  ]);
  const rawType = firstString(value, [
    "relationship_type",
    "relationship",
    "relation",
    "type",
    "kinship",
  ]);
  const hay = `${flattenValueText(value)} ${factHaystack(fact)}`;
  let resolvedCounterpart = counterpart;
  if (!resolvedCounterpart) {
    const served = hay.match(/served with ([a-z]+)/);
    if (served) resolvedCounterpart = served[1]!;
  }
  const typeHay = `${rawType ?? ""} ${hay}`;
  let dimension: string | null = null;
  if (/\b(spouse|married|wife|husband|widow|divorced|separated)\b/.test(typeHay)) dimension = "spouse";
  else if (/\b(sibling|brother|sister)\b/.test(typeHay)) dimension = "sibling";
  else if (/\b(served with|military training)\b/.test(typeHay)) dimension = "served_with";
  else if (/\b(colleague|professional|coworker|operational arrangement|intelligence work)\b/.test(typeHay)) {
    dimension = "colleague";
  }
  else if (/\b(parent|father|mother|child|son|daughter)\b/.test(typeHay)) dimension = "family";
  else if (rawType) dimension = normalizeToken(rawType.replace(/\s+/g, "_"));

  if (!resolvedCounterpart || !dimension) {
    return { counterpart: resolvedCounterpart, dimension, specificity: "insufficient" };
  }
  return { counterpart: resolvedCounterpart, dimension, specificity: "specific" };
}

function aliveSubject(fact: BookGraphFact): string {
  const hay = `${flattenValueText(fact.value)} ${factHaystack(fact)}`;
  if (/\b(wife|wives|children|child|kids|family|both children)\b/.test(hay) && /\b(dead|killed|died)\b/.test(hay)) {
    if (!/\b(also dead|wife and children|the wife)\b/.test(hay)) {
      return fact.entity_key;
    }
    return `${fact.entity_key}:family`;
  }
  return fact.entity_key;
}

export function normalizeAliveState(fact: BookGraphFact): "alive" | "dead" | "presumed_dead" | "unknown" {
  const hay = `${flattenValueText(fact.value)} ${factHaystack(fact)}`;
  if (/\b(no body|unconfirmed|unknown|no confirmation)\b/.test(hay)) {
    if (/\b(presumed|dead)\b/.test(hay)) return "presumed_dead";
    return "unknown";
  }
  if (/\b(presumed[_\s-]?dead|presumed dead)\b/.test(hay)) return "presumed_dead";
  if (/\b(dead|killed|deceased|died|executed)\b/.test(hay) && !/\balive\b/.test(hay)) return "dead";
  if (/\balive\b/.test(hay) || /\bsurrender/.test(hay) || /\bwarrant\b/.test(hay) || /\bhospital\b/.test(hay)) {
    return "alive";
  }
  const status = firstString(fact.value ?? {}, ["status", "state", "value"]);
  if (!status) return "unknown";
  if (status.includes("presumed") || status.includes("unconfirmed") || status.includes("unknown")) {
    return status.includes("dead") ? "presumed_dead" : "unknown";
  }
  if (status.includes("dead") || status.includes("killed")) return "dead";
  if (status.includes("alive") || status.includes("surrender")) return "alive";
  return "unknown";
}

function rankDimension(fact: BookGraphFact): { attribute: string; specificity: ComparisonKey["specificity"] } {
  const value = fact.value ?? {};
  const hay = `${flattenValueText(value)} ${factHaystack(fact)}`;
  if (/\b(\d+\s+years|twenty years|career duration|duration)\b/.test(hay) || value.temporal === "past") {
    if (/\b(assigned|assignment|posted|deployed)\b/.test(hay)) {
      return { attribute: "assignment", specificity: "specific" };
    }
    return { attribute: "career_duration", specificity: "specific" };
  }
  if (/\b(assigned|assignment|posted|deployed|on leave)\b/.test(hay)) {
    return { attribute: "assignment", specificity: "specific" };
  }
  if (/\b(navy seal|seal|marine|soldier|sailor)\b/.test(hay) && !/\b(captain|lieutenant|commander|sergeant|colonel)\b/.test(hay)) {
    return { attribute: "profession", specificity: "specific" };
  }
  if (/\b(team lead|team leader)\b/.test(hay) || String(value.context ?? "").toLowerCase().includes("team lead")) {
    return { attribute: "role", specificity: "specific" };
  }
  if (/\b(captain|lieutenant|commander|sergeant|colonel|major|admiral|ensign)\b/.test(hay)) {
    return { attribute: "rank", specificity: "specific" };
  }
  if (typeof value.title === "string" && value.title.trim()) {
    return { attribute: "title", specificity: "specific" };
  }
  if (typeof value.rank === "string" && /officer/.test(value.rank.toLowerCase())) {
    return { attribute: "role", specificity: "specific" };
  }
  return { attribute: "unknown_rank", specificity: "insufficient" };
}

function knowledgeTopic(fact: BookGraphFact): { attribute: string; dimension: string | null; specificity: ComparisonKey["specificity"] } {
  const topic = firstString(fact.value ?? {}, ["secret", "topic", "knowledge", "proposition", "fact", "subject"]);
  if (!topic) return { attribute: "knowledge", dimension: null, specificity: "insufficient" };
  return { attribute: "knowledge", dimension: topic, specificity: "specific" };
}

const INJURY_REGIONS = [
  "shoulder",
  "arm",
  "hand",
  "wrist",
  "leg",
  "knee",
  "ankle",
  "foot",
  "hip",
  "eye",
  "ear",
  "rib",
  "chest",
  "nose",
] as const;

function exclusiveLaterality(hay: string): "left" | "right" | null {
  const hasLeft = /\bleft\b/.test(hay);
  const hasRight = /\bright\b/.test(hay);
  if (hasLeft && hasRight) return null;
  if (hasLeft) return "left";
  if (hasRight) return "right";
  return null;
}

function exclusiveRegion(hay: string): string | null {
  const hits = INJURY_REGIONS.filter((region) => new RegExp(`\\b${region}s?\\b`).test(hay));
  return hits.length === 1 ? hits[0]! : null;
}

function injuryParts(fact: BookGraphFact): { dimension: string | null; specificity: ComparisonKey["specificity"] } {
  const value = fact.value ?? {};
  const hay = `${flattenValueText(value)} ${factHaystack(fact)}`;
  const rawLaterality = firstString(value, ["laterality", "side"]);
  const laterality = rawLaterality && /^(left|right)$/i.test(rawLaterality)
    ? rawLaterality.toLowerCase()
    : exclusiveLaterality(hay);
  const rawRegion = firstString(value, ["site", "region"]);
  const region = rawRegion && INJURY_REGIONS.includes(rawRegion as (typeof INJURY_REGIONS)[number])
    ? rawRegion
    : exclusiveRegion(hay);
  if (!region || !laterality) return { dimension: null, specificity: "insufficient" };
  return { dimension: `${laterality}:${region}`, specificity: "specific" };
}

function uniqueObjectKey(fact: BookGraphFact): { attribute: string; dimension: string | null; specificity: ComparisonKey["specificity"] } {
  if (fact.value?.unique !== true) {
    return { attribute: "generic_object", dimension: null, specificity: "insufficient" };
  }
  return { attribute: "unique_object", dimension: fact.entity_key, specificity: "specific" };
}

function eventDimension(fact: BookGraphFact): { attribute: string; specificity: ComparisonKey["specificity"] } {
  const event = firstString(fact.value ?? {}, ["event", "state"]);
  if (!event) return { attribute: "unknown_event", specificity: "insufficient" };
  const tokens = [...distinctiveTokens(event)].slice(0, 4).join("_");
  return { attribute: tokens || "unknown_event", specificity: tokens ? "specific" : "insufficient" };
}

export function comparisonKeyId(key: ComparisonKey): string {
  return [key.entity_key, key.fact_type, key.attribute, key.counterpart ?? "", key.dimension ?? ""].join("|");
}

export function buildComparisonKey(fact: BookGraphFact): ComparisonKey {
  const displayEntity = displayEntityName(fact);
  const base = {
    entity_key: fact.entity_key,
    fact_type: fact.fact_type,
    counterpart: null as string | null,
    dimension: null as string | null,
    subject: fact.entity_key,
    specificity: "specific" as const,
    display_entity: displayEntity,
    display_attribute: fact.fact_type,
  };

  if (fact.fact_type === "appearance") {
    const part = appearanceAttribute(fact);
    return {
      ...base,
      attribute: part.attribute,
      dimension: part.dimension,
      specificity: part.specificity,
      display_attribute: formatAppearanceLabel(part.attribute, part.dimension),
    };
  }
  if (fact.fact_type === "relationship") {
    const part = relationshipParts(fact);
    return {
      ...base,
      attribute: "relationship",
      counterpart: part.counterpart,
      dimension: part.dimension,
      specificity: part.specificity,
      display_attribute: part.counterpart
        ? `Relationship with ${titleCase(part.counterpart)}`
        : "Relationship",
    };
  }
  if (fact.fact_type === "alive_status") {
    const subject = aliveSubject(fact);
    return {
      ...base,
      attribute: "alive_status",
      subject,
      specificity: "specific",
      display_attribute: subject.endsWith(":family") ? "Family alive/dead" : "Alive/dead",
    };
  }
  if (fact.fact_type === "rank_title") {
    const part = rankDimension(fact);
    return {
      ...base,
      attribute: part.attribute,
      specificity: part.specificity,
      display_attribute: titleCase(part.attribute.replace(/_/g, " ")),
    };
  }
  if (fact.fact_type === "knowledge_state") {
    const part = knowledgeTopic(fact);
    return {
      ...base,
      attribute: part.attribute,
      dimension: part.dimension,
      specificity: part.specificity,
      display_attribute: part.dimension ? `Knowledge: ${part.dimension}` : "Knowledge",
    };
  }
  if (fact.fact_type === "injury") {
    const part = injuryParts(fact);
    return {
      ...base,
      attribute: "injury",
      dimension: part.dimension,
      specificity: part.specificity,
      display_attribute: part.dimension ? `Injury / ${part.dimension.replace(":", " ")}` : "Injury",
    };
  }
  if (fact.fact_type === "possession") {
    const part = uniqueObjectKey(fact);
    return {
      ...base,
      attribute: part.attribute,
      dimension: part.dimension,
      specificity: part.specificity,
      display_attribute: part.attribute === "unique_object" ? "Unique object possession" : "Possession",
    };
  }
  if (fact.fact_type === "age") {
    return { ...base, attribute: "age", display_attribute: "Age" };
  }
  if (fact.fact_type === "location" || fact.fact_type === "travel" || fact.fact_type === "presence") {
    const chapter = chapterOrdinalFromFact(fact);
    return {
      ...base,
      attribute: fact.fact_type,
      dimension: chapter == null ? null : String(chapter),
      specificity: chapter == null ? "insufficient" : "specific",
      display_attribute: titleCase(fact.fact_type),
    };
  }
  const event = eventDimension(fact);
  return {
    ...base,
    attribute: event.attribute,
    specificity: event.specificity,
    display_attribute: titleCase(event.attribute.replace(/_/g, " ")),
  };
}

function formatAppearanceLabel(attribute: string, dimension: string | null): string {
  if (attribute === "tattoo") {
    const region = dimension?.split(":")[1];
    return region && region !== "body" ? `Tattoo / ${region.replace("_", " ")}` : "Tattoo";
  }
  if (attribute === "injury_mark") {
    const [side, region] = (dimension ?? "any:injury").split(":");
    return side && side !== "any" ? `Injury mark / ${side} ${region}` : `Injury mark / ${region}`;
  }
  if (attribute === "eye_color") return "Eye color";
  return titleCase(attribute.replace(/_/g, " "));
}

function titleCase(value: string): string {
  return value
    .split(/[\s:_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
