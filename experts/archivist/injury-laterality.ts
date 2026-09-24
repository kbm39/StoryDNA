/**
 * Injury laterality is an event attribute of a specific injury.
 *
 * Left vs right for the same wound/history at the same narrative state
 * is incompatible unless evidence establishes a second injury, bilateral
 * injuries, a later new injury, or a corrected diagnosis.
 *
 * Injury condition (wounded → healing → healed) and injury presence may
 * still change. Do not make all injury state immutable.
 */

import type { ArchivistContinuityCompatibility, ArchivistFinding } from "./contracts.ts";
import { textHasAssertedPhrase } from "./assertion-classifier.ts";

function evidenceHaystack(finding: ArchivistFinding): string {
  return [
    finding.explanation,
    finding.temporal_analysis?.explanation,
    ...(finding.current_evidence ?? []).map((record) => record.excerpt),
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
  ]
    .filter(Boolean)
    .join(" ");
}

function chapterNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function observationRelation(finding: ArchivistFinding): "same_time" | "earlier_later" | "overlapping" | "unknown" {
  const currentChapter =
    chapterNumber(finding.current_location?.chapter) ??
    chapterNumber(finding.current_location?.locator);
  const conflictingChapter =
    chapterNumber(finding.conflicting_location?.chapter) ??
    chapterNumber(finding.conflicting_location?.locator);
  if (currentChapter != null && conflictingChapter != null) {
    return currentChapter === conflictingChapter ? "same_time" : "earlier_later";
  }
  const relation = finding.temporal_analysis?.relation;
  if (
    relation === "same_time" ||
    relation === "earlier_later" ||
    relation === "overlapping" ||
    relation === "unknown"
  ) {
    return relation;
  }
  return "unknown";
}

export const INJURY_LATERALITIES = ["left", "right"] as const;
export type InjuryLaterality = (typeof INJURY_LATERALITIES)[number];

const BODY_REGIONS = [
  "shoulder",
  "arm",
  "hand",
  "wrist",
  "leg",
  "knee",
  "ankle",
  "foot",
  "hip",
  "eye",
  "ear",
  "cheek",
  "temple",
  "side",
] as const;

const SEPARATE_INJURY_MARKERS = [
  "second injury",
  "second wound",
  "another wound",
  "another injury",
  "both shoulders",
  "both arms",
  "each shoulder",
  "each side",
  "bilateral",
  "two wounds",
  "two injuries",
  "new injury",
  "new wound",
  "later injury",
  "corrected diagnosis",
  "misdiagnosed",
  "wrong shoulder",
] as const;

function lateralityIn(text: string): InjuryLaterality | null {
  const haystack = text.toLowerCase();
  const left = /\bleft\b/.test(haystack);
  const right = /\bright\b/.test(haystack);
  if (left && !right) return "left";
  if (right && !left) return "right";
  return null;
}

function regionIn(text: string): string | null {
  const haystack = text.toLowerCase();
  return BODY_REGIONS.find((region) => haystack.includes(region)) ?? null;
}

export function extractInjuryLaterality(text: string): {
  laterality: InjuryLaterality | null;
  region: string | null;
} {
  return { laterality: lateralityIn(text), region: regionIn(text) };
}

export function injuryLateralityMismatch(finding: ArchivistFinding): boolean {
  const current = (finding.current_evidence ?? []).map((record) => record.excerpt).join(" ");
  const conflicting = (finding.conflicting_evidence ?? []).map((record) => record.excerpt).join(" ");
  const a = extractInjuryLaterality(current);
  const b = extractInjuryLaterality(conflicting);
  if (!a.laterality || !b.laterality) return false;
  if (a.laterality === b.laterality) return false;
  if (a.region && b.region && a.region !== b.region) return false;
  return true;
}

export function hasSeparateInjuryExplanation(finding: ArchivistFinding): boolean {
  return textHasAssertedPhrase(evidenceHaystack(finding), SEPARATE_INJURY_MARKERS);
}

export function evaluateInjuryContinuity(finding: ArchivistFinding): {
  applies: boolean;
  same_injury: boolean | null;
  compatibility: ArchivistContinuityCompatibility | null;
} {
  if (finding.issue_type !== "injury") {
    return { applies: false, same_injury: null, compatibility: null };
  }
  if (!injuryLateralityMismatch(finding)) {
    return { applies: false, same_injury: null, compatibility: null };
  }
  if (hasSeparateInjuryExplanation(finding)) {
    return { applies: true, same_injury: false, compatibility: null };
  }
  const relation = observationRelation(finding);
  if (relation === "unknown") {
    return { applies: true, same_injury: null, compatibility: "insufficient_evidence" };
  }
  return { applies: true, same_injury: true, compatibility: "incompatible" };
}
