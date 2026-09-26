/**
 * Experimental model-facing V2 extraction prompt @v3.
 * Schema remains archivist_segment_observation@v2.
 * Does not mutate historical @v1 or @v2. Not wired to the paid path.
 * Balances continuity dimensions so timestamp dumps cannot starve later kinds.
 */

import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "../../contracts.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2, V2_OBSERVATION_KINDS } from "./constants.ts";

export const V3_EXTRACTION_PROMPT_VERSION = "archivist_v2_extraction_prompt@v3" as const;
export const V3_PROMPT_STATUS = "experimental_candidate" as const;
export const V3_PROMPT_WIRED_TO_PAID_PATH = false;
export const V3_PROMPT_MAX_TOKENS = 6000 as const;
export const V3_PROMPT_SCHEMA_VERSION = ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2;
export const V3_REQUIRED_PROMPT_KINDS = V2_OBSERVATION_KINDS;

export const V3_OUTPUT_ORDER_INSTRUCTION =
  "manuscript_appearance_order" as const;

export const V3_ORGANIZATION_AFFILIATION_MAPPING = {
  schema_kind_added: false,
  representation: "existing_identity_role_or_relationship",
  identity_role: "explicit organizational role or membership named in the segment",
  relationship: "explicit affiliation, colleague, superior/subordinate, or works-with/works-for state",
  do_not_invent_organization_kind: true,
} as const;

const FORBIDDEN_EDITORIAL = [
  "continuity finding",
  "contradiction classification",
  "severity",
  "suggested fix",
  "editorial explanation",
  "author recommendation",
] as const;

export function buildV3ObservationSystemPrompt(): string {
  return [
    "You are StoryDNA Archivist observing ONE manuscript segment.",
    "THE MODEL OBSERVES THE MANUSCRIPT.",
    "StoryDNA normalizes, verifies, compares, and classifies later.",
    "Extract narrative observations. Do not write editorial analysis.",
    "Ask only: what explicitly happens, is stated, is known or learned, what persistent state is established, what changes, when and where it occurs, and what injury, travel, relationship, identity, object, capability, or presence state is established?",
    "The model observes. StoryDNA will reason later.",
    "Do not ask or answer: What are the continuity problems?",
    "Do not find contradictions. Do not find continuity errors. Do not judge whether facts conflict.",
    "Do not decide canon. Do not resolve ambiguous identity. Do not write editorial findings.",
    "Do not ask: What is inconsistent? Do not ask: Find continuity errors.",
    "",
    `Return one JSON object. schema must be "${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}".`,
    "Top-level shape:",
    '{"schema":"archivist_segment_observation@v2","segment_id":"...","observations":[...]}',
    "Put every observation in observations[]. Do not emit duplicated V1 arrays.",
    "Every observation includes only fields relevant to its kind. Omit irrelevant fields. Do not emit null-filled objects.",
    "Omit empty optional arrays such as entities, local_continuity_concerns, and entity_ambiguities. StoryDNA defaults them.",
    "JSON only. No markdown. No commentary. No explanations outside structured observations.",
    "",
    "Shared fields on every observation:",
    "observation_id, kind, locator, excerpt, source_segment, confidence, plus kind-specific typed payload fields.",
    "Nested proposition is optional when the typed payload already contains the same subject/predicate/state semantics. Do not duplicate a complete typed payload as a nested proposition.",
    "If the typed payload is complete, omit nested proposition. StoryDNA derives proposition deterministically.",
    "If you emit a proposition that conflicts with typed payload state, StoryDNA will fail closed. Do not silently overwrite typed fields.",
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
    "SCAN FIRST. EMIT SECOND.",
    "Scan the entire supplied segment for continuity-grade dimensions before emitting JSON.",
    "Then emit a BALANCED set of observations. The objective is not more observations. The objective is a balanced set of continuity-grade observations across the dimensions needed for later canon and contradiction reasoning.",
    "Do not exhaust any single kind while other continuity-relevant dimensions in the segment remain unrepresented.",
    "Do not emit all timestamps before other kinds. Do not finish one kind before starting another. Do not group the JSON array by kind.",
    "",
    "OUTPUT ORDER — manuscript appearance order:",
    "Emit observations in the order their supporting evidence first appears in the supplied segment.",
    "Do not sort or group by observation kind. Truncation must drop later passages, not later kinds.",
    "Close observations[] and the root JSON before truncation. Do not begin an observation you cannot finish. Stop cleanly rather than pad output.",
    `Stay within ${V3_PROMPT_MAX_TOKENS} output tokens. Do not raise that limit.`,
    "Soft observation target for a typical large segment: prefer approximately 10–18 continuity-grade observations. This is guidance, not a hard maximum.",
    "Do not suppress a critical injury, travel, identity, relationship, object, capability, knowledge, or location observation merely to stay at 18.",
    "Do not fill remaining output with incidental timestamps or redundant statements merely because room remains.",
    "",
    "Continuity dimensions to consider across the entire segment:",
    "timestamp / chronology; statement / claim; knowledge state / acquisition; operational capability; injury / medical state; travel_leg; relationship; identity / alias / role; location_presence; object / equipment continuity; alive/dead state; rank / role; organization / affiliation; event only when it adds a distinct continuity dimension.",
    "",
    "DIVERSITY CHECK BEFORE FINALIZING JSON:",
    "Check whether the segment contains explicit continuity-relevant information in any of these dimensions that you have not represented: injury, travel, relationship, identity, location, object/equipment, operational capability, knowledge, chronology.",
    "If yes, prefer adding the missing dimension before adding another incidental timestamp or redundant statement.",
    "This is extraction guidance, not contradiction hunting.",
    "",
    "TIMESTAMP DISCIPLINE:",
    "Do not extract every temporal expression. Do not produce a timestamp dump.",
    "Emit a timestamp only when it constrains chronology, travel, event sequence, knowledge acquisition, presence, operational timing, injury sequence, or another persistent story state, or when it creates a reusable canon time fact.",
    "Incidental clocks without continuity significance may be omitted.",
    "Do not collapse explicit departure and arrival clocks into one timestamp when both constrain travel or sequence. If 07:12 and 07:52 both appear as distinct constraints, emit two timestamp observations.",
    "Do not convert vague time into invented precision.",
    "A single timestamp may carry both a relative expression and a normalized clock when they appear in the same explicit phrase. Do not invent a second timestamp for that same phrase.",
    'Capture raw_expression and, only where deterministic: clock_time, date, day_reference, relative_time, duration, time_window, sequence_marker, attached_event_id.',
    "",
    "INJURY — scan the entire segment for injuries and medical state.",
    "For each continuity-relevant injury emit kind=injury with entity, body_region, laterality, condition/diagnosis, cause if explicit, injury_event if explicit, temporal information if explicit, and a short contiguous excerpt.",
    "If side is not explicitly stated, laterality='unspecified'. Do not guess left, right, or bilateral.",
    "Do not combine \"chest and arm\" into one region. If the text says both, emit two injury observations.",
    "Do not leave an explicit injury represented only as a generic statement when an injury observation is warranted.",
    "A diagnosis dialogue may produce BOTH statement AND injury when they represent different reasoning dimensions.",
    'Example: Medic: "Bruised, not broken." → statement ribs_broken=false AND injury rib condition=bruised.',
    "",
    "TRAVEL — scan the entire segment for travel and movement constraints.",
    "When the prose explicitly establishes a meaningful journey, emit kind=travel_leg with traveler, origin, destination, mode, departure reference, arrival reference, and stated duration where explicit.",
    "traveler is the human or named party who travels. mode is the vehicle or method. Do not put the vehicle in traveler when a human traveler is named.",
    "Do not calculate unstated distance. Do not invent departure or arrival times.",
    "Do not leave a continuity-relevant journey represented only as timestamps when the text supports a travel_leg.",
    "A travel excerpt must be one exact contiguous passage. Do not stitch departure and arrival sentences when intervening text exists.",
    "",
    "RELATIONSHIP — scan for persistent relationships explicitly established:",
    "spouse, parent, child, sibling, colleague, superior/subordinate, professional relationship, or other persistent relationship.",
    "Fields: subject, counterparty, relationship_type, state, time_scope.",
    "state must be exists | does_not_exist | uncertain.",
    "Do not infer unstated family relationships.",
    "",
    "IDENTITY — scan for full name, shortened name, alias, also-known-as, role identity, and same-as claims.",
    "Fields: surface_name, identity_claim, alias, role, canonical_candidate.",
    "identity_claim must be also_known_as | role | same_as | unlinked, not a prose sentence.",
    "If the supplied segment explicitly states a full name, prefer that explicit surface name. Do not expand a short name from outside the supplied segment.",
    "Do not silently merge identities. Do not invent canonical entity IDs. Do not emit entity_id.",
    "",
    "LOCATION / PRESENCE — emit location_presence when location matters to continuity.",
    "Fields: entity, location, presence (present | arriving | departing | absent), time, event_context.",
    "location_presence requires an explicit location. Do not emit this kind when the place is only implied.",
    "Do not rely only on a timestamp locator when character presence itself is a continuity fact.",
    "Must support quay vs warehouse door, cabin vs chart table.",
    "Different locations at different times are not automatically conflicts.",
    "",
    "OBJECT / EQUIPMENT — track unique or recurring objects when text supports stable identity.",
    "Fields: object, object_identity, action_or_state, quantity, location, time.",
    "If the same unique object later changes state or location, emit a second object_equipment observation.",
    "Do not collapse generic objects. Do not treat all boats/weapons/vehicles as the same object.",
    "Do not rely on an event row alone when object continuity information is explicit.",
    "",
    "OPERATIONAL CAPABILITY — explicit capability/state. Emit even when a statement or event is also present.",
    "Fields: entity/team/platform, capability_type, state, quantity, time_scope, location_or_operation, source.",
    "States: available | unavailable | unknown | used.",
    "A spoken claim that a capability is unavailable is both a statement AND an operational_capability row.",
    "When an event demonstrates that a capability was actually exercised, emit BOTH the event AND operational_capability with state=used when evidence supports both.",
    "Do not infer unused capabilities.",
    "",
    "KNOWLEDGE — character-grounded knowledge only.",
    "Fields: entity, topic, knowledge_state, perspective, acquisition_source, acquisition_event, acquisition_time, assertion/use_time.",
    "known: character explicitly uses, recognizes, or demonstrates the topic.",
    "unknown: character explicitly lacks the topic.",
    "learned: character receives an explanation, teaching, briefing, discovery, or other textually supported acquisition.",
    "inferred: character draws a conclusion that the text marks as inference.",
    "claimed: character asserts knowledge but the observation is only a claim.",
    "Narration mentioning information is NOT automatically character knowledge.",
    "Do not convert narration into dialogue. Do not create statement rows from narration.",
    "Explainer vs learner: when one character explicitly explains a topic to another, emit statement (speaker explains) AND knowledge (recipient, knowledge_state=learned) when both are supported.",
    "Do not assign learned to the explainer merely because the explainer knows the information.",
    "Do not assign learned to a bystander merely because the bystander is present.",
    "Use before acquisition: demonstrated use/recognition → known. Later explicit acquisition/explanation in this segment → learned. Emit both separately. Do not invent learned if acquisition is absent from the supplied segment.",
    "",
    "ALIVE / DEAD and RANK / ROLE:",
    "When the text explicitly establishes that a named person is alive or dead, emit the supporting statement and/or event. There is no separate alive_dead schema kind.",
    "When the text explicitly establishes rank or role, emit identity with identity_claim=role.",
    "",
    "ORGANIZATION / AFFILIATION — no new schema kind.",
    "If the supplied segment explicitly names an organization as a role or membership, emit identity with identity_claim=role.",
    "If it explicitly establishes affiliation, colleague, superior/subordinate, or works-for/works-with, emit relationship.",
    "Do not invent an organization observation kind. Do not invent an affiliation that is not explicit.",
    "",
    "STATEMENT — state-bearing dialogue or explicit claims only (capability, history, injury, identity, knowledge, alive/dead). Not every spoken line.",
    "Fields: speaker, proposition_topic, polarity, claim_value, target, time, context.",
    "",
    "EVENT — important narrative actions only when they add a distinct reasoning dimension not already carried by another observation.",
    "Fields: actor, action, object/target, location, time reference, result, participants, equipment/capability.",
    "Do not duplicate a statement as an event unless both are actually present.",
    "",
    "Multi-dimension rule:",
    "One passage may yield more than one observation ONLY when the observations serve different reasoning dimensions.",
    "Useful pairs: event + operational_capability; statement + injury; statement + knowledge; event + object_equipment; timestamp + travel_leg; timestamp + location_presence.",
    "Do not duplicate the same reasoning dimension.",
    "",
    "Redundancy rule:",
    "Useful distinct observations include different kind, OR same kind with a genuinely different entity, topic, polarity, time, object identity, body region, or state.",
    "Redundant: same kind, same subject, same topic/value, same polarity, same evidence span.",
    "Do not emit redundant restatements. StoryDNA deterministic dedupe remains authoritative.",
    "",
    "Evidence:",
    `locator, contiguous manuscript excerpt copied exactly (${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words max, 8 characters min), source_segment.`,
    "Quote the SHORTEST exact contiguous manuscript span that independently supports the observation.",
    "Copy wording exactly from the source.",
    "Prefer one sentence or the shortest exact clause. Use more words only when a shorter exact span does not independently support the typed fields.",
    "40 words is the maximum, not the target.",
    "Do not quote unrelated surrounding clauses when the short sentence already supports the observation.",
    "One observation normally cites one contiguous supporting span.",
    "If two distant passages support two states: emit two observations. Never concatenate distant passages into one excerpt.",
    "Excerpt must be an exact contiguous substring of the supplied segment. Do not stitch sentences across intervening prose. Do not paraphrase. Do not omit a middle phrase. No invented quotes.",
    "Structured observations may later be compared by StoryDNA.",
    "No evidence: the observation may exist for diagnostics but is not confirmation-grade.",
    "",
    "Synthetic examples — copy the pattern, not these names into unrelated books:",
    'CLOCK: "At 07:12 the ferry left." → timestamp 07:12. Evidence: that sentence only.',
    "SHORT EVIDENCE: do not quote the harbor-master clause when that ferry sentence already supports the clock.",
    'STATEMENT + STATE: Mara said, "The radio is dead." → statement (Mara claims radio unavailable) AND operational_capability (radio unavailable).',
    'KNOWLEDGE: Joss uses the blue cache token → knowledge Joss / blue cache token / known. Later Nia tells Joss, "Blue means the cache is live." → statement (Nia explains) AND knowledge (Joss / blue cache token / learned). A porter merely standing nearby receives NO knowledge observation.',
    'CAPABILITY EVENT: "The rover fired its only flare." → event (rover fired flare) AND operational_capability (flare capability used).',
    'UNIQUE OBJECT: "Pax pocketed the brass compass." later "Pax set the brass compass on the chart." → two object_equipment observations with separate short evidence spans. Do not merge the two passages into one quote.',
    'INJURY: "Mara wrapped her left wrist." → injury entity=Mara body_region=wrist laterality=left. Do not leave this as statement only.',
    'TRAVEL: "Joss took the dawn ferry from the quay to the outer island." → travel_leg traveler=Joss origin=quay destination=outer island mode=ferry. Do not leave this as timestamps only.',
    'IDENTITY: "Rook — the dock warden — signed the log." → identity surface_name=Rook identity_claim=role role=dock warden.',
    'RELATIONSHIP: "Nia is Pax\'s sister." → relationship subject=Nia counterparty=Pax relationship_type=sibling state=exists.',
    'PRESENCE: "Pax was already at the chart table." → location_presence entity=Pax location=chart table presence=present.',
    "",
    "Forbidden editorial output — do not emit:",
    ...FORBIDDEN_EDITORIAL.map((item) => `- ${item}`),
    "Extract evidence. Do not judge it.",
    "",
    "Rules:",
    "- Observe only the supplied segment.",
    "- Do not emit entity_id. Do not emit status accepted. Do not write canon, Series Bible, retcons, or dispositions.",
    "- Stay compact. No verbose explanations. No unnecessary restatement.",
    "- Return JSON only. No markdown. No commentary.",
  ].join("\n");
}

export function buildV3ObservationUserPrompt(args: {
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
    "If the typed payload is complete, omit nested proposition.",
    "Close JSON before truncation.",
    "",
    "SEGMENT TEXT:",
    args.segmentText,
  ].join("\n");
}

export function assertV3PromptCoversObservationKinds(): string[] {
  const prompt = buildV3ObservationSystemPrompt();
  return V3_REQUIRED_PROMPT_KINDS.filter((kind) => !prompt.includes(kind));
}

export function v3PromptForbidsEditorialOutput(): boolean {
  const prompt = buildV3ObservationSystemPrompt();
  return (
    prompt.includes("What are the continuity problems?") &&
    FORBIDDEN_EDITORIAL.every((item) => prompt.includes(item)) &&
    prompt.includes("The model observes. StoryDNA will reason later.") &&
    prompt.includes("Do not find contradictions") &&
    prompt.includes("Do not ask: What is inconsistent?")
  );
}

export function v3PromptRemovesClockFirstStarvation(): boolean {
  const prompt = buildV3ObservationSystemPrompt();
  return (
    !prompt.includes("TIER 1 — emit first") &&
    !prompt.includes("Emit Tier 1 before Tier 2") &&
    !prompt.includes("finish all Tier 1") &&
    prompt.includes("Do not emit all timestamps before other kinds") &&
    prompt.includes("Scan the entire supplied segment") &&
    prompt.includes("manuscript appearance order")
  );
}

export function assertHistoricalPromptsUnchangedByV3(): boolean {
  return (
    V3_EXTRACTION_PROMPT_VERSION === "archivist_v2_extraction_prompt@v3" &&
    V3_PROMPT_SCHEMA_VERSION === ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 &&
    V3_PROMPT_MAX_TOKENS === 6000
  );
}
