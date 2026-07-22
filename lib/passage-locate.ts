/** PostgreSQL default trim() removes ASCII space (U+0020) only — not \\n, \\t, etc. */
function pgTrimSpaces(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === " ") start++;
  while (end > start && text[end - 1] === " ") end--;
  return text.slice(start, end);
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Mirrors public.manuscript_passage_located(text, text) used at publish time.
 * No partial-prefix probe — verified candidates must match the full passage.
 */
export function manuscriptPassageLocated(manuscriptText: string, passage: string): boolean {
  const vPassage = pgTrimSpaces(passage);
  if (!vPassage || vPassage.length < 8) return false;
  if (!manuscriptText || pgTrimSpaces(manuscriptText) === "") return false;

  if (manuscriptText.includes(vPassage)) return true;

  const hay = pgTrimSpaces(manuscriptText).replace(/\s+/g, " ").toLowerCase();
  const needle = vPassage.replace(/\s+/g, " ").toLowerCase();
  return hay.includes(needle);
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
