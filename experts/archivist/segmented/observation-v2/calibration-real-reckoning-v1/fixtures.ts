/**
 * Frozen expected V2 observation keys for the first small real-Reckoning calibration.
 * Written from Rule 8 verified excerpts + authorized REVISED-13 passage identities
 * BEFORE any provider call. Do not alter after seeing Haiku output.
 * Does not embed manuscript windows.
 */

import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import type { V2ExpectedObservation } from "../calibration-v1/fixtures.ts";
import type { V2Observation, V2ObservationKind } from "../types.ts";

export const V2_REAL_CAL_R8010_SEGMENT_ID = "seg-v2-real-r8-010" as const;
export const V2_REAL_CAL_R8011_SEGMENT_ID = "seg-v2-real-r8-011" as const;
export const V2_REAL_CAL_R8029_SEGMENT_ID = "seg-v2-real-r8-029" as const;

function verified(id: "R8-010" | "R8-011" | "R8-029") {
  const row = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === id);
  if (!row) throw new Error(`missing frozen Rule 8 case ${id}`);
  return row;
}

const R8010 = verified("R8-010");
const R8011 = verified("R8-011");
const R8029 = verified("R8-029");

export const V2_REAL_CAL_R8010_ANCHORS = {
  benchmark_id: "R8-010",
  chapters: [R8010.side_a.locator, R8010.side_b.locator],
  side_a_excerpt: R8010.side_a.excerpt,
  side_b_excerpt: R8010.side_b.excerpt,
} as const;

export const V2_REAL_CAL_R8011_ANCHORS = {
  benchmark_id: "R8-011",
  chapters: [R8011.side_a.locator, R8011.side_b.locator],
  side_a_excerpt: R8011.side_a.excerpt,
  side_b_excerpt: R8011.side_b.excerpt,
} as const;

export const V2_REAL_CAL_R8029_ANCHORS = {
  benchmark_id: "R8-029",
  chapters: [R8029.side_a.locator, R8029.side_b.locator],
  side_a_excerpt: R8029.side_a.excerpt,
  side_b_excerpt: R8029.side_b.excerpt,
} as const;

export const V2_REAL_CAL_R8010_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-010-st-air",
    kind: "statement",
    subject_tokens: ["ari"],
    object_tokens: ["air cover"],
    excerpt_must_include: "No air cover",
    purpose: "Ari states air support unavailable",
  },
  {
    id: "r8-010-cap-unavail",
    kind: "operational_capability",
    subject_tokens: [],
    object_tokens: ["strike package"],
    excerpt_must_include: "No strike package",
    purpose: "strike package / air support capability unavailable",
  },
  {
    id: "r8-010-ev-missiles",
    kind: "event",
    subject_tokens: [],
    object_tokens: ["missile"],
    excerpt_must_include: "two missiles",
    purpose: "Hank/drone missile engagement event",
  },
  {
    id: "r8-010-cap-used",
    kind: "operational_capability",
    subject_tokens: [],
    object_tokens: ["missile"],
    excerpt_must_include: "Engaging",
    purpose: "missile capability used",
  },
];

export const V2_REAL_CAL_R8011_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-011-kn-use",
    kind: "knowledge",
    subject_tokens: ["cole"],
    object_tokens: ["numi numi"],
    excerpt_must_include: "numi numi",
    purpose: "Cole demonstrates use/recognition of numi numi",
  },
  {
    id: "r8-011-kn-learn",
    kind: "knowledge",
    subject_tokens: ["cole"],
    object_tokens: ["lullaby"],
    excerpt_must_include: "Our mother sang it to her",
    purpose: "Cole later receives the lullaby explanation",
  },
];

export const V2_REAL_CAL_R8029_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-029-inj-right",
    kind: "injury",
    subject_tokens: [],
    object_tokens: ["right"],
    excerpt_must_include: "Chest, right side",
    purpose: "right-side chest/rib injury; laterality explicit in excerpt",
  },
  {
    id: "r8-029-inj-fracture",
    kind: "injury",
    subject_tokens: [],
    object_tokens: ["rib"],
    excerpt_must_include: "third rib",
    purpose: "basement rib fracture; laterality unspecified unless excerpt states a side",
  },
];

export function realCalExpectedFor(segmentId: string): V2ExpectedObservation[] {
  if (segmentId === V2_REAL_CAL_R8010_SEGMENT_ID) return V2_REAL_CAL_R8010_EXPECTED;
  if (segmentId === V2_REAL_CAL_R8011_SEGMENT_ID) return V2_REAL_CAL_R8011_EXPECTED;
  if (segmentId === V2_REAL_CAL_R8029_SEGMENT_ID) return V2_REAL_CAL_R8029_EXPECTED;
  throw new Error(`unknown real-Reckoning calibration segment ${segmentId}`);
}

export function realCalRequiredKinds(segmentId: string): V2ObservationKind[] {
  return [...new Set(realCalExpectedFor(segmentId).map((item) => item.kind))];
}

export function caseHasUnavailableSupport(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    const text = [
      item.kind,
      item.proposition.subject,
      item.proposition.object,
      item.evidence.excerpt,
      JSON.stringify(item.payload),
    ]
      .join(" ")
      .toLowerCase();
    const unavailable =
      text.includes("no air cover") ||
      text.includes("no strike package") ||
      text.includes("unavailable");
    return (
      unavailable &&
      (item.kind === "statement" || item.kind === "operational_capability") &&
      (text.includes("air") || text.includes("strike"))
    );
  });
}

export function caseHasMissileCapabilityUsed(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    const text = [
      item.kind,
      item.proposition.subject,
      item.proposition.object,
      item.evidence.excerpt,
      JSON.stringify(item.payload),
    ]
      .join(" ")
      .toLowerCase();
    const used =
      text.includes("engaging") ||
      text.includes("used") ||
      text.includes("fired") ||
      text.includes("two missiles");
    return (
      used &&
      (item.kind === "event" || item.kind === "operational_capability") &&
      (text.includes("missile") || text.includes("engaging"))
    );
  });
}

export function caseHasColeNumiUse(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    if (item.kind !== "knowledge") return false;
    const text = [
      item.proposition.subject,
      item.proposition.object,
      item.evidence.excerpt,
      JSON.stringify(item.payload),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes("cole") && text.includes("numi numi");
  });
}

export function caseHasColeLullabyAcquisition(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    const text = [
      item.kind,
      item.proposition.subject,
      item.proposition.object,
      item.evidence.excerpt,
      JSON.stringify(item.payload),
    ]
      .join(" ")
      .toLowerCase();
    const learned =
      text.includes("learned") ||
      text.includes("sang") ||
      text.includes("mother") ||
      text.includes("explained") ||
      text.includes("lullaby");
    return (
      learned &&
      (item.kind === "knowledge" || item.kind === "statement") &&
      (text.includes("cole") || text.includes("ari") || text.includes("noa"))
    );
  });
}

export function caseHasRightInjury(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    if (item.kind !== "injury") return false;
    const text = [item.evidence.excerpt, JSON.stringify(item.payload), item.proposition.object]
      .join(" ")
      .toLowerCase();
    return text.includes("right") && (text.includes("chest") || text.includes("rib"));
  });
}

export function caseHasBasementRibFracture(retained: readonly V2Observation[]): boolean {
  return retained.some((item) => {
    if (item.kind !== "injury") return false;
    const text = [item.evidence.excerpt, JSON.stringify(item.payload), item.proposition.object]
      .join(" ")
      .toLowerCase();
    return (
      (text.includes("rib") || text.includes("fracture") || text.includes("cracked")) &&
      (text.includes("basement") || text.includes("third"))
    );
  });
}

export function r8010ExtractionPasses(retained: readonly V2Observation[]): boolean {
  return caseHasUnavailableSupport(retained) && caseHasMissileCapabilityUsed(retained);
}

export function r8011ExtractionPasses(retained: readonly V2Observation[]): boolean {
  return caseHasColeNumiUse(retained) && caseHasColeLullabyAcquisition(retained);
}

export function r8029ExtractionPasses(retained: readonly V2Observation[]): boolean {
  return caseHasRightInjury(retained) && caseHasBasementRibFracture(retained);
}

function haystack(observation: V2Observation): string {
  return [
    observation.proposition.subject,
    observation.proposition.predicate,
    observation.proposition.object,
    observation.evidence.excerpt,
    JSON.stringify(observation.payload),
  ]
    .join(" ")
    .toLowerCase();
}

/** Detection sufficiency is separate from historical observation-recall keys. */
export function r8010DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const capabilities = retained.filter((item) => item.kind === "operational_capability");
  const unavailable = capabilities.some((item) => {
    const payload = item.payload as { state?: string };
    const text = haystack(item);
    return payload.state === "unavailable" && (text.includes("air") || text.includes("strike"));
  });
  const used = capabilities.some((item) => {
    const payload = item.payload as { state?: string };
    return payload.state === "used" && haystack(item).includes("missile");
  });
  return unavailable && used;
}

export function r8011DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const knowledge = retained.filter((item) => item.kind === "knowledge");
  const used = knowledge.some((item) => {
    const payload = item.payload as { knowledge_state?: string };
    const text = haystack(item);
    return text.includes("cole") && text.includes("numi numi") && payload.knowledge_state === "known";
  });
  const learned = knowledge.some((item) => {
    const payload = item.payload as { knowledge_state?: string };
    const text = haystack(item);
    return (
      text.includes("cole") &&
      payload.knowledge_state === "learned" &&
      (text.includes("numi") || text.includes("lullaby") || text.includes("mother"))
    );
  });
  return used && learned;
}

export function r8029DetectionSufficient(retained: readonly V2Observation[]): boolean {
  return caseHasRightInjury(retained) && caseHasBasementRibFracture(retained);
}
