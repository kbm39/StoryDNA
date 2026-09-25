/**
 * Smallest authorized REVISED-13 windows for the six-case breadth design.
 * Loads manuscript text at runtime. Does not embed copyrighted prose in source.
 */

import { locatePassage } from "@/lib/passage-locate.ts";
import { countManuscriptWords } from "@/lib/word-count.ts";
import {
  V2_REAL_BREADTH_R8001_ANCHORS,
  V2_REAL_BREADTH_R8001_SEGMENT_ID,
  V2_REAL_BREADTH_R8007_ANCHORS,
  V2_REAL_BREADTH_R8007_SEGMENT_ID,
  V2_REAL_BREADTH_R8012_ANCHORS,
  V2_REAL_BREADTH_R8012_SEGMENT_ID,
  V2_REAL_BREADTH_R8016_ANCHORS,
  V2_REAL_BREADTH_R8016_SEGMENT_ID,
  V2_REAL_BREADTH_R8023_ANCHORS,
  V2_REAL_BREADTH_R8023_SEGMENT_ID,
  V2_REAL_BREADTH_R8025_ANCHORS,
  V2_REAL_BREADTH_R8025_SEGMENT_ID,
} from "./fixtures.ts";

const TARGET_WORDS_EACH_SIDE = 90;
const MAX_WORDS_EACH_SIDE = 220;

export interface AuthorizedWindow {
  chapter: string;
  start_offset: number;
  end_offset: number;
  word_count: number;
  anchor_found: boolean;
  required_tokens_present: string[];
  missing_tokens: string[];
}

export interface AuthorizedCaseWindow {
  benchmark_id: string;
  segment_id: string;
  chapters: readonly string[];
  prose: string;
  word_count: number;
  windows: AuthorizedWindow[];
}

function chapterBounds(text: string, heading: string): { start: number; end: number } {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(?:^|\\n)(${escaped})\\n`));
  if (!match || match.index === undefined) {
    throw new Error(`STOP: chapter heading not found: ${heading}`);
  }
  const start = match[0].startsWith("\n") ? match.index + 1 : match.index;
  const after = start + heading.length;
  const next = text.slice(after).search(/\nCHAPTER [A-Z0-9][A-Z0-9 -]*\n/);
  return { start, end: next < 0 ? text.length : after + next };
}

function expandAround(args: {
  chapterText: string;
  chapterStart: number;
  excerpt: string;
  lookFor: readonly string[];
}): AuthorizedWindow & { text: string } {
  const located = locatePassage(args.chapterText, args.excerpt);
  if (!located) {
    throw new Error(`STOP: authorized excerpt not found in ${args.lookFor.join(",")}`);
  }
  const words = args.chapterText.split(/(\s+)/);
  let char = 0;
  let startWord = 0;
  let endWord = words.length;
  for (let i = 0; i < words.length; i++) {
    const next = char + words[i]!.length;
    if (char <= located.start && located.start < next) startWord = i;
    if (char < located.end && located.end <= next) {
      endWord = i + 1;
      break;
    }
    char = next;
  }
  const isWord = (token: string) => /\S/.test(token);
  const wordIndexes = words.map((token, i) => (isWord(token) ? i : -1)).filter((i) => i >= 0);
  const startWordPos = wordIndexes.findIndex((i) => i >= startWord);
  const endWordPos = wordIndexes.findIndex((i) => i >= endWord - 1);
  const from = Math.max(0, (startWordPos < 0 ? 0 : startWordPos) - TARGET_WORDS_EACH_SIDE);
  const to = Math.min(
    wordIndexes.length,
    (endWordPos < 0 ? wordIndexes.length : endWordPos + 1) + TARGET_WORDS_EACH_SIDE,
  );
  let sliceStart = wordIndexes[from] ?? 0;
  let sliceEnd = (wordIndexes[to - 1] ?? words.length - 1) + 1;

  let text = words.slice(sliceStart, sliceEnd).join("");
  const missing = args.lookFor.filter((token) => !text.toLowerCase().includes(token.toLowerCase()));
  if (missing.length > 0) {
    const extraFrom = Math.max(0, from - (MAX_WORDS_EACH_SIDE - TARGET_WORDS_EACH_SIDE));
    const extraTo = Math.min(
      wordIndexes.length,
      to + (MAX_WORDS_EACH_SIDE - TARGET_WORDS_EACH_SIDE),
    );
    sliceStart = wordIndexes[extraFrom] ?? 0;
    sliceEnd = (wordIndexes[extraTo - 1] ?? words.length - 1) + 1;
    text = words.slice(sliceStart, sliceEnd).join("");
  }
  const present = args.lookFor.filter((token) => text.toLowerCase().includes(token.toLowerCase()));
  const stillMissing = args.lookFor.filter((token) => !text.toLowerCase().includes(token.toLowerCase()));
  return {
    chapter: args.lookFor[0] ?? "",
    start_offset: args.chapterStart + words.slice(0, sliceStart).join("").length,
    end_offset: args.chapterStart + words.slice(0, sliceEnd).join("").length,
    word_count: countManuscriptWords(text),
    anchor_found: true,
    required_tokens_present: present,
    missing_tokens: stillMissing,
    text: text.trim(),
  };
}

function buildCase(args: {
  benchmark_id: string;
  segment_id: string;
  chapters: readonly string[];
  sideA: { excerpt: string; lookFor: readonly string[] };
  sideB: { excerpt: string; lookFor: readonly string[] };
  manuscript: string;
}): AuthorizedCaseWindow {
  const windows: AuthorizedWindow[] = [];
  const parts: string[] = [];
  for (const [index, chapter] of args.chapters.entries()) {
    const bounds = chapterBounds(args.manuscript, chapter);
    const chapterText = args.manuscript.slice(bounds.start, bounds.end);
    const side = index === 0 ? args.sideA : args.sideB;
    const window = expandAround({
      chapterText,
      chapterStart: bounds.start,
      excerpt: side.excerpt,
      lookFor: side.lookFor,
    });
    windows.push({
      chapter,
      start_offset: window.start_offset,
      end_offset: window.end_offset,
      word_count: window.word_count,
      anchor_found: window.anchor_found,
      required_tokens_present: window.required_tokens_present,
      missing_tokens: window.missing_tokens,
    });
    parts.push(`${chapter}\n\n${window.text}`);
  }
  const prose = parts.join("\n\n");
  return {
    benchmark_id: args.benchmark_id,
    segment_id: args.segment_id,
    chapters: args.chapters,
    prose,
    word_count: countManuscriptWords(prose),
    windows,
  };
}

export function extractAuthorizedBreadthWindows(manuscript: string): {
  r8001: AuthorizedCaseWindow;
  r8007: AuthorizedCaseWindow;
  r8012: AuthorizedCaseWindow;
  r8016: AuthorizedCaseWindow;
  r8023: AuthorizedCaseWindow;
  r8025: AuthorizedCaseWindow;
} {
  return {
    r8001: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8001_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8001_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8001_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8001_ANCHORS.side_a_excerpt,
        lookFor: ["Lior Benzvi", "0210"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8001_ANCHORS.side_b_excerpt,
        lookFor: ["2:14", "2:31"],
      },
      manuscript,
    }),
    r8007: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8007_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8007_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8007_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8007_ANCHORS.side_a_excerpt,
        lookFor: ["launch"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8007_ANCHORS.side_b_excerpt,
        lookFor: ["Zodiac"],
      },
      manuscript,
    }),
    r8012: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8012_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8012_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8012_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8012_ANCHORS.side_a_excerpt,
        lookFor: ["Lior had a daughter"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8012_ANCHORS.side_b_excerpt,
        lookFor: ["She was pregnant"],
      },
      manuscript,
    }),
    r8016: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8016_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8016_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8016_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8016_ANCHORS.side_a_excerpt,
        lookFor: ["vetting program"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8016_ANCHORS.side_b_excerpt,
        lookFor: ["never vetted him ourselves"],
      },
      manuscript,
    }),
    r8023: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8023_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8023_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8023_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8023_ANCHORS.side_a_excerpt,
        lookFor: ["Meridian Systems contractor", "past her office"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8023_ANCHORS.side_b_excerpt,
        lookFor: ["Cyrus", "Ibrahim"],
      },
      manuscript,
    }),
    r8025: buildCase({
      benchmark_id: V2_REAL_BREADTH_R8025_ANCHORS.benchmark_id,
      segment_id: V2_REAL_BREADTH_R8025_SEGMENT_ID,
      chapters: V2_REAL_BREADTH_R8025_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_BREADTH_R8025_ANCHORS.side_a_excerpt,
        lookFor: ["Sultanahmet", "0447"],
      },
      sideB: {
        excerpt: V2_REAL_BREADTH_R8025_ANCHORS.side_b_excerpt,
        lookFor: ["Izmir", "0517", "Sikorskys"],
      },
      manuscript,
    }),
  };
}

export function rangesOverlap(
  a: { start_offset: number; end_offset: number },
  b: { start_offset: number; end_offset: number },
): boolean {
  return a.start_offset < b.end_offset && b.start_offset < a.end_offset;
}

export function leakageHitsInBreadthPrompt(text: string): string[] {
  const hits: string[] = [];
  if (/\bRule 8\b/i.test(text)) hits.push("Rule 8");
  if (/\bR8-0(01|07|12|16|23|25|10|11|29)\b/.test(text)) hits.push("benchmark id");
  if (/expected contradiction/i.test(text)) hits.push("expected contradiction");
  if (/benchmark diagnosis/i.test(text)) hits.push("benchmark diagnosis");
  if (/this is inconsistent/i.test(text)) hits.push("this is inconsistent");
  if (/target answer/i.test(text)) hits.push("target answer");
  return hits;
}
