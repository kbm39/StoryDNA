import { createHash } from "node:crypto";
import { locatePassage } from "@/lib/passage-locate.ts";
import type { LocatorResolution, SourceTextMatchState } from "./export-types.ts";

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) >= 0) {
    count += 1;
    idx += Math.max(1, needle.length);
  }
  return count;
}

export function classifySourceTextMatch(input: {
  readonly originalText: string;
  readonly activeManuscriptText: string;
  readonly storedStartOffset: number | null;
  readonly storedEndOffset: number | null;
}): {
  readonly state: SourceTextMatchState;
  readonly startOffset: number | null;
  readonly endOffset: number | null;
  readonly matchesActiveVersion: boolean;
} {
  const original = input.originalText.trim();
  const manuscript = input.activeManuscriptText;

  if (!original || !manuscript.trim()) {
    return {
      state: "INSUFFICIENT_LOCATOR_DATA",
      startOffset: null,
      endOffset: null,
      matchesActiveVersion: false,
    };
  }

  if (
    input.storedStartOffset !== null &&
    input.storedEndOffset !== null &&
    input.storedEndOffset > input.storedStartOffset
  ) {
    const slice = manuscript.slice(input.storedStartOffset, input.storedEndOffset);
    if (slice === original || slice.trim() === original) {
      return {
        state: "EXACT_MATCH",
        startOffset: input.storedStartOffset,
        endOffset: input.storedEndOffset,
        matchesActiveVersion: true,
      };
    }
  }

  const directCount = countOccurrences(manuscript, original);
  if (directCount > 1) {
    return {
      state: "MULTIPLE_MATCHES",
      startOffset: null,
      endOffset: null,
      matchesActiveVersion: false,
    };
  }

  const located = locatePassage(manuscript, original);
  if (located) {
    const slice = manuscript.slice(located.start, located.end);
    if (slice === original) {
      return {
        state: "EXACT_MATCH",
        startOffset: located.start,
        endOffset: located.end,
        matchesActiveVersion: true,
      };
    }
    return {
      state: "EXACT_MATCH",
      startOffset: located.start,
      endOffset: located.end,
      matchesActiveVersion: true,
    };
  }

  const normalizedHay = manuscript.replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedNeedle = original.replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedCount = countOccurrences(normalizedHay, normalizedNeedle);

  if (directCount === 1) {
    const idx = manuscript.indexOf(original);
    if (idx >= 0) {
      return {
        state: "UNIQUE_TEXT_MATCH",
        startOffset: idx,
        endOffset: idx + original.length,
        matchesActiveVersion: true,
      };
    }
  }

  if (normalizedCount === 1) {
    return {
      state: "UNIQUE_TEXT_MATCH",
      startOffset: null,
      endOffset: null,
      matchesActiveVersion: true,
    };
  }

  if (normalizedCount > 1) {
    return {
      state: "MULTIPLE_MATCHES",
      startOffset: null,
      endOffset: null,
      matchesActiveVersion: false,
    };
  }

  return {
    state: "NO_MATCH",
    startOffset: null,
    endOffset: null,
    matchesActiveVersion: false,
  };
}

export function resolveLocatorState(input: {
  readonly locatorLabel: string | null;
  readonly startOffset: number | null;
  readonly endOffset: number | null;
  readonly sourceTextMatchState: SourceTextMatchState;
}): { readonly locatorResolved: boolean; readonly locatorResolution: LocatorResolution } {
  if (input.startOffset !== null && input.endOffset !== null) {
    return { locatorResolved: true, locatorResolution: "resolved" };
  }
  if (input.locatorLabel?.trim()) {
    return {
      locatorResolved: input.sourceTextMatchState === "UNIQUE_TEXT_MATCH",
      locatorResolution:
        input.sourceTextMatchState === "UNIQUE_TEXT_MATCH" ? "partially_resolved" : "partially_resolved",
    };
  }
  if (input.sourceTextMatchState === "UNIQUE_TEXT_MATCH" || input.sourceTextMatchState === "EXACT_MATCH") {
    return { locatorResolved: true, locatorResolution: "partially_resolved" };
  }
  return { locatorResolved: false, locatorResolution: "unresolved" };
}

export function isSafeToApplyLater(input: {
  readonly sourceTextMatchState: SourceTextMatchState;
  readonly locatorResolved: boolean;
  readonly staleVersion: boolean;
}): boolean {
  if (input.staleVersion) return false;
  if (input.sourceTextMatchState === "EXACT_MATCH") return true;
  if (input.sourceTextMatchState === "UNIQUE_TEXT_MATCH" && input.locatorResolved) return true;
  return false;
}
