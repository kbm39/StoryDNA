/**
 * Non-persistent diagnostics for blocked commercial review generation.
 * Never writes to the reviews table.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { WordCountContradiction } from "./word-count-validation.ts";
import type { ProseGradeMatch } from "./prose-grade-validation.ts";
import { validateWordCountClaims } from "./word-count-validation.ts";
import { validateProseLetterGrade } from "./prose-grade-validation.ts";
import {
  extractRubricPayload,
  validateCommercialRubric,
} from "./rubric-validation.ts";
import { validateCommercialReviewContent } from "./commercial-review-pipeline.ts";
import type { ReviewStatistics } from "./review-statistics.ts";
import type { ReviewMeta } from "./types.ts";
import type { GenerationMeta } from "./ai/shared.ts";
import type { RubricGenerationFailureKind } from "./rubric-validation.ts";
import type { MemoGenerationFailureKind } from "./commercial-review-generation.ts";
import { buildCommercialReviewRepairPrompt } from "./commercial-review-repair.ts";

export type CommercialReviewFailureKind =
  | MemoGenerationFailureKind
  | RubricGenerationFailureKind;

export interface ValidationContradictionDiagnostic {
  quotation: string;
  reason: string;
  rule: string;
  claimedWords?: number;
  numericalPhrase?: string;
  approximate?: boolean;
  shorthand?: boolean;
}

export interface ValidationPassDiagnostic {
  pass: "original" | "repair";
  ok: boolean;
  error?: string;
  wordCountErrors: string[];
  wordCountContradictions: ValidationContradictionDiagnostic[];
  proseGradeConflicts: ProseGradeMatch[];
  rubricValidationErrors: string[];
}

export interface CommercialReviewFailureDiagnostics {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  canonicalWordCount: number;
  storedWordCount: number | null;
  recomputedWordCount: number;
  originalReviewText: string;
  repairedReviewText?: string;
  repairAttempted: boolean;
  originalPass: ValidationPassDiagnostic;
  repairPass?: ValidationPassDiagnostic;
  repairPrompt?: string;
  capturedAt: string;
  /** Two-call pipeline fields (when memo and rubric are generated separately). */
  pipeline?: "two_call_v1" | "legacy_combined";
  failurePhase?: "memo" | "rubric" | "combined";
  memoContent?: string;
  memoGenerationMeta?: GenerationMeta | null;
  rubricRawContent?: string;
  rubricGenerationMeta?: GenerationMeta | null;
  rubricFailureKind?: RubricGenerationFailureKind;
  /** Memo or rubric failure classification for two-call pipeline diagnostics. */
  failureKind?: CommercialReviewFailureKind;
  rubricRetryAttempted?: boolean;
  memoRepairAttempted?: boolean;
}

export function reviewFailureDiagnosticsEnabled(): boolean {
  return (
    process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS === "1" ||
    process.env.NODE_ENV === "development"
  );
}

function mapWordContradictions(
  items: WordCountContradiction[],
): ValidationContradictionDiagnostic[] {
  return items.map((c) => ({
    quotation: c.quotation,
    reason: c.reason,
    rule: c.shorthand
      ? "word_count_shorthand"
      : c.approximate
        ? "word_count_approximate"
        : c.reason.includes("Cut ")
          ? "cut_math_contradiction"
          : c.reason.includes("range")
            ? "word_count_range"
            : "word_count_claim",
    claimedWords: c.claimedWords,
    numericalPhrase: c.quotation,
    approximate: c.approximate,
    shorthand: c.shorthand,
  }));
}

function mapPassDiagnostic(args: {
  pass: "original" | "repair";
  content: string;
  statistics: ReviewStatistics;
  reviewMeta: ReviewMeta | null;
  repairAttempted?: boolean;
}): ValidationPassDiagnostic {
  const wordVal = validateWordCountClaims(args.content, args.statistics.canonical_word_count);
  const outcome = validateCommercialReviewContent({
    content: args.content,
    statistics: args.statistics,
    reviewMeta: args.reviewMeta,
    repairAttempted: args.repairAttempted ?? false,
  });
  const { memoContent, payload, parseError, categoryKeyErrors } = extractRubricPayload(
    args.content,
  );
  const rubric = validateCommercialRubric({
    payload,
    parseError,
    categoryKeyErrors,
    canonicalWordCount: args.statistics.canonical_word_count,
    fullTextSupplied: args.statistics.full_text_supplied,
    statisticsValid: wordVal.valid,
  });
  const prose =
    rubric.letterGrade != null
      ? validateProseLetterGrade(memoContent, rubric.letterGrade)
      : { valid: true, conflicts: [] as ProseGradeMatch[] };

  return {
    pass: args.pass,
    ok: outcome.ok,
    error: outcome.error,
    wordCountErrors: wordVal.errors,
    wordCountContradictions: mapWordContradictions(wordVal.contradictions),
    proseGradeConflicts: prose.conflicts,
    rubricValidationErrors: rubric.validationErrors,
  };
}

export function buildCommercialReviewFailureDiagnostics(args: {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  statistics: ReviewStatistics;
  storedWordCount: number | null;
  recomputedWordCount: number;
  originalReviewText: string;
  repairedReviewText?: string;
  repairAttempted: boolean;
  reviewMeta: ReviewMeta | null;
  repairPrompt?: string;
  calculatedLetterGrade?: string;
  manuscriptScore?: number;
  wordCountContradictions?: WordCountContradiction[];
  proseGradeConflict?: ProseGradeMatch;
}): CommercialReviewFailureDiagnostics {
  const originalPass = mapPassDiagnostic({
    pass: "original",
    content: args.originalReviewText,
    statistics: args.statistics,
    reviewMeta: args.reviewMeta,
  });

  let repairPass: ValidationPassDiagnostic | undefined;
  if (args.repairAttempted && args.repairedReviewText) {
    repairPass = mapPassDiagnostic({
      pass: "repair",
      content: args.repairedReviewText,
      statistics: args.statistics,
      reviewMeta: args.reviewMeta,
      repairAttempted: true,
    });
  }

  const repairPrompt =
    args.repairPrompt ??
    (args.repairAttempted
      ? buildCommercialReviewRepairPrompt({
          canonicalWordCount: args.statistics.canonical_word_count,
          reviewContent: args.originalReviewText,
          wordCountContradictions: args.wordCountContradictions ?? [],
          proseGradeConflict: args.proseGradeConflict,
          calculatedLetterGrade: args.calculatedLetterGrade,
          manuscriptScore: args.manuscriptScore,
        })
      : undefined);

  return {
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    canonicalWordCount: args.statistics.canonical_word_count,
    storedWordCount: args.storedWordCount,
    recomputedWordCount: args.recomputedWordCount,
    originalReviewText: args.originalReviewText,
    repairedReviewText: args.repairedReviewText,
    repairAttempted: args.repairAttempted,
    originalPass,
    repairPass,
    repairPrompt,
    capturedAt: new Date().toISOString(),
  };
}

/** Diagnostics for two-call pipeline failures (memo-only or rubric-only). */
export function buildTwoPhaseReviewFailureDiagnostics(args: {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  statistics: ReviewStatistics;
  storedWordCount: number | null;
  recomputedWordCount: number;
  memoContent: string;
  memoGenerationMeta: GenerationMeta | null;
  rubricRawContent?: string;
  rubricGenerationMeta?: GenerationMeta | null;
  rubricFailureKind?: RubricGenerationFailureKind;
  rubricRetryAttempted?: boolean;
  memoRepairAttempted?: boolean;
  failurePhase: "memo" | "rubric";
  failureError: string;
  reviewMeta: ReviewMeta | null;
  repairPrompt?: string;
  wordCountContradictions?: import("./word-count-validation.ts").WordCountContradiction[];
  failureKind?: CommercialReviewFailureKind;
}): CommercialReviewFailureDiagnostics {
  const combinedText = args.rubricRawContent
    ? `${args.memoContent}\n\n<!-- STORYDNA_RUBRIC_JSON -->\n${args.rubricRawContent}`
    : args.memoContent;

  const base = buildCommercialReviewFailureDiagnostics({
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    statistics: args.statistics,
    storedWordCount: args.storedWordCount,
    recomputedWordCount: args.recomputedWordCount,
    originalReviewText: combinedText,
    repairAttempted: args.memoRepairAttempted ?? false,
    reviewMeta: args.reviewMeta,
    repairPrompt: args.repairPrompt,
    wordCountContradictions: args.wordCountContradictions,
  });

  return {
    ...base,
    pipeline: "two_call_v1",
    failurePhase: args.failurePhase,
    memoContent: args.memoContent,
    memoGenerationMeta: args.memoGenerationMeta,
    rubricRawContent: args.rubricRawContent,
    rubricGenerationMeta: args.rubricGenerationMeta ?? null,
    rubricFailureKind: args.rubricFailureKind,
    rubricRetryAttempted: args.rubricRetryAttempted ?? false,
    memoRepairAttempted: args.memoRepairAttempted ?? false,
    failureKind: args.failureKind ?? args.rubricFailureKind,
    originalPass: {
      ...base.originalPass,
      error: args.failureError,
    },
  };
}

const MEMO_TRUNCATION_ERROR =
  "Memo generation truncated (output token limit reached). No review was published.";

/** Diagnostics when Call A exhausts its output token budget before validation. */
export function buildMemoTruncationDiagnostics(args: {
  manuscriptId: string;
  manuscriptVersionId: string | null;
  statistics: ReviewStatistics;
  storedWordCount: number | null;
  recomputedWordCount: number;
  memoContent: string;
  memoGenerationMeta: GenerationMeta;
}): CommercialReviewFailureDiagnostics {
  return {
    manuscriptId: args.manuscriptId,
    manuscriptVersionId: args.manuscriptVersionId,
    canonicalWordCount: args.statistics.canonical_word_count,
    storedWordCount: args.storedWordCount,
    recomputedWordCount: args.recomputedWordCount,
    originalReviewText: args.memoContent,
    repairAttempted: false,
    originalPass: {
      pass: "original",
      ok: false,
      error: MEMO_TRUNCATION_ERROR,
      wordCountErrors: [],
      wordCountContradictions: [],
      proseGradeConflicts: [],
      rubricValidationErrors: ["Call A truncated before memo validation."],
    },
    capturedAt: new Date().toISOString(),
    pipeline: "two_call_v1",
    failurePhase: "memo",
    failureKind: "MEMO_GENERATION_TRUNCATED",
    memoContent: args.memoContent,
    memoGenerationMeta: args.memoGenerationMeta,
    memoRepairAttempted: false,
  };
}

/** Persist truncated Call A diagnostics to gitignored local directory (dev/test only). */
export function writeMemoTruncationDiagnosticArtifact(
  diagnostics: CommercialReviewFailureDiagnostics,
  filename = "memo-truncation-latest.json",
): string | null {
  if (!reviewFailureDiagnosticsEnabled()) return null;
  const dir = join(process.cwd(), ".review-failure-diagnostics");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(diagnostics, null, 2));
  return path;
}
