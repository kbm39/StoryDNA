import "server-only";

export interface PassageContext {
  found: boolean;
  contextBefore: string | null;
  contextAfter: string | null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Locate a passage in manuscript text, tolerating minor whitespace differences. */
export function locatePassage(
  manuscriptText: string,
  passage: string,
): { start: number; end: number } | null {
  if (!manuscriptText.trim() || !passage.trim()) return null;

  const direct = manuscriptText.indexOf(passage);
  if (direct >= 0) return { start: direct, end: direct + passage.length };

  const normHay = normalizeWhitespace(manuscriptText).toLowerCase();
  const normNeedle = normalizeWhitespace(passage).toLowerCase();
  if (normNeedle.length < 8) return null;

  const normIdx = normHay.indexOf(normNeedle);
  if (normIdx < 0) {
    const probe = normNeedle.slice(0, Math.min(normNeedle.length, 60));
    if (probe.length < 20) return null;
    const probeIdx = normHay.indexOf(probe);
    if (probeIdx < 0) return null;
    return approximateSpan(manuscriptText, probeIdx, probe.length);
  }

  return approximateSpan(manuscriptText, normIdx, normNeedle.length);
}

/** Map a normalized-index match back to approximate raw string offsets. */
function approximateSpan(
  raw: string,
  normStart: number,
  normLen: number,
): { start: number; end: number } | null {
  let normPos = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) {
      if (i > 0 && !/\s/.test(raw[i - 1])) normPos++;
      continue;
    }
    if (normPos === normStart && start < 0) start = i;
    normPos++;
    if (normPos === normStart + normLen) {
      return { start, end: i + 1 };
    }
  }
  if (start >= 0) return { start, end: raw.length };
  return null;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Extract up to `maxParagraphs` paragraphs immediately before and after the
 * flagged passage. Never fabricates text — returns found=false when not located.
 */
export function extractPassageContext(
  manuscriptText: string,
  originalPassage: string,
  maxParagraphs = 3,
): PassageContext {
  const span = locatePassage(manuscriptText, originalPassage);
  if (!span) {
    return { found: false, contextBefore: null, contextAfter: null };
  }

  const before = manuscriptText.slice(0, span.start);
  const after = manuscriptText.slice(span.end);

  const paragraphsBefore = splitParagraphs(before).slice(-maxParagraphs);
  const paragraphsAfter = splitParagraphs(after).slice(0, maxParagraphs);

  return {
    found: true,
    contextBefore: paragraphsBefore.length > 0 ? paragraphsBefore.join("\n\n") : null,
    contextAfter: paragraphsAfter.length > 0 ? paragraphsAfter.join("\n\n") : null,
  };
}
