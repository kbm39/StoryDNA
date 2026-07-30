/**
 * Parse provider-returned scene review JSON (subset of full contract).
 */

import {
  MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_SCENE_DETERMINATIONS,
  MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
  MILITARY_EXPERT_SCENE_REVIEW_STATUSES,
  MILITARY_EXPERT_REVISION_SIGNIFICANCE,
  MILITARY_EXPERT_SCENE_CATEGORY_TAGS,
  isVagueSceneReviewText,
  type MilitaryExpertSceneAuthenticityPoint,
  type MilitaryExpertSceneCategoryTag,
  type MilitaryExpertSceneConfidenceLevel,
  type MilitaryExpertSceneEditorialSuggestion,
  type MilitaryExpertSceneEvidenceItem,
  type MilitaryExpertSceneReviewStatus,
} from "./scene-review-contract.ts";

export interface MilitaryExpertSceneReviewProviderOutput {
  readonly review_status: MilitaryExpertSceneReviewStatus;
  readonly authenticity_strengths: readonly MilitaryExpertSceneAuthenticityPoint[];
  readonly authenticity_concerns: readonly MilitaryExpertSceneAuthenticityPoint[];
  readonly supporting_evidence: readonly MilitaryExpertSceneEvidenceItem[];
  readonly contrary_evidence: readonly MilitaryExpertSceneEvidenceItem[];
  readonly safe_editorial_suggestions: readonly MilitaryExpertSceneEditorialSuggestion[];
  readonly realism_summary: string;
  readonly confidence: MilitaryExpertSceneConfidenceLevel;
  readonly category_tags: readonly MilitaryExpertSceneCategoryTag[];
}

const TERMINAL_PROVIDER_STATUSES = new Set<string>([
  "complete",
  "insufficient_evidence",
  "outside_expertise",
]);
const CONFIDENCE_SET = new Set<string>(MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS);
const DETERMINATION_SET = new Set<string>(MILITARY_EXPERT_SCENE_DETERMINATIONS);
const SIGNIFICANCE_SET = new Set<string>(MILITARY_EXPERT_REVISION_SIGNIFICANCE);
const CATEGORY_TAG_SET = new Set<string>(MILITARY_EXPERT_SCENE_CATEGORY_TAGS);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnum(value: unknown, allowed: Set<string>): boolean {
  return typeof value === "string" && allowed.has(value);
}

function isEnumArray(value: unknown, allowed: Set<string>): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isEnum(item, allowed));
}

const DOMAIN_ALIASES: Record<string, MilitaryExpertSceneCategoryTag> = {
  firefight: "firefight_or_battle",
  battle: "firefight_or_battle",
  firefight_or_battle: "firefight_or_battle",
  movement: "movement_and_cover",
  movement_and_cover: "movement_and_cover",
  cover: "movement_and_cover",
  breach: "room_entry_or_breach",
  room_entry: "room_entry_or_breach",
  room_entry_or_breach: "room_entry_or_breach",
  team_coordination: "team_coordination",
  coordination: "team_coordination",
  command: "command_and_control",
  command_and_control: "command_and_control",
  communications: "radio_and_communications",
  radio: "radio_and_communications",
  radio_and_communications: "radio_and_communications",
  weapons: "weapons_handling",
  weapons_handling: "weapons_handling",
  timing: "timing_and_physical_realism",
  timing_and_physical_realism: "timing_and_physical_realism",
  physical_realism: "timing_and_physical_realism",
  convoy: "convoy_and_vehicle_contact",
  convoy_and_vehicle_contact: "convoy_and_vehicle_contact",
  vehicle: "convoy_and_vehicle_contact",
  aviation: "aviation",
  casualty: "casualty_response",
  casualty_response: "casualty_response",
  evacuation: "casualty_response",
  planning: "intelligence_and_planning",
  intelligence: "intelligence_and_planning",
  intelligence_and_planning: "intelligence_and_planning",
  culture: "military_culture",
  military_culture: "military_culture",
  chain_of_command: "military_culture",
  other: "other",
};

function normalizeDomain(value: unknown): MilitaryExpertSceneCategoryTag | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (CATEGORY_TAG_SET.has(key)) return key as MilitaryExpertSceneCategoryTag;
  return DOMAIN_ALIASES[key] ?? null;
}

function normalizeDomainArray(value: unknown): MilitaryExpertSceneCategoryTag[] {
  if (!Array.isArray(value)) return ["other"];
  const mapped = value.map(normalizeDomain).filter((d): d is MilitaryExpertSceneCategoryTag => d !== null);
  return mapped.length > 0 ? mapped : ["other"];
}
function parsePoint(raw: unknown): MilitaryExpertSceneAuthenticityPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const domains = normalizeDomainArray(obj.relevant_military_domains);
  if (
    !isNonEmptyString(obj.title) ||
    !isNonEmptyString(obj.scene_specific_explanation) ||
    !isNonEmptyString(obj.why_it_matters) ||
    !isNonEmptyString(obj.manuscript_evidence_locator)
  ) {
    return null;
  }
  if (
    isVagueSceneReviewText(obj.scene_specific_explanation) ||
    isVagueSceneReviewText(obj.why_it_matters)
  ) {
    return null;
  }
  const confidence = isEnum(obj.confidence, CONFIDENCE_SET)
    ? (obj.confidence as MilitaryExpertSceneConfidenceLevel)
    : "medium";
  const significance = isEnum(obj.revision_significance, SIGNIFICANCE_SET)
    ? (obj.revision_significance as import("./scene-review-contract.ts").MilitaryExpertRevisionSignificance)
    : "important";
  const determination = isEnum(obj.determination, DETERMINATION_SET)
    ? (obj.determination as import("./scene-review-contract.ts").MilitaryExpertSceneDetermination)
    : "author_review_required";

  return Object.freeze({
    title: obj.title.trim(),
    scene_specific_explanation: obj.scene_specific_explanation.trim(),
    why_it_matters: obj.why_it_matters.trim(),
    manuscript_evidence_locator: obj.manuscript_evidence_locator.trim(),
    relevant_military_domains: Object.freeze(domains),
    confidence,
    revision_significance: significance,
    determination,
  });
}

function parseEvidence(raw: unknown): MilitaryExpertSceneEvidenceItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const locator = isNonEmptyString(obj.excerpt_locator)
    ? obj.excerpt_locator.trim()
    : isNonEmptyString(obj.locator)
      ? obj.locator.trim()
      : "scene excerpt";
  const text = isNonEmptyString(obj.excerpt_text)
    ? obj.excerpt_text.trim()
    : isNonEmptyString(obj.text)
      ? obj.text.trim()
      : "(referenced in scene)";
  const relevance = isNonEmptyString(obj.relevance)
    ? obj.relevance.trim()
    : isNonEmptyString(obj.description)
      ? obj.description.trim()
      : "Supports scene-specific assessment.";
  return Object.freeze({
    excerpt_locator: locator,
    excerpt_text: text,
    relevance,
  });
}

function parseSuggestion(raw: unknown): MilitaryExpertSceneEditorialSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.suggestion) || !isNonEmptyString(obj.rationale)) return null;
  return Object.freeze({
    suggestion: obj.suggestion.trim(),
    rationale: obj.rationale.trim(),
    addresses_concern_title:
      typeof obj.addresses_concern_title === "string" ? obj.addresses_concern_title.trim() : null,
  });
}

export function parseMilitaryExpertSceneReviewProviderOutput(
  raw: unknown,
): MilitaryExpertSceneReviewProviderOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const status =
    typeof obj.review_status === "string" && TERMINAL_PROVIDER_STATUSES.has(obj.review_status)
      ? obj.review_status
      : "complete";

  if (!isNonEmptyString(obj.realism_summary)) {
    return null;
  }
  if (isVagueSceneReviewText(obj.realism_summary)) return null;

  const strengths = (Array.isArray(obj.authenticity_strengths) ? obj.authenticity_strengths : [])
    .map(parsePoint)
    .filter((p): p is MilitaryExpertSceneAuthenticityPoint => p !== null);

  const concerns = (Array.isArray(obj.authenticity_concerns) ? obj.authenticity_concerns : [])
    .map(parsePoint)
    .filter((p): p is MilitaryExpertSceneAuthenticityPoint => p !== null);

  const supporting = (Array.isArray(obj.supporting_evidence) ? obj.supporting_evidence : [])
    .map(parseEvidence)
    .filter((e): e is MilitaryExpertSceneEvidenceItem => e !== null);

  const contrary = (Array.isArray(obj.contrary_evidence) ? obj.contrary_evidence : [])
    .map(parseEvidence)
    .filter((e): e is MilitaryExpertSceneEvidenceItem => e !== null);

  const suggestions = (
    Array.isArray(obj.safe_editorial_suggestions) ? obj.safe_editorial_suggestions : []
  )
    .map(parseSuggestion)
    .filter((s): s is MilitaryExpertSceneEditorialSuggestion => s !== null);

  const categoryTags = normalizeDomainArray(obj.category_tags);

  return Object.freeze({
    review_status: status as MilitaryExpertSceneReviewStatus,
    authenticity_strengths: Object.freeze(strengths),
    authenticity_concerns: Object.freeze(concerns),
    supporting_evidence: Object.freeze(supporting),
    contrary_evidence: Object.freeze(contrary),
    safe_editorial_suggestions: Object.freeze(suggestions),
    realism_summary: obj.realism_summary.trim(),
    confidence: isEnum(obj.confidence, CONFIDENCE_SET)
      ? (obj.confidence as MilitaryExpertSceneConfidenceLevel)
      : "medium",
    category_tags: Object.freeze(categoryTags),
  });
}

export function mergeProviderOutputIntoReviewDocument(
  provider: MilitaryExpertSceneReviewProviderOutput,
  ctx: {
    sceneReviewId: string;
    inventoryId: string;
    selectionSnapshotId: string;
    sceneId: string;
    manuscriptId: string;
    manuscriptVersionId: string;
    workflowId: string;
    locator: import("./contracts.ts").MilitaryExpertSceneLocator;
    sceneTypes: readonly string[];
    actionCategories: readonly string[];
    participants: readonly string[];
    retryCount: number;
    repairCount: number;
    createdAt: string;
    providerMetadata: import("./scene-review-contract.ts").MilitaryExpertSceneReviewProviderMetadata | null;
    parsedReviewHash: string;
  },
): import("./scene-review-contract.ts").MilitaryExpertSceneReviewDocument {
  return Object.freeze({
    contract_version: MILITARY_EXPERT_SCENE_REVIEW_CONTRACT_VERSION,
    scene_review_id: ctx.sceneReviewId,
    inventory_id: ctx.inventoryId,
    selection_snapshot_id: ctx.selectionSnapshotId,
    scene_id: ctx.sceneId,
    manuscript_id: ctx.manuscriptId,
    manuscript_version_id: ctx.manuscriptVersionId,
    workflow_id: ctx.workflowId,
    locator: ctx.locator,
    scene_types: Object.freeze([...ctx.sceneTypes]) as import("./contracts.ts").MilitaryExpertSceneInventoryEntry["scene_types"],
    action_categories: Object.freeze([...ctx.actionCategories]) as import("./contracts.ts").MilitaryExpertSceneInventoryEntry["action_categories"],
    participants: Object.freeze([...ctx.participants]),
    review_status: provider.review_status,
    authenticity_strengths: provider.authenticity_strengths,
    authenticity_concerns: provider.authenticity_concerns,
    supporting_evidence: provider.supporting_evidence,
    contrary_evidence: provider.contrary_evidence,
    safe_editorial_suggestions: provider.safe_editorial_suggestions,
    realism_summary: provider.realism_summary,
    confidence: provider.confidence,
    category_tags: provider.category_tags,
    provider_metadata: ctx.providerMetadata,
    parsed_review_hash: ctx.parsedReviewHash,
    retry_count: ctx.retryCount,
    repair_count: ctx.repairCount,
    created_at: ctx.createdAt,
    completed_at: new Date().toISOString(),
  });
}
