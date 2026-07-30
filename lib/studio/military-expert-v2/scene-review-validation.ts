/**
 * Per-scene structural and quality validation for Phase 2A.
 */

import {
  parseMilitaryExpertSceneReviewDocument,
  type MilitaryExpertSceneReviewDocument,
  type MilitaryExpertSceneReviewStatus,
} from "./scene-review-contract.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { scoreMilitaryDepth } from "./scene-review-quality.ts";

export const MILITARY_EXPERT_SCENE_REVIEW_VALIDATOR_VERSION =
  "military_expert_scene_review_validator@v1" as const;

export const TERMINAL_SCENE_REVIEW_STATUSES: readonly MilitaryExpertSceneReviewStatus[] = [
  "complete",
  "insufficient_evidence",
  "outside_expertise",
];

const UNSAFE_PROCEDURAL_PATTERNS: readonly RegExp[] = [
  /\bstep[- ]by[- ]step\b/i,
  /\bhow to (?:breach|execute|conduct|perform)\b/i,
  /\bplace (?:the )?explosive/i,
];

export interface SceneReviewValidationContext {
  readonly expectedSceneId: string;
  readonly expectedInventoryId: string;
  readonly expectedSnapshotId: string;
  readonly sceneIsMajor: boolean;
}

export interface SceneReviewValidationResult {
  readonly ok: boolean;
  readonly document: MilitaryExpertSceneReviewDocument | null;
  readonly structuralErrors: readonly string[];
  readonly qualityErrors: readonly string[];
  readonly extractionError: string | null;
}

export function parseSceneReviewProviderResponse(rawText: string): {
  ok: boolean;
  json: unknown;
  error?: string;
} {
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    const json = JSON.parse(extraction.jsonText);
    return { ok: true, json };
  } catch {
    return { ok: false, json: null, error: "JSON extraction or parse failed." };
  }
}

export function validateSceneReviewDocument(
  raw: unknown,
  ctx: SceneReviewValidationContext,
  options?: { skipQualityScoring?: boolean },
): SceneReviewValidationResult {
  const structuralErrors: string[] = [];
  const qualityErrors: string[] = [];

  const doc = parseMilitaryExpertSceneReviewDocument(raw);
  if (!doc) {
    return {
      ok: false,
      document: null,
      structuralErrors: ["Document failed contract parsing."],
      qualityErrors: [],
      extractionError: null,
    };
  }

  if (doc.scene_id !== ctx.expectedSceneId) {
    structuralErrors.push(`Scene ID mismatch: expected ${ctx.expectedSceneId}, got ${doc.scene_id}.`);
  }
  if (doc.inventory_id !== ctx.expectedInventoryId) {
    structuralErrors.push("Inventory ID mismatch.");
  }
  if (doc.selection_snapshot_id !== ctx.expectedSnapshotId) {
    structuralErrors.push("Selection snapshot ID mismatch.");
  }

  if (!TERMINAL_SCENE_REVIEW_STATUSES.includes(doc.review_status)) {
    structuralErrors.push(`Review status ${doc.review_status} is not terminal for provider output.`);
  }

  for (const suggestion of doc.safe_editorial_suggestions) {
    for (const pattern of UNSAFE_PROCEDURAL_PATTERNS) {
      if (pattern.test(suggestion.suggestion)) {
        qualityErrors.push("Unsafe procedural instruction in editorial suggestion.");
      }
    }
  }

  if (doc.review_status === "complete" && !options?.skipQualityScoring) {
    const hasStrengthOrExplicitNone =
      doc.authenticity_strengths.length > 0 ||
      doc.realism_summary.toLowerCase().includes("no notable authenticity strength");
    if (!hasStrengthOrExplicitNone && ctx.sceneIsMajor) {
      qualityErrors.push("Major scene lacks strength acknowledgment or explicit none statement.");
    }

    for (const concern of doc.authenticity_concerns) {
      if (concern.determination === "confirmed") {
        if (!concern.manuscript_evidence_locator.trim()) {
          qualityErrors.push(`Confirmed concern "${concern.title}" lacks evidence locator.`);
        }
        if (!concern.why_it_matters.trim()) {
          qualityErrors.push(`Confirmed concern "${concern.title}" lacks why-it-matters.`);
        }
      }
    }

    if (doc.category_tags.length === 0 && !options?.skipQualityScoring) {
      qualityErrors.push("Complete review lacks military domain category tags.");
    }
  }

  const scorecard = scoreMilitaryDepth(doc);
  if (!options?.skipQualityScoring && !scorecard.overallPass && doc.review_status === "complete") {
    qualityErrors.push(...scorecard.failureReasons);
  }

  return {
    ok: structuralErrors.length === 0 && qualityErrors.length === 0,
    document: doc,
    structuralErrors: Object.freeze(structuralErrors),
    qualityErrors: Object.freeze(qualityErrors),
    extractionError: null,
  };
}

export function validateSceneReviewProviderOutput(
  rawText: string,
  ctx: SceneReviewValidationContext,
): SceneReviewValidationResult {
  const parsed = parseSceneReviewProviderResponse(rawText);
  if (!parsed.ok) {
    return {
      ok: false,
      document: null,
      structuralErrors: [],
      qualityErrors: [],
      extractionError: parsed.error ?? "Parse failed.",
    };
  }
  return validateSceneReviewDocument(parsed.json, ctx);
}
