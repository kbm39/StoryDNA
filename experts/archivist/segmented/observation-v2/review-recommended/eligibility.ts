/**
 * Phase 1 review eligibility. Consumes diagnoseV2ObservationPair; does not change it.
 */

import { diagnoseV2ObservationPair } from "../comparison.ts";
import { v2ObservationEntityKey } from "../entity-resolution.ts";
import { withNamespacedObservationId } from "../entity-resolution.ts";
import type { V2ComparisonDiagnosis } from "../comparison.ts";
import type { V2Observation } from "../types.ts";
import { PHASE1_REVIEW_REASON_ALLOWLIST } from "./types.ts";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function payload(observation: V2Observation): Record<string, unknown> {
  return observation.payload as unknown as Record<string, unknown>;
}

export function observationIsReviewEvidenceVerified(observation: V2Observation): boolean {
  const evidence = observation.evidence;
  return (
    evidence.evidence_status === "verified" &&
    Boolean(evidence.locator?.trim()) &&
    Boolean(evidence.excerpt?.trim())
  );
}

export function injuryTopicKey(observation: V2Observation): string | null {
  if (observation.kind !== "injury") return null;
  const region = text(payload(observation).body_region);
  return region ? norm(region) : null;
}

export function injuryStateKey(observation: V2Observation): string | null {
  if (observation.kind !== "injury") return null;
  const state = text(payload(observation).condition) ?? text(payload(observation).diagnosis);
  return state ? norm(state) : null;
}

export function injuryLaterality(observation: V2Observation): string {
  return text(payload(observation).laterality) ?? "unspecified";
}

export function isMixedSpecifiedUnspecifiedLaterality(
  left: V2Observation,
  right: V2Observation,
): boolean {
  const leftSide = injuryLaterality(left);
  const rightSide = injuryLaterality(right);
  return (leftSide === "unspecified") !== (rightSide === "unspecified");
}

export function isPhase1ReviewEligiblePair(
  left: V2Observation,
  right: V2Observation,
  diagnosis: V2ComparisonDiagnosis,
): boolean {
  if (diagnosis.eligibility !== "insufficient_semantic_specificity") return false;
  if (!(PHASE1_REVIEW_REASON_ALLOWLIST as readonly string[]).includes(diagnosis.reason)) {
    return false;
  }
  if (!observationIsReviewEvidenceVerified(left) || !observationIsReviewEvidenceVerified(right)) {
    return false;
  }
  if (left.kind !== "injury" || right.kind !== "injury") return false;
  if (diagnosis.pairing_interface !== "injury_state") return false;
  const leftEntity = v2ObservationEntityKey(left);
  const rightEntity = v2ObservationEntityKey(right);
  if (!leftEntity || !rightEntity || leftEntity !== rightEntity) return false;
  const leftTopic = injuryTopicKey(left);
  const rightTopic = injuryTopicKey(right);
  if (!leftTopic || !rightTopic || leftTopic !== rightTopic) return false;
  const leftState = injuryStateKey(left);
  const rightState = injuryStateKey(right);
  if (!leftState || !rightState || leftState === rightState) return false;
  return isMixedSpecifiedUnspecifiedLaterality(left, right);
}

export function diagnoseNamespacedPair(
  left: V2Observation,
  right: V2Observation,
): { left: V2Observation; right: V2Observation; diagnosis: V2ComparisonDiagnosis } {
  const namedLeft = withNamespacedObservationId(left);
  const namedRight = withNamespacedObservationId(right);
  return {
    left: namedLeft,
    right: namedRight,
    diagnosis: diagnoseV2ObservationPair(namedLeft, namedRight),
  };
}
