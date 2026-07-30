/**
 * Synthesis structural and quality validation for Phase 2B.
 */

import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import {
  allSynthesisFindings,
  hashMilitaryExpertV2SynthesisDocument,
  parseMilitaryExpertV2SynthesisDocument,
  type MilitaryExpertV2SynthesisDocument,
  type MilitaryExpertSynthesisFinding,
} from "./synthesis-contract.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_VALIDATOR_VERSION =
  "military_expert_v2_synthesis_validator@v1" as const;

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

export function parseSynthesisProviderResponse(rawText: string): {
  ok: boolean;
  json: unknown;
  error?: string;
} {
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    const json = JSON.parse(extraction.jsonText);
    return { ok: true, json };
  } catch {
    // Lenient fallback: grab outermost object substring.
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const json = JSON.parse(rawText.slice(start, end + 1));
        return { ok: true, json };
      } catch {
        // continue
      }
    }
    return { ok: false, json: null, error: "JSON extraction or parse failed." };
  }
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
  obj.selected_scene_count = ctx.input.selected_scene_ids.length;
  obj.terminal_scene_count = ctx.input.coverage.terminalCount;
  obj.complete_scene_count = ctx.input.coverage.completeCount;
  obj.insufficient_evidence_count = ctx.input.coverage.insufficientEvidenceCount;
  obj.created_at = ctx.createdAt;
  obj.completed_at = obj.completed_at ?? new Date().toISOString();
  obj.provider_metadata = ctx.providerMetadata;
  obj.parsed_hash = "pending";
  return obj;
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
  if (validation.structuralErrors.some((e) => e.includes("contract parsing"))) {
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
