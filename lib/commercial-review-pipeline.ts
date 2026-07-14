/**
 * Orchestrates commercial review validation: statistics, repair, rubric, grading.
 */

import type { ReviewStatistics } from "./review-statistics.ts";
import {
  buildWordCountRepairPrompt,
  REVIEW_BLOCKED_STATISTICS_MESSAGE,
  validateWordCountClaims,
  type WordCountContradiction,
} from "./word-count-validation.ts";
import {
  extractRubricPayload,
  validateCommercialRubric,
  type RubricValidationResult,
} from "./rubric-validation.ts";
import { GRADING_FORMULA_VERSION, attachRubricToMemo, type CommercialRubricPayload } from "./commercial-fiction-rubric.ts";
import type { ReviewMeta } from "./types.ts";
import {
  normalizeProseGradeLine,
  REVIEW_BLOCKED_PROSE_GRADE_MESSAGE,
  validateProseLetterGrade,
  type ProseGradeMatch,
} from "./prose-grade-validation.ts";

export interface ValidatedCommercialReview {
  memoContent: string;
  fullContent: string;
  statistics: ReviewStatistics;
  rubric: CommercialRubricPayload | null;
  grading: RubricValidationResult;
  repairAttempted: boolean;
  repairSucceeded: boolean;
  statisticsValidationStatus: "VERIFIED" | "FAILED";
  reviewMeta: ReviewMeta | null;
}

export interface CommercialReviewValidationOutcome {
  ok: boolean;
  error?: string;
  result?: ValidatedCommercialReview;
  /** Set when a single repair pass may resolve the failure. */
  repairable?: boolean;
  repairKind?: "word_count" | "prose_grade";
  wordCountContradiction?: WordCountContradiction;
  /** All length contradictions detected (for repair prompt / diagnostics). */
  wordCountContradictions?: WordCountContradiction[];
  wordCountErrors?: string[];
  proseGradeConflict?: ProseGradeMatch;
}

export interface CommercialMemoValidationOutcome {
  ok: boolean;
  error?: string;
  repairable?: boolean;
  repairKind?: "word_count" | "prose_grade";
  wordCountContradiction?: WordCountContradiction;
  wordCountContradictions?: WordCountContradiction[];
  wordCountErrors?: string[];
}

/** Validate Call A memo only (statistics / word-count gate before rubric generation). */
export function validateCommercialMemoOnly(args: {
  memoContent: string;
  canonicalWordCount: number;
  repairAttempted?: boolean;
}): CommercialMemoValidationOutcome {
  const wordVal = validateWordCountClaims(args.memoContent, args.canonicalWordCount);

  if (!wordVal.valid && !args.repairAttempted) {
    const primary =
      wordVal.contradictions[0] ??
      ({
        quotation: wordVal.errors[0] ?? "length reference",
        claimedWords: 0,
        approximate: false,
        shorthand: false,
        reason: wordVal.errors[0] ?? "Statistics validation failed.",
      } satisfies WordCountContradiction);
    return {
      ok: false,
      repairable: true,
      repairKind: "word_count",
      wordCountContradiction: primary,
      wordCountContradictions: wordVal.contradictions,
      wordCountErrors: wordVal.errors,
      error: `${REVIEW_BLOCKED_STATISTICS_MESSAGE}: ${[
        ...wordVal.errors,
        ...wordVal.contradictions.map((c) => c.reason),
      ].join(" ")}`,
    };
  }

  if (!wordVal.valid) {
    return {
      ok: false,
      error: `${REVIEW_BLOCKED_STATISTICS_MESSAGE}: Repair did not resolve length contradictions.`,
      wordCountContradictions: wordVal.contradictions,
      wordCountErrors: wordVal.errors,
    };
  }

  return { ok: true };
}

function reattachRubric(memo: string, payload: CommercialRubricPayload): string {
  return attachRubricToMemo(memo, payload);
}

/** Run full post-generation validation pipeline (no AI calls). */
export function validateCommercialReviewContent(args: {
  content: string;
  statistics: ReviewStatistics;
  reviewMeta: ReviewMeta | null;
  repairAttempted?: boolean;
  repairSucceeded?: boolean;
}): CommercialReviewValidationOutcome {
  const stats = { ...args.statistics };
  const wordVal = validateWordCountClaims(args.content, stats.canonical_word_count);
  const statisticsValid = wordVal.valid;

  const { memoContent, payload, parseError, categoryKeyErrors } = extractRubricPayload(args.content);
  const grading = validateCommercialRubric({
    payload,
    parseError,
    categoryKeyErrors,
    canonicalWordCount: stats.canonical_word_count,
    fullTextSupplied: stats.full_text_supplied,
    statisticsValid,
  });

  stats.statistics_validation_status = statisticsValid
    ? "verified"
    : args.repairAttempted
      ? "failed"
      : "pending";

  if (!statisticsValid && !args.repairAttempted) {
    const primary =
      wordVal.contradictions[0] ??
      ({
        quotation: wordVal.errors[0] ?? "length reference",
        claimedWords: 0,
        approximate: false,
        shorthand: false,
        reason: wordVal.errors[0] ?? "Statistics validation failed.",
      } satisfies WordCountContradiction);
    return {
      ok: false,
      repairable: true,
      repairKind: "word_count",
      wordCountContradiction: primary,
      wordCountContradictions: wordVal.contradictions,
      wordCountErrors: wordVal.errors,
      error: `${REVIEW_BLOCKED_STATISTICS_MESSAGE}: ${[
        ...wordVal.errors,
        ...wordVal.contradictions.map((c) => c.reason),
      ].join(" ")}`,
    };
  }

  if (!statisticsValid && args.repairAttempted) {
    return {
      ok: false,
      error: `${REVIEW_BLOCKED_STATISTICS_MESSAGE}: Repair did not resolve length contradictions.`,
    };
  }

  if (!grading.valid && grading.gradeStatus.startsWith("WITHHELD")) {
    return {
      ok: false,
      error: `Review validation failed: ${grading.validationErrors.join(" ")}`,
    };
  }

  if (!grading.letterGrade) {
    return {
      ok: false,
      error: "Review validation failed: calculated letter grade unavailable.",
    };
  }

  const proseVal = validateProseLetterGrade(memoContent, grading.letterGrade);
  if (!proseVal.valid) {
    if (!args.repairAttempted) {
      return {
        ok: false,
        repairable: true,
        repairKind: "prose_grade",
        proseGradeConflict: proseVal.conflicts[0],
        error: `${REVIEW_BLOCKED_PROSE_GRADE_MESSAGE}: prose claims ${proseVal.conflicts.map((c) => c.grade).join(", ")} but calculated grade is ${grading.letterGrade}.`,
      };
    }
    return {
      ok: false,
      error: `${REVIEW_BLOCKED_PROSE_GRADE_MESSAGE}: Repair did not resolve prose grade contradictions.`,
    };
  }

  const normalizedMemo = normalizeProseGradeLine(
    memoContent,
    grading.letterGrade,
    grading.manuscriptScore,
  );
  const fullContent = payload ? reattachRubric(normalizedMemo, payload) : args.content;

  return {
    ok: true,
    result: {
      memoContent: normalizedMemo,
      fullContent,
      statistics: stats,
      rubric: payload,
      grading,
      repairAttempted: args.repairAttempted ?? false,
      repairSucceeded: Boolean(args.repairAttempted),
      statisticsValidationStatus: statisticsValid ? "VERIFIED" : "FAILED",
      reviewMeta: args.reviewMeta,
    },
  };
}

/** Build grading record for DB persistence (matches RPC validation expectations). */
export function buildReviewGradingRecord(v: ValidatedCommercialReview): Record<string, unknown> {
  const g = v.grading;
  return {
    manuscript_score: g.manuscriptScore,
    manuscript_letter_grade: g.letterGrade || null,
    craft_score: g.craftScore,
    acquisition_readiness_score: g.acquisitionScore,
    grading_formula_version: GRADING_FORMULA_VERSION,
    grade_status: g.gradeStatus,
    review_reliability_status: g.reviewReliabilityStatus,
    canonical_word_count: v.statistics.canonical_word_count,
    words_analyzed: v.statistics.words_analyzed,
    statistics_validation_status: "VERIFIED",
    evidence_completeness_status: g.evidenceCompletenessStatus,
    arithmetic_validation_status: "VERIFIED",
    rubric_breakdown: v.rubric,
    grading_metadata: {
      repair_attempted: v.repairAttempted,
      repair_succeeded: v.repairSucceeded,
      validation_errors: g.validationErrors,
      statistics: v.statistics,
    },
  };
}

export function firstWordCountContradiction(
  content: string,
  canonicalWordCount: number,
): WordCountContradiction | null {
  const r = validateWordCountClaims(content, canonicalWordCount);
  return r.contradictions[0] ?? null;
}

export { buildWordCountRepairPrompt, REVIEW_BLOCKED_STATISTICS_MESSAGE };
