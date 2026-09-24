import { countManuscriptWords } from "@/lib/word-count.ts";
import {
  CHAPTER_WORD_NAMES,
  EXPECTED_RECKONING_CHAPTER_COUNT,
  EXPECTED_RECKONING_UNIT_COUNT,
  TOKENS_PER_MANUSCRIPT_WORD,
} from "./constants.ts";
import { StructuralUnitError } from "./errors.ts";
import type { StructuralManuscriptUnit } from "./types.ts";

const WORD_TO_NUMBER = new Map<string, number>(
  CHAPTER_WORD_NAMES.map((name, index) => [name, index + 1]),
);

export interface ParsedHeading {
  heading: string;
  heading_kind: "prologue" | "chapter";
  chapter_number: number | null;
  unit_id: string;
}

function normalizeHeadingToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function parseStructuralHeading(line: string): ParsedHeading | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^PROLOGUE$/i.test(trimmed)) {
    return {
      heading: "PROLOGUE",
      heading_kind: "prologue",
      chapter_number: null,
      unit_id: "prologue",
    };
  }
  const numbered = trimmed.match(/^CHAPTER\s+(\d{1,2})$/i);
  if (numbered) {
    const chapter_number = Number(numbered[1]);
    if (!Number.isInteger(chapter_number) || chapter_number < 1 || chapter_number > 29) {
      return null;
    }
    return {
      heading: `CHAPTER ${chapter_number}`,
      heading_kind: "chapter",
      chapter_number,
      unit_id: `chapter-${String(chapter_number).padStart(2, "0")}`,
    };
  }
  const named = trimmed.match(/^CHAPTER\s+([A-Z][A-Z\s-]+)$/i);
  if (!named) return null;
  const token = normalizeHeadingToken(named[1] ?? "");
  const chapter_number = WORD_TO_NUMBER.get(token);
  if (!chapter_number) return null;
  return {
    heading: `CHAPTER ${CHAPTER_WORD_NAMES[chapter_number - 1]}`,
    heading_kind: "chapter",
    chapter_number,
    unit_id: `chapter-${String(chapter_number).padStart(2, "0")}`,
  };
}

export function estimateTokensFromWords(words: number): number {
  return Math.ceil(words * TOKENS_PER_MANUSCRIPT_WORD);
}

export function extractStructuralUnits(text: string): StructuralManuscriptUnit[] {
  if (!text.trim()) {
    throw new StructuralUnitError("manuscript text is empty");
  }
  const matches: Array<{ index: number; heading: ParsedHeading }> = [];
  const lines = text.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const heading = parseStructuralHeading(line);
    if (heading) matches.push({ index: offset, heading });
    offset += line.length + (i < lines.length - 1 ? 1 : 0);
  }
  if (matches.length === 0) {
    throw new StructuralUnitError("no PROLOGUE/CHAPTER headings located");
  }

  const units: StructuralManuscriptUnit[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const next = matches[i + 1];
    const start = i === 0 ? 0 : current.index;
    const end = next ? next.index : text.length;
    const slice = text.slice(start, end);
    const word_count = countManuscriptWords(slice);
    units.push({
      unit_id: current.heading.unit_id,
      ordinal: i,
      heading: current.heading.heading,
      heading_kind: current.heading.heading_kind,
      chapter_number: current.heading.chapter_number,
      start_offset: start,
      end_offset: end,
      word_count,
      approximate_token_count: estimateTokensFromWords(word_count),
      part_index: 1,
      part_count: 1,
      locator: {
        kind: "char_range",
        start,
        end,
        unit_id: current.heading.unit_id,
        heading: current.heading.heading,
      },
    });
  }
  return units;
}

export function assertExpectedReckoningStructure(
  units: readonly StructuralManuscriptUnit[],
): void {
  if (units.length !== EXPECTED_RECKONING_UNIT_COUNT) {
    throw new StructuralUnitError(
      `expected ${EXPECTED_RECKONING_UNIT_COUNT} structural units, found ${units.length}`,
    );
  }
  const first = units[0];
  if (!first || first.heading_kind !== "prologue" || first.unit_id !== "prologue") {
    throw new StructuralUnitError("first structural unit must be PROLOGUE");
  }
  for (let chapter = 1; chapter <= EXPECTED_RECKONING_CHAPTER_COUNT; chapter++) {
    const unit = units[chapter];
    const expectedId = `chapter-${String(chapter).padStart(2, "0")}`;
    if (!unit || unit.unit_id !== expectedId || unit.chapter_number !== chapter) {
      throw new StructuralUnitError(`missing or out-of-order ${expectedId}`);
    }
  }
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.unit_id)) {
      throw new StructuralUnitError(`duplicate structural unit ${unit.unit_id}`);
    }
    seen.add(unit.unit_id);
  }
}

export function splitOversizedUnit(
  unit: StructuralManuscriptUnit,
  text: string,
  maxWords: number,
): StructuralManuscriptUnit[] {
  if (unit.word_count <= maxWords) return [unit];
  const slice = text.slice(unit.start_offset, unit.end_offset);
  const headingLineEnd = slice.indexOf("\n");
  const headingPrefix = headingLineEnd >= 0 ? slice.slice(0, headingLineEnd + 1) : "";
  const body = headingLineEnd >= 0 ? slice.slice(headingLineEnd + 1) : slice;
  const paragraphs = body.split(/\n{2,}/);
  const parts: Array<{ start: number; end: number; words: number }> = [];
  let cursor = unit.start_offset + headingPrefix.length;
  let partStart = unit.start_offset;
  let partWords = countManuscriptWords(headingPrefix);
  const flush = (end: number) => {
    const words = countManuscriptWords(text.slice(partStart, end));
    if (end > partStart && words > 0) {
      parts.push({ start: partStart, end, words });
    }
    partStart = end;
    partWords = 0;
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i] ?? "";
    const separator = i < paragraphs.length - 1 ? "\n\n" : "";
    const block = paragraph + separator;
    const blockWords = countManuscriptWords(block);
    if (partWords + blockWords > maxWords && partStart < cursor) {
      flush(cursor);
      partStart = cursor;
    }
    partWords += blockWords;
    cursor += block.length;
  }
  if (partStart < unit.end_offset) flush(unit.end_offset);
  if (parts.length <= 1) return [unit];

  return parts.map((part, index) => ({
    ...unit,
    unit_id: `${unit.unit_id}-part-${String(index + 1).padStart(2, "0")}`,
    start_offset: part.start,
    end_offset: part.end,
    word_count: part.words,
    approximate_token_count: estimateTokensFromWords(part.words),
    part_index: index + 1,
    part_count: parts.length,
    locator: {
      kind: "char_range",
      start: part.start,
      end: part.end,
      unit_id: `${unit.unit_id}-part-${String(index + 1).padStart(2, "0")}`,
      heading: unit.heading,
    },
  }));
}

export function structuralRootId(unitId: string): string {
  return unitId.replace(/-part-\d+$/, "");
}
