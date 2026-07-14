/**
 * Detect manuscript-length claims in review text that contradict canonical word count.
 * Classifies numeric references as CURRENT_TOTAL, RESULTING_TOTAL, or CUT_AMOUNT.
 */

import { buildCommercialReviewRepairPrompt } from "./commercial-review-repair.ts";

export type LengthClaimType = "current_total" | "resulting_total" | "cut_amount";

export interface WordCountContradiction {
  /** Verbatim excerpt from the review containing the claim. */
  quotation: string;
  /** Normalized numeric claim (words), when applicable. */
  claimedWords: number;
  /** Whether the claim used approximate language (about, roughly, ~). */
  approximate: boolean;
  /** Whether shorthand was used (150k, 150k-ish). */
  shorthand: boolean;
  reason: string;
  claimType?: LengthClaimType;
}

export interface WordCountValidationResult {
  valid: boolean;
  contradictions: WordCountContradiction[];
  /** Non-quotation failures (missing exact statement, etc.). */
  errors: string[];
}

/** Default relative tolerance for "about / approximately" claims (~2%). */
export const APPROXIMATE_TOLERANCE_RATIO = 0.02;

/** Absolute tolerance for plain numeric claims without approximate language. */
export const EXACT_TOLERANCE_WORDS = 500;

/** Material inconsistency threshold — always fail shorthand / large drift. */
export const MATERIAL_DRIFT_RATIO = 0.05;

/** Tolerance for cut-math resulting word counts. */
export const CUT_MATH_TOLERANCE_RATIO = 0.01;

/**
 * Editorial rounding tolerance for cut-amount and resulting-total ranges in agent prose.
 * Agent memos round to nearest ~100 words (e.g. 13,379 → "13,400"). 150 words absorbs
 * ±0.1% editorial rounding without accepting materially wrong cut math.
 */
export const EDITORIAL_CUT_RANGE_TOLERANCE_WORDS = 150;

export interface CompoundCutRange {
  cutPercentageMin: number | null;
  cutPercentageMax: number | null;
  cutAmountMin: number | null;
  cutAmountMax: number | null;
  resultingTotalMin: number | null;
  resultingTotalMax: number | null;
  spanStart: number;
  spanEnd: number;
  quotation: string;
  valid: boolean;
}

const APPROX_WORDS =
  /\b(?:about|approximately|approx\.?|roughly|around|~|comfortably|likely|probably|estimated|estimate of|est\.)\b/i;

const LENGTH_CONTEXT =
  /\b(word|words|manuscript|draft|novel|book|length|count|size|total|page|pages|reading time|read time)\b/i;

const CURRENT_TOTAL_INDICATORS =
  /\b(?:the\s+)?(?:manuscript|book|draft|novel)\s+is\b|\b(?:manuscript|book|draft|novel)\s+runs\b|\bcomes in at\b|\bcurrent(?:ly)?\s+(?:length|runs|totals?|stands)\b|\b(?:totals?|stands)\s+at\b|\b(?:draft|book|manuscript)\s+currently\b|\b\d{1,3}(?:,\d{3})+\s*[-–—]?\s*word\s+(?:manuscript|novel|draft|book)\b/i;

const RESULTING_TOTAL_INDICATORS =
  /\b(?:would bring|would land|would result|would get|would reach|after a cut|after reducing|after trimming|target(?:\s+length)?|revised manuscript|post-cut|resulting word count|resulting in|trim to|cut to|bring the book to|land the book|down to|yields?|yielding|leaves?|produces?|bringing)\b/i;

const CUT_AMOUNT_INDICATORS =
  /\b(?:savings|saving|remove|removed|cut approximately|delete|trim|reduce by|reduction of|words distributed|est\.?\s*savings|\d+\s*[–—-]\s*\d+\s*%\s*(?:reduction|cut))\b/i;

const REDUCTION_CLAUSE_INDICATORS =
  /\b(?:reduction|reduce|cut|remove|trim|savings)\b/i;

function memoBody(text: string): string {
  return text.split("<!-- STORYDNA_RUBRIC_JSON -->")[0] ?? text;
}

/** Memo prose plus any trailing text after the rubric JSON block. */
function scannableReviewText(text: string): string {
  const marker = "<!-- STORYDNA_RUBRIC_JSON -->";
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const rest = text.slice(idx + marker.length);
  const lastBrace = rest.lastIndexOf("}");
  const afterJson = lastBrace >= 0 ? rest.slice(lastBrace + 1) : "";
  return `${before}${afterJson}`;
}

function parseKValue(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  const kMatch = s.match(/^(\d+(?:\.\d+)?)\s*k(?:\s*-?\s*ish)?$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const n = parseInt(s.replace(/\./g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseWordNumber(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/,/g, "");
  if (/k/.test(cleaned)) return parseKValue(cleaned);
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function withinTolerance(
  claimed: number,
  canonical: number,
  approximate: boolean,
): boolean {
  const diff = Math.abs(claimed - canonical);
  if (approximate) {
    return diff <= Math.max(EXACT_TOLERANCE_WORDS, canonical * APPROXIMATE_TOLERANCE_RATIO);
  }
  return diff <= EXACT_TOLERANCE_WORDS;
}

function cutMathTolerance(canonical: number): number {
  return Math.max(500, Math.round(canonical * CUT_MATH_TOLERANCE_RATIO));
}

function cutAmountFromPct(canonical: number, cutPct: number): number {
  return Math.round(canonical * (cutPct / 100));
}

function resultingFromCut(canonical: number, cutPct: number): number {
  return Math.round(canonical * (1 - cutPct / 100));
}

function rangesOverlapWithTolerance(
  claimedMin: number,
  claimedMax: number,
  expectedMin: number,
  expectedMax: number,
  tolerance: number,
): boolean {
  return claimedMax >= expectedMin - tolerance && claimedMin <= expectedMax + tolerance;
}

function validateCompoundCutRange(range: CompoundCutRange, canonicalWordCount: number): boolean {
  const tol = EDITORIAL_CUT_RANGE_TOLERANCE_WORDS;
  const pctMin = range.cutPercentageMin;
  const pctMax = range.cutPercentageMax ?? pctMin;

  if (pctMin != null && range.cutAmountMin != null && range.cutAmountMax != null) {
    const expectedCutMin = cutAmountFromPct(canonicalWordCount, pctMin);
    const expectedCutMax = cutAmountFromPct(canonicalWordCount, pctMax!);
    if (
      !rangesOverlapWithTolerance(
        range.cutAmountMin,
        range.cutAmountMax,
        expectedCutMin,
        expectedCutMax,
        tol,
      )
    ) {
      return false;
    }
  }

  if (pctMin != null && range.resultingTotalMin != null && range.resultingTotalMax != null) {
    const expectedResultMin = resultingFromCut(canonicalWordCount, pctMax!);
    const expectedResultMax = resultingFromCut(canonicalWordCount, pctMin);
    if (
      !rangesOverlapWithTolerance(
        range.resultingTotalMin,
        range.resultingTotalMax,
        expectedResultMin,
        expectedResultMax,
        tol,
      )
    ) {
      return false;
    }
  }

  if (
    pctMin == null &&
    range.cutAmountMin != null &&
    range.cutAmountMax != null &&
    range.resultingTotalMin != null &&
    range.resultingTotalMax != null
  ) {
    const expectedResultMin = canonicalWordCount - range.cutAmountMax;
    const expectedResultMax = canonicalWordCount - range.cutAmountMin;
    if (
      !rangesOverlapWithTolerance(
        range.resultingTotalMin,
        range.resultingTotalMax,
        expectedResultMin,
        expectedResultMax,
        tol,
      )
    ) {
      return false;
    }
  }

  return true;
}

/** Parse compound cut clauses with linked percentage, cut-amount, and resulting-total ranges. */
export function parseCompoundCutRanges(text: string, canonicalWordCount: number): CompoundCutRange[] {
  const body = scannableReviewText(text);
  const out: CompoundCutRange[] = [];

  type PatternSpec = {
    re: RegExp;
    map: (m: RegExpExecArray) => Omit<CompoundCutRange, "spanStart" | "spanEnd" | "quotation" | "valid">;
  };

  const patterns: PatternSpec[] = [
    {
      // a 12–18% reduction (approximately 13,400 to 20,100 words, bringing … to roughly 91,400–98,100 words)
      re: /\b(?:a|an)?\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*%\s*(?:reduction|cut)\s*\(\s*(?:approximately|roughly|about)?\s*(\d{1,3}(?:,\d{3})+)\s+(?:to|and)\s+(\d{1,3}(?:,\d{3})+)\s+words?\s*,\s*(?:bringing|leaving|resulting|landing)[^)]*?(?:roughly|approximately|about)?\s*(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?\s*\)/gi,
      map: (m) => ({
        cutPercentageMin: parseFloat(m[1]),
        cutPercentageMax: parseFloat(m[2]),
        cutAmountMin: parseWordNumber(m[3]),
        cutAmountMax: parseWordNumber(m[4]),
        resultingTotalMin: parseWordNumber(m[5]),
        resultingTotalMax: parseWordNumber(m[6]),
      }),
    },
    {
      // cut 10–15%, or about 11,149–16,724 words, resulting in 94,767–100,342 words
      re: /\bcut\s+(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*%,?\s*(?:or\s+)?(?:about|approximately|roughly)?\s*(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?,?\s*(?:resulting in|leaving|landing)\s+(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?/gi,
      map: (m) => ({
        cutPercentageMin: parseFloat(m[1]),
        cutPercentageMax: parseFloat(m[2]),
        cutAmountMin: parseWordNumber(m[3]),
        cutAmountMax: parseWordNumber(m[4]),
        resultingTotalMin: parseWordNumber(m[5]),
        resultingTotalMax: parseWordNumber(m[6]),
      }),
    },
    {
      // remove between 5,000 and 8,000 words, leaving approximately 103,491–106,491 words
      re: /\b(?:remove|cut|trim)\s+(?:between\s+)?(\d{1,3}(?:,\d{3})+)\s+(?:and|to)\s+(\d{1,3}(?:,\d{3})+)\s+words?,?\s*(?:leaving|resulting in|landing)\s+(?:approximately|roughly|about)?\s*(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?/gi,
      map: (m) => ({
        cutPercentageMin: null,
        cutPercentageMax: null,
        cutAmountMin: parseWordNumber(m[1]),
        cutAmountMax: parseWordNumber(m[2]),
        resultingTotalMin: parseWordNumber(m[3]),
        resultingTotalMax: parseWordNumber(m[4]),
      }),
    },
    {
      // A 12–18% reduction would leave 91,400–98,100 words
      re: /\b(?:a|an)?\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*%\s*(?:reduction|cut)\s+(?:would\s+)?(?:leave|bring|land|result in)\s+(?:roughly|approximately|about)?\s*(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?/gi,
      map: (m) => ({
        cutPercentageMin: parseFloat(m[1]),
        cutPercentageMax: parseFloat(m[2]),
        cutAmountMin: null,
        cutAmountMax: null,
        resultingTotalMin: parseWordNumber(m[3]),
        resultingTotalMax: parseWordNumber(m[4]),
      }),
    },
    {
      // Cut approximately 13,400–20,100 words (cut-amount range only)
      re: /\b(?:cut|remove|trim)\s+(?:approximately|roughly|about)\s+(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s+words?/gi,
      map: (m) => ({
        cutPercentageMin: null,
        cutPercentageMax: null,
        cutAmountMin: parseWordNumber(m[1]),
        cutAmountMax: parseWordNumber(m[2]),
        resultingTotalMin: null,
        resultingTotalMax: null,
      }),
    },
    {
      // Remove 13,400 words, leaving 98,091 words
      re: /\b(?:remove|cut|trim)\s+(\d{1,3}(?:,\d{3})+)\s+words?,?\s*(?:leaving|resulting in|landing)\s+(?:approximately|roughly|about)?\s*(\d{1,3}(?:,\d{3})+)\s+words?/gi,
      map: (m) => ({
        cutPercentageMin: null,
        cutPercentageMax: null,
        cutAmountMin: parseWordNumber(m[1]),
        cutAmountMax: parseWordNumber(m[1]),
        resultingTotalMin: parseWordNumber(m[2]),
        resultingTotalMax: parseWordNumber(m[2]),
      }),
    },
  ];

  for (const { re, map } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const spanStart = m.index;
      const spanEnd = m.index + m[0].length;
      if (out.some((existing) => overlapsSpan(spanStart, spanEnd, existing.spanStart, existing.spanEnd))) {
        continue;
      }

      const fields = map(m);
      if (
        fields.cutAmountMin != null &&
        fields.cutAmountMax != null &&
        fields.cutAmountMin > fields.cutAmountMax
      ) {
        [fields.cutAmountMin, fields.cutAmountMax] = [fields.cutAmountMax, fields.cutAmountMin];
      }
      if (
        fields.resultingTotalMin != null &&
        fields.resultingTotalMax != null &&
        fields.resultingTotalMin > fields.resultingTotalMax
      ) {
        [fields.resultingTotalMin, fields.resultingTotalMax] = [
          fields.resultingTotalMax,
          fields.resultingTotalMin,
        ];
      }

      const range: CompoundCutRange = {
        ...fields,
        spanStart,
        spanEnd,
        quotation: body.slice(Math.max(0, spanStart - 20), Math.min(body.length, spanEnd + 20)).trim(),
        valid: false,
      };

      // Cut-amount-only ranges (no % / resulting) pass without arithmetic check
      if (
        range.cutPercentageMin == null &&
        range.resultingTotalMin == null &&
        range.cutAmountMin != null
      ) {
        range.valid = true;
      } else {
        range.valid = validateCompoundCutRange(range, canonicalWordCount);
      }

      out.push(range);
    }
  }

  return out;
}

function isManuscriptLengthContext(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 120), index + 140).toLowerCase();
  return (
    LENGTH_CONTEXT.test(window) ||
    /\bk(?:\s*-?\s*ish)?\b/.test(window) ||
    /\b(north of|south of|comfortably|approximately|about|roughly|around|inside this|book inside)\b/.test(
      window,
    )
  );
}

/** Classify a word-count reference using surrounding clause context. */
export function classifyLengthClaimContext(
  text: string,
  numberIndex: number,
  numberEnd: number,
): LengthClaimType {
  const before = text.slice(Math.max(0, numberIndex - 100), numberIndex).toLowerCase();
  const after = text.slice(numberEnd, Math.min(text.length, numberEnd + 40)).toLowerCase();
  const clause = text.slice(Math.max(0, numberIndex - 150), Math.min(text.length, numberEnd + 80)).toLowerCase();

  // Reduction/cut clause precedence — linked components override generic current-total detection
  if (REDUCTION_CLAUSE_INDICATORS.test(clause)) {
    if (RESULTING_TOTAL_INDICATORS.test(before)) return "resulting_total";
    if (
      /\b(?:bringing|leaving|resulting|landing|targeting)\b/.test(after) ||
      (RESULTING_TOTAL_INDICATORS.test(clause) && !/\b(?:approximately|roughly|about)\s+\d/i.test(before))
    ) {
      // Number follows resulting indicator in same clause
      const afterWords = after.startsWith(" words");
      if (RESULTING_TOTAL_INDICATORS.test(before) || (/\bto\s+roughly\b/.test(before) && afterWords)) {
        return "resulting_total";
      }
    }
    if (
      CUT_AMOUNT_INDICATORS.test(before) ||
      /\b(?:approximately|roughly|about)\s+\d/i.test(before) ||
      /\d+\s+(?:to|and)\s+\d/i.test(clause.slice(Math.max(0, numberIndex - Math.max(0, numberIndex - 150) - 20)))
    ) {
      // Within "(approximately X to Y words," before bringing/resulting
      const bringingIdx = clause.indexOf("bringing");
      const leavingIdx = clause.indexOf("leaving");
      const resultingIdx = clause.indexOf("resulting");
      const pivotIdx = [bringingIdx, leavingIdx, resultingIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
      const numOffset = numberIndex - Math.max(0, numberIndex - 150);
      if (pivotIdx < 0 || numOffset < pivotIdx) {
        if (/\bwords?\b/.test(after.slice(0, 10))) return "cut_amount";
      }
    }
    if (/\b(?:reduction|cut)\s*\(\s*(?:approximately|roughly|about)?/i.test(clause)) {
      const bringingIdx = clause.search(/\b(?:bringing|leaving|resulting|landing)\b/);
      const numOffset = numberIndex - Math.max(0, numberIndex - 150);
      if (bringingIdx >= 0 && numOffset < bringingIdx) return "cut_amount";
      if (bringingIdx >= 0 && numOffset > bringingIdx) return "resulting_total";
    }
  }

  if (CUT_AMOUNT_INDICATORS.test(before)) return "cut_amount";
  if (RESULTING_TOTAL_INDICATORS.test(before)) return "resulting_total";
  if (CURRENT_TOTAL_INDICATORS.test(before)) return "current_total";

  // "Target length: 89,193 words after a 20% cut" — resulting follows target + after cut in after-context
  if (/target/i.test(before) && /\bafter a cut\b/i.test(after)) return "resulting_total";
  if (/\bafter a \d+/i.test(after)) return "resulting_total";

  // Percent-of-whole savings (not a current total)
  if (/\b(?:est\.?\s*)?savings\b/i.test(before) && /%\s*of\s*the\s+whole/i.test(after)) {
    return "cut_amount";
  }
  if (/%\s*of\s*the\s+whole/i.test(after)) return "cut_amount";

  // Default: treat bare "N words" near length vocabulary as current total
  if (isManuscriptLengthContext(text, numberIndex)) return "current_total";

  return "current_total";
}

/** Extract cut_percentage → resulting_total pairs from a clause or sentence. */
export function parseLinkedCutRecommendations(
  text: string,
  canonicalWordCount: number,
): Array<{
  cutPercentage: number;
  resultingTotal: number;
  spanStart: number;
  spanEnd: number;
  quotation: string;
  valid: boolean;
}> {
  const body = scannableReviewText(text);
  const out: Array<{
    cutPercentage: number;
    resultingTotal: number;
    spanStart: number;
    spanEnd: number;
    quotation: string;
    valid: boolean;
  }> = [];
  const tolerance = cutMathTolerance(canonicalWordCount);

  const patterns = [
    /\b(?:a|an)?\s*(\d+(?:\.\d+)?)\s*%\s*cut(?:\s+would\s+bring(?:\s+(?:the\s+)?book)?\s+to)?\s*(?:roughly\s+|about\s+|approximately\s+)?(\d{1,3}(?:,\d{3})+)\s*words?\b/gi,
    /\band\s+(?:a|an)?\s*(\d+(?:\.\d+)?)\s*%\s*cut\s+to\s+(?:roughly\s+|about\s+|approximately\s+)?(\d{1,3}(?:,\d{3})+)\s*words?\b/gi,
    /\b(?:a|an)?\s*(\d+(?:\.\d+)?)\s*%\s*cut\s+to\s+(?:roughly\s+|about\s+|approximately\s+)?(\d{1,3}(?:,\d{3})+)\s*words?\b/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const cutPct = parseFloat(m[1]);
      const resulting = parseWordNumber(m[2]);
      if (!Number.isFinite(cutPct) || resulting == null) continue;

      const spanStart = m.index;
      const spanEnd = m.index + m[0].length;
      if (out.some((existing) => overlapsSpan(spanStart, spanEnd, existing.spanStart, existing.spanEnd))) {
        continue;
      }

      const expected = resultingFromCut(canonicalWordCount, cutPct);
      const valid = Math.abs(expected - resulting) <= tolerance;
      const quotation = body.slice(Math.max(0, spanStart - 15), Math.min(body.length, spanEnd + 15)).trim();

      out.push({
        cutPercentage: cutPct,
        resultingTotal: resulting,
        spanStart,
        spanEnd,
        quotation,
        valid,
      });
    }
  }

  return out;
}

interface RawMatch {
  quotation: string;
  claimedWords: number;
  approximate: boolean;
  shorthand: boolean;
  index: number;
  matchEnd: number;
  claimType: LengthClaimType;
  dedupeKey: string;
}

function overlapsSpan(index: number, end: number, spanStart: number, spanEnd: number): boolean {
  return index < spanEnd && end > spanStart;
}

function collectMatches(text: string, validatedSpans: Array<{ spanStart: number; spanEnd: number }>): RawMatch[] {
  const body = scannableReviewText(text);
  const matches: RawMatch[] = [];
  const seen = new Set<string>();

  const patterns: Array<{
    re: RegExp;
    approximate: boolean;
    shorthand: boolean;
    group: number;
  }> = [
    { re: /\b(\d+(?:\.\d+)?)\s*[kK]\s*-?\s*ish\b/g, approximate: false, shorthand: true, group: 1 },
    { re: /\broughly\s+(\d+(?:\.\d+)?)\s*[kK]\b/gi, approximate: true, shorthand: true, group: 1 },
    { re: /\b(\d+(?:\.\d+)?)\s*[kK]\b/g, approximate: false, shorthand: true, group: 1 },
    {
      re: /\b(?:about|approximately|approx\.?|roughly|around|~|comfortably)\s+(\d{1,3}(?:,\d{3})+|\d{4,6})\s*words?\b/gi,
      approximate: true,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(?:about|approximately|approx\.?|roughly|around|~|comfortably)\s+(\d+(?:\.\d+)?)\s*[kK](?:\s*-?\s*ish)?\s*(?:words?)?\b/gi,
      approximate: true,
      shorthand: true,
      group: 1,
    },
    {
      re: /\b(?:north of|south of|comfortably\s+(?:north\s+of|over|above)|over|above|more than|exceeding|at least)\s+(\d+(?:\.\d+)?)\s*[kK]\b/gi,
      approximate: false,
      shorthand: true,
      group: 1,
    },
    {
      re: /\b(?:north of|south of|comfortably\s+(?:north\s+of|over|above)|over|above|more than|exceeding|at least)\s+(\d{1,3}(?:,\d{3})+|\d{4,6})\s*words?\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:[–—-]\s*(\d{1,3}(?:,\d{3})+|\d{4,6}))?\s*words?\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(\d+(?:\.\d+)?)\s*[kK]\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/gi,
      approximate: false,
      shorthand: true,
      group: 1,
    },
    {
      re: /\b(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/gi,
      approximate: false,
      shorthand: true,
      group: 1,
    },
    {
      re: /\b(\d{1,3}(?:,\d{3})+)\s*word\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(?:a|an|the)\s+(\d{3,4})\s*[-–—]?\s*page\s+(?:manuscript|novel|draft|book)\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(\d{3,4})\s*[-–—]?\s*page\s+(?:manuscript|novel|draft|book)\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(?:roughly|about|approximately|~)\s*(\d{1,3}(?:,\d{3})+|\d{3,4})\s*pages?\b/gi,
      approximate: true,
      shorthand: false,
      group: 1,
    },
    {
      re: /\b(\d+(?:\.\d+)?)\s*[-–—]?\s*hour\s+(?:read|reading time)\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
    {
      re: /\breading time\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*hours?\b/gi,
      approximate: false,
      shorthand: false,
      group: 1,
    },
  ];

  for (const { re, approximate, shorthand, group } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const raw = m[group];
      let claimed = shorthand ? parseKValue(`${raw}k`) : parseWordNumber(raw);
      if (claimed == null) continue;

      const matchEnd = m.index + m[0].length;
      const matchIndex = m.index;

      if (validatedSpans.some((s) => overlapsSpan(matchIndex, matchEnd, s.spanStart, s.spanEnd))) {
        continue;
      }

      // Page-count heuristic: ~250 words/page for manuscript length estimates.
      if (/page/i.test(m[0]) && claimed < 10_000) {
        claimed = Math.round(claimed * 250);
      }
      // Reading-time heuristic: ~250 wpm × 60 min/hour.
      if (/hour|reading time/i.test(m[0]) && claimed < 10_000) {
        claimed = Math.round(claimed * 250 * 60);
      }

      if (claimed < 10_000 || claimed > 500_000) continue;
      if (!isManuscriptLengthContext(body, m.index) && !shorthand && !/page|hour|reading time/i.test(m[0])) {
        continue;
      }

      const claimType = classifyLengthClaimContext(body, m.index, matchEnd);
      const start = Math.max(0, m.index - 30);
      const end = Math.min(body.length, matchEnd + 50);
      const quotation = body.slice(start, end).trim();
      const normalizedPhrase = m[0].trim().toLowerCase().replace(/\s+/g, " ");
      const dedupeKey = `${m.index}:${matchEnd}:${claimType}:${normalizedPhrase}`;

      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      matches.push({
        quotation,
        claimedWords: claimed,
        approximate: approximate || APPROX_WORDS.test(m[0]),
        shorthand,
        index: m.index,
        matchEnd,
        claimType,
        dedupeKey,
      });
    }
  }

  return matches;
}

/** Detect k/word ranges used as manuscript-length estimates (e.g. "105–115k book inside this"). */
function collectRangeContradictions(text: string, canonicalWordCount: number): WordCountContradiction[] {
  const body = scannableReviewText(text);
  const out: WordCountContradiction[] = [];
  const seen = new Set<string>();

  const rangePatterns = [
    /\b(\d+(?:\.\d+)?)\s*[kK]\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/g,
    /\b(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/g,
    /\b(\d{1,3}(?:,\d{3})+)\s*[–—-]\s*(\d{1,3}(?:,\d{3})+)\s*words?\b/gi,
  ];

  for (const re of rangePatterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const before = body.slice(Math.max(0, m.index - 60), m.index).toLowerCase();
      if (RESULTING_TOTAL_INDICATORS.test(before) || CUT_AMOUNT_INDICATORS.test(before)) {
        continue;
      }
      // Skip ranges inside reduction clauses (handled by parseCompoundCutRanges)
      const clause = body.slice(Math.max(0, m.index - 120), m.index + m[0].length + 40).toLowerCase();
      if (REDUCTION_CLAUSE_INDICATORS.test(clause) && /\d+\s*[–—-]\s*\d+\s*%/.test(clause)) {
        continue;
      }

      const low = parseWordNumber(/k/i.test(m[0]) ? `${m[1]}k` : m[1]);
      const high = parseWordNumber(/k/i.test(m[0]) ? `${m[2]}k` : m[2]);
      if (low == null || high == null) continue;

      const window = body.slice(Math.max(0, m.index - 40), m.index + m[0].length + 60).toLowerCase();
      const isTarget =
        /\b(reach|target|down to|into|produce|yields?|to get|book inside|inside this|core novel|publishable)\b/.test(
          window,
        );
      const containsCanonical = canonicalWordCount >= low && canonicalWordCount <= high;

      const failRange =
        /k/i.test(m[0]) ||
        isTarget ||
        !containsCanonical ||
        /\bbook inside\b/i.test(window);

      if (!failRange) continue;

      const quotation = body.slice(Math.max(0, m.index - 25), m.index + m[0].length + 55).trim();
      const dedupeKey = `range:${m.index}:${m.index + m[0].length}:current_total`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      out.push({
        quotation,
        claimedWords: Math.round((low + high) / 2),
        approximate: true,
        shorthand: /k/i.test(m[0]),
        reason: `Length range ${low.toLocaleString()}–${high.toLocaleString()} contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
        claimType: "current_total",
      });
    }
  }

  return out;
}

/** Validate cut-percentage claims against canonical arithmetic (prose and JSON-adjacent). */
function collectCutRecommendationContradictions(
  text: string,
  canonicalWordCount: number,
): WordCountContradiction[] {
  const body = scannableReviewText(text);
  const out: WordCountContradiction[] = [];
  const tolerance = cutMathTolerance(canonicalWordCount);

  const patterns = [
    /\bcut\s+(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*%\s*(?:to\s*)?(?:reach|to|down to|into|produce|yield(?:ing)?)\s*(\d+(?:\.\d+)?)\s*[kK]\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/gi,
    /\b(?:a|an)\s*(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*%\s*cut\s*(?:would|will|to)\s*(?:reach|produce|yield|get)\s*(\d+(?:\.\d+)?)\s*[kK]\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/gi,
    /\b(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*%\s*(?:cut|reduction)\s*(?:to|toward|into)\s*(\d+(?:\.\d+)?)\s*[kK]\s*[–—-]\s*(\d+(?:\.\d+)?)\s*[kK]\b/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const cutLow = parseFloat(m[1]);
      const cutHigh = m[2] ? parseFloat(m[2]) : cutLow;
      const targetLow = parseKValue(`${m[3]}k`);
      const targetHigh = parseKValue(`${m[4]}k`);
      if (!Number.isFinite(cutLow) || targetLow == null || targetHigh == null) continue;

      const resultLow = resultingFromCut(canonicalWordCount, cutHigh);
      const resultHigh = resultingFromCut(canonicalWordCount, cutLow);

      const targetOverlaps =
        resultHigh >= targetLow - tolerance && resultLow <= targetHigh + tolerance;

      if (targetOverlaps) continue;

      const quotation = body.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30).trim();
      out.push({
        quotation,
        claimedWords: Math.round((targetLow + targetHigh) / 2),
        approximate: false,
        shorthand: true,
        reason: `Cut ${cutLow}${m[2] ? `–${cutHigh}` : ""}% from ${canonicalWordCount.toLocaleString()} yields ~${resultLow.toLocaleString()}–${resultHigh.toLocaleString()}, not ${targetLow.toLocaleString()}–${targetHigh.toLocaleString()}.`,
        claimType: "resulting_total",
      });
    }
  }

  return out;
}

function validateResultingTotalClaim(
  m: RawMatch,
  text: string,
  canonicalWordCount: number,
): WordCountContradiction | null {
  const body = scannableReviewText(text);
  const before = body.slice(Math.max(0, m.index - 120), m.index);

  const pctMatches = [...before.matchAll(/(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*%/g)];
  const tolerance = cutMathTolerance(canonicalWordCount);

  if (pctMatches.length > 0) {
    const last = pctMatches[pctMatches.length - 1];
    const cutLow = parseFloat(last[1]);
    const cutHigh = last[2] ? parseFloat(last[2]) : cutLow;
    const expectedLow = resultingFromCut(canonicalWordCount, cutHigh);
    const expectedHigh = resultingFromCut(canonicalWordCount, cutLow);
    if (
      m.claimedWords >= expectedLow - tolerance &&
      m.claimedWords <= expectedHigh + tolerance
    ) {
      return null;
    }
    return {
      quotation: m.quotation,
      claimedWords: m.claimedWords,
      approximate: m.approximate,
      shorthand: m.shorthand,
      claimType: "resulting_total",
      reason: `Resulting length ${m.claimedWords.toLocaleString()} does not match ${cutLow}${last[2] ? `–${cutHigh}` : ""}% cut from canonical ${canonicalWordCount.toLocaleString()}.`,
    };
  }

  // No explicit % — do not compare to canonical current total
  return null;
}

/** Require exact canonical count stated at least once in memo prose. */
export function hasExactCanonicalStatement(text: string, canonicalWordCount: number): boolean {
  const body = memoBody(text);
  const formatted = canonicalWordCount.toLocaleString("en-US");
  const commaFlexible = formatted.replace(/,/g, "[, ]?");
  const patterns = [
    new RegExp(`\\b${commaFlexible}\\s+words\\b`, "i"),
    new RegExp(`\\bmanuscript\\s+is\\s+${commaFlexible}\\b`, "i"),
    new RegExp(`\\b${commaFlexible}\\s*[-–—]\\s*word\\s+manuscript\\b`, "i"),
    new RegExp(`\\btotal\\s+(?:of\\s+)?${commaFlexible}\\s+words\\b`, "i"),
  ];
  return patterns.some((re) => re.test(body));
}

/** Validate review prose against canonical manuscript word count. */
export function validateWordCountClaims(
  reviewText: string,
  canonicalWordCount: number,
): WordCountValidationResult {
  const errors: string[] = [];
  const contradictions: WordCountContradiction[] = [];
  const contradictionKeys = new Set<string>();

  function pushContradiction(c: WordCountContradiction, spanStart?: number, spanEnd?: number) {
    const type = c.claimType ?? "current_total";
    const key =
      spanStart != null && spanEnd != null
        ? `${spanStart}:${spanEnd}:${type}:${c.claimedWords}`
        : `${c.quotation.slice(0, 80)}:${type}:${c.claimedWords}`;
    if (contradictionKeys.has(key)) return;
    contradictionKeys.add(key);
    contradictions.push(c);
  }

  if (canonicalWordCount <= 0) return { valid: true, contradictions: [], errors: [] };

  if (!hasExactCanonicalStatement(reviewText, canonicalWordCount)) {
    errors.push(
      `Memo must state the exact canonical count at least once (e.g. "The manuscript is ${canonicalWordCount.toLocaleString()} words.").`,
    );
  }

  const linkedCuts = parseLinkedCutRecommendations(reviewText, canonicalWordCount);
  const compoundCuts = parseCompoundCutRanges(reviewText, canonicalWordCount);
  const validatedSpans = [
    ...linkedCuts.map((c) => ({ spanStart: c.spanStart, spanEnd: c.spanEnd })),
    ...compoundCuts.map((c) => ({ spanStart: c.spanStart, spanEnd: c.spanEnd })),
  ];

  for (const cut of linkedCuts) {
    if (!cut.valid) {
      pushContradiction(
        {
          quotation: cut.quotation,
          claimedWords: cut.resultingTotal,
          approximate: true,
          shorthand: false,
          claimType: "resulting_total",
          reason: `${cut.cutPercentage}% cut from ${canonicalWordCount.toLocaleString()} should yield ~${resultingFromCut(canonicalWordCount, cut.cutPercentage).toLocaleString()}, not ${cut.resultingTotal.toLocaleString()}.`,
        },
        cut.spanStart,
        cut.spanEnd,
      );
    }
  }

  for (const compound of compoundCuts) {
    if (!compound.valid) {
      pushContradiction(
        {
          quotation: compound.quotation,
          claimedWords: compound.resultingTotalMin ?? compound.cutAmountMin ?? 0,
          approximate: true,
          shorthand: false,
          claimType: compound.resultingTotalMin != null ? "resulting_total" : "cut_amount",
          reason: `Compound cut clause math does not match canonical ${canonicalWordCount.toLocaleString()}.`,
        },
        compound.spanStart,
        compound.spanEnd,
      );
    }
  }

  for (const m of collectMatches(reviewText, validatedSpans)) {
    if (m.claimedWords === canonicalWordCount) continue;

    if (m.claimType === "cut_amount") continue;

    if (m.claimType === "resulting_total") {
      const err = validateResultingTotalClaim(m, reviewText, canonicalWordCount);
      if (err) pushContradiction(err, m.index, m.matchEnd);
      continue;
    }

    // CURRENT_TOTAL
    const drift = Math.abs(m.claimedWords - canonicalWordCount) / canonicalWordCount;

    // CURRENT_TOTAL — approximate independent estimates must match canonical exactly
    if (m.approximate && m.claimedWords !== canonicalWordCount) {
      pushContradiction(
        {
          quotation: m.quotation,
          claimedWords: m.claimedWords,
          approximate: true,
          shorthand: m.shorthand,
          claimType: "current_total",
          reason: `Estimated length claim (${m.claimedWords.toLocaleString()}) contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
        },
        m.index,
        m.matchEnd,
      );
      continue;
    }

    if (m.shorthand) {
      pushContradiction(
        {
          quotation: m.quotation,
          claimedWords: m.claimedWords,
          approximate: m.approximate,
          shorthand: true,
          claimType: "current_total",
          reason: `Shorthand or estimated length claim (${m.claimedWords.toLocaleString()}) contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
        },
        m.index,
        m.matchEnd,
      );
      continue;
    }

    if (withinTolerance(m.claimedWords, canonicalWordCount, m.approximate)) continue;

    if (drift >= MATERIAL_DRIFT_RATIO || !m.approximate) {
      pushContradiction(
        {
          quotation: m.quotation,
          claimedWords: m.claimedWords,
          approximate: m.approximate,
          shorthand: false,
          claimType: "current_total",
          reason: `Claimed ${m.claimedWords.toLocaleString()} words contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
        },
        m.index,
        m.matchEnd,
      );
    }
  }

  for (const c of collectRangeContradictions(reviewText, canonicalWordCount)) {
    pushContradiction(c);
  }
  for (const c of collectCutRecommendationContradictions(reviewText, canonicalWordCount)) {
    pushContradiction(c);
  }

  return {
    valid: contradictions.length === 0 && errors.length === 0,
    contradictions,
    errors,
  };
}

/** Build repair instruction for a single contradiction (legacy helper). */
export function buildWordCountRepairPrompt(args: {
  canonicalWordCount: number;
  contradiction: WordCountContradiction;
  reviewContent: string;
}): string {
  return buildCommercialReviewRepairPrompt({
    canonicalWordCount: args.canonicalWordCount,
    reviewContent: args.reviewContent,
    wordCountContradictions: [args.contradiction],
  });
}

export const REVIEW_BLOCKED_STATISTICS_MESSAGE =
  "REVIEW BLOCKED — AUTHORITATIVE STATISTICS CONTRADICTED";
