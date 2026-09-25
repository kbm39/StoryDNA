/**
 * Narrow typographic punctuation equivalence for V2 evidence matching.
 * Does not rewrite stored excerpts. Does not use NFKC. Does not call a model.
 * Does not change publish-time manuscriptPassageLocated.
 */

export const V2_UNICODE_PUNCTUATION_EQUIVALENCE_VERSION =
  "archivist_v2_unicode_punctuation_equivalent@v1" as const;

export const V2_TYPOGRAPHIC_PUNCTUATION_MAP = {
  "\u2018": "'", // LEFT SINGLE QUOTATION MARK ‘
  "\u2019": "'", // RIGHT SINGLE QUOTATION MARK ’
  "\u201C": '"', // LEFT DOUBLE QUOTATION MARK “
  "\u201D": '"', // RIGHT DOUBLE QUOTATION MARK ”
} as const;

export type V2EvidenceMatchMethod = "exact" | "unicode_punctuation_equivalent";

export interface V2PunctuationMatch {
  contiguous: boolean;
  method: V2EvidenceMatchMethod | null;
  normalized_punctuation: boolean;
  raw_excerpt: string;
  raw_source_match_window: string | null;
}

function pgTrimSpaces(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === " ") start++;
  while (end > start && text[end - 1] === " ") end--;
  return text.slice(start, end);
}

export function canonicalizeTypographicPunctuation(text: string): string {
  return text.replace(/[\u2018\u2019\u201C\u201D]/g, (ch) => {
    return V2_TYPOGRAPHIC_PUNCTUATION_MAP[ch as keyof typeof V2_TYPOGRAPHIC_PUNCTUATION_MAP] ?? ch;
  });
}

function collapseForMatch(text: string): { collapsed: string; map: number[] } {
  const trimmed = pgTrimSpaces(text);
  const rawStart = text.indexOf(trimmed);
  let collapsed = "";
  const map: number[] = [];
  let pendingSpace = false;
  let pendingSpaceRaw = -1;
  for (let i = 0; i < trimmed.length; i += 1) {
    const rawIndex = rawStart + i;
    const ch = trimmed[i]!;
    if (/\s/.test(ch)) {
      if (collapsed.length === 0) continue;
      if (!pendingSpace) {
        pendingSpace = true;
        pendingSpaceRaw = rawIndex;
      }
      continue;
    }
    if (pendingSpace) {
      collapsed += " ";
      map.push(pendingSpaceRaw);
      pendingSpace = false;
    }
    const mapped = V2_TYPOGRAPHIC_PUNCTUATION_MAP[ch as keyof typeof V2_TYPOGRAPHIC_PUNCTUATION_MAP] ?? ch;
    collapsed += mapped.toLowerCase();
    map.push(rawIndex);
  }
  return { collapsed, map };
}

function locateCanonicalWindow(source: string, excerpt: string): string | null {
  const hay = collapseForMatch(source);
  const needle = collapseForMatch(excerpt).collapsed;
  if (!needle) return null;
  const idx = hay.collapsed.indexOf(needle);
  if (idx < 0) return null;
  const start = hay.map[idx];
  const end = hay.map[idx + needle.length - 1];
  if (start == null || end == null) return null;
  return source.slice(start, end + 1);
}

export function matchContiguousWithTypographicPunctuation(args: {
  segmentText: string;
  excerpt: string;
  exactLocated: boolean;
}): V2PunctuationMatch {
  const rawExcerpt = args.excerpt;
  if (args.exactLocated) {
    return {
      contiguous: true,
      method: "exact",
      normalized_punctuation: false,
      raw_excerpt: rawExcerpt,
      raw_source_match_window: null,
    };
  }
  const vPassage = pgTrimSpaces(args.excerpt);
  if (!vPassage || vPassage.length < 8 || !args.segmentText || pgTrimSpaces(args.segmentText) === "") {
    return {
      contiguous: false,
      method: null,
      normalized_punctuation: false,
      raw_excerpt: rawExcerpt,
      raw_source_match_window: null,
    };
  }
  const hay = collapseForMatch(args.segmentText).collapsed;
  const needle = collapseForMatch(vPassage).collapsed;
  if (!hay.includes(needle)) {
    return {
      contiguous: false,
      method: null,
      normalized_punctuation: false,
      raw_excerpt: rawExcerpt,
      raw_source_match_window: null,
    };
  }
  return {
    contiguous: true,
    method: "unicode_punctuation_equivalent",
    normalized_punctuation: true,
    raw_excerpt: rawExcerpt,
    raw_source_match_window: locateCanonicalWindow(args.segmentText, vPassage),
  };
}
