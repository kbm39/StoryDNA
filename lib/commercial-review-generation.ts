/**
 * Two-call Literary Agent generation: memo (Call A) + rubric JSON (Call B).
 * Pure assessment helpers are testable without AI or database access.
 */

import type { GenerationMeta } from "./ai/shared.ts";
import {
  attachRubricToMemo,
  COMMERCIAL_MEMO_MAX_TOKENS,
  RUBRIC_JSON_MARKER,
  type CommercialRubricPayload,
} from "./commercial-fiction-rubric.ts";
import type { ReviewStatistics } from "./review-statistics.ts";
import {
  classifyRubricGenerationFailure,
  extractRubricPayload,
  parseRubricJsonString,
  validateCommercialRubric,
  type RubricGenerationFailureKind,
  type RubricValidationResult,
} from "./rubric-validation.ts";
import {
  validateCommercialMemoOnly,
  validateCommercialReviewContent,
  type CommercialMemoValidationOutcome,
  type CommercialReviewValidationOutcome,
} from "./commercial-review-pipeline.ts";
import { validateWordCountClaims } from "./word-count-validation.ts";

export type { RubricGenerationFailureKind };

export type MemoGenerationFailureKind = "MEMO_GENERATION_TRUNCATED";

export const MEMO_TRUNCATION_ERROR =
  "Memo generation truncated (output token limit reached). No review was published.";

export interface CallAGenerationGate {
  proceedToMemoValidation: boolean;
  invokeCallB: boolean;
  invokePublishRpc: boolean;
  failureKind: MemoGenerationFailureKind | null;
  error: string | null;
}

/** Gate Call A output before memo validation (truncation blocks everything downstream). */
export function evaluateCallAGeneration(args: {
  generationMeta: GenerationMeta | null | undefined;
}): CallAGenerationGate {
  const meta = args.generationMeta;
  if (meta?.outputTruncated) {
    return {
      proceedToMemoValidation: false,
      invokeCallB: false,
      invokePublishRpc: false,
      failureKind: "MEMO_GENERATION_TRUNCATED",
      error: MEMO_TRUNCATION_ERROR,
    };
  }
  return {
    proceedToMemoValidation: true,
    invokeCallB: false,
    invokePublishRpc: false,
    failureKind: null,
    error: null,
  };
}

/** After memo validation passes, Call B may run. Publish requires full pipeline success. */
export function evaluatePostMemoValidation(args: {
  memoGateOk: boolean;
}): { invokeCallB: boolean; invokePublishRpc: boolean } {
  return {
    invokeCallB: args.memoGateOk,
    invokePublishRpc: false,
  };
}

/** True when a real Hold Fast-scale memo (11,738 out tokens) fits within the memo budget. */
export function isMemoOutputWithinBudget(meta: GenerationMeta): boolean {
  return !meta.outputTruncated && meta.maxTokens >= COMMERCIAL_MEMO_MAX_TOKENS;
}

export { COMMERCIAL_MEMO_MAX_TOKENS };

export interface RubricGenerationAssessment {
  rawContent: string;
  generationMeta: GenerationMeta;
  parsed: ReturnType<typeof parseRubricJsonString>;
  rubricGrading: RubricValidationResult;
  failureKind: RubricGenerationFailureKind | null;
}

/** Assess a rubric-only model response (Call B). */
export function assessRubricGenerationResult(args: {
  rawContent: string;
  generationMeta: GenerationMeta;
  statistics: ReviewStatistics;
  statisticsValid: boolean;
}): RubricGenerationAssessment {
  const parsed = parseRubricJsonString(args.rawContent);
  const rubricGrading = validateCommercialRubric({
    payload: parsed.payload,
    parseError: parsed.parseError,
    categoryKeyErrors: parsed.categoryKeyErrors,
    canonicalWordCount: args.statistics.canonical_word_count,
    fullTextSupplied: args.statistics.full_text_supplied,
    statisticsValid: args.statisticsValid,
  });
  const failureKind = classifyRubricGenerationFailure({
    rawContent: args.rawContent,
    outputTruncated: args.generationMeta.outputTruncated,
    parseError: parsed.parseError,
    categoryKeyErrors: parsed.categoryKeyErrors,
    rubricValidationErrors: rubricGrading.validationErrors,
    rubricValid: rubricGrading.valid,
  });

  return {
    rawContent: args.rawContent,
    generationMeta: args.generationMeta,
    parsed,
    rubricGrading,
    failureKind,
  };
}

/** Whether Call B should be retried once (rubric-only — never regenerates memo). */
export function shouldRetryRubricGeneration(assessment: RubricGenerationAssessment): boolean {
  return assessment.failureKind != null;
}

export function memoContainsEmbeddedRubric(memo: string): boolean {
  return memo.includes(RUBRIC_JSON_MARKER);
}

/** Combine validated memo + rubric for storage and downstream validation. */
export function combineMemoAndRubric(
  memoContent: string,
  payload: CommercialRubricPayload,
): string {
  return attachRubricToMemo(memoContent, payload);
}

/** Validate memo before rubric generation (Call A gate). */
export function validateMemoBeforeRubric(args: {
  memoContent: string;
  canonicalWordCount: number;
  repairAttempted?: boolean;
}): CommercialMemoValidationOutcome {
  if (memoContainsEmbeddedRubric(args.memoContent)) {
    return {
      ok: false,
      error:
        "Memo validation failed: embedded STORYDNA_RUBRIC_JSON must not appear in Call A output.",
    };
  }
  return validateCommercialMemoOnly(args);
}

/** Full post-merge validation (steps A–G before publish). */
export function validateCombinedCommercialReview(args: {
  memoContent: string;
  rubricPayload: CommercialRubricPayload;
  statistics: ReviewStatistics;
  reviewMeta: import("./types.ts").ReviewMeta | null;
  memoRepairAttempted?: boolean;
}): CommercialReviewValidationOutcome {
  const fullContent = combineMemoAndRubric(args.memoContent, args.rubricPayload);
  return validateCommercialReviewContent({
    content: fullContent,
    statistics: args.statistics,
    reviewMeta: args.reviewMeta,
    repairAttempted: args.memoRepairAttempted ?? false,
  });
}

/** Replay helper: classify legacy combined-output truncation (Hold Fast diagnostic). */
export function classifyLegacyCombinedOutputFailure(
  content: string,
  canonicalWordCount: number,
): {
  memoParse: ReturnType<typeof extractRubricPayload>;
  memoWordCountValid: boolean;
  rubricFailureKind: RubricGenerationFailureKind | null;
  wouldAttemptWordCountRepair: boolean;
  wouldRetryRubricOnly: boolean;
} {
  const memoParse = extractRubricPayload(content);
  const markerIdx = content.indexOf(RUBRIC_JSON_MARKER);
  const rubricRaw = markerIdx >= 0 ? content.slice(markerIdx + RUBRIC_JSON_MARKER.length) : "";
  const wordVal = validateWordCountClaims(memoParse.memoContent, canonicalWordCount);

  const assessment = assessRubricGenerationResult({
    rawContent: rubricRaw,
    generationMeta: {
      finishReason: "max_tokens",
      inputTokens: null,
      outputTokens: null,
      maxTokens: 16_000,
      outputTruncated: true,
    },
    statistics: {
      canonical_word_count: canonicalWordCount,
      full_text_supplied: true,
    } as ReviewStatistics,
    statisticsValid: wordVal.valid,
  });

  return {
    memoParse,
    memoWordCountValid: wordVal.valid,
    rubricFailureKind: assessment.failureKind,
    wouldAttemptWordCountRepair: !wordVal.valid,
    wouldRetryRubricOnly: shouldRetryRubricGeneration(assessment),
  };
}
