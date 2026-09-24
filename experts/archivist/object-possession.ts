/**
 * Unique-object possession: the same unique object cannot occupy two
 * incompatible possessions or locations at the same narrative time
 * unless a transfer, travel, or duplicate is evidenced.
 *
 * Do not apply this to generic/non-unique objects.
 */

import type { ArchivistContinuityCompatibility, ArchivistFinding } from "./contracts.ts";
import { textHasAssertedPhrase } from "./assertion-classifier.ts";

const TRANSFER_MARKERS = [
  "gave",
  "handed",
  "passed",
  "tossed",
  "threw",
  "stole",
  "stolen",
  "lost",
  "transferred",
  "transfer",
  "found",
  "left it",
  "took it",
  "returned",
  "recovered",
  "recovery",
  "duplicate",
  "copy of",
  "another compass",
  "another copy",
] as const;

const UNIQUE_MARKERS = ["unique", "only", "the only"] as const;
const GENERIC_INDEFINITE = /\b(?:a|an|some|another)\s+\w+\b/;

function haystack(finding: ArchivistFinding): string {
  return [
    finding.explanation,
    finding.temporal_analysis?.explanation,
    ...(finding.current_evidence ?? []).map((record) => record.excerpt),
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
  ]
    .filter(Boolean)
    .join(" ");
}

function sideText(
  finding: ArchivistFinding,
  side: "current" | "conflicting",
): string {
  const records = side === "current" ? finding.current_evidence : finding.conflicting_evidence;
  return (records ?? []).map((record) => record.excerpt).join(" ").toLowerCase();
}

function objectName(text: string): string | null {
  const unique = text.match(/\bthe\s+((?:silver|gold|brass|iron|black|white)\s+\w+)\b/);
  if (unique) return unique[1] ?? null;
  const named = text.match(/\bthe\s+([a-z]+(?:\s+[a-z]+)?)\b/);
  return named?.[1] ?? null;
}

export function objectAppearsUnique(finding: ArchivistFinding): boolean {
  const text = haystack(finding).toLowerCase();
  if (UNIQUE_MARKERS.some((marker) => text.includes(marker))) return true;
  const current = objectName(sideText(finding, "current"));
  const conflicting = objectName(sideText(finding, "conflicting"));
  const specific = Boolean(current && conflicting && current === conflicting && /\b(?:silver|gold|brass|iron|black|white)\s+/.test(current));
  if (specific) return true;
  if (GENERIC_INDEFINITE.test(sideText(finding, "current")) && GENERIC_INDEFINITE.test(sideText(finding, "conflicting"))) {
    return false;
  }
  return false;
}

export function hasObjectTransferExplanation(finding: ArchivistFinding): boolean {
  return textHasAssertedPhrase(haystack(finding), TRANSFER_MARKERS);
}

function sameTime(finding: ArchivistFinding): boolean {
  const relation = finding.temporal_analysis?.relation;
  const currentChapter = finding.current_location?.chapter ?? finding.current_location?.locator;
  const conflictingChapter = finding.conflicting_location?.chapter ?? finding.conflicting_location?.locator;
  if (currentChapter && conflictingChapter && currentChapter === conflictingChapter) {
    return relation !== "earlier_later";
  }
  return relation === "same_time" || relation === "overlapping";
}

export function evaluateObjectPossessionContinuity(finding: ArchivistFinding): {
  applies: boolean;
  unique: boolean;
  compatibility: ArchivistContinuityCompatibility | null;
} {
  if (finding.issue_type !== "possession" && finding.issue_type !== "object_continuity") {
    return { applies: false, unique: false, compatibility: null };
  }
  const unique = objectAppearsUnique(finding);
  if (!unique) {
    return { applies: true, unique: false, compatibility: null };
  }
  if (hasObjectTransferExplanation(finding)) {
    return { applies: true, unique: true, compatibility: "compatible_change" };
  }
  if (sameTime(finding)) {
    return { applies: true, unique: true, compatibility: "incompatible" };
  }
  return { applies: true, unique: true, compatibility: "unexplained_change" };
}
