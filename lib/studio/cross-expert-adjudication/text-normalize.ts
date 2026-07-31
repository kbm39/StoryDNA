import { createHash } from "node:crypto";

export function normalizeAuditText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeAuditText(text: string): string[] {
  const normalized = normalizeAuditText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 2);
}

export function hashAuditPayload(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function excerptInManuscript(manuscriptText: string, excerpt: string): boolean {
  const normalizedExcerpt = normalizeAuditText(excerpt);
  if (normalizedExcerpt.length < 20) return false;
  const normalizedManuscript = normalizeAuditText(manuscriptText);
  if (normalizedManuscript.includes(normalizedExcerpt)) return true;

  const words = normalizedExcerpt.split(" ").filter((w) => w.length > 3);
  if (words.length < 4) return false;
  const window = Math.min(12, words.length);
  const probe = words.slice(0, window).join(" ");
  return normalizedManuscript.includes(probe);
}

export function recommendationOverlapRatio(
  manuscriptText: string,
  recommendation: string,
): number {
  const recTokens = new Set(tokenizeAuditText(recommendation));
  if (recTokens.size === 0) return 0;
  const manuscriptTokens = new Set(tokenizeAuditText(manuscriptText));
  let overlap = 0;
  for (const token of recTokens) {
    if (manuscriptTokens.has(token)) overlap++;
  }
  return overlap / recTokens.size;
}

export function topicOverlapRatio(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap++;
  }
  return overlap / Math.min(setA.size, setB.size);
}

export function searchManuscriptMarker(
  manuscriptText: string,
  pattern: string | RegExp,
): { readonly found: boolean; readonly matchCount: number } {
  const re = typeof pattern === "string" ? new RegExp(pattern, "gi") : pattern;
  const matches = manuscriptText.match(re);
  return Object.freeze({ found: Boolean(matches?.length), matchCount: matches?.length ?? 0 });
}
