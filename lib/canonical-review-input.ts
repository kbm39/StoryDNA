/**
 * Immutable canonical review input — single source of truth before any AI call.
 */

import { countManuscriptWords } from "./word-count.ts";
import { STORYDNA_COUNT_METHOD } from "./word-count-reporting.ts";

export interface CanonicalReviewInput {
  canonicalWordCount: number;
  countMethod: typeof STORYDNA_COUNT_METHOD;
  manuscriptVersionId: string | null;
  manuscriptContentHash: string | null;
  storedWordCount: number;
  recomputedWordCount: number;
}

export type CanonicalReviewInputResult =
  | { ok: true; input: CanonicalReviewInput }
  | {
      ok: false;
      error: string;
      storedWordCount: number | null;
      recomputedWordCount: number;
    };

export interface BuildCanonicalReviewInputArgs {
  manuscriptVersionId: string | null;
  extractedText: string;
  storedWordCount: number | null;
  contentHash?: string | null;
}

/** Verify stored manuscript_version.word_count matches an independent recount. */
export function verifyCanonicalWordCount(args: {
  storedWordCount: number | null;
  extractedText: string;
}): { ok: true; recomputedWordCount: number } | { ok: false; error: string; recomputedWordCount: number } {
  const recomputed = countManuscriptWords(args.extractedText);
  if (recomputed <= 0) {
    return {
      ok: false,
      error: "Cannot run review: extracted text produced zero countable words.",
      recomputedWordCount: recomputed,
    };
  }

  const stored = args.storedWordCount;
  if (stored != null && stored > 0 && stored !== recomputed) {
    return {
      ok: false,
      error: `Cannot run review: stored word_count (${stored.toLocaleString()}) does not match independent recount (${recomputed.toLocaleString()}). Re-ingest or backfill before generating a review.`,
      recomputedWordCount: recomputed,
    };
  }

  return { ok: true, recomputedWordCount: recomputed };
}

export function buildCanonicalReviewInput(
  args: BuildCanonicalReviewInputArgs,
): CanonicalReviewInputResult {
  const verification = verifyCanonicalWordCount({
    storedWordCount: args.storedWordCount,
    extractedText: args.extractedText,
  });

  if (!verification.ok) {
    return {
      ok: false,
      error: verification.error,
      storedWordCount: args.storedWordCount,
      recomputedWordCount: verification.recomputedWordCount,
    };
  }

  const canonical = verification.recomputedWordCount;
  return {
    ok: true,
    input: {
      canonicalWordCount: canonical,
      countMethod: STORYDNA_COUNT_METHOD,
      manuscriptVersionId: args.manuscriptVersionId,
      manuscriptContentHash: args.contentHash ?? null,
      storedWordCount: args.storedWordCount ?? canonical,
      recomputedWordCount: canonical,
    },
  };
}
