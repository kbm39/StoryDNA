/**
 * Segment observation / repair / reconciliation prompts for the paid pilot.
 * Segment text only. No full-manuscript resend. No accepted-canon language.
 */

import type { PlannedSegment, ReconciliationBatch } from "./types.ts";

export function segmentObservationSystemPrompt(): string {
  return [
    "You are StoryDNA Archivist observing ONE manuscript segment.",
    "Return a single JSON object only. No markdown. No commentary.",
    'schema must be "archivist_segment_observation@v1".',
    "Rules:",
    "- Observe only the supplied segment text.",
    "- Do not invent quotes. Every excerpt must be a contiguous substring of the segment.",
    "- Do not emit entity_id.",
    '- Do not emit status "accepted". Do not write canon, Series Bible, retcons, or dispositions.',
    "- entity_type: person | place | object | vehicle | weapon | event | organization | other",
    "- fact_type: age | appearance | injury | alive_status | rank_title | relationship | location | possession | knowledge_state | chronology | travel | presence | other",
    "- Prefer high-signal continuity facts only: appearance, injury laterality, knowledge_state, unique objects, relationships, location, rank_title, alive_status, chronology.",
    "- HARD CAPS: at most 12 entities that carry a fact, at most 6 facts in any one array, at most 24 facts total.",
    "- Every fact MUST include excerpt (contiguous substring, <=20 words) and locator: {locator, chapter}.",
    "- evidence_references items MUST include excerpt and locator, not prose descriptions.",
    "- aliases=[] unless a second observed name is actually present. Do not invent nicknames.",
    "- entities[].alias is the observed surface name, not a nickname list.",
    "- Do not nest facts under entities. Do not emit entities[].facts.",
    "- Do not emit editorial concerns or final-review prose. Observation only.",
    'Example top-level fact: {"id":"f1","alias":"Cole","entity_type":"person","fact_type":"appearance","value":{"mark":"observed"},"excerpt":"contiguous substring","locator":{"locator":"CHAPTER THREE","chapter":"CHAPTER THREE"},"confidence":"high","inferred":false}',
    "- Empty fact arrays are allowed. Do not pad entities to a quota.",
    "- Fact ids must be unique strings.",
    "- confidence: high | medium | low",
    "- inferred must be boolean.",
    "- temporal_scope.kind: at | from | until | during | unknown",
    "- candidate_facts is the priority payload. Emit every supported observation there first.",
    "- Emit keys in this order: schema, segment_id, entities, aliases, candidate_facts, entity_ambiguities, then remaining arrays.",
    "- Remaining arrays (events, state_transitions, relationships, injuries, appearance, age, rank_title, alive_status, knowledge, locations, chronology, possessions, unique_objects, weapons_equipment, vehicles, organizations, local_continuity_concerns, evidence_references) must be [] unless they add a NEW observation not already in candidate_facts.",
    "- Do not restate a candidate_fact in events, relationships, or injuries. StoryDNA fills omitted unused arrays.",
    "- No editorial prose. Stop once all supported observations are represented. Stay within 4000 output tokens.",
  ].join("\n");
}

export function segmentObservationUserPrompt(args: {
  segment: PlannedSegment;
  segmentText: string;
}): string {
  const units = args.segment.assignments
    .map((item) => `${item.role}:${item.heading}[${item.start_offset}:${item.end_offset}]`)
    .join(", ");
  return [
    `segment_id: ${args.segment.segment_id}`,
    `ordinal: ${args.segment.ordinal}`,
    `char_range: ${args.segment.start_offset}-${args.segment.end_offset}`,
    `units: ${units}`,
    "Return compact observational JSON only. Emit entities, then candidate_facts, then entity_ambiguities. Leave unused auxiliary arrays empty. Do not duplicate facts. No entity_id. Facts need excerpt+locator. aliases=[] if none observed. Stop within 4000 output tokens.",
    "",
    "SEGMENT TEXT:",
    args.segmentText,
  ].join("\n");
}

export function segmentRepairUserPrompt(args: {
  segmentId: string;
  errors: readonly string[];
  previousJson: string;
}): string {
  return [
    `Repair the JSON so it validates as archivist_segment_observation@v1 for segment_id ${args.segmentId}.`,
    "Keep the same facts. Do not invent new quotes. Do not add entity_id. Do not set status accepted.",
    `Validation errors: ${args.errors.join("; ")}`,
    "Return corrected JSON only.",
    "",
    args.previousJson,
  ].join("\n");
}

export function reconciliationSystemPrompt(): string {
  return [
    "You are StoryDNA Archivist classifying already-paired continuity conflicts.",
    "Return a single JSON object only. No markdown.",
    "Use only the supplied pair excerpts. Do not invent quotes. Do not resend or request the manuscript.",
    'Classifications: "confirmed_contradiction" | "possible_continuity_conflict" | "author_verification_needed".',
    "One-sided or temporally compatible evidence cannot confirm.",
    'Shape: {"decisions":[{"pair_id":"","classification":"","explanation":""}]}',
  ].join("\n");
}

export function reconciliationUserPrompt(batch: ReconciliationBatch): string {
  return [
    `batch_id: ${batch.batch_id}`,
    "Classify each pair.",
    JSON.stringify(
      batch.items.map((item) => ({
        pair_id: item.pair_id,
        alias: item.entity_identity.alias,
        kind: item.comparison.kind,
        fact_type: item.comparison.fact_type,
        temporal_relationship: item.temporal_relationship,
        left_value: item.comparison.left_value,
        right_value: item.comparison.right_value,
        excerpts: item.excerpts,
      })),
      null,
      2,
    ),
  ].join("\n");
}
