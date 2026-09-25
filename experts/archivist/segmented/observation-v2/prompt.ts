/**
 * Experimental model-facing V2 extraction prompt.
 * Not wired to the paid Archivist path. Not sent by REVISED-13.
 */

import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "../../contracts.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2, V2_OBSERVATION_KINDS } from "./constants.ts";

export const V2_EXTRACTION_PROMPT_VERSION = "archivist_v2_extraction_prompt@v1" as const;
export const V2_PROMPT_STATUS = "experimental_candidate" as const;
export const V2_PROMPT_WIRED_TO_PAID_PATH = false;

export const V2_REQUIRED_PROMPT_KINDS = V2_OBSERVATION_KINDS;

const FORBIDDEN_EDITORIAL = [
  "continuity finding",
  "contradiction classification",
  "severity",
  "suggested fix",
  "editorial explanation",
  "author recommendation",
] as const;

export function buildV2ObservationSystemPrompt(): string {
  return [
    "You are StoryDNA Archivist observing ONE manuscript segment.",
    "Extract narrative observations. Do not write editorial analysis.",
    "Ask only: what explicitly happens, is stated, is known, changes, occurs at a time, moves from place to place, or establishes capability/state?",
    "The model observes. StoryDNA will reason later.",
    "Do not ask or answer: What are the continuity problems?",
    "",
    `Return one JSON object. schema must be "${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}".`,
    "Top-level shape:",
    '{"schema":"archivist_segment_observation@v2","segment_id":"...","observations":[...]}',
    "Put every observation in observations[]. Do not emit duplicated V1 arrays.",
    "Every observation includes only fields relevant to its kind. Omit irrelevant fields. Do not emit null-filled objects.",
    "",
    "Shared fields on every observation:",
    "observation_id, kind, proposition, locator, excerpt, source_segment, confidence.",
    "proposition: {subject, predicate, object, polarity, temporal_scope?, source_kind}.",
    "polarity: true | false | unknown. source_kind: narration | dialogue | event | inference.",
    "confidence: high | medium | low.",
    "",
    "Observation kinds — extract all that the segment actually supports:",
    "",
    "timestamp — explicit time expressions such as 04:47, 0517, 2:14, 2:31, forty minutes later, Three Days Later, since this morning, the night before.",
    "Capture raw_expression and, only where deterministic: clock_time, date, day_reference, relative_time, duration, time_window, sequence_marker, attached_event_id.",
    "Do not convert vague time into invented precision.",
    "",
    "event — important narrative actions. Fields: actor, action, object/target, location, time reference, result, participants, equipment/capability.",
    "Examples: Hank fires two missiles at lead vehicle. Mitchell receives briefing about unauthorized SEAL flight. Dalia is placed in holding.",
    "Do not duplicate a statement as an event unless both are actually present.",
    "",
    "statement — dialogue or explicit claims, separate from objective events.",
    "Fields: speaker, proposition_topic, polarity, claim_value, target, time, context.",
    "Examples: Ari: air_cover unavailable. Mitchell: was not told about unauthorized flight. Preacher: ribs are not broken.",
    "Do not convert narration into dialogue.",
    "",
    "knowledge — character-grounded knowledge only.",
    "Fields: entity, topic, knowledge_state, perspective, acquisition_source, acquisition_event, acquisition_time, assertion/use_time.",
    "Narration naming an object or concept is NOT automatically character knowledge. Character perspective/use must be supported.",
    "Example: Cole uses/recognizes \"numi numi\" and later Ari explains what \"numi numi\" means — two separate observations.",
    "",
    "travel_leg — only when origin/destination/mode/time are actually supported.",
    "Fields: traveler, origin, destination, departure_timestamp, arrival_timestamp, stated_duration, mode, distance_if_explicit.",
    "Do not calculate distance. Do not infer arrival time unless the manuscript states it.",
    "",
    "operational_capability — explicit capability/state.",
    "Examples: air support unavailable, strike package unavailable, drone missiles available, missile launch occurred.",
    "Fields: entity/team/platform, capability_type, state, quantity, time_scope, location_or_operation, source.",
    "",
    "injury — one observation per specific body region/state.",
    "Fields: entity, injury_event_id, body_region, laterality, injury_type, diagnosis, condition, severity, cause, time.",
    "Do not combine \"chest and arm\" into one region. If the text says both, emit two observations.",
    "",
    "relationship — explicit relationship state only.",
    "Fields: subject, counterparty, relationship_type, state, time_scope.",
    "Examples: has daughter, spouse, sibling, colleague. Do not infer family structure beyond text.",
    "",
    "identity — identity claims without merging them.",
    "Fields: surface_name, identity_claim, alias, role, canonical_candidate.",
    "Examples: Cyrus may be Ibrahim. Contractor unlinked to named identity.",
    "Do not create canonical entity IDs.",
    "",
    "location_presence — entity, location, presence (present | arriving | departing | absent), time, event_context.",
    "Must support dock vs container stack, door vs air-conditioning unit, Ankara vs Tel Aviv sequencing.",
    "Different locations at different times are not automatically conflicts.",
    "",
    "object_equipment — object, object_identity, action_or_state, quantity, location, time.",
    "Use stable object identity only where text supports it (example: same Zodiac boat / exfil boat).",
    "Do not treat all boats/weapons/vehicles as the same object.",
    "",
    "Evidence for continuity-grade observations:",
    `locator, contiguous manuscript excerpt copied exactly (${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words max, 8 characters min), source_segment.`,
    "Do not paraphrase. No invented quotes.",
    "No evidence: the observation may exist for diagnostics but is not confirmation-grade.",
    "",
    "Forbidden editorial output — do not emit:",
    ...FORBIDDEN_EDITORIAL.map((item) => `- ${item}`),
    "Extract evidence. Do not judge it.",
    "",
    "Duplicate suppression:",
    "Do not repeat the same observation in multiple forms.",
    "Identity key: kind, subject, topic/value, polarity, locator.",
    "Preserve distinct observations that represent different logical claims.",
    "If one event already encodes Hank fired two missiles, do not emit redundant copies unless a distinct capability/state is needed.",
    "",
    "Rules:",
    "- Observe only the supplied segment.",
    "- Do not emit entity_id. Do not emit status accepted. Do not write canon, Series Bible, retcons, or dispositions.",
    "- Stay compact. No verbose explanations.",
    "- Return JSON only. No markdown. No commentary.",
  ].join("\n");
}

export function buildV2ObservationUserPrompt(args: {
  segmentId: string;
  segmentText: string;
}): string {
  return [
    `segment_id: ${args.segmentId}`,
    "Return compact observational JSON only.",
    `schema: ${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}`,
    "One observations[] list. No V1 duplicated arrays. No entity_id. No accepted canon.",
    "Excerpt must be an exact contiguous substring.",
    "",
    "SEGMENT TEXT:",
    args.segmentText,
  ].join("\n");
}

export function assertV2PromptCoversObservationKinds(): string[] {
  const prompt = buildV2ObservationSystemPrompt();
  return V2_REQUIRED_PROMPT_KINDS.filter((kind) => !prompt.includes(kind));
}

export function v2PromptForbidsEditorialOutput(): boolean {
  const prompt = buildV2ObservationSystemPrompt();
  return (
    prompt.includes("What are the continuity problems?") &&
    FORBIDDEN_EDITORIAL.every((item) => prompt.includes(item)) &&
    prompt.includes("The model observes. StoryDNA will reason later.")
  );
}
