/**
 * Dual-count reporting: StoryDNA analytical vs Microsoft Word embedded DOCX count.
 */

export const STORYDNA_COUNT_METHOD = "STORYDNA_UNICODE_V1" as const;

export const WORD_COUNT_DUAL_EXPLANATION =
  "Word processors use different tokenization rules. StoryDNA uses its consistent Unicode-aware analytical counter for reviews, scoring, percentages, and revision comparisons.";

/** Hold Fast · Hold_Fast_Book1_The_Reckoning-3(1).docx — independently verified regression fixture. */
export const HOLD_FAST_WORD_COUNT_FIXTURE = {
  sourceDocumentWordCount: 111_576,
  canonicalWordCount: 111_491,
  legacySplitCount: 111_441,
  differenceWords: 85,
  percentDifference: 0.08,
} as const;

/** Legacy whitespace-split count (pre-canonical ingestion heuristic). */
export function legacyWhitespaceSplitCount(text: string | null | undefined): number {
  if (!text) return 0;
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Required Literary Agent memo sentence — exactly one current-total statement. */
export function canonicalManuscriptLengthSentence(canonicalWordCount: number): string {
  return `The manuscript is ${canonicalWordCount.toLocaleString("en-US")} words.`;
}

/** @deprecated Use canonicalManuscriptLengthSentence — kept for import stability. */
export function storyDnaAnalyticalOpening(canonicalWordCount: number): string {
  return canonicalManuscriptLengthSentence(canonicalWordCount);
}

export interface DualWordCountDisplay {
  canonicalWordCount: number;
  sourceDocumentWordCount: number | null;
  differenceWords: number | null;
  percentDifference: number | null;
  percentDifferenceLabel: string | null;
  sourceUnavailable: boolean;
}

/** Format absolute and relative difference between analytical and Word counts. */
export function dualWordCountDisplay(args: {
  canonicalWordCount: number | null | undefined;
  sourceDocumentWordCount: number | null | undefined;
}): DualWordCountDisplay | null {
  const canonical = args.canonicalWordCount ?? 0;
  if (canonical <= 0) return null;

  const source = args.sourceDocumentWordCount;
  if (source == null || source <= 0) {
    return {
      canonicalWordCount: canonical,
      sourceDocumentWordCount: null,
      differenceWords: null,
      percentDifference: null,
      percentDifferenceLabel: null,
      sourceUnavailable: true,
    };
  }

  const differenceWords = Math.abs(source - canonical);
  const percentDifference = (differenceWords / canonical) * 100;
  return {
    canonicalWordCount: canonical,
    sourceDocumentWordCount: source,
    differenceWords,
    percentDifference,
    percentDifferenceLabel: `${percentDifference.toFixed(2)}%`,
    sourceUnavailable: false,
  };
}
