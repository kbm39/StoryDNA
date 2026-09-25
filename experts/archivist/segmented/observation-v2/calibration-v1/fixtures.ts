/**
 * Synthetic V2 calibration fixtures and expected keys.
 * Written before any provider call. No REVISED-13. No copyrighted passages.
 */

import { V2_OBSERVATION_KINDS } from "../constants.ts";
import type { V2ObservationKind, V2Polarity } from "../types.ts";

export const V2_CAL_SEGMENT_A_ID = "seg-v2-cal-a" as const;
export const V2_CAL_SEGMENT_B_ID = "seg-v2-cal-b" as const;

export const V2_CAL_SEGMENT_A_PROSE = [
  "CHAPTER CAL-A",
  "",
  "At 04:47, Mara stood on the north dock. She said, \"Air support is unavailable.\"",
  "",
  "Cole pointed at the crate and used the name gray lantern.",
  "",
  "Three minutes later a drone fired two missiles at the lead truck from the south crane pad.",
  "",
  "Dana then told Cole that gray lantern meant the silent recall code.",
  "",
  "Mara was still present on the north dock. Cole was present at the south crane pad.",
].join("\n");

export const V2_CAL_SEGMENT_B_PROSE = [
  "CHAPTER CAL-B",
  "",
  "At 05:17, Lena boarded the Sikorsky in Ankara with her sister Noor. The brass compass was in Lena's jacket.",
  "",
  "Forty minutes later, at 05:57, the Sikorsky landed in Izmir.",
  "",
  "A medic said Lena's right ribs were bruised, not broken. The same medic later wrote that the ribs were cracked.",
  "",
  "The contractor, also known as Ibrahim, carried the brass compass from the cabin to the tarmac.",
  "",
  "Noor stayed beside her sister.",
].join("\n");

export interface V2ExpectedObservation {
  id: string;
  kind: V2ObservationKind;
  subject_tokens: string[];
  object_tokens: string[];
  excerpt_must_include: string;
  polarity?: V2Polarity;
  purpose: string;
}

export const V2_CAL_A_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "a-ts-0447",
    kind: "timestamp",
    subject_tokens: ["mara"],
    object_tokens: ["04:47"],
    excerpt_must_include: "04:47",
    purpose: "explicit clock on the dock scene",
  },
  {
    id: "a-st-air",
    kind: "statement",
    subject_tokens: ["mara"],
    object_tokens: ["air support", "unavailable"],
    excerpt_must_include: "Air support is unavailable",
    polarity: "false",
    purpose: "Mara claims air support unavailable",
  },
  {
    id: "a-cap-air",
    kind: "operational_capability",
    subject_tokens: ["air"],
    object_tokens: ["unavailable"],
    excerpt_must_include: "Air support is unavailable",
    purpose: "air support capability state",
  },
  {
    id: "a-kn-use",
    kind: "knowledge",
    subject_tokens: ["cole"],
    object_tokens: ["gray lantern"],
    excerpt_must_include: "used the name gray lantern",
    purpose: "Cole uses the term before it is explained",
  },
  {
    id: "a-ts-three",
    kind: "timestamp",
    subject_tokens: ["drone"],
    object_tokens: ["three minutes"],
    excerpt_must_include: "Three minutes later",
    purpose: "relative duration before the launch",
  },
  {
    id: "a-ev-missiles",
    kind: "event",
    subject_tokens: ["drone"],
    object_tokens: ["missiles"],
    excerpt_must_include: "drone fired two missiles",
    purpose: "objective missile launch",
  },
  {
    id: "a-cap-used",
    kind: "operational_capability",
    subject_tokens: ["drone"],
    object_tokens: ["missile"],
    excerpt_must_include: "fired two missiles",
    purpose: "missiles used after claimed unavailability",
  },
  {
    id: "a-kn-learn",
    kind: "knowledge",
    subject_tokens: ["dana"],
    object_tokens: ["gray lantern"],
    excerpt_must_include: "silent recall code",
    purpose: "Dana explains the term after Cole used it",
  },
  {
    id: "a-loc-dock",
    kind: "location_presence",
    subject_tokens: ["mara"],
    object_tokens: ["north dock"],
    excerpt_must_include: "north dock",
    purpose: "Mara present on the north dock",
  },
  {
    id: "a-loc-crane",
    kind: "location_presence",
    subject_tokens: ["cole"],
    object_tokens: ["south crane"],
    excerpt_must_include: "south crane pad",
    purpose: "Cole present at the south crane pad",
  },
];

export const V2_CAL_B_EXPECTED: V2ExpectedObservation[] = [
  {
    id: "b-ts-0517",
    kind: "timestamp",
    subject_tokens: ["lena"],
    object_tokens: ["05:17"],
    excerpt_must_include: "05:17",
    purpose: "explicit departure clock",
  },
  {
    id: "b-travel",
    kind: "travel_leg",
    subject_tokens: ["lena"],
    object_tokens: ["izmir"],
    excerpt_must_include: "Sikorsky",
    purpose: "Ankara to Izmir by Sikorsky",
  },
  {
    id: "b-ts-forty",
    kind: "timestamp",
    subject_tokens: ["sikorsky"],
    object_tokens: ["forty minutes"],
    excerpt_must_include: "Forty minutes later",
    purpose: "stated relative duration",
  },
  {
    id: "b-ts-0557",
    kind: "timestamp",
    subject_tokens: ["sikorsky"],
    object_tokens: ["05:57"],
    excerpt_must_include: "05:57",
    purpose: "explicit arrival clock",
  },
  {
    id: "b-rel-sister",
    kind: "relationship",
    subject_tokens: ["lena"],
    object_tokens: ["noor"],
    excerpt_must_include: "her sister Noor",
    purpose: "explicit sibling relationship",
  },
  {
    id: "b-inj-right",
    kind: "injury",
    subject_tokens: ["lena"],
    object_tokens: ["rib"],
    excerpt_must_include: "right ribs were bruised",
    purpose: "right-side rib injury, bruised not broken",
  },
  {
    id: "b-st-ribs",
    kind: "statement",
    subject_tokens: ["medic"],
    object_tokens: ["bruised"],
    excerpt_must_include: "bruised, not broken",
    purpose: "medic claim about rib state",
  },
  {
    id: "b-inj-cracked",
    kind: "injury",
    subject_tokens: ["lena"],
    object_tokens: ["cracked"],
    excerpt_must_include: "ribs were cracked",
    purpose: "later explicit injury-state change",
  },
  {
    id: "b-id-ibrahim",
    kind: "identity",
    subject_tokens: ["contractor"],
    object_tokens: ["ibrahim"],
    excerpt_must_include: "also known as Ibrahim",
    purpose: "alias claim without merge",
  },
  {
    id: "b-obj-jacket",
    kind: "object_equipment",
    subject_tokens: ["compass"],
    object_tokens: ["jacket"],
    excerpt_must_include: "brass compass was in Lena's jacket",
    purpose: "unique object at departure",
  },
  {
    id: "b-obj-tarmac",
    kind: "object_equipment",
    subject_tokens: ["compass"],
    object_tokens: ["tarmac"],
    excerpt_must_include: "brass compass from the cabin to the tarmac",
    purpose: "same unique object used later",
  },
];

export function calibrationProseFor(segmentId: string): string {
  if (segmentId === V2_CAL_SEGMENT_A_ID) return V2_CAL_SEGMENT_A_PROSE;
  if (segmentId === V2_CAL_SEGMENT_B_ID) return V2_CAL_SEGMENT_B_PROSE;
  throw new Error(`unknown calibration segment ${segmentId}`);
}

export function expectedFor(segmentId: string): V2ExpectedObservation[] {
  if (segmentId === V2_CAL_SEGMENT_A_ID) return V2_CAL_A_EXPECTED;
  if (segmentId === V2_CAL_SEGMENT_B_ID) return V2_CAL_B_EXPECTED;
  throw new Error(`unknown calibration segment ${segmentId}`);
}

export function assertExpectedKeysCoverKinds(expected: V2ExpectedObservation[], kinds: readonly V2ObservationKind[]): string[] {
  const present = new Set(expected.map((item) => item.kind));
  return kinds.filter((kind) => !present.has(kind));
}

export function assertExcerptsExistInProse(expected: V2ExpectedObservation[], prose: string): string[] {
  return expected
    .filter((item) => !prose.includes(item.excerpt_must_include))
    .map((item) => item.id);
}

export function requiredKindsForSegmentA(): V2ObservationKind[] {
  return ["timestamp", "statement", "event", "operational_capability", "knowledge", "location_presence"];
}

export function requiredKindsForSegmentB(): V2ObservationKind[] {
  return ["travel_leg", "timestamp", "injury", "relationship", "identity", "object_equipment"];
}

export function allCalibrationKinds(): readonly V2ObservationKind[] {
  return V2_OBSERVATION_KINDS;
}
