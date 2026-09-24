/**
 * Separate observation time from continuity compatibility.
 *
 * Temporal relation answers when two observations occur.
 * Continuity compatibility answers whether a value change is allowed.
 * Different chapter numbers are earlier_later, not a reason to reject
 * a confirmed contradiction.
 */

import type {
  ArchivistContinuityCompatibility,
  ArchivistFinding,
  ArchivistObservationTemporalRelation,
} from "./contracts.ts";
import { phraseIsAsserted } from "./assertion-classifier.ts";
import { classifyFactPersistence } from "./fact-persistence.ts";
import { evaluateInjuryContinuity } from "./injury-laterality.ts";
import { evaluateKnowledgeContinuity } from "./knowledge-state.ts";
import { evaluateObjectPossessionContinuity } from "./object-possession.ts";

export const LEGACY_TEMPORAL_RELATION_MAP: Record<string, ArchivistObservationTemporalRelation> = {
  identical: "same_time",
  overlap: "overlapping",
  disjoint: "earlier_later",
  unknown: "unknown",
  same_time: "same_time",
  earlier_later: "earlier_later",
  overlapping: "overlapping",
};

const TRANSITION_MARKERS: Record<string, readonly string[]> = {
  appearance: [
    "dye",
    "dyed",
    "contacts",
    "lenses",
    "disguise",
    "wig",
    "costume",
    "supernatural",
    "spell",
    "glamour",
  ],
  alive_status: ["died", "dies", "dead", "killed", "deceased", "executed", "murdered"],
  rank_title: ["promoted", "demoted", "commissioned", "retired", "stripped"],
  location: ["moved", "traveled", "travelled", "left", "arrived", "fled"],
  possession: ["gave", "stole", "lost", "found", "handed"],
  injury: ["healed", "recovered"],
  relationship: ["married", "divorced", "separated", "broke up", "became"],
  age: ["years later", "years passed"],
  knowledge_state: [],
};

function chapterNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapArchivistTemporalRelation(
  value: unknown,
): ArchivistObservationTemporalRelation | string {
  if (typeof value !== "string") return "unknown";
  const trimmed = value.trim().toLowerCase();
  return LEGACY_TEMPORAL_RELATION_MAP[trimmed] ?? trimmed;
}

export function inferObservationTemporalRelation(finding: ArchivistFinding): ArchivistObservationTemporalRelation {
  const currentChapter =
    chapterNumber(finding.current_location?.chapter) ??
    chapterNumber(finding.current_location?.locator) ??
    chapterNumber(finding.temporal_analysis?.current_scope?.chapter);
  const conflictingChapter =
    chapterNumber(finding.conflicting_location?.chapter) ??
    chapterNumber(finding.conflicting_location?.locator) ??
    chapterNumber(finding.temporal_analysis?.conflicting_scope?.chapter);

  if (currentChapter != null && conflictingChapter != null) {
    if (currentChapter !== conflictingChapter) return "earlier_later";
    const currentTime = finding.temporal_analysis?.current_scope?.narrative_time;
    const conflictingTime = finding.temporal_analysis?.conflicting_scope?.narrative_time;
    if (currentTime && conflictingTime && currentTime !== conflictingTime) return "overlapping";
    return "same_time";
  }

  const mapped = mapArchivistTemporalRelation(finding.temporal_analysis?.relation);
  if (
    mapped === "same_time" ||
    mapped === "earlier_later" ||
    mapped === "overlapping" ||
    mapped === "unknown"
  ) {
    return mapped;
  }
  return "unknown";
}

export function findingTextHints(finding: ArchivistFinding): string {
  return [
    finding.explanation,
    finding.temporal_analysis?.explanation,
    ...(finding.current_evidence ?? []).map((record) => record.excerpt),
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
  ]
    .filter(Boolean)
    .join(" ");
}

export function transitionEvidenceText(finding: ArchivistFinding): string {
  return [
    finding.temporal_analysis?.explanation,
    ...(finding.current_evidence ?? []).map((record) => record.excerpt),
    ...(finding.conflicting_evidence ?? []).map((record) => record.excerpt),
  ]
    .filter(Boolean)
    .join(" ");
}

export function hasTransitionEvidence(finding: ArchivistFinding, factType: string): boolean {
  const haystack = transitionEvidenceText(finding);
  const markers = [
    ...(TRANSITION_MARKERS[factType] ?? []),
    ...(factType === "appearance" ? TRANSITION_MARKERS.appearance : []),
  ];
  return markers.some((marker) => phraseIsAsserted(haystack, marker));
}

export function evaluateContinuityCompatibility(
  finding: ArchivistFinding,
): ArchivistContinuityCompatibility {
  const bothSides =
    (finding.current_evidence?.length ?? 0) > 0 && (finding.conflicting_evidence?.length ?? 0) > 0;
  if (!bothSides) return "insufficient_evidence";

  const injury = evaluateInjuryContinuity(finding);
  if (injury.applies && injury.compatibility) return injury.compatibility;

  const knowledge = evaluateKnowledgeContinuity(finding);
  if (knowledge.applies && knowledge.compatibility) return knowledge.compatibility;

  const object = evaluateObjectPossessionContinuity(finding);
  if (object.applies && object.compatibility) return object.compatibility;

  const hints = findingTextHints(finding);
  const factType = finding.issue_type;
  const persistence = classifyFactPersistence({
    factType,
    issueType: finding.issue_type,
    textHints: hints,
  });
  const transition = hasTransitionEvidence(finding, factType);
  const relation = inferObservationTemporalRelation(finding);

  if (transition) return "compatible_change";
  if (persistence === "persistent" || persistence === "event_attribute") return "incompatible";
  if (persistence === "ephemeral") {
    if (relation === "same_time" || relation === "overlapping") return "incompatible";
    return "compatible_change";
  }
  if (persistence === "unknown") return "insufficient_evidence";
  return "unexplained_change";
}

export function confirmedContradictionMayStand(
  compatibility: ArchivistContinuityCompatibility,
): boolean {
  return compatibility === "incompatible" || compatibility === "unexplained_change";
}

export function applyArchivistTemporalContinuity(finding: ArchivistFinding): ArchivistFinding {
  const relation = inferObservationTemporalRelation(finding);
  const continuity_compatibility = evaluateContinuityCompatibility(finding);
  return {
    ...finding,
    temporal_analysis: {
      ...finding.temporal_analysis,
      relation,
      continuity_compatibility,
    },
  };
}
