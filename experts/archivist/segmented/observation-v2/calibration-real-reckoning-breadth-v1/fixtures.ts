/**
 * Frozen expected V2 observation keys for the six-case breadth design.
 * Written from Rule 8 verified excerpts BEFORE any provider call.
 * Detection-required keys only. Do not alter after seeing Haiku output.
 * Does not embed manuscript windows.
 */

import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import type { V2ExpectedObservation } from "../calibration-v1/fixtures.ts";
import type { V2Observation, V2ObservationKind } from "../types.ts";
import { V2_REAL_BREADTH_BENCHMARK_IDS } from "./lock.ts";

export const V2_REAL_BREADTH_R8001_SEGMENT_ID = "seg-v2-breadth-r8-001" as const;
export const V2_REAL_BREADTH_R8007_SEGMENT_ID = "seg-v2-breadth-r8-007" as const;
export const V2_REAL_BREADTH_R8012_SEGMENT_ID = "seg-v2-breadth-r8-012" as const;
export const V2_REAL_BREADTH_R8016_SEGMENT_ID = "seg-v2-breadth-r8-016" as const;
export const V2_REAL_BREADTH_R8023_SEGMENT_ID = "seg-v2-breadth-r8-023" as const;
export const V2_REAL_BREADTH_R8025_SEGMENT_ID = "seg-v2-breadth-r8-025" as const;

function verified(id: (typeof V2_REAL_BREADTH_BENCHMARK_IDS)[number]) {
  const row = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === id);
  if (!row) throw new Error(`missing frozen Rule 8 case ${id}`);
  return row;
}

const R8001 = verified("R8-001");
const R8007 = verified("R8-007");
const R8012 = verified("R8-012");
const R8016 = verified("R8-016");
const R8023 = verified("R8-023");
const R8025 = verified("R8-025");

export const V2_REAL_BREADTH_R8001_ANCHORS = {
  benchmark_id: "R8-001" as const,
  dimension: R8001.required_reasoning_type,
  chapters: [R8001.side_a.locator, R8001.side_b.locator],
  side_a_excerpt: R8001.side_a.excerpt,
  side_b_excerpt: R8001.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8007_ANCHORS = {
  benchmark_id: "R8-007" as const,
  dimension: R8007.required_reasoning_type,
  chapters: [R8007.side_a.locator, R8007.side_b.locator],
  side_a_excerpt: R8007.side_a.excerpt,
  side_b_excerpt: R8007.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8012_ANCHORS = {
  benchmark_id: "R8-012" as const,
  dimension: R8012.required_reasoning_type,
  chapters: [R8012.side_a.locator, R8012.side_b.locator],
  side_a_excerpt: R8012.side_a.excerpt,
  side_b_excerpt: R8012.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8016_ANCHORS = {
  benchmark_id: "R8-016" as const,
  dimension: R8016.required_reasoning_type,
  chapters: [R8016.side_a.locator, R8016.side_b.locator],
  side_a_excerpt: R8016.side_a.excerpt,
  side_b_excerpt: R8016.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8023_ANCHORS = {
  benchmark_id: "R8-023" as const,
  dimension: R8023.required_reasoning_type,
  chapters: [R8023.side_a.locator, R8023.side_b.locator],
  side_a_excerpt: R8023.side_a.excerpt,
  side_b_excerpt: R8023.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8025_ANCHORS = {
  benchmark_id: "R8-025" as const,
  dimension: R8025.required_reasoning_type,
  chapters: [R8025.side_a.locator, R8025.side_b.locator],
  side_a_excerpt: R8025.side_a.excerpt,
  side_b_excerpt: R8025.side_b.excerpt,
} as const;

export const V2_REAL_BREADTH_R8001_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-001-ts-0210",
    kind: "timestamp",
    subject_tokens: ["lior"],
    object_tokens: ["0210"],
    excerpt_must_include: "0210",
    purpose: "Lior found hanged at the 0210 check",
  },
  {
    id: "r8-001-ts-0214",
    kind: "timestamp",
    subject_tokens: [],
    object_tokens: ["2:14"],
    excerpt_must_include: "2:14",
    purpose: "scrap logged at 2:14",
  },
];

export const V2_REAL_BREADTH_R8007_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-007-obj-launch",
    kind: "object_equipment",
    subject_tokens: ["cyrus"],
    object_tokens: ["launch"],
    excerpt_must_include: "into a launch",
    purpose: "Cyrus escaped into a launch",
  },
  {
    id: "r8-007-obj-zodiac",
    kind: "object_equipment",
    subject_tokens: [],
    object_tokens: ["zodiac"],
    excerpt_must_include: "Zodiac",
    purpose: "staged exfil boat named Zodiac",
  },
];

export const V2_REAL_BREADTH_R8012_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-012-rel-daughter",
    kind: "relationship",
    subject_tokens: ["lior"],
    object_tokens: ["daughter"],
    excerpt_must_include: "Lior had a daughter",
    purpose: "Lior has a living daughter",
  },
  {
    id: "r8-012-rel-unborn",
    kind: "relationship",
    subject_tokens: [],
    object_tokens: ["pregnant"],
    excerpt_must_include: "She was pregnant",
    purpose: "unborn child is the one who must be told",
  },
];

export const V2_REAL_BREADTH_R8016_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-016-st-galit",
    kind: "statement",
    subject_tokens: ["galit"],
    object_tokens: ["vetting"],
    excerpt_must_include: "ran that vetting program",
    purpose: "Galit says she ran the vetting program Cyrus walked through",
  },
  {
    id: "r8-016-st-avi",
    kind: "statement",
    subject_tokens: ["avi"],
    object_tokens: ["vetted"],
    excerpt_must_include: "never vetted him ourselves",
    purpose: "Avi says Mossad never vetted him; the vendor did",
  },
];

export const V2_REAL_BREADTH_R8023_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-023-loc-contractor",
    kind: "location_presence",
    subject_tokens: ["contractor"],
    object_tokens: ["office"],
    excerpt_must_include: "pushed a cart of cabling past her office",
    purpose: "Meridian contractor regularly passes Dalia's office",
  },
  {
    id: "r8-023-id-ibrahim",
    kind: "identity",
    subject_tokens: ["cyrus"],
    object_tokens: ["ibrahim"],
    excerpt_must_include: "Cyrus, Ibrahim",
    purpose: "Cyrus is named Ibrahim, her handler",
  },
];

export const V2_REAL_BREADTH_R8025_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "r8-025-ts-0447",
    kind: "timestamp",
    subject_tokens: [],
    object_tokens: ["0447"],
    excerpt_must_include: "0447",
    purpose: "Istanbul rooftop clock 0447",
  },
  {
    id: "r8-025-ts-0517",
    kind: "timestamp",
    subject_tokens: [],
    object_tokens: ["0517"],
    excerpt_must_include: "0517",
    purpose: "Izmir NATO base clock 0517",
  },
  {
    id: "r8-025-tr-sikorsky",
    kind: "travel_leg",
    subject_tokens: [],
    object_tokens: ["izmir"],
    excerpt_must_include: "Sikorskys",
    purpose: "Turkish Sikorsky flight to Izmir",
  },
];

const EXPECTED_BY_SEGMENT: Record<string, V2ExpectedObservation[]> = {
  [V2_REAL_BREADTH_R8001_SEGMENT_ID]: V2_REAL_BREADTH_R8001_EXPECTED,
  [V2_REAL_BREADTH_R8007_SEGMENT_ID]: V2_REAL_BREADTH_R8007_EXPECTED,
  [V2_REAL_BREADTH_R8012_SEGMENT_ID]: V2_REAL_BREADTH_R8012_EXPECTED,
  [V2_REAL_BREADTH_R8016_SEGMENT_ID]: V2_REAL_BREADTH_R8016_EXPECTED,
  [V2_REAL_BREADTH_R8023_SEGMENT_ID]: V2_REAL_BREADTH_R8023_EXPECTED,
  [V2_REAL_BREADTH_R8025_SEGMENT_ID]: V2_REAL_BREADTH_R8025_EXPECTED,
};

export function breadthExpectedFor(segmentId: string): V2ExpectedObservation[] {
  const rows = EXPECTED_BY_SEGMENT[segmentId];
  if (!rows) throw new Error(`unknown breadth segment ${segmentId}`);
  return rows;
}

export function breadthRequiredKinds(segmentId: string): V2ObservationKind[] {
  return [...new Set(breadthExpectedFor(segmentId).map((item) => item.kind))];
}

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

export function r8001DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return texts.some((text) => text.includes("0210")) && texts.some((text) => text.includes("2:14") || text.includes("0214"));
}

export function r8007DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return texts.some((text) => text.includes("launch")) && texts.some((text) => text.includes("zodiac"));
}

export function r8012DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return (
    texts.some((text) => text.includes("daughter")) &&
    texts.some((text) => text.includes("pregnant") || text.includes("child"))
  );
}

export function r8016DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return (
    texts.some((text) => text.includes("vetting") && (text.includes("ran") || text.includes("galit"))) &&
    texts.some((text) => text.includes("never vetted") || (text.includes("vendor") && text.includes("vet")))
  );
}

export function r8023DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  return (
    texts.some((text) => text.includes("office") || text.includes("cabling") || text.includes("contractor")) &&
    texts.some((text) => text.includes("ibrahim"))
  );
}

export function r8025DetectionSufficient(retained: readonly V2Observation[]): boolean {
  const texts = retained.map(haystack);
  const clocks =
    texts.some((text) => text.includes("0447") || text.includes("04:47")) &&
    texts.some((text) => text.includes("0517") || text.includes("05:17"));
  const places =
    texts.some((text) => text.includes("istanbul") || text.includes("sultanahmet")) &&
    texts.some((text) => text.includes("izmir"));
  return clocks && places;
}

export const BREADTH_DETECTION_FNS = {
  "R8-001": r8001DetectionSufficient,
  "R8-007": r8007DetectionSufficient,
  "R8-012": r8012DetectionSufficient,
  "R8-016": r8016DetectionSufficient,
  "R8-023": r8023DetectionSufficient,
  "R8-025": r8025DetectionSufficient,
} as const;
