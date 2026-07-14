/**
 * Detect manuscript-length claims in review text that contradict canonical word count.
 */

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

const APPROX_WORDS =
  /\b(?:about|approximately|approx\.?|roughly|around|~|comfortably|likely|probably|estimated|estimate of|est\.)\b/i;

const LENGTH_CONTEXT =
  /\b(word|words|manuscript|draft|novel|book|length|count|size|total|page|pages|reading time|read time)\b/i;

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

function isPostCutResultContext(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 80), index + 80).toLowerCase();
  return /\b(cut|trim|reduce|reduction|yields?|yielding|resulting|after|leaves?|down to|produces?|bringing)\b/.test(
    window,
  );
}

function cutResultMatchesCanonical(
  claimed: number,
  canonical: number,
  text: string,
  index: number,
): boolean {
  if (!isPostCutResultContext(text, index)) return false;
  const window = text.slice(Math.max(0, index - 80), index + 80);
  const pctMatch = window.match(/(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*%/);
  if (!pctMatch) return false;
  const low = parseFloat(pctMatch[1]);
  const high = pctMatch[2] ? parseFloat(pctMatch[2]) : low;
  const resultLow = Math.round(canonical * (1 - high / 100));
  const resultHigh = Math.round(canonical * (1 - low / 100));
  const tolerance = Math.max(500, Math.round(canonical * CUT_MATH_TOLERANCE_RATIO));
  return claimed >= resultLow - tolerance && claimed <= resultHigh + tolerance;
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

interface RawMatch {
  quotation: string;
  claimedWords: number;
  approximate: boolean;
  shorthand: boolean;
  index: number;
}

function collectMatches(text: string): RawMatch[] {
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

      const start = Math.max(0, m.index - 30);
      const end = Math.min(body.length, m.index + m[0].length + 50);
      const quotation = body.slice(start, end).trim();
      const key = `${claimed}:${quotation.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        quotation,
        claimedWords: claimed,
        approximate: approximate || APPROX_WORDS.test(m[0]),
        shorthand,
        index: m.index,
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
      const low = parseWordNumber(/k/i.test(m[0]) ? `${m[1]}k` : m[1]);
      const high = parseWordNumber(/k/i.test(m[0]) ? `${m[2]}k` : m[2]);
      if (low == null || high == null) continue;

      const window = body.slice(Math.max(0, m.index - 40), m.index + m[0].length + 60).toLowerCase();
      const isTarget =
        /\b(reach|target|down to|into|produce|yields?|to get|book inside|inside this|core novel|publishable)\b/.test(
          window,
        );
      const containsCanonical = canonicalWordCount >= low && canonicalWordCount <= high;

      // Fail k-shorthand ranges used as length characterization unless exact canonical is the sole claim.
      const failRange =
        /k/i.test(m[0]) ||
        isTarget ||
        !containsCanonical ||
        /\bbook inside\b/i.test(window);

      if (!failRange) continue;

      const quotation = body.slice(Math.max(0, m.index - 25), m.index + m[0].length + 55).trim();
      const key = quotation.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        quotation,
        claimedWords: Math.round((low + high) / 2),
        approximate: true,
        shorthand: /k/i.test(m[0]),
        reason: `Length range ${low.toLocaleString()}–${high.toLocaleString()} contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
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
  const tolerance = Math.max(500, Math.round(canonicalWordCount * CUT_MATH_TOLERANCE_RATIO));

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

      const resultLow = Math.round(canonicalWordCount * (1 - cutHigh / 100));
      const resultHigh = Math.round(canonicalWordCount * (1 - cutLow / 100));

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
      });
    }
  }

  return out;
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

  if (canonicalWordCount <= 0) return { valid: true, contradictions: [], errors: [] };

  if (!hasExactCanonicalStatement(reviewText, canonicalWordCount)) {
    errors.push(
      `Memo must state the exact canonical count at least once (e.g. "The manuscript is ${canonicalWordCount.toLocaleString()} words.").`,
    );
  }

  for (const m of collectMatches(reviewText)) {
    if (m.claimedWords === canonicalWordCount) continue;
    if (cutResultMatchesCanonical(m.claimedWords, canonicalWordCount, scannableReviewText(reviewText), m.index)) {
      continue;
    }

    const drift = Math.abs(m.claimedWords - canonicalWordCount) / canonicalWordCount;

    if (m.shorthand || m.approximate) {
      contradictions.push({
        quotation: m.quotation,
        claimedWords: m.claimedWords,
        approximate: m.approximate,
        shorthand: m.shorthand,
        reason: m.shorthand
          ? `Shorthand or estimated length claim (${m.claimedWords.toLocaleString()}) contradicts canonical ${canonicalWordCount.toLocaleString()}.`
          : `Estimated length claim (${m.claimedWords.toLocaleString()}) contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
      });
      continue;
    }

    if (withinTolerance(m.claimedWords, canonicalWordCount, m.approximate)) continue;

    if (drift >= MATERIAL_DRIFT_RATIO || !m.approximate) {
      contradictions.push({
        quotation: m.quotation,
        claimedWords: m.claimedWords,
        approximate: m.approximate,
        shorthand: false,
        reason: `Claimed ${m.claimedWords.toLocaleString()} words contradicts canonical ${canonicalWordCount.toLocaleString()}.`,
      });
    }
  }

  contradictions.push(...collectRangeContradictions(reviewText, canonicalWordCount));
  contradictions.push(...collectCutRecommendationContradictions(reviewText, canonicalWordCount));

  // Deduplicate contradictions by quotation prefix.
  const deduped = contradictions.filter((c, i, arr) => {
    const key = c.quotation.slice(0, 70);
    return arr.findIndex((x) => x.quotation.slice(0, 70) === key) === i;
  });

  return {
    valid: deduped.length === 0 && errors.length === 0,
    contradictions: deduped,
    errors,
  };
}

/** Build repair instruction for a single contradiction. */
export function buildWordCountRepairPrompt(args: {
  canonicalWordCount: number;
  contradiction: WordCountContradiction;
  reviewContent: string;
}): string {
  return `The acquisitions memo below contradicts the authoritative manuscript word count.

AUTHORITATIVE TOTAL: ${args.canonicalWordCount.toLocaleString()} words (exact — do not estimate or round away).

CONTRADICTORY PASSAGE:
"${args.contradiction.quotation}"

INSTRUCTIONS:
1. Open the memo with an exact authoritative statement: "The manuscript is ${args.canonicalWordCount.toLocaleString()} words."
2. Replace every incorrect total-length reference, shorthand (150k), range estimate (105–115k), page count, or reading-time proxy with the exact authoritative count.
3. Recalculate any percentage cuts and target lengths using ${args.canonicalWordCount.toLocaleString()} as the current total (e.g. 20% cut → ~${Math.round(args.canonicalWordCount * 0.8).toLocaleString()} words).
4. Do not change story analysis, evidence, or rubric scores except where they depend on the wrong length.
5. Preserve the memo structure and the STORYDNA_RUBRIC_JSON block at the end (update length_recommendations if present).
6. Do not invent a new total length from pages, tokens, or reading time.

---
MEMO TO CORRECT:

${args.reviewContent}`;
}

export const REVIEW_BLOCKED_STATISTICS_MESSAGE =
  "REVIEW BLOCKED — AUTHORITATIVE STATISTICS CONTRADICTED";
