import type { ShadowApplicationState, ShadowOperationType } from "./shadow-types.ts";

const REPLACEMENT_TYPES = new Set([
  "line_edit",
  "paragraph_rewrite",
  "rewrite",
  "tighten",
  "clarify",
  "replace_dialogue",
  "replace_description",
  "replace_exposition",
]);

const DELETION_TYPES = new Set(["deletion", "delete"]);

const INSERTION_TYPES = new Set(["insertion", "expand"]);

const UNSUPPORTED_TYPES = new Set([
  "structural",
  "reorder",
  "combine",
  "split",
  "move",
  "comment_only",
  "author_decision_required",
  "restructuring_recommendation",
]);

export function mapRevisionTypeToOperation(revisionType: string): ShadowOperationType | null {
  if (REPLACEMENT_TYPES.has(revisionType)) return "replacement";
  if (DELETION_TYPES.has(revisionType)) return "deletion";
  if (INSERTION_TYPES.has(revisionType)) return "insertion_after";
  if (UNSUPPORTED_TYPES.has(revisionType)) return null;
  if (revisionType.includes("insert")) return "insertion_after";
  return "replacement";
}

export function unsupportedApplicationReason(revisionType: string): string {
  return `Revision type "${revisionType}" is not supported by the shadow application engine.`;
}

export function classifyBlockedState(input: {
  readonly staleVersion: boolean;
  readonly sourceMismatch: boolean;
  readonly ambiguousLocator: boolean;
  readonly hasConflict: boolean;
  readonly unsupportedType: boolean;
  readonly notSelected: boolean;
  readonly unsafe: boolean;
}): ShadowApplicationState {
  if (input.notSelected) return "skipped_unselected";
  if (input.hasConflict) return "blocked_conflict";
  if (input.staleVersion) return "blocked_stale_version";
  if (input.sourceMismatch) return "blocked_source_mismatch";
  if (input.ambiguousLocator) return "blocked_ambiguous_locator";
  if (input.unsupportedType || input.unsafe) return "skipped_unsafe";
  return "skipped_unsafe";
}

export function applyTextOperation(input: {
  readonly text: string;
  readonly operationType: ShadowOperationType;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly finalText: string;
  readonly expectedOriginal: string;
}): { ok: true; text: string } | { ok: false; error: string } {
  const slice = input.text.slice(input.startOffset, input.endOffset);
  if (slice !== input.expectedOriginal && slice.trim() !== input.expectedOriginal.trim()) {
    return { ok: false, error: "Source text verification failed before application." };
  }

  switch (input.operationType) {
    case "replacement":
    case "deletion":
      return {
        ok: true,
        text:
          input.text.slice(0, input.startOffset) +
          input.finalText +
          input.text.slice(input.endOffset),
      };
    case "insertion_before":
      return {
        ok: true,
        text:
          input.text.slice(0, input.startOffset) +
          input.finalText +
          input.text.slice(input.startOffset),
      };
    case "insertion_after":
      return {
        ok: true,
        text:
          input.text.slice(0, input.endOffset) +
          input.finalText +
          input.text.slice(input.endOffset),
      };
  }
}

export function operationsOverlap(
  a: { startOffset: number; endOffset: number },
  b: { startOffset: number; endOffset: number },
): boolean {
  return a.startOffset < b.endOffset && b.startOffset < a.endOffset;
}

export function sortOperationsForApplication<T extends { startOffset: number; endOffset: number; itemId: string }>(
  operations: readonly T[],
): T[] {
  return [...operations].sort((a, b) => {
    if (b.startOffset !== a.startOffset) return b.startOffset - a.startOffset;
    if (b.endOffset !== a.endOffset) return b.endOffset - a.endOffset;
    return b.itemId.localeCompare(a.itemId);
  });
}
