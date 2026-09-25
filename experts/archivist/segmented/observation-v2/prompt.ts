/**
 * Experimental model-facing V2 extraction prompt.
 * Not wired to the paid Archivist path. Not sent by REVISED-13.
 * Nested proposition is optional for the model when the typed payload is
 * complete; the envelope still requires proposition after adapter recovery.
 * Schema version stays archivist_segment_observation@v2.
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
    'polarity must be the strings "true" | "false" | "unknown". Do not emit JSON booleans.',
    "source_kind: narration | dialogue | event | inference.",
    "confidence: high | medium | low.",
    "Exact enums — use only these strings:",
    "- knowledge_state: known | unknown | learned | inferred | claimed",
    "- knowledge perspective: character | narration | unspecified",
    "- relationship state: exists | does_not_exist | uncertain",
    "- identity_claim: also_known_as | role | same_as | unlinked",
    "- capability state: available | unavailable | unknown | used",
    "- capability source: statement | event | narration",
    "- presence: present | arriving | departing | absent",
    "- laterality: left | right | bilateral | unspecified",
    "",
    "Observation kinds — extract all that the segment actually supports:",
    "",
    "timestamp — explicit time expressions such as 04:47, 0517, 2:14, 2:31, forty minutes later, Three Days Later, since this morning, the night before.",
    "Capture raw_expression and, only where deterministic: clock_time, date, day_reference, relative_time, duration, time_window, sequence_marker, attached_event_id.",
    "Do not collapse explicit departure and arrival clocks into one timestamp. If 05:17 and 05:57 both appear, emit two timestamp observations.",
    "Do not convert vague time into invented precision.",
    "",
    "event — important narrative actions. Fields: actor, action, object/target, location, time reference, result, participants, equipment/capability.",
    "Examples: Hank fires two missiles at lead vehicle. Mitchell receives briefing about unauthorized SEAL flight. Dalia is placed in holding.",
    "Do not duplicate a statement as an event unless both are actually present.",
    "",
    "statement — dialogue or explicit claims, separate from objective events.",
    "Fields: speaker, proposition_topic, polarity, claim_value, target, time, context.",
    "Examples: Ari: air_cover unavailable. Mitchell: was not told about unauthorized flight. Preacher: ribs are not broken.",
    "Do not convert narration into dialogue. Do not create statement rows from narration.",
    "When dialogue explicitly asserts an injury diagnosis or state, emit BOTH a statement AND an injury row if both views are supported.",
    'Example: Medic: "Bruised, not broken." → statement ribs_broken=false AND injury rib condition=bruised.',
    "",
    "knowledge — character-grounded knowledge only.",
    "Fields: entity, topic, knowledge_state, perspective, acquisition_source, acquisition_event, acquisition_time, assertion/use_time.",
    "Narration naming an object or concept is NOT automatically character knowledge. Character perspective/use must be supported.",
    "If a character uses or recognizes a term, emit knowledge with knowledge_state=known and perspective=character.",
    "If another character later explains that term, emit a SECOND knowledge observation with knowledge_state=learned. Do not emit only a statement.",
    "A character explaining a term can justify statement=explanation AND knowledge=target character learned topic. Those are different reasoning dimensions.",
    "Example: Cole uses/recognizes \"numi numi\" and later Ari explains what \"numi numi\" means — two separate knowledge observations.",
    "",
    "travel_leg — only when origin/destination/mode/time are actually supported.",
    "Fields: traveler, origin, destination, departure_timestamp, arrival_timestamp, stated_duration, mode, distance_if_explicit.",
    "traveler is the human or named party who travels. mode is the vehicle or method. Do not put the vehicle in traveler when a human traveler is named.",
    "Do not calculate distance. Do not infer arrival time unless the manuscript states it.",
    "A travel excerpt must be one exact contiguous passage. Do not stitch departure and arrival sentences when intervening text exists.",
    "A single timestamp may carry both a relative expression and a normalized clock when they appear in the same explicit phrase (example: Forty minutes later, at 05:57). Do not invent a second timestamp for that same phrase.",
    "",
    "operational_capability — explicit capability/state. Emit this kind even when a statement or event is also present.",
    "Examples: air support unavailable, strike package unavailable, drone missiles available, missile launch occurred.",
    "Fields: entity/team/platform, capability_type, state, quantity, time_scope, location_or_operation, source.",
    "A spoken claim that air support is unavailable is both a statement AND an operational_capability row.",
    "When an event demonstrates that a capability was actually exercised, emit BOTH the event AND operational_capability with state=used when evidence supports both.",
    "Example: drone fires two missiles → event missile_launch AND capability missile capability=used.",
    "Do not infer unused capabilities.",
    "",
    "injury — one observation per specific body region/state.",
    "Fields: entity, injury_event_id, body_region, laterality, injury_type, diagnosis, condition, severity, cause, time.",
    "If injury side is not explicitly stated, emit laterality='unspecified'. Do not guess left, right, or bilateral.",
    "Do not combine \"chest and arm\" into one region. If the text says both, emit two observations.",
    "",
    "relationship — explicit relationship state only.",
    "Fields: subject, counterparty, relationship_type, state, time_scope.",
    "state must be exists | does_not_exist | uncertain.",
    "Examples: has daughter, spouse, sibling, colleague. Do not infer family structure beyond text.",
    "",
    "identity — identity claims without merging them.",
    "Fields: surface_name, identity_claim, alias, role, canonical_candidate.",
    "identity_claim must be also_known_as | role | same_as | unlinked, not a prose sentence.",
    "Examples: Cyrus may be Ibrahim. Contractor unlinked to named identity.",
    "Do not create canonical entity IDs.",
    "",
    "location_presence — entity, location, presence (present | arriving | departing | absent), time, event_context.",
    "location_presence requires an explicit location. Do not emit this kind when the place is only implied.",
    "Must support dock vs container stack, door vs air-conditioning unit, Ankara vs Tel Aviv sequencing.",
    "Different locations at different times are not automatically conflicts.",
    "",
    "object_equipment — object, object_identity, action_or_state, quantity, location, time.",
    "Use stable object identity only where text supports it (example: same Zodiac boat / exfil boat).",
    "If the same unique object appears later, emit a second object_equipment observation for that later state.",
    "An object being carried later can justify event=person carried object AND object_equipment=same object present/carried at later location/time.",
    "Do not rely on an event row alone when object continuity information is explicit.",
    "Do not treat all boats/weapons/vehicles as the same object.",
    "",
    "Multi-dimension extraction:",
    "A single passage may justify more than one observation kind when those observations serve different reasoning dimensions.",
    "This is NOT redundant duplication.",
    "Examples: missile launch → event plus operational_capability used; medic dialogue → statement plus injury; later object carry → event plus object_equipment; term explanation → statement plus learned knowledge.",
    "Do NOT duplicate observations that express the exact same reasoning dimension.",
    "",
    "Evidence for continuity-grade observations:",
    `locator, contiguous manuscript excerpt copied exactly (${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words max, 8 characters min), source_segment.`,
    "Excerpt must be an exact contiguous substring of the supplied segment. Do not stitch sentences across intervening prose. Do not paraphrase. Do not omit a middle phrase. No invented quotes.",
    "No evidence: the observation may exist for diagnostics but is not confirmation-grade.",
    "",
    "Forbidden editorial output — do not emit:",
    ...FORBIDDEN_EDITORIAL.map((item) => `- ${item}`),
    "Extract evidence. Do not judge it.",
    "",
    "Duplicate suppression:",
    "Do not repeat the same observation in multiple forms.",
    "Identity key: kind, subject, topic/value, polarity, locator.",
    "Preserve distinct observations that represent different logical claims and different reasoning dimensions.",
    "If one event already encodes Hank fired two missiles, still emit the distinct operational_capability used row when the launch demonstrates that capability.",
    "",
    "Rules:",
    "- Observe only the supplied segment.",
    "- Do not emit entity_id. Do not emit status accepted. Do not write canon, Series Bible, retcons, or dispositions.",
    "- Stay compact. No verbose explanations.",
    "- Nested proposition is optional when the typed payload already contains the same subject/predicate/state semantics. Do not duplicate a complete typed payload as a nested proposition.",
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
