/**
 * Experimental model-facing V2 extraction prompt @v4.
 * Schema remains archivist_segment_observation@v2.
 * Does not mutate historical @v1, @v2, or @v3. Not wired to the paid path.
 * Keeps V3 scan-first balance and timestamp discipline.
 * Adds a hard observation cap so 6000-token segments can close JSON.
 */

import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2, V2_OBSERVATION_KINDS } from "./constants.ts";
import {
  V3_EXTRACTION_PROMPT_VERSION,
  V3_ORGANIZATION_AFFILIATION_MAPPING,
  V3_OUTPUT_ORDER_INSTRUCTION,
  V3_PROMPT_MAX_TOKENS,
  V3_PROMPT_SCHEMA_VERSION,
  assertHistoricalPromptsUnchangedByV3,
  buildV3ObservationSystemPrompt,
  buildV3ObservationUserPrompt,
  v3PromptForbidsEditorialOutput,
  v3PromptRemovesClockFirstStarvation,
} from "./prompt-v3.ts";

export const V4_EXTRACTION_PROMPT_VERSION = "archivist_v2_extraction_prompt@v4" as const;
export const V4_PROMPT_STATUS = "experimental_candidate" as const;
export const V4_PROMPT_WIRED_TO_PAID_PATH = false;
export const V4_PROMPT_MAX_TOKENS = 6000 as const;
export const V4_PROMPT_SCHEMA_VERSION = ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2;
export const V4_REQUIRED_PROMPT_KINDS = V2_OBSERVATION_KINDS;
export const V4_OUTPUT_ORDER_INSTRUCTION = V3_OUTPUT_ORDER_INSTRUCTION;
export const V4_ORGANIZATION_AFFILIATION_MAPPING = V3_ORGANIZATION_AFFILIATION_MAPPING;
export const V4_OBSERVATION_HARD_CAP = 16 as const;
export const V4_OBSERVATION_SOFT_MIN = 12 as const;

const V3_SOFT_TARGET = [
  "Soft observation target for a typical large segment: prefer approximately 10–18 continuity-grade observations. This is guidance, not a hard maximum.",
  "Do not suppress a critical injury, travel, identity, relationship, object, capability, knowledge, or location observation merely to stay at 18.",
  "Do not fill remaining output with incidental timestamps or redundant statements merely because room remains.",
].join("\n");

const V4_HARD_CAP = [
  `HARD OBSERVATION CAP: emit at most ${V4_OBSERVATION_HARD_CAP} observations for this segment.`,
  `Prefer ${V4_OBSERVATION_SOFT_MIN}–${V4_OBSERVATION_HARD_CAP} continuity-grade observations. ${V4_OBSERVATION_HARD_CAP} is a hard maximum, not a target to fill.`,
  "If the segment would produce more than 16 rows, keep the balanced continuity-grade set and omit incidental restatements.",
  "Do not emit a second injury for the same entity and the same body_region in this segment.",
  "Do not emit a second travel_leg for the same traveler, origin, and destination in this segment.",
  "Do not suppress the only injury, travel, identity, relationship, object, capability, knowledge, or location observation in the segment merely to stay under the cap.",
  "Do not fill remaining output with incidental timestamps or redundant statements merely because room remains.",
].join("\n");

export function buildV4ObservationSystemPrompt(): string {
  const v3 = buildV3ObservationSystemPrompt();
  if (!v3.includes(V3_SOFT_TARGET)) {
    throw new Error("v4 cannot derive from v3: soft target block missing");
  }
  return v3.replace(V3_SOFT_TARGET, V4_HARD_CAP);
}

export function buildV4ObservationUserPrompt(args: {
  segmentId: string;
  segmentText: string;
}): string {
  return [
    `segment_id: ${args.segmentId}`,
    "Return compact observational JSON only.",
    `schema: ${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}`,
    "One observations[] list. No V1 duplicated arrays. No entity_id. No accepted canon.",
    "Quote the shortest exact contiguous excerpt. One observation, one span.",
    "Scan the entire segment first. Emit a balanced continuity-grade set in manuscript appearance order. Do not group by kind.",
    `Emit at most ${V4_OBSERVATION_HARD_CAP} observations. Do not re-emit the same injury entity+body_region.`,
    "If the typed payload is complete, omit nested proposition.",
    "Close JSON before truncation.",
    "",
    "SEGMENT TEXT:",
    args.segmentText,
  ].join("\n");
}

export function assertV4PromptCoversObservationKinds(): string[] {
  const prompt = buildV4ObservationSystemPrompt();
  return V4_REQUIRED_PROMPT_KINDS.filter((kind) => !prompt.includes(kind));
}

export function v4PromptForbidsEditorialOutput(): boolean {
  return v3PromptForbidsEditorialOutput();
}

export function v4PromptRemovesClockFirstStarvation(): boolean {
  return v3PromptRemovesClockFirstStarvation() && !buildV4ObservationSystemPrompt().includes("TIER 1 — emit first");
}

export function v4PromptKeepsV3Balance(): boolean {
  const prompt = buildV4ObservationSystemPrompt();
  return (
    prompt.includes("SCAN FIRST. EMIT SECOND") &&
    prompt.includes("Do not emit all timestamps before other kinds") &&
    prompt.includes("TIMESTAMP DISCIPLINE") &&
    prompt.includes("kind=injury") &&
    prompt.includes("kind=travel_leg") &&
    !prompt.includes("prefer approximately 10–18") &&
    prompt.includes(`at most ${V4_OBSERVATION_HARD_CAP} observations`)
  );
}

export function assertHistoricalPromptsUnchangedByV4(): boolean {
  return (
    assertHistoricalPromptsUnchangedByV3() &&
    V3_EXTRACTION_PROMPT_VERSION === "archivist_v2_extraction_prompt@v3" &&
    V3_PROMPT_SCHEMA_VERSION === V4_PROMPT_SCHEMA_VERSION &&
    V3_PROMPT_MAX_TOKENS === 6000 &&
    V4_PROMPT_MAX_TOKENS === 6000 &&
    buildV3ObservationUserPrompt({ segmentId: "seg", segmentText: "x" }).includes("SEGMENT TEXT:")
  );
}
