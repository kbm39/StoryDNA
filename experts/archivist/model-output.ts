/**
 * Model-facing Archivist payload + deterministic StoryDNA envelope.
 *
 * The model emits editorial fields only. Identity, schema, metrics,
 * generation provenance, and author-challenge flags are system-owned.
 */

import { isolateFirstJsonValue } from "@/lib/ai/revision-candidate-recovery.ts";
import {
  ARCHIVIST_CLASSIFICATIONS,
  ARCHIVIST_CONFIDENCE_LEVELS,
  ARCHIVIST_DEFINITION_VERSION,
  ARCHIVIST_ENTITY_RESOLUTIONS,
  ARCHIVIST_ENTITY_TYPES,
  ARCHIVIST_EVIDENCE_ROLES,
  ARCHIVIST_EVIDENCE_SOURCE_KINDS,
  ARCHIVIST_EVIDENCE_VERIFICATION_STATUSES,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_FACT_TYPES,
  ARCHIVIST_ISSUE_TYPES,
  ARCHIVIST_MODEL_PROPOSABLE_AUTHORITIES,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_SEVERITY_LEVELS,
  ARCHIVIST_VERSION,
  type ArchivistReview,
} from "./contracts.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "./constitution-hash.ts";
import { normalizeArchivistReview } from "./normalization.ts";
import { parseArchivistReview } from "./parsing.ts";
import {
  ARCHIVIST_NORMALIZATION_VERSION,
  ARCHIVIST_PROMPT_VERSION,
  ARCHIVIST_VALIDATOR_VERSION,
} from "./runtime-definition.ts";

export const ARCHIVIST_MODEL_OUTPUT_SCHEMA = "archivist_model_output@v1" as const;

export const ARCHIVIST_MODEL_OUTPUT_KEYS = [
  "summary",
  "findings",
  "canon_delta",
  "entity_ambiguities",
] as const;

export const ARCHIVIST_SYSTEM_OWNED_REVIEW_KEYS = [
  "schema",
  "expert_key",
  "expert_version",
  "manuscript_id",
  "manuscript_version_id",
  "content_hash",
  "series_id",
  "metrics",
  "generation",
  "author_challenge_supported",
] as const;

export type ArchivistJsonFailureClass =
  | "not_json"
  | "markdown_fenced_json"
  | "prose_wrapped_json"
  | "truncated_json"
  | "malformed_json"
  | "valid_json_wrong_shape";

export type ArchivistJsonExtractMethod = "identity" | "fenced" | "isolated" | "none";

export interface ArchivistJsonExtractSuccess {
  ok: true;
  jsonText: string;
  value: unknown;
  method: Exclude<ArchivistJsonExtractMethod, "none">;
  failure_class: null;
  deterministic_recovery: boolean;
}

export interface ArchivistJsonExtractFailure {
  ok: false;
  jsonText: null;
  value: null;
  method: "none";
  failure_class: ArchivistJsonFailureClass;
  deterministic_recovery: boolean;
  message: string;
}

export type ArchivistJsonExtract = ArchivistJsonExtractSuccess | ArchivistJsonExtractFailure;

export interface ArchivistReviewIdentity {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  series_id?: string | null;
}

export const ARCHIVIST_MODEL_OUTPUT_CONTRACT = [
  "{",
  '  "summary": { "narrative": "string" },',
  "  \"findings\": [{",
  '    "id": "string",',
  `    "issue_type": "${ARCHIVIST_ISSUE_TYPES.join("|")}",`,
  `    "classification": "${ARCHIVIST_CLASSIFICATIONS.join("|")}",`,
  `    "severity": "${ARCHIVIST_SEVERITY_LEVELS.join("|")}",`,
  `    "confidence": "${ARCHIVIST_CONFIDENCE_LEVELS.join("|")}",`,
  '    "current_location": { "locator": "string", "chapter": "string?" },',
  '    "conflicting_location": { "locator": "string", "chapter": "string?" },',
  `    "current_evidence": [{ "excerpt": "string", "locator": "string", "evidence_role": "${ARCHIVIST_EVIDENCE_ROLES.join("|")}", "verification_status": "${ARCHIVIST_EVIDENCE_VERIFICATION_STATUSES.join("|")}", "source_kind": "${ARCHIVIST_EVIDENCE_SOURCE_KINDS.join("|")}" }],`,
  '    "conflicting_evidence": [/* same shape as current_evidence */],',
  '    "temporal_analysis": { "relation": "identical|overlap|disjoint|unknown", "explanation": "string", "current_scope": { "kind": "at|from_to|as_of_book|unknown" }, "conflicting_scope": {} },',
  '    "explanation": "string",',
  '    "suggested_resolution": "string"',
  "  }],",
  "  \"canon_delta\": [{",
  '    "id": "string",',
  `    "entity": { "alias": "string", "resolution": "${ARCHIVIST_ENTITY_RESOLUTIONS.join("|")}", "entity_type": "${ARCHIVIST_ENTITY_TYPES.join("|")}" },`,
  `    "entity_type": "${ARCHIVIST_ENTITY_TYPES.join("|")}",`,
  `    "fact_type": "${ARCHIVIST_FACT_TYPES.join("|")}",`,
  '    "proposed_fact_value": {},',
  '    "temporal_scope": { "kind": "at|from_to|as_of_book|unknown" },',
  '    "source_location": { "locator": "string" },',
  "    \"evidence\": [/* evidence records */],",
  `    "confidence": "${ARCHIVIST_CONFIDENCE_LEVELS.join("|")}",`,
  `    "proposed_authority": "${ARCHIVIST_MODEL_PROPOSABLE_AUTHORITIES.join("|")}",`,
  '    "status": "candidate"',
  "  }],",
  "  \"entity_ambiguities\": [{",
  '    "id": "string",',
  '    "alias": "string",',
  '    "candidate_entities": [{ "entity_id": "string", "canonical_name": "string", "entity_type": "person|place|object|vehicle|weapon|event|organization|other", "evidence": [] }],',
  '    "context": "string",',
  `    "confidence": "${ARCHIVIST_CONFIDENCE_LEVELS.join("|")}",`,
  '    "recommended_author_verification": "string"',
  "  }]",
  "}",
].join("\n");

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function unwrapFence(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fence ? fence[1].trim() : null;
}

function looksTruncated(raw: string): boolean {
  const open = (raw.match(/[{[]/g) ?? []).length;
  const close = (raw.match(/[}\]]/g) ?? []).length;
  return raw.includes("{") && (isolateFirstJsonValue(raw) == null || open > close);
}

export function extractArchivistJson(raw: string): ArchivistJsonExtract {
  const trimmed = raw.trim();
  const identity = tryParseJson(trimmed);
  if (identity !== undefined) {
    if (typeof identity !== "object" || identity === null || Array.isArray(identity)) {
      return {
        ok: false,
        jsonText: null,
        value: null,
        method: "none",
        failure_class: "valid_json_wrong_shape",
        deterministic_recovery: false,
        message: "Archivist output must be a JSON object",
      };
    }
    return {
      ok: true,
      jsonText: trimmed,
      value: identity,
      method: "identity",
      failure_class: null,
      deterministic_recovery: false,
    };
  }

  const fenced = unwrapFence(trimmed);
  if (fenced) {
    const fencedValue = tryParseJson(fenced);
    if (fencedValue !== undefined && typeof fencedValue === "object" && fencedValue !== null && !Array.isArray(fencedValue)) {
      return {
        ok: true,
        jsonText: fenced,
        value: fencedValue,
        method: "fenced",
        failure_class: null,
        deterministic_recovery: true,
      };
    }
    const isolatedFence = isolateFirstJsonValue(fenced);
    const isolatedFenceValue = isolatedFence ? tryParseJson(isolatedFence) : undefined;
    if (
      isolatedFenceValue !== undefined &&
      typeof isolatedFenceValue === "object" &&
      isolatedFenceValue !== null &&
      !Array.isArray(isolatedFenceValue)
    ) {
      return {
        ok: true,
        jsonText: isolatedFence!,
        value: isolatedFenceValue,
        method: "isolated",
        failure_class: null,
        deterministic_recovery: true,
      };
    }
    return {
      ok: false,
      jsonText: null,
      value: null,
      method: "none",
      failure_class: looksTruncated(fenced) ? "truncated_json" : "malformed_json",
      deterministic_recovery: true,
      message: looksTruncated(fenced)
        ? "Fenced Archivist JSON is truncated"
        : "Fenced Archivist output is not valid JSON",
    };
  }

  const isolated = isolateFirstJsonValue(trimmed);
  const isolatedValue = isolated ? tryParseJson(isolated) : undefined;
  if (
    isolatedValue !== undefined &&
    typeof isolatedValue === "object" &&
    isolatedValue !== null &&
    !Array.isArray(isolatedValue)
  ) {
    return {
      ok: true,
      jsonText: isolated!,
      value: isolatedValue,
      method: "isolated",
      failure_class: null,
      deterministic_recovery: true,
    };
  }

  if (!trimmed.includes("{") && !trimmed.includes("[")) {
    return {
      ok: false,
      jsonText: null,
      value: null,
      method: "none",
      failure_class: "not_json",
      deterministic_recovery: false,
      message: "Archivist output is not JSON",
    };
  }

  return {
    ok: false,
    jsonText: null,
    value: null,
    method: "none",
    failure_class: looksTruncated(trimmed) ? "truncated_json" : "malformed_json",
    deterministic_recovery: true,
    message: looksTruncated(trimmed)
      ? "Archivist JSON is truncated"
      : "Archivist output is not valid JSON",
  };
}

export function applyArchivistSystemOwnedFields(
  review: ArchivistReview,
  identity: ArchivistReviewIdentity,
): ArchivistReview {
  return normalizeArchivistReview({
    ...review,
    schema: ARCHIVIST_REVIEW_SCHEMA,
    expert_key: ARCHIVIST_EXPERT_KEY,
    expert_version: ARCHIVIST_VERSION,
    manuscript_id: identity.manuscript_id,
    manuscript_version_id: identity.manuscript_version_id,
    content_hash: identity.content_hash,
    series_id: identity.series_id ?? review.series_id ?? null,
    author_challenge_supported: true,
    findings: review.findings.map((finding) => ({
      ...finding,
      author_action: finding.author_action ? finding.author_action : "pending",
      author_challenge_supported: true,
    })),
    canon_delta: review.canon_delta.map((delta) => ({
      ...delta,
      status: delta.status ? delta.status : "candidate",
    })),
    generation: {
      provider: "none",
      model: "none",
      prompt_version: ARCHIVIST_PROMPT_VERSION,
      validator_version: ARCHIVIST_VALIDATOR_VERSION,
      normalization_version: ARCHIVIST_NORMALIZATION_VERSION,
      definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    },
  });
}

export function parseAndEnvelopeArchivistModelOutput(
  raw: unknown,
  identity: ArchivistReviewIdentity,
):
  | { ok: true; review: ArchivistReview; extract: ArchivistJsonExtractSuccess | null }
  | {
      ok: false;
      extract: ArchivistJsonExtract | null;
      parse_code: string;
      message: string;
    } {
  let value = raw;
  let extract: ArchivistJsonExtractSuccess | null = null;
  if (typeof raw === "string") {
    const extracted = extractArchivistJson(raw);
    if (!extracted.ok) {
      return {
        ok: false,
        extract: extracted,
        parse_code: extracted.failure_class,
        message: extracted.message,
      };
    }
    extract = extracted;
    value = extracted.value;
  }

  const parsed = parseArchivistReview(value);
  if (!parsed.ok) {
    return {
      ok: false,
      extract,
      parse_code: parsed.code,
      message: parsed.message,
    };
  }

  return {
    ok: true,
    review: applyArchivistSystemOwnedFields(parsed.review, identity),
    extract,
  };
}

export function buildArchivistModelOutputInstructions(): string {
  return [
    `Return ONLY a JSON object matching ${ARCHIVIST_MODEL_OUTPUT_SCHEMA}.`,
    "No markdown fences. No prose before or after the JSON.",
    "Do not emit schema, expert_key, expert_version, manuscript identity, content_hash, series_id, metrics, generation, author_action, or author_challenge_supported. StoryDNA attaches those deterministically.",
    `Workflow definition ${ARCHIVIST_DEFINITION_VERSION} remains StoryDNA-owned.`,
    "Confirmed contradictions require current_evidence AND conflicting_evidence, plus current_location and conflicting_location locators.",
    "Do not call two facts contradictory merely because values differ. Disjoint temporal states may both be valid.",
    "canon_delta.status must be candidate. Never emit accepted canon.",
    "Do not invent quotations. If evidence is insufficient, use possible_continuity_conflict or author_verification_needed.",
    "Leave aliases unresolved when identity is ambiguous. Do not guess.",
    "Model-facing contract:",
    ARCHIVIST_MODEL_OUTPUT_CONTRACT,
  ].join("\n");
}
