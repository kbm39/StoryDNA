/**
 * Repair prompt construction and deterministic memo statistics normalization.
 */

import { calculateLengthCut } from "./length-cut-arithmetic.ts";
import { canonicalManuscriptLengthSentence } from "./word-count-reporting.ts";
import type { WordCountContradiction } from "./word-count-validation.ts";
import {
  hasExactCanonicalStatement,
  parseCompoundCutRanges,
  parseLinkedCutRecommendations,
  validateWordCountClaims,
} from "./word-count-validation.ts";
import type { ProseGradeMatch } from "./prose-grade-validation.ts";
import { buildProseGradeRepairPrompt } from "./prose-grade-validation.ts";

const RUBRIC_MARKER = "<!-- STORYDNA_RUBRIC_JSON -->";
const ANY_CANONICAL_OPENING = /^The manuscript is [\d,]+ words\.?\s*$/gim;

export interface CommercialMemoRepairPromptArgs {
  canonicalWordCount: number;
  memoContent: string;
  wordCountContradictions: WordCountContradiction[];
  wordCountErrors?: string[];
  proseGradeConflict?: ProseGradeMatch;
  calculatedLetterGrade?: string;
  manuscriptScore?: number;
}

/** Memo-only repair prompt (Call A) — no rubric JSON preservation. */
export function buildCommercialMemoRepairPrompt(
  args: CommercialMemoRepairPromptArgs,
): string {
  return buildCommercialReviewRepairPrompt({
    ...args,
    reviewContent: args.memoContent,
    memoOnly: true,
  });
}

export interface CommercialReviewRepairPromptArgs {
  canonicalWordCount: number;
  reviewContent: string;
  wordCountContradictions: WordCountContradiction[];
  wordCountErrors?: string[];
  proseGradeConflict?: ProseGradeMatch;
  calculatedLetterGrade?: string;
  manuscriptScore?: number;
  /** When true, omit rubric-preservation instructions (two-call pipeline memo repair). */
  memoOnly?: boolean;
}

export type MemoStatisticsNormalizationResult =
  | { ok: true; content: string; changed: boolean }
  | {
      ok: false;
      error: string;
      content: string;
      unclassifiedContradictions: WordCountContradiction[];
    };

function formatCutExamples(canonicalWordCount: number): string {
  const cut20 = calculateLengthCut(canonicalWordCount, 20).resulting;
  const cut25 = calculateLengthCut(canonicalWordCount, 25).resulting;
  return `- 20% cut from ${canonicalWordCount.toLocaleString("en-US")} → ~${cut20.toLocaleString("en-US")} words
- 25% cut from ${canonicalWordCount.toLocaleString("en-US")} → ~${cut25.toLocaleString("en-US")} words`;
}

/** Full repair prompt for one model pass — includes every detected contradiction. */
export function buildCommercialReviewRepairPrompt(
  args: CommercialReviewRepairPromptArgs,
): string {
  const exactOpen = canonicalManuscriptLengthSentence(args.canonicalWordCount);
  const sections: string[] = [
    "The acquisitions memo below failed StoryDNA validation. Apply ALL corrections in one pass.",
    "",
    `AUTHORITATIVE MANUSCRIPT LENGTH: ${args.canonicalWordCount.toLocaleString("en-US")} words (exact — never estimate, round away, or substitute shorthand).`,
    "",
    "MANDATORY REPAIR REQUIREMENTS:",
    "1. Preserve the memo's editorial analysis, structure, section headings, and evidence-backed findings.",
    `2. Include exactly one current-total sentence at the top: "${exactOpen}"`,
    "3. Remove or rewrite EVERY conflicting current-total claim, approximate total, shorthand (150k, ~150k, 150k-ish), page-count proxy, reading-time proxy, and invalid target range that contradicts the authoritative total.",
    "4. Recalculate EVERY percentage-cut recommendation and EVERY resulting/target word count from the authoritative total above.",
    formatCutExamples(args.canonicalWordCount),
    "5. Remove stale derived numbers that cannot be reconciled with the authoritative total.",
    "6. Do NOT assign an independent prose letter grade (no **Grade: X**, Overall grade, Final grade, or letter grade lines). The application adds the calculated grade.",
    args.memoOnly
      ? "7. Output the complete repaired memo only — no commentary, no STORYDNA_RUBRIC_JSON or any JSON block."
      : "7. Preserve the STORYDNA_RUBRIC_JSON block at the end — update length_recommendations arithmetic inside JSON if present; do not delete categories or evidence.",
    "8. Never reuse word counts from earlier manuscript versions, staging/dev runs, prior reviews, or any source other than the authoritative total above.",
    "9. Revise any narrative conclusions that still depend on the wrong total length (acquisition positioning, pacing diagnosis tied to wrong scale, etc.).",
  ];

  if (args.wordCountErrors?.length) {
    sections.push("", "VALIDATION ERRORS:", ...args.wordCountErrors.map((e) => `- ${e}`));
  }

  if (args.wordCountContradictions.length > 0) {
    sections.push("", "EVERY LENGTH CONTRADICTION TO FIX:");
    args.wordCountContradictions.forEach((c, i) => {
      sections.push(`${i + 1}. "${c.quotation}"`, `   Rule: ${c.reason}`);
    });
  }

  if (args.proseGradeConflict && args.calculatedLetterGrade && args.manuscriptScore != null) {
    sections.push(
      "",
      buildProseGradeRepairPrompt({
        calculatedLetterGrade: args.calculatedLetterGrade,
        manuscriptScore: args.manuscriptScore,
        conflict: args.proseGradeConflict,
        reviewContent: "",
      }).replace(/\n---\nMEMO TO CORRECT:\n\n$/, ""),
    );
  }

  sections.push("", "---", "MEMO TO CORRECT:", "", args.reviewContent);
  return sections.join("\n");
}

function splitMemoAndRubricTail(content: string): { memo: string; rubricTail: string } {
  const markerIdx = content.indexOf(RUBRIC_MARKER);
  if (markerIdx < 0) return { memo: content, rubricTail: "" };
  return {
    memo: content.slice(0, markerIdx),
    rubricTail: content.slice(markerIdx),
  };
}

function joinMemoAndRubricTail(memo: string, rubricTail: string): string {
  if (!rubricTail) return memo;
  return `${memo.trim()}\n\n${rubricTail}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function enforceSingleCanonicalOpening(memo: string, canonicalWordCount: number): string {
  const exactOpen = canonicalManuscriptLengthSentence(canonicalWordCount);
  const body = memo.replace(ANY_CANONICAL_OPENING, "").trim();
  return `${exactOpen}\n\n${body}`.replace(/\n{3,}/g, "\n\n").trim();
}

function countCanonicalOpeningSentences(memo: string, canonicalWordCount: number): number {
  const exactOpen = canonicalManuscriptLengthSentence(canonicalWordCount);
  const escaped = exactOpen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (memo.match(new RegExp(escaped, "gi")) ?? []).length;
}

function replaceLinkedCutResultingTotals(memo: string, canonicalWordCount: number): string {
  let next = memo;
  const linkedCuts = parseLinkedCutRecommendations(next, canonicalWordCount)
    .filter((cut) => !cut.valid)
    .sort((a, b) => b.spanStart - a.spanStart);

  for (const cut of linkedCuts) {
    const expected = calculateLengthCut(canonicalWordCount, cut.cutPercentage).resulting;
    const span = next.slice(cut.spanStart, cut.spanEnd);
    const updatedSpan = span.replace(/\d{1,3}(?:,\d{3})+/, formatCount(expected));
    if (updatedSpan === span) continue;
    next = next.slice(0, cut.spanStart) + updatedSpan + next.slice(cut.spanEnd);
  }

  return next;
}

function replaceInvalidCompoundCutRanges(memo: string, canonicalWordCount: number): string {
  let next = memo;
  const ranges = parseCompoundCutRanges(next, canonicalWordCount)
    .filter((range) => !range.valid)
    .sort((a, b) => b.spanStart - a.spanStart);

  for (const range of ranges) {
    const span = next.slice(range.spanStart, range.spanEnd);
    let updated = span;
    const pctMin = range.cutPercentageMin;
    const pctMax = range.cutPercentageMax ?? pctMin;

    if (pctMin != null && range.cutAmountMin != null && range.cutAmountMax != null) {
      const expectedCutMin = calculateLengthCut(canonicalWordCount, pctMin).cutAmount;
      const expectedCutMax = calculateLengthCut(canonicalWordCount, pctMax!).cutAmount;
      updated = replaceFirstNumber(updated, range.cutAmountMin, expectedCutMin);
      updated = replaceFirstNumber(updated, range.cutAmountMax, expectedCutMax);
    }

    if (pctMin != null && range.resultingTotalMin != null && range.resultingTotalMax != null) {
      const expectedResultMin = calculateLengthCut(canonicalWordCount, pctMax!).resulting;
      const expectedResultMax = calculateLengthCut(canonicalWordCount, pctMin).resulting;
      updated = replaceFirstNumber(updated, range.resultingTotalMin, expectedResultMin);
      updated = replaceFirstNumber(updated, range.resultingTotalMax, expectedResultMax);
    }

    if (updated !== span) {
      next = next.slice(0, range.spanStart) + updated + next.slice(range.spanEnd);
    }
  }

  return next;
}

function replaceFirstNumber(text: string, from: number, to: number): string {
  const fromText = formatCount(from);
  const toText = formatCount(to);
  const idx = text.indexOf(fromText);
  if (idx < 0) return text;
  return text.slice(0, idx) + toText + text.slice(idx + fromText.length);
}

function replaceStaleInlineTotalDescriptors(memo: string, canonicalWordCount: number): string {
  const canonicalText = formatCount(canonicalWordCount);
  let next = memo.replace(/\bat (\d{1,3}(?:,\d{3})+) words\b/gi, (match, raw: string) => {
    const value = parseInt(raw.replace(/,/g, ""), 10);
    return value === canonicalWordCount ? match : `at ${canonicalText} words`;
  });

  next = next.replace(/\b(\d{1,3}(?:,\d{3})+)-word\b/g, (match, raw: string) => {
    const value = parseInt(raw.replace(/,/g, ""), 10);
    return value === canonicalWordCount ? match : `${canonicalText}-word`;
  });

  return next;
}

function isSafelyNormalizableContradiction(contradiction: WordCountContradiction): boolean {
  if (contradiction.claimType === "resulting_total") return true;
  if (contradiction.claimType === "current_total") {
    return !contradiction.quotation.startsWith("Multiple conflicting current-length totals");
  }
  return false;
}

/**
 * Deterministic memo statistics normalization after model repair.
 * Fail-closed when a remaining contradiction cannot be safely classified.
 */
export function normalizeCommercialMemoStatistics(args: {
  memoContent: string;
  canonicalWordCount: number;
}): MemoStatisticsNormalizationResult {
  const { canonicalWordCount } = args;
  if (canonicalWordCount <= 0) {
    return {
      ok: false,
      error: "Cannot normalize memo statistics without a positive canonical word count.",
      content: args.memoContent,
      unclassifiedContradictions: [],
    };
  }

  const { memo: memoBody, rubricTail } = splitMemoAndRubricTail(args.memoContent);
  let memo = memoBody;

  if (countCanonicalOpeningSentences(memo, canonicalWordCount) > 1) {
    return {
      ok: false,
      error: "Duplicate canonical current-total sentences detected.",
      content: args.memoContent,
      unclassifiedContradictions: [],
    };
  }

  let changed = memo !== memoBody;

  const normalizedOpening = enforceSingleCanonicalOpening(memo, canonicalWordCount);
  if (normalizedOpening !== memo) {
    memo = normalizedOpening;
    changed = true;
  }

  const afterLinkedCuts = replaceLinkedCutResultingTotals(memo, canonicalWordCount);
  if (afterLinkedCuts !== memo) {
    memo = afterLinkedCuts;
    changed = true;
  }

  const afterCompoundCuts = replaceInvalidCompoundCutRanges(memo, canonicalWordCount);
  if (afterCompoundCuts !== memo) {
    memo = afterCompoundCuts;
    changed = true;
  }

  const afterInlineTotals = replaceStaleInlineTotalDescriptors(memo, canonicalWordCount);
  if (afterInlineTotals !== memo) {
    memo = afterInlineTotals;
    changed = true;
  }

  const validation = validateWordCountClaims(memo, canonicalWordCount);

  const content = joinMemoAndRubricTail(memo, rubricTail);
  if (validation.valid && hasExactCanonicalStatement(content, canonicalWordCount)) {
    return { ok: true, content, changed };
  }

  const unclassifiedContradictions = validation.contradictions.filter(
    (contradiction) => !isSafelyNormalizableContradiction(contradiction),
  );
  const remainingUnsafe = validation.contradictions.filter(
    (contradiction) =>
      isSafelyNormalizableContradiction(contradiction) &&
      !validation.valid,
  );

  const error =
    validation.errors[0] ??
    unclassifiedContradictions[0]?.reason ??
    remainingUnsafe[0]?.reason ??
    "Memo statistics normalization could not resolve all length contradictions.";

  return {
    ok: false,
    error,
    content,
    unclassifiedContradictions:
      unclassifiedContradictions.length > 0 ? unclassifiedContradictions : validation.contradictions,
  };
}

/** Deterministic normalization for legacy combined-output tests — not a substitute for model repair in production. */
export function normalizeCommercialReviewStatisticsText(args: {
  content: string;
  canonicalWordCount: number;
  calculatedLetterGrade?: string;
  manuscriptScore?: number;
}): string {
  const markerIdx = args.content.indexOf(RUBRIC_MARKER);
  const rubricTail = markerIdx >= 0 ? args.content.slice(markerIdx) : "";
  const cut20 = calculateLengthCut(args.canonicalWordCount, 20).resulting;
  const cut25 = calculateLengthCut(args.canonicalWordCount, 25).resulting;

  let memo =
    markerIdx >= 0
      ? args.content.slice(0, markerIdx)
      : args.content;

  memo = memo
    .replace(/^\s*This is a 150k-ish draft\.?\s*$/gim, "")
    .replace(/^\s*There is a 105[–—-]115k book inside this\.?\s*$/gim, "")
    .replace(
      /^\s*Cut 20[–—-]25% to reach 105[–—-]115k\.?\s*$/gim,
      `A 20% cut yields approximately ${formatCount(cut20)} words.\nA 25% cut yields approximately ${formatCount(cut25)} words.`,
    )
    .replace(/\*\*Grade:\s*[A-F][+-]?\*\*/gi, "")
    .replace(/\b150\s*k\s*-?\s*ish\b/gi, "")
    .replace(/\b~?\s*150\s*k\b/gi, "")
    .replace(/\b105\s*[–—-]\s*115\s*k\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const normalized = normalizeCommercialMemoStatistics({
    memoContent: memo,
    canonicalWordCount: args.canonicalWordCount,
  });
  memo = normalized.ok ? normalized.content : normalized.content;

  if (args.calculatedLetterGrade && args.manuscriptScore != null) {
    memo = memo.replace(/\*\*Grade:\s*[A-F][+-]?\*\*/gi, "");
    if (!memo.includes("Commercial acquisition grade (calculated):")) {
      memo += `\n\n**Commercial acquisition grade (calculated): ${args.calculatedLetterGrade}** (${args.manuscriptScore}/100 — computed by StoryDNA from validated rubric scores; not author-selected.)`;
    }
  }

  return rubricTail ? `${memo}\n\n${rubricTail}` : memo;
}
