/**
 * Fail-closed V2 enum/shape normalization.
 * Recovers only unambiguous Haiku aliases. Does not invent observations.
 */

import type { V2Laterality, V2ObservationKind, V2Polarity, V2Proposition } from "./types.ts";

export const V2_ENUM_NORMALIZATION_VERSION = "archivist_v2_enum_normalization@v1" as const;

export interface V2NormalizationAudit {
  observation_id?: string;
  field: string;
  original: unknown;
  normalized: unknown;
  rule: string;
  reason: string;
}

export interface V2EnumNormalizationResult {
  payload: Record<string, unknown>;
  proposition: V2Proposition;
  audits: V2NormalizationAudit[];
  error: string | null;
}

const REFUSED_KNOWLEDGE_AS_KNOWN = new Set(["mentions", "mention", "sees", "see", "hears", "hear", "narrates", "narrate"]);

function asText(...values: unknown[]): string {
  return values
    .flatMap((value) => (typeof value === "string" ? [value] : []))
    .join(" ")
    .toLowerCase();
}

export function normalizePolarityValue(value: unknown): V2Polarity | null {
  if (value === true || value === 1) return "true";
  if (value === false || value === 0) return "false";
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (["true", "yes", "affirmative", "asserted"].includes(key)) return "true";
  if (["false", "no", "negated", "denied"].includes(key)) return "false";
  if (["unknown", "unclear", "unspecified"].includes(key)) return "unknown";
  return null;
}

const EXPLICIT_SIDES = ["left", "right", "bilateral"] as const;

export function lateralityNamedInExcerpt(excerpt: string): V2Laterality | null {
  const text = excerpt.toLowerCase();
  const left = /\bleft\b/.test(text);
  const right = /\bright\b/.test(text);
  const bilateral = /\bbilateral\b|\bboth sides\b/.test(text);
  const hits = [
    left ? "left" : null,
    right ? "right" : null,
    bilateral ? "bilateral" : null,
  ].filter((item): item is (typeof EXPLICIT_SIDES)[number] => item !== null);
  return hits.length === 1 ? hits[0] : null;
}

function explicitModelLaterality(value: unknown): V2Laterality | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  if (key === "left" || key === "right" || key === "bilateral" || key === "unspecified") {
    return key;
  }
  return null;
}

function demonstratedUse(text: string): boolean {
  return /\b(use|uses|used|using|recognize|recognizes|recognized|recognising)\b/.test(text);
}

export function parseAlsoKnownAsClaim(value: unknown): { alias: string } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^may\s+be\b/i.test(trimmed) || /^might\s+be\b/i.test(trimmed) || /^possibly\b/i.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(/^(?:also[_\s-]*known[_\s-]*as|a\.?k\.?a\.?)\s+(.+)$/i);
  if (!match?.[1]) return null;
  const alias = match[1].trim().replace(/[.,;:]+$/, "");
  return alias ? { alias } : null;
}

export function applySafeEnumNormalizations(args: {
  observationId: string;
  kind: V2ObservationKind;
  payload: Record<string, unknown>;
  proposition: V2Proposition;
  excerpt: string;
}): V2EnumNormalizationResult {
  const payload = { ...args.payload };
  const proposition = { ...args.proposition };
  const audits: V2NormalizationAudit[] = [];

  const propPolarity = normalizePolarityValue(proposition.polarity);
  if (propPolarity && proposition.polarity !== propPolarity) {
    audits.push({
      observation_id: args.observationId,
      field: "proposition.polarity",
      original: args.proposition.polarity,
      normalized: propPolarity,
      rule: "boolean_or_alias_polarity",
      reason: propPolarity === "true" ? "boolean_true_to_enum_true" : "boolean_false_to_enum_false",
    });
    proposition.polarity = propPolarity;
  }

  if (args.kind === "statement") {
    const payloadPolarity = payload.polarity === undefined ? null : normalizePolarityValue(payload.polarity);
    if (payload.polarity !== undefined && payloadPolarity === null) {
      return { payload, proposition, audits, error: "invalid statement polarity" };
    }
    if (payloadPolarity && propPolarity && payloadPolarity !== propPolarity) {
      return { payload, proposition, audits, error: "contradictory polarity" };
    }
    if (payload.polarity === undefined && propPolarity) {
      payload.polarity = propPolarity;
      audits.push({
        observation_id: args.observationId,
        field: "payload.polarity",
        original: undefined,
        normalized: propPolarity,
        rule: "propagate_proposition_polarity",
        reason: "statement_payload_required_polarity",
      });
    } else if (payloadPolarity && payload.polarity !== payloadPolarity) {
      audits.push({
        observation_id: args.observationId,
        field: "payload.polarity",
        original: payload.polarity,
        normalized: payloadPolarity,
        rule: "boolean_or_alias_polarity",
        reason: "statement_payload_polarity_normalized",
      });
      payload.polarity = payloadPolarity;
    }
  }

  if (args.kind === "knowledge") {
    const rawState = typeof payload.knowledge_state === "string" ? payload.knowledge_state.trim().toLowerCase() : "";
    const evidence = asText(args.excerpt, proposition.predicate, proposition.object, payload.topic, payload.entity);
    if (rawState === "uses") {
      if (payload.perspective === "narration") {
        return { payload, proposition, audits, error: "narration naming is not character knowledge" };
      }
      if (!demonstratedUse(evidence)) {
        return { payload, proposition, audits, error: "knowledge_state uses lacks demonstrated use" };
      }
      payload.knowledge_state = "known";
      audits.push({
        observation_id: args.observationId,
        field: "knowledge_state",
        original: "uses",
        normalized: "known",
        rule: "uses_to_known",
        reason: "known_by_demonstrated_use",
      });
      if (payload.perspective !== "character") {
        const rawPerspective = payload.perspective;
        payload.perspective = "character";
        audits.push({
          observation_id: args.observationId,
          field: "perspective",
          original: rawPerspective,
          normalized: "character",
          rule: "uses_to_known",
          reason: "character_by_demonstrated_use",
        });
      }
    } else if (REFUSED_KNOWLEDGE_AS_KNOWN.has(rawState)) {
      return { payload, proposition, audits, error: `knowledge_state ${rawState} is not known` };
    }
  }

  if (args.kind === "relationship") {
    const rawState = typeof payload.state === "string" ? payload.state.trim().toLowerCase() : "";
    if (rawState === "confirmed") {
      payload.state = "exists";
      audits.push({
        observation_id: args.observationId,
        field: "state",
        original: args.payload.state,
        normalized: "exists",
        rule: "confirmed_to_exists",
        reason: "explicit_relationship_confirmed",
      });
    } else if (["possible", "likely", "maybe", "speculative", "uncertain_guess"].includes(rawState)) {
      return { payload, proposition, audits, error: `relationship state ${rawState} is not exists` };
    }
  }

  if (args.kind === "injury") {
    const modelSide = explicitModelLaterality(payload.laterality);
    const excerptSide = lateralityNamedInExcerpt(args.excerpt);
    if (modelSide && EXPLICIT_SIDES.includes(modelSide as (typeof EXPLICIT_SIDES)[number]) && excerptSide && excerptSide !== modelSide) {
      return { payload, proposition, audits, error: "laterality evidence conflict" };
    }
    if (!modelSide) {
      payload.laterality = excerptSide ?? "unspecified";
      audits.push({
        observation_id: args.observationId,
        field: "laterality",
        original: args.payload.laterality,
        normalized: payload.laterality,
        rule: "injury_laterality_default",
        reason: excerptSide ? "laterality_from_this_excerpt_only" : "missing_laterality_unspecified",
      });
    }
  }

  if (args.kind === "identity") {
    const rawClaim = payload.identity_claim;
    const parsed = parseAlsoKnownAsClaim(rawClaim);
    if (parsed) {
      const existingAlias = typeof payload.alias === "string" ? payload.alias.trim() : "";
      if (existingAlias && existingAlias.toLowerCase() !== parsed.alias.toLowerCase()) {
        return { payload, proposition, audits, error: "identity alias mismatch" };
      }
      payload.identity_claim = "also_known_as";
      payload.alias = existingAlias || parsed.alias;
      audits.push({
        observation_id: args.observationId,
        field: "identity_claim",
        original: rawClaim,
        normalized: "also_known_as",
        rule: "also_known_as_prose",
        reason: "explicit_alias_equivalence",
      });
    }
  }

  return { payload, proposition, audits, error: null };
}
