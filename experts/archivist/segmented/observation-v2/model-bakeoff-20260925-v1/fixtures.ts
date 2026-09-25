/**
 * Frozen bake-off expected keys. Written before any bake-off provider call.
 * Synthetic keys only. R8-001 / R8-016 / R8-011 reuse already-frozen expected rows.
 * Do not alter after seeing model output.
 */

import type { V2ExpectedObservation } from "../calibration-v1/fixtures.ts";
import { observationMatchesExpected } from "../calibration-v1/score.ts";
import { r8011DetectionSufficient } from "../calibration-real-reckoning-v1/fixtures.ts";
import type { V2Observation } from "../types.ts";

function haystack(observation: V2Observation): string {
  return [
    observation.kind,
    observation.proposition.subject,
    observation.proposition.predicate,
    observation.proposition.object,
    observation.evidence.excerpt,
    JSON.stringify(observation.payload),
  ]
    .join(" ")
    .toLowerCase();
}

export const V2_BAKEOFF_SYNTHETIC_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "syn-ts-0712",
    kind: "timestamp",
    subject_tokens: [],
    object_tokens: ["07:12"],
    excerpt_must_include: "07:12",
    purpose: "ferry departure clock",
  },
  {
    id: "syn-st-radio",
    kind: "statement",
    subject_tokens: ["mara"],
    object_tokens: ["radio"],
    excerpt_must_include: "The radio is dead",
    purpose: "Mara states the radio is dead",
  },
  {
    id: "syn-cap-radio",
    kind: "operational_capability",
    subject_tokens: ["radio"],
    object_tokens: ["radio"],
    excerpt_must_include: "The radio is dead",
    purpose: "radio capability unavailable",
  },
  {
    id: "syn-kn-joss-known",
    kind: "knowledge",
    subject_tokens: ["joss"],
    object_tokens: ["blue"],
    excerpt_must_include: "blue cache token",
    purpose: "Joss uses the blue cache token before it is explained",
  },
  {
    id: "syn-st-nia",
    kind: "statement",
    subject_tokens: ["nia"],
    object_tokens: ["blue"],
    excerpt_must_include: "Blue means the cache is live",
    purpose: "Nia explains the token",
  },
  {
    id: "syn-kn-joss-learned",
    kind: "knowledge",
    subject_tokens: ["joss"],
    object_tokens: ["blue"],
    excerpt_must_include: "Blue means the cache is live",
    purpose: "Joss receives the cache-token explanation",
  },
  {
    id: "syn-ev-flare",
    kind: "event",
    subject_tokens: ["rover"],
    object_tokens: ["flare"],
    excerpt_must_include: "fired its only flare",
    purpose: "rover flare event",
  },
  {
    id: "syn-cap-flare",
    kind: "operational_capability",
    subject_tokens: ["flare"],
    object_tokens: ["flare"],
    excerpt_must_include: "fired its only flare",
    purpose: "flare capability used",
  },
  {
    id: "syn-obj-compass-pocket",
    kind: "object_equipment",
    subject_tokens: ["pax"],
    object_tokens: ["compass"],
    excerpt_must_include: "pocketed the brass compass",
    purpose: "brass compass initial possession",
  },
  {
    id: "syn-obj-compass-chart",
    kind: "object_equipment",
    subject_tokens: ["pax"],
    object_tokens: ["compass"],
    excerpt_must_include: "set the brass compass on the chart",
    purpose: "brass compass continuation onto the chart",
  },
];

export function syntheticClockPresent(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => item.kind === "timestamp" && haystack(item).includes("07:12"));
}

export function syntheticJossKnown(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    if (item.kind !== "knowledge") return false;
    const payload = item.payload as { knowledge_state?: string };
    return haystack(item).includes("joss") && payload.knowledge_state === "known";
  });
}

export function syntheticJossLearned(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    if (item.kind !== "knowledge") return false;
    const payload = item.payload as { knowledge_state?: string };
    return haystack(item).includes("joss") && payload.knowledge_state === "learned";
  });
}

export function syntheticRadioUnavailable(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    const text = haystack(item);
    if (!text.includes("radio")) return false;
    const payload = item.payload as { state?: string };
    const unavailable =
      text.includes("dead") ||
      text.includes("unavailable") ||
      payload.state === "unavailable";
    return unavailable && (item.kind === "statement" || item.kind === "operational_capability");
  });
}

export function syntheticFlareUsed(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    const text = haystack(item);
    if (!text.includes("flare")) return false;
    const payload = item.payload as { state?: string };
    if (item.kind === "operational_capability" && payload.state === "used") return true;
    return item.kind === "event" && (text.includes("fired") || text.includes("used"));
  });
}

export function syntheticBothCompassStates(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return (
    texts.some((text) => text.includes("compass") && (text.includes("pocket") || text.includes("pocketed"))) &&
    texts.some((text) => text.includes("compass") && text.includes("chart"))
  );
}

export function syntheticDetectionSufficient(retained: readonly V2Observation[]): boolean {
  return (
    syntheticClockPresent(retained) &&
    syntheticJossKnown(retained) &&
    syntheticJossLearned(retained) &&
    syntheticRadioUnavailable(retained) &&
    syntheticFlareUsed(retained) &&
    syntheticBothCompassStates(retained)
  );
}

export function r8001ClocksConfirmationGrade(retained: readonly V2Observation[]): boolean {
  const clock0210 = retained.some((item) => {
    const text = haystack(item);
    return item.evidence.evidence_status === "verified" && text.includes("0210");
  });
  const clock0214 = retained.some((item) => {
    const text = haystack(item);
    return (
      item.evidence.evidence_status === "verified" &&
      (text.includes("2:14") || text.includes("02:14") || text.includes("0214"))
    );
  });
  return clock0210 && clock0214;
}

export function r8016SidesRetainedVerified(
  retained: readonly V2Observation[],
  expected: readonly V2ExpectedObservation[],
): boolean {
  return expected.every((row) =>
    retained.some(
      (observation) =>
        observation.evidence.evidence_status === "verified" &&
        observationMatchesExpected(row, observation),
    ),
  );
}

export function r8011ColeKnownAndLearned(retained: readonly V2Observation[]): boolean {
  return r8011DetectionSufficient(retained);
}
