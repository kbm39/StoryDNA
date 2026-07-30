/**
 * Military Expert V2 cross-scene synthesis contract.
 * Version: military_expert_v2_synthesis@v1
 */

import { hashCanonicalOutput } from "@/lib/expert-review-engine/canonical-output.ts";
import {
  MILITARY_EXPERT_SCENE_CATEGORY_TAGS,
  MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_SCENE_DETERMINATIONS,
  MILITARY_EXPERT_REVISION_SIGNIFICANCE,
  type MilitaryExpertSceneCategoryTag,
  type MilitaryExpertSceneConfidenceLevel,
  type MilitaryExpertSceneDetermination,
  type MilitaryExpertRevisionSignificance,
} from "./scene-review-contract.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION =
  "military_expert_v2_synthesis@v1" as const;

export const MILITARY_EXPERT_SYNTHESIS_KINDS = [
  "single_scene",
  "cross_scene_pattern",
  "book_level",
] as const;

export type MilitaryExpertSynthesisKind = (typeof MILITARY_EXPERT_SYNTHESIS_KINDS)[number];

export interface MilitaryExpertSynthesisFinding {
  readonly finding_id: string;
  readonly title: string;
  readonly plain_english_explanation: string;
  readonly source_scene_ids: readonly string[];
  readonly source_scene_review_ids: readonly string[];
  readonly best_locators: readonly string[];
  readonly military_domains: readonly MilitaryExpertSceneCategoryTag[];
  readonly evidence_summary: string;
  readonly why_it_matters: string;
  readonly revision_significance: MilitaryExpertRevisionSignificance;
  readonly confidence: MilitaryExpertSceneConfidenceLevel;
  readonly contrary_evidence_summary: string;
  readonly safe_editorial_guidance: string;
  readonly determination: MilitaryExpertSceneDetermination;
  readonly synthesis_kind: MilitaryExpertSynthesisKind;
}

export interface MilitaryExpertSynthesisRecurringItem {
  readonly title: string;
  readonly explanation: string;
  readonly source_scene_ids: readonly string[];
}

export interface MilitaryExpertSynthesisCoverageSummary {
  readonly inventory_scene_count: number;
  readonly selected_scene_count: number;
  readonly terminal_scene_count: number;
  readonly complete_scene_count: number;
  readonly insufficient_evidence_count: number;
  readonly not_selected_scene_count: number;
  readonly scope_statement: string;
}

export interface MilitaryExpertSynthesisProviderMetadata {
  readonly model: string;
  readonly provider: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd: number;
  readonly correlation_id: string;
  readonly captured_at: string;
}

export interface MilitaryExpertV2SynthesisDocument {
  readonly contract_version: typeof MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION;
  readonly synthesis_id: string;
  readonly inventory_id: string;
  readonly selection_snapshot_id: string;
  readonly manuscript_id: string;
  readonly manuscript_version_id: string;
  readonly source_scene_review_ids: readonly string[];
  readonly selected_scene_count: number;
  readonly terminal_scene_count: number;
  readonly complete_scene_count: number;
  readonly insufficient_evidence_count: number;
  readonly recurring_strengths: readonly MilitaryExpertSynthesisRecurringItem[];
  readonly recurring_concerns: readonly MilitaryExpertSynthesisRecurringItem[];
  readonly single_scene_findings: readonly MilitaryExpertSynthesisFinding[];
  readonly cross_scene_findings: readonly MilitaryExpertSynthesisFinding[];
  readonly top_priority_findings: readonly string[];
  readonly author_review_required_items: readonly string[];
  readonly coverage_summary: MilitaryExpertSynthesisCoverageSummary;
  readonly overall_authenticity_assessment: string;
  readonly top_revision_priorities: readonly string[];
  readonly methodology_scope_statement: string;
  readonly provider_metadata: MilitaryExpertSynthesisProviderMetadata | null;
  readonly parsed_hash: string;
  readonly created_at: string;
  readonly completed_at: string | null;
}

const KIND_SET = new Set<string>(MILITARY_EXPERT_SYNTHESIS_KINDS);
const CONFIDENCE_SET = new Set<string>(MILITARY_EXPERT_SCENE_CONFIDENCE_LEVELS);
const DETERMINATION_SET = new Set<string>(MILITARY_EXPERT_SCENE_DETERMINATIONS);
const SIGNIFICANCE_SET = new Set<string>(MILITARY_EXPERT_REVISION_SIGNIFICANCE);
const CATEGORY_SET = new Set<string>(MILITARY_EXPERT_SCENE_CATEGORY_TAGS);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseRecurringItem(raw: unknown): MilitaryExpertSynthesisRecurringItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.title) || !isNonEmptyString(obj.explanation)) return null;
  if (!isStringArray(obj.source_scene_ids) || obj.source_scene_ids.length === 0) return null;
  return Object.freeze({
    title: obj.title.trim(),
    explanation: obj.explanation.trim(),
    source_scene_ids: Object.freeze([...obj.source_scene_ids]),
  });
}

function parseFinding(raw: unknown): MilitaryExpertSynthesisFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(obj.finding_id) ||
    !isNonEmptyString(obj.title) ||
    !isNonEmptyString(obj.plain_english_explanation) ||
    !isStringArray(obj.source_scene_ids) ||
    obj.source_scene_ids.length === 0 ||
    !isStringArray(obj.source_scene_review_ids) ||
    obj.source_scene_review_ids.length === 0 ||
    !isStringArray(obj.best_locators) ||
    !Array.isArray(obj.military_domains) ||
    !obj.military_domains.every((d) => typeof d === "string" && CATEGORY_SET.has(d)) ||
    !isNonEmptyString(obj.evidence_summary) ||
    !isNonEmptyString(obj.why_it_matters) ||
    !SIGNIFICANCE_SET.has(String(obj.revision_significance)) ||
    !CONFIDENCE_SET.has(String(obj.confidence)) ||
    typeof obj.contrary_evidence_summary !== "string" ||
    !isNonEmptyString(obj.safe_editorial_guidance) ||
    !DETERMINATION_SET.has(String(obj.determination)) ||
    !KIND_SET.has(String(obj.synthesis_kind))
  ) {
    return null;
  }
  return Object.freeze({
    finding_id: obj.finding_id.trim(),
    title: obj.title.trim(),
    plain_english_explanation: obj.plain_english_explanation.trim(),
    source_scene_ids: Object.freeze([...obj.source_scene_ids]),
    source_scene_review_ids: Object.freeze([...obj.source_scene_review_ids]),
    best_locators: Object.freeze([...(obj.best_locators as string[])]),
    military_domains: Object.freeze([
      ...(obj.military_domains as MilitaryExpertSceneCategoryTag[]),
    ]),
    evidence_summary: obj.evidence_summary.trim(),
    why_it_matters: obj.why_it_matters.trim(),
    revision_significance: obj.revision_significance as MilitaryExpertRevisionSignificance,
    confidence: obj.confidence as MilitaryExpertSceneConfidenceLevel,
    contrary_evidence_summary: obj.contrary_evidence_summary.trim(),
    safe_editorial_guidance: obj.safe_editorial_guidance.trim(),
    determination: obj.determination as MilitaryExpertSceneDetermination,
    synthesis_kind: obj.synthesis_kind as MilitaryExpertSynthesisKind,
  });
}

function parseCoverageSummary(raw: unknown): MilitaryExpertSynthesisCoverageSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.inventory_scene_count !== "number" ||
    typeof obj.selected_scene_count !== "number" ||
    typeof obj.terminal_scene_count !== "number" ||
    typeof obj.complete_scene_count !== "number" ||
    typeof obj.insufficient_evidence_count !== "number" ||
    typeof obj.not_selected_scene_count !== "number" ||
    !isNonEmptyString(obj.scope_statement)
  ) {
    return null;
  }
  return Object.freeze({
    inventory_scene_count: obj.inventory_scene_count,
    selected_scene_count: obj.selected_scene_count,
    terminal_scene_count: obj.terminal_scene_count,
    complete_scene_count: obj.complete_scene_count,
    insufficient_evidence_count: obj.insufficient_evidence_count,
    not_selected_scene_count: obj.not_selected_scene_count,
    scope_statement: obj.scope_statement.trim(),
  });
}

function parseProviderMetadata(raw: unknown): MilitaryExpertSynthesisProviderMetadata | null {
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

export function diagnoseSynthesisParseFailure(raw: unknown): readonly string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    errors.push("root_not_object");
    return errors;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.contract_version !== MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION) {
    errors.push(`contract_version:${String(obj.contract_version)}`);
  }
  for (const key of [
    "synthesis_id",
    "inventory_id",
    "selection_snapshot_id",
    "manuscript_id",
    "manuscript_version_id",
    "overall_authenticity_assessment",
    "methodology_scope_statement",
    "parsed_hash",
    "created_at",
  ]) {
    if (!isNonEmptyString(obj[key])) errors.push(`missing_${key}`);
  }
  for (const key of [
    "selected_scene_count",
    "terminal_scene_count",
    "complete_scene_count",
    "insufficient_evidence_count",
  ]) {
    if (typeof obj[key] !== "number") errors.push(`bad_number_${key}:${typeof obj[key]}`);
  }
  if (!isStringArray(obj.source_scene_review_ids)) errors.push("bad_source_scene_review_ids");
  if (!isStringArray(obj.top_priority_findings)) errors.push("bad_top_priority_findings");
  if (!isStringArray(obj.author_review_required_items)) errors.push("bad_author_review_required_items");
  if (!isStringArray(obj.top_revision_priorities)) errors.push("bad_top_revision_priorities");
  if (!Array.isArray(obj.recurring_strengths)) errors.push("bad_recurring_strengths");
  if (!Array.isArray(obj.recurring_concerns)) errors.push("bad_recurring_concerns");
  if (!Array.isArray(obj.single_scene_findings)) errors.push("bad_single_scene_findings");
  if (!Array.isArray(obj.cross_scene_findings)) errors.push("bad_cross_scene_findings");
  if (!parseCoverageSummary(obj.coverage_summary)) errors.push("bad_coverage_summary");
  if (Array.isArray(obj.single_scene_findings) && Array.isArray(obj.cross_scene_findings)) {
    const single = obj.single_scene_findings.map(parseFinding).filter(Boolean);
    const cross = obj.cross_scene_findings.map(parseFinding).filter(Boolean);
    if (single.length + cross.length === 0) errors.push("no_valid_findings");
    if (single.length !== obj.single_scene_findings.length) {
      errors.push(`invalid_single_scene_findings:${obj.single_scene_findings.length - single.length}`);
    }
    if (cross.length !== obj.cross_scene_findings.length) {
      errors.push(`invalid_cross_scene_findings:${obj.cross_scene_findings.length - cross.length}`);
    }
  }
  return Object.freeze(errors);
}

export function parseMilitaryExpertV2SynthesisDocument(
  raw: unknown,
): MilitaryExpertV2SynthesisDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    obj.contract_version !== MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION ||
    !isNonEmptyString(obj.synthesis_id) ||
    !isNonEmptyString(obj.inventory_id) ||
    !isNonEmptyString(obj.selection_snapshot_id) ||
    !isNonEmptyString(obj.manuscript_id) ||
    !isNonEmptyString(obj.manuscript_version_id) ||
    !isStringArray(obj.source_scene_review_ids) ||
    typeof obj.selected_scene_count !== "number" ||
    typeof obj.terminal_scene_count !== "number" ||
    typeof obj.complete_scene_count !== "number" ||
    typeof obj.insufficient_evidence_count !== "number" ||
    !Array.isArray(obj.recurring_strengths) ||
    !Array.isArray(obj.recurring_concerns) ||
    !Array.isArray(obj.single_scene_findings) ||
    !Array.isArray(obj.cross_scene_findings) ||
    !isStringArray(obj.top_priority_findings) ||
    !isStringArray(obj.author_review_required_items) ||
    !isNonEmptyString(obj.overall_authenticity_assessment) ||
    !isStringArray(obj.top_revision_priorities) ||
    !isNonEmptyString(obj.methodology_scope_statement) ||
    !isNonEmptyString(obj.parsed_hash) ||
    !isNonEmptyString(obj.created_at) ||
    (obj.completed_at !== null && typeof obj.completed_at !== "string")
  ) {
    return null;
  }

  const coverage = parseCoverageSummary(obj.coverage_summary);
  if (!coverage) return null;

  const recurringStrengths = obj.recurring_strengths
    .map(parseRecurringItem)
    .filter((item): item is MilitaryExpertSynthesisRecurringItem => item !== null);

  const recurringConcerns = obj.recurring_concerns
    .map(parseRecurringItem)
    .filter((item): item is MilitaryExpertSynthesisRecurringItem => item !== null);

  const singleScene = obj.single_scene_findings
    .map(parseFinding)
    .filter((item): item is MilitaryExpertSynthesisFinding => item !== null);

  const crossScene = obj.cross_scene_findings
    .map(parseFinding)
    .filter((item): item is MilitaryExpertSynthesisFinding => item !== null);

  if (singleScene.length + crossScene.length === 0) return null;

  return Object.freeze({
    contract_version: MILITARY_EXPERT_V2_SYNTHESIS_CONTRACT_VERSION,
    synthesis_id: obj.synthesis_id,
    inventory_id: obj.inventory_id,
    selection_snapshot_id: obj.selection_snapshot_id,
    manuscript_id: obj.manuscript_id,
    manuscript_version_id: obj.manuscript_version_id,
    source_scene_review_ids: Object.freeze([...obj.source_scene_review_ids]),
    selected_scene_count: obj.selected_scene_count,
    terminal_scene_count: obj.terminal_scene_count,
    complete_scene_count: obj.complete_scene_count,
    insufficient_evidence_count: obj.insufficient_evidence_count,
    recurring_strengths: Object.freeze(recurringStrengths),
    recurring_concerns: Object.freeze(recurringConcerns),
    single_scene_findings: Object.freeze(singleScene),
    cross_scene_findings: Object.freeze(crossScene),
    top_priority_findings: Object.freeze([...obj.top_priority_findings]),
    author_review_required_items: Object.freeze([...obj.author_review_required_items]),
    coverage_summary: coverage,
    overall_authenticity_assessment: obj.overall_authenticity_assessment.trim(),
    top_revision_priorities: Object.freeze([...obj.top_revision_priorities]),
    methodology_scope_statement: obj.methodology_scope_statement.trim(),
    provider_metadata: parseProviderMetadata(obj.provider_metadata),
    parsed_hash: obj.parsed_hash,
    created_at: obj.created_at,
    completed_at: (obj.completed_at as string | null) ?? null,
  });
}

export function hashMilitaryExpertV2SynthesisDocument(
  doc: MilitaryExpertV2SynthesisDocument,
): string {
  return hashCanonicalOutput({
    contract_version: doc.contract_version,
    synthesis_id: doc.synthesis_id,
    selection_snapshot_id: doc.selection_snapshot_id,
    source_scene_review_ids: doc.source_scene_review_ids,
    single_scene_findings: doc.single_scene_findings,
    cross_scene_findings: doc.cross_scene_findings,
    top_priority_findings: doc.top_priority_findings,
    overall_authenticity_assessment: doc.overall_authenticity_assessment,
  });
}

export function newSynthesisId(snapshotId: string): string {
  const slug = snapshotId.replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  return `syn_${slug}_${Date.now().toString(36)}`;
}

export function allSynthesisFindings(
  doc: MilitaryExpertV2SynthesisDocument,
): readonly MilitaryExpertSynthesisFinding[] {
  return Object.freeze([...doc.single_scene_findings, ...doc.cross_scene_findings]);
}
