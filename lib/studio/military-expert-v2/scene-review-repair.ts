/**
 * Patch-only per-scene repair for Phase 2A scene reviews.
 */

import {
  hashMilitaryExpertSceneReviewDocument,
  parseMilitaryExpertSceneReviewDocument,
  type MilitaryExpertSceneReviewDocument,
} from "./scene-review-contract.ts";
import {
  validateSceneReviewDocument,
  type SceneReviewValidationContext,
} from "./scene-review-validation.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";

export const MILITARY_EXPERT_SCENE_REVIEW_REPAIR_VERSION =
  "military_expert_scene_review_repair@v1" as const;

export interface SceneReviewRepairAttempt {
  readonly attemptNumber: number;
  readonly repairReason: string;
  readonly repairCostUsd: number;
  readonly repairedFields: readonly string[];
  readonly finalDisposition: "accepted" | "rejected" | "partial";
}

export interface SceneReviewRepairResult {
  readonly ok: boolean;
  readonly document: MilitaryExpertSceneReviewDocument | null;
  readonly attempt: SceneReviewRepairAttempt | null;
  readonly errors: readonly string[];
}

const REPAIRABLE_STRUCTURAL_FIELDS = [
  "review_status",
  "confidence",
  "category_tags",
  "realism_summary",
] as const;

export function classifySceneReviewRepairNeed(
  validation: ReturnType<typeof validateSceneReviewDocument>,
): string[] {
  const reasons: string[] = [];
  if (validation.extractionError) reasons.push("json_extraction_failed");
  if (validation.structuralErrors.some((e) => e.includes("Scene ID mismatch"))) {
    reasons.push("incorrect_scene_id");
  }
  if (validation.structuralErrors.some((e) => e.includes("contract parsing"))) {
    reasons.push("contract_parse_failed");
  }
  if (validation.qualityErrors.some((e) => e.includes("Unsafe procedural"))) {
    reasons.push("unsafe_wording");
  }
  if (validation.qualityErrors.some((e) => e.includes("strength acknowledgment"))) {
    reasons.push("missing_strength_acknowledgment");
  }
  if (validation.qualityErrors.some((e) => e.includes("why-it-matters"))) {
    reasons.push("missing_why_it_matters");
  }
  if (validation.qualityErrors.some((e) => e.includes("category tags"))) {
    reasons.push("missing_category_tags");
  }
  return reasons;
}

export function buildSceneReviewRepairPrompt(args: {
  originalJson: string;
  repairReasons: readonly string[];
  sceneId: string;
}): string {
  return [
    "Patch the following scene review JSON to fix validation errors.",
    "Return ONLY the corrected JSON object. Do not change the scene_id.",
    "Do not invent manuscript evidence. Do not add tactical how-to instructions.",
    "",
    `Scene ID (must remain): ${args.sceneId}`,
    `Repair reasons: ${args.repairReasons.join(", ")}`,
    "",
    "Original JSON:",
    args.originalJson,
  ].join("\n");
}

export function applyDeterministicSceneReviewPatches(
  raw: unknown,
  ctx: SceneReviewValidationContext & {
    workflowId: string;
    sceneReviewId: string;
    locator: MilitaryExpertSceneReviewDocument["locator"];
    sceneTypes: MilitaryExpertSceneReviewDocument["scene_types"];
    actionCategories: MilitaryExpertSceneReviewDocument["action_categories"];
    participants: MilitaryExpertSceneReviewDocument["participants"];
    createdAt: string;
    repairCount: number;
    retryCount: number;
  },
): MilitaryExpertSceneReviewDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = { ...(raw as Record<string, unknown>) };

  obj.contract_version = "military_expert_scene_review@v1";
  obj.scene_review_id = ctx.sceneReviewId;
  obj.inventory_id = ctx.expectedInventoryId;
  obj.selection_snapshot_id = ctx.expectedSnapshotId;
  obj.scene_id = ctx.expectedSceneId;
  obj.workflow_id = ctx.workflowId;
  obj.locator = ctx.locator;
  obj.scene_types = [...ctx.sceneTypes];
  obj.action_categories = [...ctx.actionCategories];
  obj.participants = [...ctx.participants];
  obj.retry_count = ctx.retryCount;
  obj.repair_count = ctx.repairCount + 1;
  obj.created_at = ctx.createdAt;
  obj.completed_at = obj.completed_at ?? new Date().toISOString();
  obj.parsed_review_hash = obj.parsed_review_hash ?? "pending";

  if (!obj.review_status || obj.review_status === "queued" || obj.review_status === "running") {
    obj.review_status = "complete";
  }

  const doc = parseMilitaryExpertSceneReviewDocument(obj);
  if (!doc) return null;
  const hash = hashMilitaryExpertSceneReviewDocument(doc);
  return Object.freeze({ ...doc, parsed_review_hash: hash });
}

export function processSceneReviewRepairResponse(
  rawText: string,
  ctx: SceneReviewValidationContext & {
    workflowId: string;
    sceneReviewId: string;
    locator: MilitaryExpertSceneReviewDocument["locator"];
    sceneTypes: MilitaryExpertSceneReviewDocument["scene_types"];
    actionCategories: MilitaryExpertSceneReviewDocument["action_categories"];
    participants: MilitaryExpertSceneReviewDocument["participants"];
    createdAt: string;
    repairCount: number;
    retryCount: number;
    repairCostUsd: number;
    attemptNumber: number;
    repairReasons: readonly string[];
  },
): SceneReviewRepairResult {
  let json: unknown;
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    json = JSON.parse(extraction.jsonText);
  } catch {
    return {
      ok: false,
      document: null,
      attempt: Object.freeze({
        attemptNumber: ctx.attemptNumber,
        repairReason: ctx.repairReasons.join("; "),
        repairCostUsd: ctx.repairCostUsd,
        repairedFields: Object.freeze([]),
        finalDisposition: "rejected",
      }),
      errors: Object.freeze(["Repair JSON extraction failed."]),
    };
  }

  const patched = applyDeterministicSceneReviewPatches(json, ctx);
  if (!patched) {
    return {
      ok: false,
      document: null,
      attempt: null,
      errors: Object.freeze(["Repair patch application failed."]),
    };
  }

  const validation = validateSceneReviewDocument(patched, ctx);
  const disposition = validation.ok ? "accepted" : validation.qualityErrors.length > 0 ? "partial" : "rejected";

  return {
    ok: validation.ok,
    document: validation.ok ? patched : null,
    attempt: Object.freeze({
      attemptNumber: ctx.attemptNumber,
      repairReason: ctx.repairReasons.join("; "),
      repairCostUsd: ctx.repairCostUsd,
      repairedFields: Object.freeze([...REPAIRABLE_STRUCTURAL_FIELDS]),
      finalDisposition: disposition,
    }),
    errors: Object.freeze([...validation.structuralErrors, ...validation.qualityErrors]),
  };
}
