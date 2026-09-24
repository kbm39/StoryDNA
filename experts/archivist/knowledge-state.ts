/**
 * Knowledge-before-acquisition: a character cannot use a fact before
 * the established acquisition unless another source is evidenced.
 *
 * Do not invent knowledge history. Uncertain chronology does not confirm.
 */

import type { ArchivistContinuityCompatibility, ArchivistFinding } from "./contracts.ts";

function evidenceHaystack(finding: ArchivistFinding): string {
  return [
    finding.temporal_analysis?.explanation,
    ...(finding.current_evidence ?? []).map((record) => record.excerpt),
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
  ]
    .filter(Boolean)
    .join(" ");
}

const USAGE_MARKERS = [
  "whispered",
  "recited",
  "used the",
  "gave the",
  "spoke the",
  "said the",
  "knew the",
  "already knew",
] as const;

const ACQUISITION_MARKERS = [
  "learned",
  "was told",
  "told her",
  "told him",
  "discovered",
  "revealed",
  "found out",
  "was given",
] as const;

const ALTERNATE_SOURCE_MARKERS = [
  "already knew",
  "had learned",
  "had been told",
  "remembered from",
  "knew from",
  "overheard earlier",
  "someone else told",
  "another source",
] as const;

function chapterNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sideText(
  finding: ArchivistFinding,
  side: "current" | "conflicting",
): string {
  const records = side === "current" ? finding.current_evidence : finding.conflicting_evidence;
  return (records ?? []).map((record) => record.excerpt).join(" ").toLowerCase();
}

function hasMarker(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

export function knowledgeUsageBeforeAcquisition(finding: ArchivistFinding): {
  usage_before_acquisition: boolean;
  chronology_established: boolean;
  alternate_source: boolean;
} {
  const current = sideText(finding, "current");
  const conflicting = sideText(finding, "conflicting");
  const currentIsUsage = hasMarker(current, USAGE_MARKERS);
  const currentIsAcquisition = hasMarker(current, ACQUISITION_MARKERS);
  const conflictingIsUsage = hasMarker(conflicting, USAGE_MARKERS);
  const conflictingIsAcquisition = hasMarker(conflicting, ACQUISITION_MARKERS);

  const currentChapter =
    chapterNumber(finding.current_location?.chapter) ??
    chapterNumber(finding.current_location?.locator) ??
    chapterNumber(finding.temporal_analysis?.current_scope?.chapter);
  const conflictingChapter =
    chapterNumber(finding.conflicting_location?.chapter) ??
    chapterNumber(finding.conflicting_location?.locator) ??
    chapterNumber(finding.temporal_analysis?.conflicting_scope?.chapter);
  const chronology_established = currentChapter != null && conflictingChapter != null;

  const alternate_source = ALTERNATE_SOURCE_MARKERS.some((marker) =>
    evidenceHaystack(finding).toLowerCase().includes(marker),
  );

  if (!chronology_established) {
    return { usage_before_acquisition: false, chronology_established, alternate_source };
  }

  const earlierIsUsage =
    (currentChapter < conflictingChapter && currentIsUsage && conflictingIsAcquisition) ||
    (conflictingChapter < currentChapter && conflictingIsUsage && currentIsAcquisition);

  return {
    usage_before_acquisition: earlierIsUsage,
    chronology_established,
    alternate_source,
  };
}

export function evaluateKnowledgeContinuity(finding: ArchivistFinding): {
  applies: boolean;
  compatibility: ArchivistContinuityCompatibility | null;
} {
  if (finding.issue_type !== "knowledge_state") {
    return { applies: false, compatibility: null };
  }
  const result = knowledgeUsageBeforeAcquisition(finding);
  if (result.alternate_source) {
    return { applies: true, compatibility: null };
  }
  if (!result.chronology_established) {
    return { applies: true, compatibility: "insufficient_evidence" };
  }
  if (result.usage_before_acquisition) {
    return { applies: true, compatibility: "incompatible" };
  }
  return { applies: false, compatibility: null };
}
