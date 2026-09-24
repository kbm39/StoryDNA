import { countManuscriptWords } from "@/lib/word-count.ts";
import { ARCHIVIST_COVERAGE_REPORT_SCHEMA } from "./constants.ts";
import { CoverageIncompleteError } from "./errors.ts";
import { structuralRootId } from "./structural-units.ts";
import type {
  CoverageRange,
  FullNovelCoverageReport,
  SegmentPlan,
} from "./types.ts";

function mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  const sorted = [...ranges].filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }
  return merged;
}

function subtractRanges(
  universe: { start: number; end: number },
  covered: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = universe.start;
  for (const range of mergeRanges(covered)) {
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < universe.end) gaps.push({ start: cursor, end: universe.end });
  return gaps;
}

function rangeWords(text: string, start: number, end: number): number {
  return countManuscriptWords(text.slice(start, end));
}

export function buildCoverageReport(args: {
  text: string;
  plan: SegmentPlan;
  canonicalWordCount: number;
}): FullNovelCoverageReport {
  const primaryRanges = args.plan.segments.flatMap((segment) =>
    segment.assignments
      .filter((item) => item.role === "primary")
      .map((item) => ({
        start: item.start_offset,
        end: item.end_offset,
        segment_id: segment.segment_id,
        unit_id: item.unit_id,
      })),
  );
  const uncovered = subtractRanges(
    { start: 0, end: args.text.length },
    primaryRanges,
  ).filter((range) => rangeWords(args.text, range.start, range.end) > 0);

  const occupancy = new Map<string, number>();
  for (const range of primaryRanges) {
    const key = `${range.start}:${range.end}:${range.unit_id}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  }
  const duplicated: CoverageRange[] = [];
  for (const [key, count] of occupancy) {
    if (count < 2) continue;
    const [start, end, unit_id] = key.split(":");
    duplicated.push({
      start: Number(start),
      end: Number(end),
      unit_id,
      kind: "duplicated",
    });
  }

  const unique_words_covered = args.plan.segments.reduce(
    (sum, segment) => sum + segment.unique_word_count,
    0,
  );
  const overlap_words = args.plan.segments.reduce(
    (sum, segment) => sum + segment.overlap_word_count,
    0,
  );
  const represented = new Set(args.plan.units.map((unit) => structuralRootId(unit.unit_id)));
  const exact =
    unique_words_covered === args.canonicalWordCount &&
    uncovered.length === 0 &&
    duplicated.length === 0 &&
    represented.size === args.plan.unit_count;
  const coverage_percentage = args.canonicalWordCount === 0
    ? 0
    : (unique_words_covered / args.canonicalWordCount) * 100;

  return {
    schema: ARCHIVIST_COVERAGE_REPORT_SCHEMA,
    manuscript_id: args.plan.manuscript_id,
    manuscript_version_id: args.plan.manuscript_version_id,
    content_hash: args.plan.content_hash,
    canonical_manuscript_words: args.canonicalWordCount,
    unit_count: args.plan.unit_count,
    units_represented: represented.size,
    segment_count: args.plan.segment_count,
    segments: args.plan.segments.map((segment) => ({
      segment_id: segment.segment_id,
      start_offset: segment.start_offset,
      end_offset: segment.end_offset,
      words_assigned: segment.unique_word_count + segment.overlap_word_count,
      unique_words: segment.unique_word_count,
      overlap_words: segment.overlap_word_count,
    })),
    unique_words_covered,
    overlap_words,
    uncovered_ranges: uncovered.map((range) => ({ ...range, kind: "uncovered" as const })),
    duplicated_ranges: duplicated,
    coverage_percentage,
    complete: exact,
  };
}

export function assertCompleteCoverage(report: FullNovelCoverageReport): void {
  if (report.units_represented !== report.unit_count) {
    throw new CoverageIncompleteError(
      `structural units represented ${report.units_represented}/${report.unit_count}`,
    );
  }
  if (report.unique_words_covered !== report.canonical_manuscript_words) {
    throw new CoverageIncompleteError(
      `unique words ${report.unique_words_covered} != canonical ${report.canonical_manuscript_words}`,
    );
  }
  if (report.uncovered_ranges.length > 0) {
    throw new CoverageIncompleteError("unexplained coverage gaps remain");
  }
  if (report.coverage_percentage !== 100) {
    throw new CoverageIncompleteError(
      `coverage is ${report.coverage_percentage}, not 100`,
    );
  }
  if (!report.complete) {
    throw new CoverageIncompleteError("coverage report is not complete");
  }
}
