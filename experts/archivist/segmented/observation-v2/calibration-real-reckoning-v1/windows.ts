/**
 * Smallest authorized REVISED-13 windows for the real-Reckoning V2 calibration.
 * Loads manuscript text at runtime. Does not embed copyrighted prose in source.
 */

import { locatePassage } from "@/lib/passage-locate.ts";
import { countManuscriptWords } from "@/lib/word-count.ts";
import {
  V2_REAL_CAL_R8010_ANCHORS,
  V2_REAL_CAL_R8010_SEGMENT_ID,
  V2_REAL_CAL_R8011_ANCHORS,
  V2_REAL_CAL_R8011_SEGMENT_ID,
  V2_REAL_CAL_R8029_ANCHORS,
  V2_REAL_CAL_R8029_SEGMENT_ID,
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
  const start = text.indexOf(heading);
  if (start < 0) throw new Error(`STOP: chapter heading not found: ${heading}`);
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
    start_offset: args.chapterStart + (words.slice(0, sliceStart).join("").length),
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

export function extractAuthorizedRealReckoningWindows(manuscript: string): {
  r8010: AuthorizedCaseWindow;
  r8011: AuthorizedCaseWindow;
  r8029: AuthorizedCaseWindow;
} {
  return {
    r8010: buildCase({
      benchmark_id: V2_REAL_CAL_R8010_ANCHORS.benchmark_id,
      segment_id: V2_REAL_CAL_R8010_SEGMENT_ID,
      chapters: V2_REAL_CAL_R8010_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_CAL_R8010_ANCHORS.side_a_excerpt,
        lookFor: ["Ari", "No air cover", "No strike package"],
      },
      sideB: {
        excerpt: V2_REAL_CAL_R8010_ANCHORS.side_b_excerpt,
        lookFor: ["Hank", "Hector", "two missiles", "Engaging"],
      },
      manuscript,
    }),
    r8011: buildCase({
      benchmark_id: V2_REAL_CAL_R8011_ANCHORS.benchmark_id,
      segment_id: V2_REAL_CAL_R8011_SEGMENT_ID,
      chapters: V2_REAL_CAL_R8011_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_CAL_R8011_ANCHORS.side_a_excerpt,
        lookFor: ["Cole", "numi numi"],
      },
      sideB: {
        excerpt: V2_REAL_CAL_R8011_ANCHORS.side_b_excerpt,
        lookFor: ["Ari", "Cole", "Our mother sang it to her"],
      },
      manuscript,
    }),
    r8029: buildCase({
      benchmark_id: V2_REAL_CAL_R8029_ANCHORS.benchmark_id,
      segment_id: V2_REAL_CAL_R8029_SEGMENT_ID,
      chapters: V2_REAL_CAL_R8029_ANCHORS.chapters,
      sideA: {
        excerpt: V2_REAL_CAL_R8029_ANCHORS.side_a_excerpt,
        lookFor: ["Chest, right side"],
      },
      sideB: {
        excerpt: V2_REAL_CAL_R8029_ANCHORS.side_b_excerpt,
        lookFor: ["third rib", "basement"],
      },
      manuscript,
    }),
  };
}

export function leakageHitsInPrompt(text: string): string[] {
  const hits: string[] = [];
  if (/\bRule 8\b/i.test(text)) hits.push("Rule 8");
  if (/\bR8-0(10|11|29)\b/.test(text)) hits.push("benchmark id");
  if (/expected contradiction/i.test(text)) hits.push("expected contradiction");
  if (/benchmark diagnosis/i.test(text)) hits.push("benchmark diagnosis");
  if (/this is inconsistent/i.test(text)) hits.push("this is inconsistent");
  if (/target answer/i.test(text)) hits.push("target answer");
  return hits;
}
