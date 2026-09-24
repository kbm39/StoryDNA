/**
 * Deterministic contiguous-passage recovery for Archivist evidence.
 * Does not weaken manuscriptPassageLocated. Does not invent quotations.
 */

import { manuscriptPassageLocated, locatePassage } from "@/lib/passage-locate.ts";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "../contracts.ts";
import { countExcerptWords } from "../evidence.ts";
import { extractStructuralUnits, parseStructuralHeading } from "./structural-units.ts";

export type RecoveredPassageClass = "A" | "B" | "C";

export interface ContiguousPassageRecovery {
  class: RecoveredPassageClass;
  excerpt: string;
  original_excerpt: string;
  located: boolean;
  reason: string;
  fabricated: false;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "his", "her", "their", "was", "were", "had", "have", "from", "that", "this",
]);

function wordsOf(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function ngrams(words: string[], min: number): string[] {
  const out: string[] = [];
  for (let size = words.length; size >= min; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      out.push(words.slice(i, i + size).join(" "));
    }
  }
  return out;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!manuscriptPassageLocated(haystack, needle)) return 0;
  const hay = haystack.replace(/\s+/g, " ").toLowerCase();
  const n = needle.replace(/\s+/g, " ").toLowerCase().trim();
  if (n.length < 8) return 0;
  let count = 0;
  let idx = 0;
  while (idx < hay.length) {
    const found = hay.indexOf(n, idx);
    if (found < 0) break;
    count += 1;
    idx = found + Math.max(1, n.length);
  }
  return count;
}

export function chapterScopeForLocator(
  manuscriptText: string,
  locator: string | undefined,
): { text: string; heading: string } | null {
  if (!locator?.trim()) return null;
  try {
    const units = extractStructuralUnits(manuscriptText);
    const parsed = parseStructuralHeading(locator.trim());
    const unit = units.find((item) => {
      if (parsed && item.unit_id === parsed.unit_id) return true;
      if (item.heading.toLowerCase() === locator.trim().toLowerCase()) return true;
      if (item.unit_id === locator.trim().toLowerCase()) return true;
      return false;
    });
    if (!unit) return null;
    return {
      text: manuscriptText.slice(unit.start_offset, unit.end_offset),
      heading: unit.heading,
    };
  } catch {
    return null;
  }
}

function valueTokens(value: Record<string, unknown> | undefined): string[] {
  if (!value) return [];
  const tokens: string[] = [];
  const walk = (item: unknown) => {
    if (typeof item === "string" && item.trim().length >= 3) tokens.push(item.trim());
    else if (typeof item === "number") tokens.push(String(item));
    else if (item && typeof item === "object") {
      for (const nested of Object.values(item)) walk(nested);
    }
  };
  walk(value);
  return tokens;
}

function expandToSentence(scopeText: string, start: number, end: number): string {
  let left = start;
  let right = end;
  while (left > 0 && !/[.?!]/.test(scopeText[left - 1] ?? "") && scopeText[left - 1] !== "\n") {
    left -= 1;
  }
  while (right < scopeText.length && !/[.?!]/.test(scopeText[right - 1] ?? "") && scopeText[right] !== "\n") {
    right += 1;
  }
  let slice = scopeText.slice(left, right).trim();
  if (countExcerptWords(slice) > ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS) {
    slice = wordsOf(scopeText.slice(start)).slice(0, ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS).join(" ");
    const bounded = locatePassage(scopeText, slice);
    if (bounded) slice = scopeText.slice(bounded.start, bounded.end).trim();
  }
  return slice;
}

function supportsSameObservation(args: {
  original: string;
  recovered: string;
  value?: Record<string, unknown>;
  scope: string;
}): boolean {
  const originalWords = wordsOf(args.original).filter((word) => !STOP.has(word.toLowerCase()));
  const recoveredLower = args.recovered.toLowerCase();
  const shared = originalWords.filter((word) => recoveredLower.includes(word.toLowerCase()));
  if (shared.length < 1 && originalWords.length >= 1) return false;
  if (shared.length < 2 && originalWords.length >= 4) return false;
  for (const token of valueTokens(args.value)) {
    if (!args.original.toLowerCase().includes(token.toLowerCase())) continue;
    if (!args.scope.toLowerCase().includes(token.toLowerCase())) continue;
    if (!args.recovered.toLowerCase().includes(token.toLowerCase())) return false;
  }
  return true;
}

export function recoverContiguousManuscriptPassage(args: {
  excerpt: string;
  locator?: string;
  manuscriptText: string;
  value?: Record<string, unknown>;
}): ContiguousPassageRecovery {
  const original = args.excerpt ?? "";
  if (manuscriptPassageLocated(args.manuscriptText, original)) {
    return {
      class: "A",
      excerpt: original,
      original_excerpt: original,
      located: true,
      reason: "stored excerpt is already a contiguous manuscript passage",
      fabricated: false,
    };
  }

  const scope = chapterScopeForLocator(args.manuscriptText, args.locator);
  const searchText = scope?.text ?? args.manuscriptText;
  const excerptWords = wordsOf(original);
  if (excerptWords.length === 0) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "empty excerpt has no recoverable contiguous passage",
      fabricated: false,
    };
  }

  const candidates: Array<{ phrase: string; start: number }> = [];
  for (const phrase of ngrams(excerptWords, 3)) {
    if (phrase.replace(/\s+/g, "").length < 8) continue;
    if (countOccurrences(searchText, phrase) !== 1) continue;
    const span = locatePassage(searchText, phrase);
    if (!span) continue;
    candidates.push({ phrase, start: span.start });
  }

  if (candidates.length === 0) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "no unique contiguous fragment of the stored excerpt exists in the locator scope",
      fabricated: false,
    };
  }

  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  const longest = candidates[0]!.phrase.length;
  const top = candidates.filter((item) => item.phrase.length === longest);
  const starts = new Set(top.map((item) => item.start));
  if (starts.size > 1) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "multiple unique fragments exist at different locations; recovery is unsafe",
      fabricated: false,
    };
  }

  const chosen = top[0]!;
  const span = locatePassage(searchText, chosen.phrase);
  if (!span) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "unique fragment could not be mapped back to manuscript offsets",
      fabricated: false,
    };
  }
  const recovered = expandToSentence(searchText, span.start, span.end);
  if (!manuscriptPassageLocated(args.manuscriptText, recovered)) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "expanded passage failed manuscriptPassageLocated",
      fabricated: false,
    };
  }
  if (!supportsSameObservation({
    original,
    recovered,
    value: args.value,
    scope: searchText,
  })) {
    return {
      class: "C",
      excerpt: original,
      original_excerpt: original,
      located: false,
      reason: "recovered passage does not deterministically support the same observation",
      fabricated: false,
    };
  }
  return {
    class: "B",
    excerpt: recovered,
    original_excerpt: original,
    located: true,
    reason: "unique contiguous fragment recovered from locator scope and expanded to manuscript sentence",
    fabricated: false,
  };
}
