/**
 * Authoritative manuscript statistics for review generation and validation.
 * Canonical length always comes from stored manuscript version text — never from model estimates.
 */

import { countManuscriptWords, manuscriptWordsInCharSlice } from "./word-count.ts";
import {
  STORYDNA_COUNT_METHOD,
  canonicalManuscriptLengthSentence,
} from "./word-count-reporting.ts";
import type { CanonicalReviewInput } from "./canonical-review-input.ts";
import { formatLengthCutBlock } from "./length-cut-arithmetic.ts";

export type StatisticsValidationStatus =
  | "pending"
  | "verified"
  | "failed"
  | "repaired";

export type ReviewScope =
  | "full_manuscript"
  | "partial_manuscript"
  | "chapter_segment"
  | "notes_based";

export interface ReviewStatistics {
  manuscript_id: string;
  manuscript_version_id: string | null;
  canonical_word_count: number;
  count_method: "STORYDNA_UNICODE_V1";
  character_count: number;
  full_text_supplied: boolean;
  scope: ReviewScope;
  scope_start: number | null;
  scope_end: number | null;
  words_analyzed: number;
  statistics_source: "manuscript_version" | "manuscript_legacy";
  statistics_validation_status: StatisticsValidationStatus;
}

export interface BuildReviewStatisticsArgs {
  manuscriptId: string;
  manuscriptVersionId?: string | null;
  extractedText: string;
  sentChars: number;
  /** Stored word_count from DB — must match recomputed count before review runs. */
  storedWordCount?: number | null;
  characterCount?: number | null;
  /** When provided, canonical count comes from verified input object. */
  canonicalInput?: CanonicalReviewInput | null;
}

/** Resolve canonical counts from verified input or extracted text. */
export function buildReviewStatistics(args: BuildReviewStatisticsArgs): ReviewStatistics {
  const text = args.extractedText ?? "";
  const recomputed = countManuscriptWords(text);
  const canonical = args.canonicalInput
    ? args.canonicalInput.canonicalWordCount
    : recomputed > 0
      ? recomputed
      : args.storedWordCount != null && args.storedWordCount > 0
        ? args.storedWordCount
        : 0;
  const characterCount =
    args.characterCount != null && args.characterCount > 0
      ? args.characterCount
      : text.length;
  const fullText = args.sentChars >= text.length && text.length > 0;
  const wordsAnalyzed = fullText
    ? canonical
    : manuscriptWordsInCharSlice(text, args.sentChars, canonical);

  return {
    manuscript_id: args.manuscriptId,
    manuscript_version_id: args.manuscriptVersionId ?? null,
    canonical_word_count: canonical,
    count_method: STORYDNA_COUNT_METHOD,
    character_count: characterCount,
    full_text_supplied: fullText,
    scope: fullText ? "full_manuscript" : "partial_manuscript",
    scope_start: fullText ? 0 : 0,
    scope_end: fullText ? text.length : args.sentChars,
    words_analyzed: wordsAnalyzed,
    statistics_source: args.manuscriptVersionId ? "manuscript_version" : "manuscript_legacy",
    statistics_validation_status: "pending",
  };
}

function scopeLabel(scope: ReviewScope): string {
  switch (scope) {
    case "full_manuscript":
      return "Full manuscript";
    case "partial_manuscript":
      return "Partial manuscript (model input limit)";
    case "chapter_segment":
      return "Chapter segment";
    case "notes_based":
      return "Notes-based";
    default:
      return scope;
  }
}

/** Strongly delimited prompt block injected into every review path. */
export function authoritativeStatisticsBlock(stats: ReviewStatistics): string {
  if (stats.canonical_word_count <= 0) return "";

  return `

═══════════════════════════════════════════════════════════════
CANONICAL MANUSCRIPT LENGTH
═══════════════════════════════════════════════════════════════
The manuscript is exactly ${stats.canonical_word_count.toLocaleString()} words by StoryDNA's analytical counter.
Do not estimate, round, infer, or replace this number.
Any length recommendation must use this exact count as its starting point.

- canonical_word_count: ${stats.canonical_word_count.toLocaleString()}
- count_method: ${stats.count_method}
- manuscript_version_id: ${stats.manuscript_version_id ?? "legacy"}
- Required memo sentence (exactly once): "${canonicalManuscriptLengthSentence(stats.canonical_word_count)}"
- Words analyzed in this review: ${stats.words_analyzed.toLocaleString()}
- Full manuscript supplied: ${stats.full_text_supplied ? "true" : "false"}
- Review scope: ${scopeLabel(stats.scope)}

MANDATORY RULES:
- canonical_word_count and count_method are authoritative for all review arithmetic.
- Use ONLY the StoryDNA analytical count — never Microsoft Word embedded counts or legacy split counts.
- Do not estimate manuscript length.
- Do not infer length from pages, characters, tokens, excerpts, or reading time.
- Do not contradict, round away, or replace the exact total.
- Any length-based recommendation must use the exact authoritative count (${stats.canonical_word_count.toLocaleString()} words).
- The acquisitions memo MUST include exactly one current-total sentence: "${canonicalManuscriptLengthSentence(stats.canonical_word_count)}"
- Do not use shorthand (150k), ranges (105–115k), page counts, or reading time to estimate total length.
- Do not claim totals such as 130k, 150k, or "well past 150k" or other unsupported round figures.
- Cut recommendations must show current count, cut percentage, cut amount, and resulting count — example 15% cut:
${formatLengthCutBlock(stats.canonical_word_count, 15)}
- If prior review text or supplied material contains a different total, ignore it.
- words_analyzed (${stats.words_analyzed.toLocaleString()}) is coverage for this review — it is NOT total manuscript length.
═══════════════════════════════════════════════════════════════`;
}

/** Minimal statistics block when only word counts are available (craft / screen paths). */
export function statisticsBlockForPrompt(args: {
  wordCount: number;
  wordsAnalyzed?: number;
  fullText?: boolean;
}): string {
  if (args.wordCount <= 0) return "";
  const wordsAnalyzed = args.wordsAnalyzed ?? args.wordCount;
  return authoritativeStatisticsBlock({
    manuscript_id: "",
    manuscript_version_id: null,
    canonical_word_count: args.wordCount,
    count_method: STORYDNA_COUNT_METHOD,
    character_count: 0,
    full_text_supplied: args.fullText ?? true,
    scope: args.fullText === false ? "partial_manuscript" : "full_manuscript",
    scope_start: 0,
    scope_end: null,
    words_analyzed: wordsAnalyzed,
    statistics_source: "manuscript_legacy",
    statistics_validation_status: "pending",
  });
}
