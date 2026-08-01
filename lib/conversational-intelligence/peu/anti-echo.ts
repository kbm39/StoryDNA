import type { GateFailReason } from "./types.ts";

const EDITORIAL_TOKENS = [
  "respect without idealizing",
  "balance",
  "standard for independent read",
  "independent read",
  "success criteria",
  "dual success",
  "tactical authenticity",
  "commercial hook",
  "query-ready",
  "should inform",
  "should guide",
  "should become",
  "should assess",
  "during the independent read",
] as const;

const SHALLOW_TEMPLATE_PATTERNS = [
  /\byou want\b.+\bis\s+(?:the\s+)?protagonist\b/i,
  /that's a clear editorial priority/i,
  /clear editorial priority/i,
] as const;

const ECHO_PATTERN = /^you described\b/i;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function tokenOverlapRatio(response: string, authorTurn: string): number {
  const responseTokens = tokenize(response);
  const authorTokens = tokenize(authorTurn);
  if (responseTokens.size === 0 || authorTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of responseTokens) {
    if (authorTokens.has(token)) overlap++;
  }
  return overlap / responseTokens.size;
}

function normalizedLevenshtein(a: string, b: string): number {
  const s = a.toLowerCase().trim();
  const t = b.toLowerCase().trim();
  if (s === t) return 1;
  if (s.length === 0 || t.length === 0) return 0;

  const matrix: number[][] = Array.from({ length: s.length + 1 }, (_, i) =>
    Array.from({ length: t.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  const distance = matrix[s.length]![t.length]!;
  const maxLen = Math.max(s.length, t.length);
  return 1 - distance / maxLen;
}

function hasEditorialAdvancementTokens(response: string, authorTurn: string): boolean {
  const lower = response.toLowerCase();
  const authorLower = authorTurn.toLowerCase();
  return EDITORIAL_TOKENS.some(
    (token) => lower.includes(token) && !authorLower.includes(token),
  );
}

function isYouDescribedEcho(response: string, authorTurn: string): boolean {
  if (!ECHO_PATTERN.test(response.trim())) return false;
  const overlap = tokenOverlapRatio(response, authorTurn);
  return overlap >= 0.5 || normalizedLevenshtein(response, authorTurn) >= 0.6;
}

export type AntiEchoResult = {
  readonly triggered: boolean;
  readonly overlap_ratio: number;
  readonly similarity: number;
  readonly fail_reason: GateFailReason | null;
};

function isExplicitInsightEcho(response: string, authorTurn: string): boolean {
  const r = response.trim().toLowerCase();
  const a = authorTurn.trim().toLowerCase();
  if (r === a) return true;
  const editorialInsight =
    /\b(admire|respect|cost|flaw|balance|idealiz|tension|experience|success|criteria)\b/i;
  return editorialInsight.test(authorTurn) && normalizedLevenshtein(response, authorTurn) >= 0.95;
}

function isShallowTemplateEcho(response: string): boolean {
  return SHALLOW_TEMPLATE_PATTERNS.some((pattern) => pattern.test(response));
}

export function detectAntiEcho(response: string, authorTurn: string): AntiEchoResult {
  if (isShallowTemplateEcho(response)) {
    return {
      triggered: true,
      overlap_ratio: tokenOverlapRatio(response, authorTurn),
      similarity: normalizedLevenshtein(response, authorTurn),
      fail_reason: "INSUFFICIENT_EDITORIAL_ADVANCEMENT",
    };
  }

  if (isExplicitInsightEcho(response, authorTurn)) {
    return { triggered: false, overlap_ratio: 1, similarity: 1, fail_reason: null };
  }

  const overlap = tokenOverlapRatio(response, authorTurn);
  const similarity = normalizedLevenshtein(response, authorTurn);
  const editorialAdvancement = hasEditorialAdvancementTokens(response, authorTurn);
  const youDescribedEcho = isYouDescribedEcho(response, authorTurn);

  const triggered =
    youDescribedEcho ||
    (overlap > 0.7 && !editorialAdvancement) ||
    (similarity > 0.85 && !editorialAdvancement);

  return {
    triggered,
    overlap_ratio: overlap,
    similarity,
    fail_reason: triggered ? "INSUFFICIENT_EDITORIAL_ADVANCEMENT" : null,
  };
}
