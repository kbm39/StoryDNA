import type { ComparisonMode } from "./types.ts";

/** Resolve comparison mode from version IDs and optional content hashes. */
export function resolveComparisonMode(args: {
  priorVersionId: string | null;
  currentVersionId: string | null;
  priorContentHash?: string | null;
  currentContentHash?: string | null;
}): ComparisonMode {
  if (
    args.priorVersionId &&
    args.currentVersionId &&
    args.priorVersionId === args.currentVersionId
  ) {
    return "SAME_VERSION_REASSESSMENT";
  }
  if (
    args.priorContentHash &&
    args.currentContentHash &&
    args.priorContentHash === args.currentContentHash
  ) {
    return "SAME_VERSION_REASSESSMENT";
  }
  return "REVISION_COMPARISON";
}

export function isSameVersionMode(mode: ComparisonMode): boolean {
  return mode === "SAME_VERSION_REASSESSMENT";
}

export function isRevisionMode(mode: ComparisonMode): boolean {
  return mode === "REVISION_COMPARISON";
}

/** Revision statuses that must not appear in same-version mode. */
export const REVISION_ONLY_STATUSES = new Set([
  "RESOLVED",
  "SUBSTANTIALLY_IMPROVED",
  "PARTIALLY_IMPROVED",
  "UNCHANGED",
  "WORSENED",
  "STALE_CRITIQUE",
]);

/** Same-version statuses that must not appear in revision mode. */
export const SAME_VERSION_ONLY_STATUSES = new Set([
  "SUPPORTED",
  "UNSUPPORTED",
  "OVERBROAD",
  "DUPLICATED",
]);
