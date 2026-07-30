/**
 * Patch-only synthesis repair for Phase 2B — max 2 attempts, Opus.
 */

import {
  hashMilitaryExpertV2SynthesisDocument,
  parseMilitaryExpertV2SynthesisDocument,
  type MilitaryExpertV2SynthesisDocument,
} from "./synthesis-contract.ts";
import {
  validateSynthesisDocument,
  type SynthesisValidationContext,
} from "./synthesis-validation.ts";
import { extractStrictModelJsonObject } from "@/experts/military-expert/model-json-extraction.ts";
import { normalizeSynthesisProviderOutput } from "./synthesis-provider-output.ts";
import { mergeProviderOutputIntoSynthesisDocument } from "./synthesis-validation.ts";
import type { MilitaryExpertV2SynthesisInput } from "./synthesis-input.ts";

export const MILITARY_EXPERT_V2_SYNTHESIS_REPAIR_VERSION =
  "military_expert_v2_synthesis_repair@v1" as const;

export interface SynthesisRepairAttempt {
  readonly attemptNumber: number;
  readonly repairReason: string;
  readonly repairCostUsd: number;
  readonly repairedFields: readonly string[];
  readonly finalDisposition: "accepted" | "rejected" | "partial";
}

export interface SynthesisRepairResult {
  readonly ok: boolean;
  readonly document: MilitaryExpertV2SynthesisDocument | null;
  readonly attempt: SynthesisRepairAttempt | null;
  readonly errors: readonly string[];
}

export function buildSynthesisRepairPrompt(args: {
  originalJson: string;
  repairReasons: readonly string[];
  synthesisId: string;
}): string {
  return [
    "Patch the following Military Expert V2 synthesis JSON to fix validation errors.",
    "Return ONLY the corrected JSON object.",
    "Do not invent scene evidence. Do not add unreviewed scenes.",
    "Do not convert insufficient-evidence scenes into confirmed judgments.",
    "Do not add tactical how-to instructions.",
    "",
    `Synthesis ID (must remain): ${args.synthesisId}`,
    `Repair reasons: ${args.repairReasons.join(", ")}`,
    "",
    "Original JSON:",
    args.originalJson,
  ].join("\n");
}

export function applyDeterministicSynthesisPatches(
  raw: unknown,
  ctx: SynthesisValidationContext & {
    synthesisId: string;
    input: MilitaryExpertV2SynthesisInput;
    createdAt: string;
  },
): MilitaryExpertV2SynthesisDocument | null {
  const merged = mergeProviderOutputIntoSynthesisDocument(raw, {
    ...ctx,
    providerMetadata: null,
  });
  const doc = parseMilitaryExpertV2SynthesisDocument(merged);
  if (!doc) return null;
  const hash = hashMilitaryExpertV2SynthesisDocument(doc);
  return Object.freeze({ ...doc, parsed_hash: hash });
}

export function processSynthesisRepairResponse(
  rawText: string,
  ctx: SynthesisValidationContext & {
    synthesisId: string;
    input: MilitaryExpertV2SynthesisInput;
    createdAt: string;
    repairCostUsd: number;
    attemptNumber: number;
    repairReasons: readonly string[];
    sceneReviewIdBySceneId: ReadonlyMap<string, string>;
  },
): SynthesisRepairResult {
  let json: unknown;
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    json = normalizeSynthesisProviderOutput(
      JSON.parse(extraction.jsonText),
      ctx.sceneReviewIdBySceneId,
    );
  } catch {
    return {
      ok: false,
      document: null,
      attempt: Object.freeze({
        attemptNumber: ctx.attemptNumber,
        repairReason: ctx.repairReasons.join(", "),
        repairCostUsd: ctx.repairCostUsd,
        repairedFields: Object.freeze([]),
        finalDisposition: "rejected",
      }),
      errors: Object.freeze(["Repair JSON extraction failed."]),
    };
  }

  const patched = applyDeterministicSynthesisPatches(json, ctx);
  if (!patched) {
    return {
      ok: false,
      document: null,
      attempt: Object.freeze({
        attemptNumber: ctx.attemptNumber,
        repairReason: ctx.repairReasons.join(", "),
        repairCostUsd: ctx.repairCostUsd,
        repairedFields: Object.freeze([]),
        finalDisposition: "rejected",
      }),
      errors: Object.freeze(["Repair contract parse failed."]),
    };
  }

  const validation = validateSynthesisDocument(patched, ctx, { skipQualityScoring: true });
  const disposition = validation.ok ? "accepted" : validation.structuralErrors.length === 0 ? "partial" : "rejected";

  return {
    ok: validation.ok,
    document: validation.document,
    attempt: Object.freeze({
      attemptNumber: ctx.attemptNumber,
      repairReason: ctx.repairReasons.join(", "),
      repairCostUsd: ctx.repairCostUsd,
      repairedFields: Object.freeze(["synthesis_payload"]),
      finalDisposition: disposition,
    }),
    errors: Object.freeze([...validation.structuralErrors, ...validation.qualityErrors]),
  };
}
