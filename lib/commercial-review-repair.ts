/**
 * Repair prompt construction and deterministic normalization for tests/dev diagnostics.
 */

import type { WordCountContradiction } from "./word-count-validation.ts";
import type { ProseGradeMatch } from "./prose-grade-validation.ts";
import { buildProseGradeRepairPrompt } from "./prose-grade-validation.ts";

const RUBRIC_MARKER = "<!-- STORYDNA_RUBRIC_JSON -->";

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

function formatCutExamples(canonicalWordCount: number): string {
  const cut20 = Math.round(canonicalWordCount * 0.8);
  const cut25 = Math.round(canonicalWordCount * 0.75);
  return `- 20% cut from ${canonicalWordCount.toLocaleString()} → ~${cut20.toLocaleString()} words
- 25% cut from ${canonicalWordCount.toLocaleString()} → ~${cut25.toLocaleString()} words`;
}

/** Full repair prompt for one model pass — includes every detected contradiction. */
export function buildCommercialReviewRepairPrompt(
  args: CommercialReviewRepairPromptArgs,
): string {
  const sections: string[] = [
    "The acquisitions memo below failed StoryDNA validation. Apply ALL corrections in one pass.",
    "",
    `AUTHORITATIVE MANUSCRIPT LENGTH: ${args.canonicalWordCount.toLocaleString()} words (exact — never estimate, round away, or substitute shorthand).`,
    "",
    "MANDATORY REPAIR REQUIREMENTS:",
    `1. Open the memo with this exact sentence: "The manuscript is ${args.canonicalWordCount.toLocaleString()} words."`,
    "2. Remove EVERY inconsistent total-length statement, shorthand (150k, ~150k, 150k-ish), approximate total (about/roughly/around), page-count proxy, reading-time proxy, and invalid target range that contradicts the authoritative total.",
    "3. Recalculate EVERY percentage-cut recommendation and EVERY resulting/target word count from the authoritative total above.",
    formatCutExamples(args.canonicalWordCount),
    "4. Do NOT assign an independent prose letter grade (no **Grade: X**, Overall grade, Final grade, or letter grade lines). The application adds the calculated grade.",
    args.memoOnly
      ? "5. Output memo prose ONLY — do NOT append STORYDNA_RUBRIC_JSON or any JSON block."
      : "5. Preserve the STORYDNA_RUBRIC_JSON block at the end — update length_recommendations arithmetic inside JSON if present; do not delete categories or evidence.",
    "6. Revise any narrative conclusions that still depend on the wrong total length (acquisition positioning, pacing diagnosis tied to wrong scale, etc.).",
  ];

  if (args.wordCountErrors?.length) {
    sections.push("", "VALIDATION ERRORS:", ...args.wordCountErrors.map((e) => `- ${e}`));
  }

  if (args.wordCountContradictions.length > 0) {
    sections.push("", "EVERY LENGTH CONTRADICTION TO FIX:");
    args.wordCountContradictions.forEach((c, i) => {
      sections.push(
        `${i + 1}. "${c.quotation}"`,
        `   Rule: ${c.reason}`,
      );
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

/** Deterministic normalization for unit tests — not a substitute for model repair in production. */
export function normalizeCommercialReviewStatisticsText(args: {
  content: string;
  canonicalWordCount: number;
  calculatedLetterGrade?: string;
  manuscriptScore?: number;
}): string {
  const markerIdx = args.content.indexOf(RUBRIC_MARKER);
  const rubricTail = markerIdx >= 0 ? args.content.slice(markerIdx) : "";
  const cut20 = Math.round(args.canonicalWordCount * 0.8);
  const cut25 = Math.round(args.canonicalWordCount * 0.75);
  const exactOpen = `The manuscript is ${args.canonicalWordCount.toLocaleString()} words.`;

  let memo =
    markerIdx >= 0
      ? args.content.slice(0, markerIdx)
      : args.content;

  memo = memo
    .replace(/^\s*This is a 150k-ish draft\.?\s*$/gim, "")
    .replace(/^\s*There is a 105[–—-]115k book inside this\.?\s*$/gim, "")
    .replace(
      /^\s*Cut 20[–—-]25% to reach 105[–—-]115k\.?\s*$/gim,
      `A 20% cut yields approximately ${cut20.toLocaleString()} words.\nA 25% cut yields approximately ${cut25.toLocaleString()} words.`,
    )
    .replace(/\*\*Grade:\s*[A-F][+-]?\*\*/gi, "")
    .replace(/\b150\s*k\s*-?\s*ish\b/gi, "")
    .replace(/\b~?\s*150\s*k\b/gi, "")
    .replace(/\b105\s*[–—-]\s*115\s*k\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!new RegExp(`\\b${args.canonicalWordCount.toLocaleString()}\\s+words\\b`, "i").test(memo)) {
    memo = memo.replace(/^\s*/, "");
  }

  memo = `${exactOpen}\n\n${memo}`.replace(/\n{3,}/g, "\n\n").trim();

  if (args.calculatedLetterGrade && args.manuscriptScore != null) {
    memo = memo.replace(/\*\*Grade:\s*[A-F][+-]?\*\*/gi, "");
    if (!memo.includes("Commercial acquisition grade (calculated):")) {
      memo += `\n\n**Commercial acquisition grade (calculated): ${args.calculatedLetterGrade}** (${args.manuscriptScore}/100 — computed by StoryDNA from validated rubric scores; not author-selected.)`;
    }
  }

  return rubricTail ? `${memo}\n\n${rubricTail}` : memo;
}
