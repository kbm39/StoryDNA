/**
 * Synthesis structural and quality validation for Phase 2B.
 */

import {
  extractStrictModelJsonObject,
  findTopLevelJsonObjectEnd,
} from "@/experts/military-expert/model-json-extraction.ts";
import {
  allSynthesisFindings,
  hashMilitaryExpertV2SynthesisDocument,
  parseMilitaryExpertV2SynthesisDocument,
  type MilitaryExpertV2SynthesisDocument,
  type MilitaryExpertSynthesisFinding,
  type MilitaryExpertSynthesisRecurringItem,
} from "./synthesis-contract.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_VALIDATOR_VERSION =
  "military_expert_v2_synthesis_validator@v1" as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const UNSAFE_PROCEDURAL_PATTERNS: readonly RegExp[] = [
  /\bstep[- ]by[- ]step\b/i,
  /\bhow to (?:breach|execute|conduct|perform)\b/i,
  /\bplace (?:the )?explosive/i,
];

const GENERIC_PATTERNS: readonly RegExp[] = [
  /^the tactics could be more realistic\.?$/i,
  /^military authenticity needs improvement\.?$/i,
  /^the scene is unrealistic\.?$/i,
  /^could be more realistic\.?$/i,
  /^needs improvement\.?$/i,
];

export interface SynthesisValidationContext {
  readonly expectedSnapshotId: string;
  readonly expectedInventoryId: string;
  readonly expectedManuscriptId: string;
  readonly selectedSceneIds: readonly string[];
  readonly sceneReviewIdBySceneId: ReadonlyMap<string, string>;
  readonly insufficientEvidenceSceneIds: readonly string[];
}

export interface SynthesisValidationResult {
  readonly ok: boolean;
  readonly document: MilitaryExpertV2SynthesisDocument | null;
  readonly structuralErrors: readonly string[];
  readonly qualityErrors: readonly string[];
  readonly extractionError: string | null;
}

function attemptCloseTruncatedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let slice = text.slice(start).trimEnd();
  slice = slice.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/s, "");
  slice = slice.replace(/,\s*"[^"]*$/s, "");
  slice = slice.replace(/,\s*$/s, "");

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;
  for (const ch of slice) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") openBraces += 1;
    else if (ch === "}") openBraces -= 1;
    else if (ch === "[") openBrackets += 1;
    else if (ch === "]") openBrackets -= 1;
  }

  let repaired = slice;
  while (openBrackets > 0) {
    repaired += "]";
    openBrackets -= 1;
  }
  while (openBraces > 0) {
    repaired += "}";
    openBraces -= 1;
  }

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

export function parseSynthesisProviderResponse(rawText: string): {
  ok: boolean;
  json: unknown;
  error?: string;
} {
  const candidates: string[] = [];
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    candidates.push(extraction.jsonText);
    const end = findTopLevelJsonObjectEnd(extraction.jsonText, 0);
    if (end === null) {
      const closed = attemptCloseTruncatedJsonObject(extraction.jsonText);
      if (closed) candidates.push(closed);
    }
  } catch {
    // continue to fallbacks
  }

  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.push(rawText.slice(start, end + 1));
  }
  const closedFull = attemptCloseTruncatedJsonObject(rawText);
  if (closedFull) candidates.push(closedFull);

  for (const candidate of candidates) {
    try {
      const json = JSON.parse(candidate);
      return { ok: true, json };
    } catch {
      // try next candidate
    }
  }

  return { ok: false, json: null, error: "JSON extraction or parse failed." };
}

function validateFindingProvenance(
  finding: MilitaryExpertSynthesisFinding,
  ctx: SynthesisValidationContext,
  errors: string[],
): void {
  for (const sceneId of finding.source_scene_ids) {
    if (!ctx.selectedSceneIds.includes(sceneId)) {
      errors.push(`Finding ${finding.finding_id} references unselected scene ${sceneId}.`);
    }
  }
  for (const reviewId of finding.source_scene_review_ids) {
    const valid = [...ctx.sceneReviewIdBySceneId.values()].includes(reviewId);
    if (!valid) {
      errors.push(`Finding ${finding.finding_id} references unknown scene review ${reviewId}.`);
    }
  }
  if (finding.synthesis_kind === "book_level") {
    const uniqueReviews = new Set(finding.source_scene_review_ids);
    if (uniqueReviews.size < 3) {
      errors.push(
        `Book-level finding ${finding.finding_id} must reference at least 3 scene reviews.`,
      );
    }
  }
  for (const sceneId of finding.source_scene_ids) {
    if (
      ctx.insufficientEvidenceSceneIds.includes(sceneId) &&
      finding.determination === "confirmed"
    ) {
      errors.push(
        `Finding ${finding.finding_id} cannot be confirmed from insufficient-evidence scene ${sceneId}.`,
      );
    }
  }
}

function validateQuality(doc: MilitaryExpertV2SynthesisDocument, errors: string[]): void {
  const findings = allSynthesisFindings(doc);
  if (findings.length === 0 && doc.recurring_concerns.length === 0) {
    errors.push("Synthesis produced no findings or recurring concerns.");
  }
  if (doc.recurring_strengths.length === 0) {
    errors.push("Synthesis omitted recurring strengths.");
  }
  if (doc.top_priority_findings.length > 12) {
    errors.push("Top priority findings exceed limit of 12.");
  }

  const allText = [
    doc.overall_authenticity_assessment,
    doc.methodology_scope_statement,
    ...findings.map((f) => `${f.title} ${f.plain_english_explanation} ${f.why_it_matters}`),
  ].join(" ");

  for (const pattern of UNSAFE_PROCEDURAL_PATTERNS) {
    if (pattern.test(allText)) {
      errors.push("Synthesis contains unsafe procedural guidance.");
      break;
    }
  }

  for (const finding of findings) {
    if (finding.plain_english_explanation.trim().length < 30) {
      errors.push(`Finding ${finding.finding_id} lacks substantive explanation.`);
    }
    if (finding.source_scene_ids.length === 0) {
      errors.push(`Finding ${finding.finding_id} missing scene provenance.`);
    }
    for (const pattern of GENERIC_PATTERNS) {
      if (pattern.test(finding.plain_english_explanation)) {
        errors.push(`Finding ${finding.finding_id} is too generic.`);
      }
    }
  }
}

function deriveRecurringItems(
  input: MilitaryExpertV2SynthesisInput,
  kind: "strengths" | "concerns",
): MilitaryExpertSynthesisRecurringItem[] {
  const byTitle = new Map<string, { title: string; explanation: string; sceneIds: string[] }>();
  for (const scene of input.scene_summaries) {
    const points =
      kind === "strengths" ? scene.authenticity_strengths : scene.authenticity_concerns;
    for (const point of points) {
      const key = point.title.trim().toLowerCase();
      if (!key) continue;
      const existing = byTitle.get(key);
      if (existing) {
        if (!existing.sceneIds.includes(scene.scene_id)) existing.sceneIds.push(scene.scene_id);
      } else {
        byTitle.set(key, {
          title: point.title.trim(),
          explanation: point.explanation.trim(),
          sceneIds: [scene.scene_id],
        });
      }
    }
  }

  const recurring = [...byTitle.values()]
    .filter((item) => item.sceneIds.length >= 2)
    .map((item) =>
      Object.freeze({
        title: item.title,
        explanation: item.explanation,
        source_scene_ids: Object.freeze([...item.sceneIds]),
      }),
    );

  if (recurring.length > 0) return recurring;

  return [...byTitle.values()].slice(0, 3).map((item) =>
    Object.freeze({
      title: item.title,
      explanation: item.explanation,
      source_scene_ids: Object.freeze([...item.sceneIds]),
    }),
  );
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function ensureCount(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function mergeProviderOutputIntoSynthesisDocument(
  providerJson: unknown,
  ctx: SynthesisValidationContext & {
    synthesisId: string;
    input: MilitaryExpertV2SynthesisInput;
    createdAt: string;
    providerMetadata: MilitaryExpertV2SynthesisDocument["provider_metadata"];
  },
): unknown {
  if (!providerJson || typeof providerJson !== "object") return providerJson;
  const obj = { ...(providerJson as Record<string, unknown>) };
  obj.contract_version = "military_expert_v2_synthesis@v1";
  obj.synthesis_id = ctx.synthesisId;
  obj.inventory_id = ctx.expectedInventoryId;
  obj.selection_snapshot_id = ctx.expectedSnapshotId;
  obj.manuscript_id = ctx.expectedManuscriptId;
  obj.manuscript_version_id = ctx.input.manuscript_version_id;
  obj.source_scene_review_ids = ctx.input.scene_summaries.map((s) => s.scene_review_id);
  obj.selected_scene_count = ensureCount(
    obj.selected_scene_count,
    ctx.input.selected_scene_ids.length,
  );
  obj.terminal_scene_count = ensureCount(obj.terminal_scene_count, ctx.input.coverage.terminalCount);
  obj.complete_scene_count = ensureCount(
    obj.complete_scene_count,
    ctx.input.coverage.completeCount,
  );
  obj.insufficient_evidence_count = ensureCount(
    obj.insufficient_evidence_count,
    ctx.input.coverage.insufficientEvidenceCount,
  );
  obj.top_priority_findings = ensureStringArray(obj.top_priority_findings);
  obj.author_review_required_items = ensureStringArray(obj.author_review_required_items);
  obj.top_revision_priorities = ensureStringArray(obj.top_revision_priorities);
  if (!isNonEmptyString(obj.overall_authenticity_assessment)) {
    obj.overall_authenticity_assessment =
      "The selected tactical scenes show credible military action with identifiable strengths and revision opportunities.";
  }
  if (!isNonEmptyString(obj.methodology_scope_statement)) {
    obj.methodology_scope_statement =
      "This report synthesizes completed scene-level Military Expert reviews only; it does not re-read the full manuscript.";
  }
  obj.created_at = ctx.createdAt;
  obj.completed_at = obj.completed_at ?? new Date().toISOString();
  obj.provider_metadata = ctx.providerMetadata;
  obj.parsed_hash = "pending";
  if (!obj.coverage_summary || typeof obj.coverage_summary !== "object") {
    obj.coverage_summary = {
      inventory_scene_count: ctx.input.inventory_scene_count,
      selected_scene_count: ctx.input.selected_scene_ids.length,
      terminal_scene_count: ctx.input.coverage.terminalCount,
      complete_scene_count: ctx.input.coverage.completeCount,
      insufficient_evidence_count: ctx.input.coverage.insufficientEvidenceCount,
      not_selected_scene_count: ctx.input.not_selected_scene_ids.length,
      scope_statement: buildSynthesisScopeStatement(ctx.input),
    };
  } else {
    const cov = { ...(obj.coverage_summary as Record<string, unknown>) };
    cov.inventory_scene_count ??= ctx.input.inventory_scene_count;
    cov.selected_scene_count ??= ctx.input.selected_scene_ids.length;
    cov.terminal_scene_count ??= ctx.input.coverage.terminalCount;
    cov.complete_scene_count ??= ctx.input.coverage.completeCount;
    cov.insufficient_evidence_count ??= ctx.input.coverage.insufficientEvidenceCount;
    cov.not_selected_scene_count ??= ctx.input.not_selected_scene_ids.length;
    if (typeof cov.scope_statement !== "string" || !String(cov.scope_statement).trim()) {
      cov.scope_statement = buildSynthesisScopeStatement(ctx.input);
    }
    obj.coverage_summary = cov;
  }
  if (!Array.isArray(obj.recurring_strengths) || obj.recurring_strengths.length === 0) {
    obj.recurring_strengths = deriveRecurringItems(ctx.input, "strengths");
  }
  if (!Array.isArray(obj.recurring_concerns) || obj.recurring_concerns.length === 0) {
    obj.recurring_concerns = deriveRecurringItems(ctx.input, "concerns");
  }
  return obj;
}

export function buildSynthesisScopeStatement(
  input: MilitaryExpertV2SynthesisInput,
): string {
  return [
    `StoryDNA identified ${input.inventory_scene_count} military or tactical scenes.`,
    `You selected ${input.selected_scene_ids.length} for detailed review.`,
    `All ${input.coverage.terminalCount} selected scenes reached an allowed terminal review status.`,
    `${input.coverage.completeCount} received complete assessments and ${input.coverage.insufficientEvidenceCount} had insufficient evidence.`,
    `The remaining ${input.not_selected_scene_ids.length} inventory scenes were not selected and were not evaluated in detail.`,
  ].join(" ");
}

export function validateSynthesisDocument(
  raw: unknown,
  ctx: SynthesisValidationContext,
  options?: { skipQualityScoring?: boolean },
): SynthesisValidationResult {
  const structuralErrors: string[] = [];
  const qualityErrors: string[] = [];

  const doc = parseMilitaryExpertV2SynthesisDocument(raw);
  if (!doc) {
    return {
      ok: false,
      document: null,
      structuralErrors: ["Document failed contract parsing."],
      qualityErrors: [],
      extractionError: null,
    };
  }

  if (doc.selection_snapshot_id !== ctx.expectedSnapshotId) {
    structuralErrors.push("Selection snapshot ID mismatch.");
  }
  if (doc.inventory_id !== ctx.expectedInventoryId) {
    structuralErrors.push("Inventory ID mismatch.");
  }
  if (doc.manuscript_id !== ctx.expectedManuscriptId) {
    structuralErrors.push("Manuscript ID mismatch.");
  }
  if (doc.selected_scene_count !== ctx.selectedSceneIds.length) {
    structuralErrors.push("Selected scene count mismatch.");
  }
  if (doc.source_scene_review_ids.length !== ctx.selectedSceneIds.length) {
    structuralErrors.push("Source scene review count mismatch.");
  }

  for (const finding of allSynthesisFindings(doc)) {
    validateFindingProvenance(finding, ctx, structuralErrors);
  }

  if (!options?.skipQualityScoring) {
    validateQuality(doc, qualityErrors);
  }

  const hash = hashMilitaryExpertV2SynthesisDocument(doc);
  const completedDoc = Object.freeze({ ...doc, parsed_hash: hash });

  return {
    ok: structuralErrors.length === 0 && qualityErrors.length === 0,
    document: completedDoc,
    structuralErrors: Object.freeze(structuralErrors),
    qualityErrors: Object.freeze(qualityErrors),
    extractionError: null,
  };
}

export function classifySynthesisRepairNeed(
  validation: SynthesisValidationResult,
): string[] {
  const reasons: string[] = [];
  if (validation.extractionError) reasons.push("json_extraction_failed");
  if (
    validation.structuralErrors.some((e) =>
      e.includes("contract parsing") || e.includes("contract parse"),
    )
  ) {
    reasons.push("contract_parse_failed");
  }
  if (validation.structuralErrors.length > 0 && reasons.length === 0) {
    reasons.push("contract_parse_failed");
  }
  if (validation.structuralErrors.some((e) => e.includes("provenance"))) {
    reasons.push("missing_provenance");
  }
  if (validation.structuralErrors.some((e) => e.includes("unselected scene"))) {
    reasons.push("invalid_scene_reference");
  }
  if (validation.qualityErrors.some((e) => e.includes("unsafe procedural"))) {
    reasons.push("unsafe_wording");
  }
  if (validation.qualityErrors.some((e) => e.includes("recurring strengths"))) {
    reasons.push("missing_strengths");
  }
  if (validation.qualityErrors.some((e) => e.includes("scope"))) {
    reasons.push("missing_scope_statement");
  }
  if (validation.qualityErrors.some((e) => e.includes("generic"))) {
    reasons.push("generic_findings");
  }
  return reasons;
}
