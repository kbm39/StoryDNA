/**
 * Canonical manuscript word count.
 *
 * Source of truth: plain `extracted_text` from a single manuscript ingestion.
 * This function never reads reviewer reports, metadata, or chapter tables.
 *
 * Rules:
 * - Unicode whitespace (including NBSP) collapses to single spaces.
 * - Empty / whitespace-only input returns 0.
 * - Words are letter or digit sequences (any Unicode script).
 * - Internal apostrophes (straight U+0027, curly U+2019) stay in one token: don't, he's, James's.
 * - ASCII hyphens between alphanumeric parts form one compound: well-known, twenty-one.
 * - Em/en dashes, slashes, and other punctuation separate words.
 * - Standalone punctuation is ignored.
 * - Markup stripping removes only plausible HTML/XML tags (see stripMarkupForWordCount).
 *   Spaced angle brackets such as `a < b > c` are prose, not tags.
 * - Input is never mutated.
 */

const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
/** Element tags: `<name>`, `</name>`, `<name attr="x">`, `<w:t>`, self-closing optional. */
const MARKUP_TAG = /<\/?[a-zA-Z][\w:.-]*(?:\s[^>]*)?\/?>/g;
/** XML/HTML comments. */
const MARKUP_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_ENTITIES = /&(?:#x?[0-9a-f]+|[a-z]+);/gi;

/** Letters/digits with optional internal apostrophe or hyphen-linked segments. */
const WORD =
  /[\p{L}\p{M}\p{N}]+(?:[''\u2019][\p{L}\p{M}\p{N}]+)*(?:-[\p{L}\p{M}\p{N}]+(?:[''\u2019][\p{L}\p{M}\p{N}]+)*)*/gu;

export function stripMarkupForWordCount(text: string): string {
  return text
    .replace(MARKUP_COMMENT, " ")
    .replace(MARKUP_TAG, " ")
    .replace(HTML_ENTITIES, " ");
}

export function normalizeManuscriptWhitespace(text: string): string {
  return text.normalize("NFKC").replace(UNICODE_SPACES, " ").replace(/\s+/g, " ").trim();
}

/** Count words in plain extracted manuscript text. */
export function countManuscriptWords(text: string | null | undefined): number {
  if (text == null || text === "") return 0;
  const prepared = normalizeManuscriptWhitespace(stripMarkupForWordCount(text));
  if (!prepared) return 0;
  const matches = prepared.match(WORD);
  return matches?.length ?? 0;
}

/** Words represented by a sent character slice, proportional to full-manuscript count. */
export function manuscriptWordsInCharSlice(
  fullText: string,
  sentChars: number,
  totalWords?: number,
): number {
  if (!fullText || sentChars <= 0) return 0;
  const words = totalWords ?? countManuscriptWords(fullText);
  if (sentChars >= fullText.length) return words;
  return Math.max(1, Math.round(words * (sentChars / fullText.length)));
}
