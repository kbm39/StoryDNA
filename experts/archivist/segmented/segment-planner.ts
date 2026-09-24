import { createHash } from "node:crypto";
import { countManuscriptWords } from "@/lib/word-count.ts";
import {
  ARCHIVIST_SEGMENTED_PLANNER_VERSION,
  SEGMENT_MAX_INPUT_TOKENS,
  SEGMENT_MAX_MANUSCRIPT_WORDS,
  SEGMENT_PROMPT_OVERHEAD_TOKENS,
  SEGMENT_TARGET_WORD_PREFERRED,
  STRUCTURAL_OVERLAP_FALLBACK_WORDS,
  STRUCTURAL_OVERLAP_UNIT_WORD_CAP,
} from "./constants.ts";
import { StructuralUnitError } from "./errors.ts";
import {
  assertExpectedReckoningStructure,
  estimateTokensFromWords,
  extractStructuralUnits,
  splitOversizedUnit,
  structuralRootId,
} from "./structural-units.ts";
import type {
  PlannedSegment,
  SegmentPlan,
  SegmentUnitAssignment,
  StructuralManuscriptUnit,
} from "./types.ts";

export interface SegmentPlannerOptions {
  maxManuscriptWords?: number;
  maxInputTokens?: number;
  requireReckoningThirtyUnits?: boolean;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function sliceHash(text: string, start: number, end: number): string {
  return createHash("sha256").update(text.slice(start, end), "utf8").digest("hex");
}

function overlapFromPrevious(
  previous: StructuralManuscriptUnit,
  text: string,
): SegmentUnitAssignment {
  if (previous.word_count <= STRUCTURAL_OVERLAP_UNIT_WORD_CAP) {
    return {
      unit_id: previous.unit_id,
      heading: previous.heading,
      role: "overlap",
      start_offset: previous.start_offset,
      end_offset: previous.end_offset,
      word_count: previous.word_count,
    };
  }
  const slice = text.slice(previous.start_offset, previous.end_offset);
  const paragraphs = slice.split(/\n{2,}/);
  let taken = "";
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const candidate = [paragraphs[i], taken].filter(Boolean).join("\n\n");
    if (countManuscriptWords(candidate) > STRUCTURAL_OVERLAP_FALLBACK_WORDS && taken) {
      break;
    }
    taken = candidate;
  }
  const start = previous.end_offset - taken.length;
  return {
    unit_id: previous.unit_id,
    heading: previous.heading,
    role: "overlap",
    start_offset: Math.max(previous.start_offset, start),
    end_offset: previous.end_offset,
    word_count: countManuscriptWords(taken),
  };
}

function estimatedInputTokens(uniqueWords: number, overlapWords: number): number {
  return (
    estimateTokensFromWords(uniqueWords + overlapWords) + SEGMENT_PROMPT_OVERHEAD_TOKENS
  );
}

function flushSegment(args: {
  ordinal: number;
  assignments: SegmentUnitAssignment[];
  text: string;
}): PlannedSegment {
  const primary = args.assignments.filter((item) => item.role === "primary");
  const overlap = args.assignments.filter((item) => item.role === "overlap");
  if (primary.length === 0) {
    throw new StructuralUnitError("segment has no primary coverage");
  }
  const start_offset = Math.min(...args.assignments.map((item) => item.start_offset));
  const end_offset = Math.max(...args.assignments.map((item) => item.end_offset));
  const unique_word_count = primary.reduce((sum, item) => sum + item.word_count, 0);
  const overlap_word_count = overlap.reduce((sum, item) => sum + item.word_count, 0);
  const firstId = primary[0]!.unit_id;
  const lastId = primary[primary.length - 1]!.unit_id;
  return {
    segment_id: `seg-${String(args.ordinal).padStart(2, "0")}-${firstId}-${lastId}`,
    ordinal: args.ordinal,
    primary_unit_ids: primary.map((item) => item.unit_id),
    overlap_unit_ids: overlap.map((item) => item.unit_id),
    assignments: args.assignments,
    start_offset,
    end_offset,
    unique_word_count,
    overlap_word_count,
    approximate_input_tokens: estimatedInputTokens(unique_word_count, overlap_word_count),
    source_hash: sliceHash(args.text, start_offset, end_offset),
  };
}

function assignPrimary(unit: StructuralManuscriptUnit): SegmentUnitAssignment {
  return {
    unit_id: unit.unit_id,
    heading: unit.heading,
    role: "primary",
    start_offset: unit.start_offset,
    end_offset: unit.end_offset,
    word_count: unit.word_count,
  };
}

export function expandUnitsForBudget(
  units: readonly StructuralManuscriptUnit[],
  text: string,
  maxWords: number,
): StructuralManuscriptUnit[] {
  return units.flatMap((unit) => splitOversizedUnit(unit, text, maxWords));
}

export function planSegments(
  text: string,
  identity: {
    manuscript_id: string;
    manuscript_version_id: string;
    content_hash: string;
  },
  options?: SegmentPlannerOptions,
): SegmentPlan {
  const maxWords = options?.maxManuscriptWords ?? SEGMENT_MAX_MANUSCRIPT_WORDS;
  const maxTokens = options?.maxInputTokens ?? SEGMENT_MAX_INPUT_TOKENS;
  const units = extractStructuralUnits(text);
  if (options?.requireReckoningThirtyUnits !== false) {
    assertExpectedReckoningStructure(units);
  }
  const packedUnits = expandUnitsForBudget(units, text, maxWords);
  const segments: PlannedSegment[] = [];
  let current: SegmentUnitAssignment[] = [];
  let currentPrimaryWords = 0;
  let previousPrimary: StructuralManuscriptUnit | undefined;

  const startNew = (unit: StructuralManuscriptUnit) => {
    current = [];
    currentPrimaryWords = 0;
    if (previousPrimary) {
      current.push(overlapFromPrevious(previousPrimary, text));
    }
    current.push(assignPrimary(unit));
    currentPrimaryWords = unit.word_count;
  };

  const wouldExceed = (nextWords: number): boolean => {
    const overlapWords = current
      .filter((item) => item.role === "overlap")
      .reduce((sum, item) => sum + item.word_count, 0);
    const words = currentPrimaryWords + nextWords;
    if (currentPrimaryWords > 0 && words > maxWords) return true;
    return estimatedInputTokens(words, overlapWords) > maxTokens;
  };

  for (const unit of packedUnits) {
    if (current.length === 0) {
      startNew(unit);
      previousPrimary = unit;
      continue;
    }
    if (wouldExceed(unit.word_count)) {
      segments.push(flushSegment({ ordinal: segments.length + 1, assignments: current, text }));
      startNew(unit);
    } else {
      current.push(assignPrimary(unit));
      currentPrimaryWords += unit.word_count;
    }
    previousPrimary = unit;
  }
  if (current.some((item) => item.role === "primary")) {
    segments.push(flushSegment({ ordinal: segments.length + 1, assignments: current, text }));
  }
  if (segments.length === 0) {
    throw new StructuralUnitError("planner produced no segments");
  }

  const plan_fingerprint = sha256Json({
    planner_version: ARCHIVIST_SEGMENTED_PLANNER_VERSION,
    manuscript_id: identity.manuscript_id,
    manuscript_version_id: identity.manuscript_version_id,
    content_hash: identity.content_hash,
    units: packedUnits.map((unit) => ({
      unit_id: unit.unit_id,
      start: unit.start_offset,
      end: unit.end_offset,
    })),
    segments: segments.map((segment) => ({
      segment_id: segment.segment_id,
      assignments: segment.assignments,
    })),
  });

  return {
    planner_version: ARCHIVIST_SEGMENTED_PLANNER_VERSION,
    plan_fingerprint,
    manuscript_id: identity.manuscript_id,
    manuscript_version_id: identity.manuscript_version_id,
    content_hash: identity.content_hash,
    unit_count: units.length,
    segment_count: segments.length,
    units,
    segments,
  };
}

export function representedStructuralRoots(plan: SegmentPlan): string[] {
  const roots = new Set<string>();
  for (const unit of plan.units) {
    roots.add(structuralRootId(unit.unit_id));
  }
  return [...roots];
}

export function preferredSegmentWordTarget(): number {
  return SEGMENT_TARGET_WORD_PREFERRED;
}
