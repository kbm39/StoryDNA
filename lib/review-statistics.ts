/**
 * Authoritative manuscript statistics for review generation and validation.
 * Canonical length always comes from stored manuscript version text — never from model estimates.
 */

import { countManuscriptWords, manuscriptWordsInCharSlice } from "./word-count.ts";

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
  /** Stored word_count from DB when available; recomputed from text if missing. */
  storedWordCount?: number | null;
  characterCount?: number | null;
}

/** Resolve canonical counts from stored manuscript / version snapshot. */
export function buildReviewStatistics(args: BuildReviewStatisticsArgs): ReviewStatistics {
  const text = args.extractedText ?? "";
  const recomputed = countManuscriptWords(text);
  // Authoritative length always comes from extracted_text — never a stale DB column.
  const canonical =
    recomputed > 0
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
MANUSCRIPT STATISTICS — AUTHORITATIVE
═══════════════════════════════════════════════════════════════
- Exact total manuscript word count: ${stats.canonical_word_count.toLocaleString()}
- Words analyzed in this review: ${stats.words_analyzed.toLocaleString()}
- Full manuscript supplied: ${stats.full_text_supplied ? "true" : "false"}
- Review scope: ${scopeLabel(stats.scope)}

MANDATORY RULES:
- These values are authoritative.
- Do not estimate manuscript length.
- Do not infer length from pages, characters, tokens, excerpts, or reading time.
- Do not contradict, round away, or replace the exact total.
- Any length-based recommendation must use the exact authoritative count (${stats.canonical_word_count.toLocaleString()} words).
- The acquisitions memo MUST state the exact total once, e.g. "The manuscript is ${stats.canonical_word_count.toLocaleString()} words."
- Do not use shorthand (150k), ranges (105–115k), page counts, or reading time to estimate total length.
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
