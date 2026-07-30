/**
 * Military Expert V2 per-scene review contract.
 * Version: military_expert_scene_review@v1
 */

import { hashCanonicalOutput } from "@/lib/expert-review-engine/canonical-output.ts";
import {
  MILITARY_EXPERT_ACTION_CATEGORIES,
  MILITARY_EXPERT_SCENE_TYPES,
  parseMilitaryExpertSceneLocator,
  type MilitaryExpertActionCategory,
  type MilitaryExpertSceneLocator,
  type MilitaryExpertSceneType,
} from "./contracts.ts";

export const MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION =
  "military_expert_scene_review@v1" as const;

export const MILITARY_EXPERT_SCENE_REVIEW_STATUSES = [
  "queued",
  "running",
  "complete",
  "insufficient_evidence",
  "outside_expertise",
  "failed",
] as const;

export type MilitaryExpertSceneReviewStatus =
  (typeof MILITARY_EXPERT_SCENE_REVIEW_STATUSES)[number];

export const MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
] as const;

export type MilitaryExpertSceneConfidenceLevel =
  (typeof MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS)[number];

export const MILITARY_EXPERT_SCENE_DETERMINATIONS = [
  "confirmed",
  "author_review_required",
] as const;

export type MilitaryExpertSceneDetermination =
  (typeof MILITARY_EXPERT_SCENE_DETERMINATIONS)[number];

export const MILITARY_EXPERT_REVISION_SIGNIFICANCE = [
  "critical",
  "important",
  "minor",
  "informational",
] as const;

export type MilitaryExpertRevisionSignificance =
  (typeof MILITARY_EXPERT_REVISION_SIGNIFICANCE)[number];

export const MILITARY_EXPERT_SCENE_CATEGORY_TAGS = [
  "firefight_or_battle",
  "movement_and_cover",
  "room_entry_or_breach",
  "team_coordination",
  "command_and_control",
  "radio_and_communications",
  "weapons_handling",
  "timing_and_physical_realism",
  "convoy_and_vehicle_contact",
  "aviation",
  "casualty_response",
  "intelligence_and_planning",
  "military_culture",
  "other",
] as const;

export type MilitaryExpertSceneCategoryTag =
  (typeof MILITARY_EXPERT_SCENE_CATEGORY_TAGS)[number];

export interface MilitaryExpertSceneEvidenceItem {
  readonly excerpt_locator: string;
  readonly excerpt_text: string;
  readonly relevance: string;
}

export interface MilitaryExpertSceneEditorialSuggestion {
  readonly suggestion: string;
  readonly rationale: string;
  readonly addresses_concern_title: string | null;
}

export interface MilitaryExpertSceneAuthenticityPoint {
  readonly title: string;
  readonly scene_specific_explanation: string;
  readonly why_it_matters: string;
  readonly manuscript_evidence_locator: string;
  readonly relevant_military_domains: readonly MilitaryExpertSceneCategoryTag[];
  readonly confidence: MilitaryExpertSceneConfidenceLevel;
  readonly revision_significance: MilitaryExpertRevisionSignificance;
  readonly determination: MilitaryExpertSceneDetermination;
}

export interface MilitaryExpertSceneReviewProviderMetadata {
  readonly model: string;
  readonly provider: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd: number;
  readonly correlation_id: string;
  readonly captured_at: string;
}

export interface MilitaryExpertSceneReviewDocument {
  readonly contract_version: typeof MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION;
  readonly scene_review_id: string;
  readonly inventory_id: string;
  readonly selection_snapshot_id: string;
  readonly scene_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly workflow_id: string;
  readonly locator: MilitaryExpertSceneLocator;
  readonly scene_types: readonly MilitaryExpertSceneType[];
  readonly action_categories: readonly MilitaryExpertActionCategory[];
  readonly participants: readonly string[];
  readonly review_status: MilitaryExpertSceneReviewStatus;
  readonly authenticity_strengths: readonly MilitaryExpertSceneAuthenticityPoint[];
  readonly authenticity_concerns: readonly MilitaryExpertSceneAuthenticityPoint[];
  readonly supporting_evidence: readonly MilitaryExpertSceneEvidenceItem[];
  readonly contrary_evidence: readonly MilitaryExpertSceneEvidenceItem[];
  readonly safe_editorial_suggestions: readonly MilitaryExpertSceneEditorialSuggestion[];
  readonly realism_summary: string;
  readonly confidence: MilitaryExpertSceneConfidenceLevel;
  readonly category_tags: readonly MilitaryExpertSceneCategoryTag[];
  readonly provider_metadata: MilitaryExpertSceneReviewProviderMetadata | null;
  readonly parsed_review_hash: string;
  readonly retry_count: number;
  readonly repair_count: number;
  readonly created_at: string;
  readonly completed_at: string | null;
}

const REVIEW_STATUS_SET = new Set<string>(MILITARY_EXPERT_SCENE_REVIEW_STATUSES);
const CONFIDENCE_SET = new Set<string>(MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS);
const DETERMINATION_SET = new Set<string>(MILITARY_EXPERT_SCENE_DETERMINATIONS);
const SIGNIFICANCE_SET = new Set<string>(MILITARY_EXPERT_REVISION_SIGNIFICANCE);
const CATEGORY_TAG_SET = new Set<string>(MILITARY_EXPERT_SCENE_CATEGORY_TAGS);
const SCENE_TYPE_SET = new Set<string>(MILITARY_EXPERT_SCENE_TYPES);
const ACTION_CATEGORY_SET = new Set<string>(MILITARY_EXPERT_ACTION_CATEGORIES);

/** Vague statements rejected at validation time. */
export const VAGUE_SCENE_REVIEW_PATTERNS: readonly RegExp[] = [
  /^the tactics could be more realistic\.?$/i,
  /^military authenticity needs improvement\.?$/i,
  /^the scene is unrealistic\.?$/i,
  /^could be more realistic\.?$/i,
  /^needs improvement\.?$/i,
  /^not realistic enough\.?$/i,
  /^lacks realism\.?$/i,
  /^improve military authenticity\.?$/i,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnum(value: unknown, allowed: Set<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function isEnumArray(value: unknown, allowed: Set<string>): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isEnum(item, allowed));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isVagueSceneReviewText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    for (const pattern of VAGUE_SCENE_REVIEW_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
  }
  for (const pattern of VAGUE_SCENE_REVIEW_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function parseEvidenceItem(raw: unknown): MilitaryExpertSceneEvidenceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.excerpt_locator) ||
    !isNonEmptyString(obj.excerpt_text) ||
    !isNonEmptyString(obj.relevance)
  ) {
    return null;
  }
  return Object.freeze({
    excerpt_locator: obj.excerpt_locator.trim(),
    excerpt_text: obj.excerpt_text.trim(),
    relevance: obj.relevance.trim(),
  });
}

function parseEditorialSuggestion(raw: unknown): MilitaryExpertSceneEditorialSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.suggestion) || !isNonEmptyString(obj.rationale)) return null;
  if (obj.addresses_concern_title !== null && typeof obj.addresses_concern_title !== "string") {
    return null;
  }
  return Object.freeze({
    suggestion: obj.suggestion.trim(),
    rationale: obj.rationale.trim(),
    addresses_concern_title:
      typeof obj.addresses_concern_title === "string" ? obj.addresses_concern_title.trim() : null,
  });
}

function parseAuthenticityPoint(raw: unknown): MilitaryExpertSceneAuthenticityPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.title) ||
    !isNonEmptyString(obj.scene_specific_explanation) ||
    !isNonEmptyString(obj.why_it_matters) ||
    !isNonEmptyString(obj.manuscript_evidence_locator) ||
    !isEnumArray(obj.relevant_military_domains, CATEGORY_TAG_SET) ||
    !isEnum(obj.confidence, CONFIDENCE_SET) ||
    !isEnum(obj.revision_significance, SIGNIFICANCE_SET) ||
    !isEnum(obj.determination, DETERMINATION_SET)
  ) {
    return null;
  }
  if (
    isVagueSceneReviewText(obj.scene_specific_explanation) ||
    isVagueSceneReviewText(obj.why_it_matters)
  ) {
    return null;
  }
  return Object.freeze({
    title: obj.title.trim(),
    scene_specific_explanation: obj.scene_specific_explanation.trim(),
    why_it_matters: obj.why_it_matters.trim(),
    manuscript_evidence_locator: obj.manuscript_evidence_locator.trim(),
    relevant_military_domains: Object.freeze([
      ...(obj.relevant_military_domains as MilitaryExpertSceneCategoryTag[]),
    ]),
    confidence: obj.confidence as MilitaryExpertSceneConfidenceLevel,
    revision_significance: obj.revision_significance as MilitaryExpertRevisionSignificance,
    determination: obj.determination as MilitaryExpertSceneDetermination,
  });
}

function parseProviderMetadata(raw: unknown): MilitaryExpertSceneReviewProviderMetadata | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.model) ||
    !isNonEmptyString(obj.provider) ||
    typeof obj.input_tokens !== "number" ||
    typeof obj.output_tokens !== "number" ||
    typeof obj.cost_usd !== "number" ||
    !isNonEmptyString(obj.correlation_id) ||
    !isNonEmptyString(obj.captured_at)
  ) {
    return null;
  }
  return Object.freeze({
    model: obj.model,
    provider: obj.provider,
    input_tokens: obj.input_tokens,
    output_tokens: obj.output_tokens,
    cost_usd: obj.cost_usd,
    correlation_id: obj.correlation_id,
    captured_at: obj.captured_at,
  });
}

export function parseMilitaryExpertSceneReviewDocument(
  raw: unknown,
): MilitaryExpertSceneReviewDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const locator = parseMilitaryExpertSceneLocator(obj.locator);
  if (
    obj.contract_version !== MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION ||
    !locator ||
    !isNonEmptyString(obj.scene_review_id) ||
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.selection_snapshot_id) ||
    !isNonEmptyString(obj.scene_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    !isNonEmptyString(obj.workflow_id) ||
    !isEnumArray(obj.scene_types, SCENE_TYPE_SET) ||
    !isEnumArray(obj.action_categories, ACTION_CATEGORY_SET) ||
    !isStringArray(obj.participants) ||
    !isEnum(obj.review_status, REVIEW_STATUS_SET) ||
    !Array.isArray(obj.authenticity_strengths) ||
    !Array.isArray(obj.authenticity_concerns) ||
    !Array.isArray(obj.supporting_evidence) ||
    !Array.isArray(obj.contrary_evidence) ||
    !Array.isArray(obj.safe_editorial_suggestions) ||
    !isNonEmptyString(obj.realism_summary) ||
    !isEnum(obj.confidence, CONFIDENCE_SET) ||
    !Array.isArray(obj.category_tags) ||
    !obj.category_tags.every((tag) => isEnum(tag, CATEGORY_TAG_SET)) ||
    !isNonEmptyString(obj.parsed_review_hash) ||
    typeof obj.retry_count !== "number" ||
    typeof obj.repair_count !== "number" ||
    !isNonEmptyString(obj.created_at) ||
    (obj.completed_at !== null && typeof obj.completed_at !== "string")
  ) {
    return null;
  }

  if (isVagueSceneReviewText(obj.realism_summary)) return null;

  const strengths = obj.authenticity_strengths
    .map(parseAuthenticityPoint)
    .filter((item): item is MilitaryExpertSceneAuthenticityPoint => item !== null);
  if (strengths.length !== obj.authenticity_strengths.length) return null;

  const concerns = obj.authenticity_concerns
    .map(parseAuthenticityPoint)
    .filter((item): item is MilitaryExpertSceneAuthenticityPoint => item !== null);
  if (concerns.length !== obj.authenticity_concerns.length) return null;

  const supporting = obj.supporting_evidence
    .map(parseEvidenceItem)
    .filter((item): item is MilitaryExpertSceneEvidenceItem => item !== null);
  if (supporting.length !== obj.supporting_evidence.length) return null;

  const contrary = obj.contrary_evidence
    .map(parseEvidenceItem)
    .filter((item): item is MilitaryExpertSceneEvidenceItem => item !== null);

  const suggestions = obj.safe_editorial_suggestions
    .map(parseEditorialSuggestion)
    .filter((item): item is MilitaryExpertSceneEditorialSuggestion => item !== null);
  if (suggestions.length !== obj.safe_editorial_suggestions.length) return null;

  const providerMetadata = parseProviderMetadata(obj.provider_metadata);

  return Object.freeze({
    contract_version: MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
    scene_review_id: obj.scene_review_id,
    inventory_id: obj.inventory_id,
    selection_snapshot_id: obj.selection_snapshot_id,
    scene_id: obj.scene_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    workflow_id: obj.workflow_id,
    locator,
    scene_types: Object.freeze([...(obj.scene_types as MilitaryExpertSceneType[])]),
    action_categories: Object.freeze([
      ...(obj.action_categories as MilitaryExpertActionCategory[]),
    ]),
    participants: Object.freeze([...(obj.participants as string[])]),
    review_status: obj.review_status as MilitaryExpertSceneReviewStatus,
    authenticity_strengths: Object.freeze(strengths),
    authenticity_concerns: Object.freeze(concerns),
    supporting_evidence: Object.freeze(supporting),
    contrary_evidence: Object.freeze(contrary),
    safe_editorial_suggestions: Object.freeze(suggestions),
    realism_summary: obj.realism_summary.trim(),
    confidence: obj.confidence as MilitaryExpertSceneConfidenceLevel,
    category_tags: Object.freeze([...(obj.category_tags as MilitaryExpertSceneCategoryTag[])]),
    provider_metadata: providerMetadata,
    parsed_review_hash: obj.parsed_review_hash,
    retry_count: obj.retry_count,
    repair_count: obj.repair_count,
    created_at: obj.created_at,
    completed_at: (obj.completed_at as string | null) ?? null,
  });
}

export function hashMilitaryExpertSceneReviewDocument(
  doc: MilitaryExpertSceneReviewDocument,
): string {
  return hashCanonicalOutput({
    contract_version: doc.contract_version,
    scene_review_id: doc.scene_review_id,
    scene_id: doc.scene_id,
    review_status: doc.review_status,
    authenticity_strengths: doc.authenticity_strengths,
    authenticity_concerns: doc.authenticity_concerns,
    supporting_evidence: doc.supporting_evidence,
    contrary_evidence: doc.contrary_evidence,
    safe_editorial_suggestions: doc.safe_editorial_suggestions,
    realism_summary: doc.realism_summary,
    confidence: doc.confidence,
    category_tags: doc.category_tags,
  });
}

export function newSceneReviewId(sceneId: string): string {
  return `sr_${sceneId.toLowerCase().replace(/[^a-z0-9-]/g, "")}_${Date.now().toString(36)}`;
}
