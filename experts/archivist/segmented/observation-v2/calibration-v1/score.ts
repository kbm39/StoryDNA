/**
 * $0 V2 extraction-calibration scoring.
 * Matches expected keys to adapted observations. Does not pair conflicts.
 */

import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "../../../contracts.ts";
import { countExcerptWords } from "../../../evidence.ts";
import { excerptIsContiguousInSegment } from "../evidence-contiguity.ts";
import { V2_OBSERVATION_KINDS } from "../constants.ts";
import type { V2Observation, V2ObservationKind } from "../types.ts";
import type { V2ExpectedObservation } from "./fixtures.ts";

export interface V2KindScore {
  kind: V2ObservationKind;
  expected: number;
  emitted: number;
  retained: number;
  correct: number;
  missed: number;
  hallucinated: number;
}

export interface V2SegmentScore {
  segment_id: string;
  expected: number;
  emitted: number;
  retained: number;
  true_positives: number;
  missed: string[];
  unexpected_grounded: number;
  hallucinated: number;
  quarantined: number;
  duplicates_suppressed: number;
  evidence_valid: number;
  fabricated_evidence: number;
  recall: number;
  precision: number;
  evidence_accuracy: number;
  matched: Array<{ expected_id: string; observation_id: string }>;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function haystack(observation: V2Observation): string {
  const payload = observation.payload as unknown as Record<string, unknown>;
  return norm(
    [
      observation.proposition.subject,
      observation.proposition.predicate,
      observation.proposition.object,
      observation.evidence.excerpt,
      ...Object.values(payload).map((item) => (typeof item === "string" ? item : "")),
    ].join(" "),
  );
}

export function evidenceMatchesProse(excerpt: string, prose: string): boolean {
  return excerpt.trim().length >= 8 && excerptIsContiguousInSegment(prose, excerpt);
}

export function observationMatchesExpected(expected: V2ExpectedObservation, observation: V2Observation): boolean {
  if (observation.kind !== expected.kind) return false;
  if (expected.polarity && observation.proposition.polarity !== expected.polarity) return false;
  const text = haystack(observation);
  const objectsOk = expected.object_tokens.every((token) => text.includes(norm(token)));
  const excerptOk =
    observation.evidence.excerpt.includes(expected.excerpt_must_include) ||
    text.includes(norm(expected.excerpt_must_include));
  if (expected.kind === "travel_leg") {
    const payload = observation.payload as unknown as Record<string, unknown>;
    const routeGrounded =
      typeof payload.origin === "string" &&
      payload.origin.trim() !== "" &&
      typeof payload.destination === "string" &&
      payload.destination.trim() !== "";
    const subjectOrVehicle = expected.subject_tokens.some((token) => text.includes(norm(token)));
    return objectsOk && excerptOk && routeGrounded && (subjectOrVehicle || Boolean(payload.traveler));
  }
  return (
    expected.subject_tokens.every((token) => text.includes(norm(token))) &&
    objectsOk
  );
}

export function excerptLooksFabricated(excerpt: string, prose: string): boolean {
  const trimmed = excerpt.trim();
  if (trimmed.length < 8) return false;
  if (countExcerptWords(trimmed) > ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS) return true;
  return !excerptIsContiguousInSegment(prose, trimmed);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(3));
}

export function scoreV2CalibrationSegment(args: {
  segmentId: string;
  prose: string;
  expected: V2ExpectedObservation[];
  emittedCount: number;
  retained: V2Observation[];
  quarantined: number;
  duplicatesSuppressed: number;
}): V2SegmentScore {
  const used = new Set<number>();
  const matched: Array<{ expected_id: string; observation_id: string }> = [];
  const missed: string[] = [];

  for (const expected of args.expected) {
    const index = args.retained.findIndex(
      (observation, i) => !used.has(i) && observationMatchesExpected(expected, observation),
    );
    if (index < 0) {
      missed.push(expected.id);
      continue;
    }
    used.add(index);
    matched.push({ expected_id: expected.id, observation_id: args.retained[index]!.id });
  }

  let unexpectedGrounded = 0;
  let hallucinated = 0;
  let evidenceValid = 0;
  let fabricated = 0;
  args.retained.forEach((observation, index) => {
    const valid = evidenceMatchesProse(observation.evidence.excerpt, args.prose);
    if (valid) evidenceValid += 1;
    if (excerptLooksFabricated(observation.evidence.excerpt, args.prose)) fabricated += 1;
    if (used.has(index)) return;
    if (valid) unexpectedGrounded += 1;
    else hallucinated += 1;
  });

  return {
    segment_id: args.segmentId,
    expected: args.expected.length,
    emitted: args.emittedCount,
    retained: args.retained.length,
    true_positives: matched.length,
    missed,
    unexpected_grounded: unexpectedGrounded,
    hallucinated,
    quarantined: args.quarantined,
    duplicates_suppressed: args.duplicatesSuppressed,
    evidence_valid: evidenceValid,
    fabricated_evidence: fabricated,
    recall: ratio(matched.length, args.expected.length),
    precision: ratio(matched.length, args.retained.length),
    evidence_accuracy: ratio(evidenceValid, args.retained.length),
    matched,
  };
}

export function scoreV2CalibrationByKind(args: {
  expected: V2ExpectedObservation[];
  retained: V2Observation[];
  emittedKinds: V2ObservationKind[];
}): V2KindScore[] {
  return V2_OBSERVATION_KINDS.map((kind) => {
    const expected = args.expected.filter((item) => item.kind === kind);
    const retained = args.retained.filter((item) => item.kind === kind);
    const used = new Set<number>();
    let correct = 0;
    for (const row of expected) {
      const index = retained.findIndex(
        (observation, i) => !used.has(i) && observationMatchesExpected(row, observation),
      );
      if (index >= 0) {
        used.add(index);
        correct += 1;
      }
    }
    return {
      kind,
      expected: expected.length,
      emitted: args.emittedKinds.filter((item) => item === kind).length,
      retained: retained.length,
      correct,
      missed: expected.length - correct,
      hallucinated: retained.length - used.size,
    };
  });
}

export function combineSegmentScores(scores: V2SegmentScore[]): {
  expected: number;
  retained: number;
  true_positives: number;
  recall: number;
  precision: number;
  evidence_accuracy: number;
  fabricated_evidence: number;
  hallucinated: number;
} {
  const expected = scores.reduce((sum, row) => sum + row.expected, 0);
  const retained = scores.reduce((sum, row) => sum + row.retained, 0);
  const truePositives = scores.reduce((sum, row) => sum + row.true_positives, 0);
  const evidenceValid = scores.reduce((sum, row) => sum + row.evidence_valid, 0);
  return {
    expected,
    retained,
    true_positives: truePositives,
    recall: ratio(truePositives, expected),
    precision: ratio(truePositives, retained),
    evidence_accuracy: ratio(evidenceValid, retained),
    fabricated_evidence: scores.reduce((sum, row) => sum + row.fabricated_evidence, 0),
    hallucinated: scores.reduce((sum, row) => sum + row.hallucinated, 0),
  };
}
