/**
 * Generic $0 rehearsal fixtures for the isolated Opus V2 eval runner.
 * Novel-agnostic names only. No Rule 8 answers. No held-out prose.
 */

import { RECKONING_REVISED_13_SOURCE_PIN } from "../../../reckoning-revised-13-source-pin.ts";
import { RECKONING_REVISED_13_SEGMENT_PLAN } from "../../reckoning-revised-13-segment-plan.ts";
import type { ArchivistSegmentObservationV2, V2Observation, V2ObservationPayload, V2Proposition } from "../types.ts";
import { emptySegmentObservationV2 } from "../validate.ts";
import { OPUS_V2_EVAL_SOURCE_PIN } from "./lock.ts";

const PIN = RECKONING_REVISED_13_SOURCE_PIN;

function obs(
  id: string,
  shaped: V2ObservationPayload,
  proposition: Partial<V2Proposition> & Pick<V2Proposition, "subject" | "predicate" | "object">,
  locator: string,
  segmentId: string,
  extras?: Partial<V2Observation["evidence"]>,
): V2Observation {
  return {
    id,
    ...shaped,
    proposition: {
      polarity: "true",
      source_kind: "narration",
      ...proposition,
    },
    evidence: {
      locator,
      excerpt: `${proposition.subject} ${proposition.predicate} ${proposition.object}`.slice(0, 80),
      source_segment: segmentId,
      manuscript_id: PIN.manuscript_id,
      manuscript_version_id: PIN.manuscript_version_id,
      content_hash: PIN.content_hash,
      evidence_status: "verified",
      ...extras,
    },
    confidence: "high",
    inferred: false,
  };
}

export const OPUS_V2_EVAL_SEGMENT_IDS = RECKONING_REVISED_13_SEGMENT_PLAN.segments.map(
  (row) => row.segment_id,
);

function document(
  segmentId: string,
  observations: V2Observation[],
  ambiguities: ArchivistSegmentObservationV2["entity_ambiguities"] = [],
): ArchivistSegmentObservationV2 {
  const base = emptySegmentObservationV2(segmentId);
  return {
    ...base,
    manuscript_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_id,
    manuscript_version_id: OPUS_V2_EVAL_SOURCE_PIN.manuscript_version_id,
    content_hash: OPUS_V2_EVAL_SOURCE_PIN.content_hash,
    observations,
    entity_ambiguities: ambiguities,
    entities: [...new Set(observations.map((row) => row.proposition.subject))].map((alias) => ({
      alias,
      entity_type: "person",
      local_mentions: [alias],
    })),
  };
}

export function rehearsalObservationsForSegment(segmentId: string): ArchivistSegmentObservationV2 {
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14] = OPUS_V2_EVAL_SEGMENT_IDS;
  if (segmentId === s1) {
    return document(segmentId, [
      obs(
        "clock-a",
        { kind: "timestamp", payload: { raw_expression: "02:10", clock_time: "02:10", attached_event_id: "raid" } },
        { subject: "Mara", predicate: "found_at", object: "02:10" },
        "CHAPTER TWO",
        segmentId,
      ),
      obs(
        "clock-b",
        { kind: "timestamp", payload: { raw_expression: "2:14", clock_time: "02:14", attached_event_id: "raid" } },
        { subject: "note", predicate: "logged_at", object: "02:14" },
        "CHAPTER TWO",
        segmentId,
      ),
      obs(
        "st-bridge",
        {
          kind: "statement",
          payload: { speaker: "Joss", proposition_topic: "bridge intact", polarity: "true", target: "bridge" },
        },
        { subject: "Joss", predicate: "claims", object: "bridge intact", polarity: "true", source_kind: "dialogue" },
        "CHAPTER TWO",
        segmentId,
      ),
      obs(
        "ev-bridge",
        { kind: "event", payload: { actor: "convoy", action: "destroyed", object: "bridge" } },
        { subject: "convoy", predicate: "destroyed", object: "bridge", polarity: "false" },
        "CHAPTER TWO",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s2) {
    return document(segmentId, [
      obs(
        "k-use",
        { kind: "knowledge", payload: { entity: "Mara", topic: "cipher key", knowledge_state: "known", perspective: "character" } },
        { subject: "Mara", predicate: "knows", object: "cipher key" },
        "CHAPTER TWO",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s3) {
    return document(segmentId, [
      obs(
        "k-learn",
        { kind: "knowledge", payload: { entity: "Mara", topic: "cipher key", knowledge_state: "learned", perspective: "character" } },
        { subject: "Mara", predicate: "learned", object: "cipher key" },
        "CHAPTER FOUR",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s4) {
    return document(segmentId, [
      obs(
        "inj-l",
        { kind: "injury", payload: { entity: "Mara", body_region: "shoulder", laterality: "left", condition: "open wound" } },
        { subject: "Mara", predicate: "injured", object: "left shoulder" },
        "CHAPTER FIVE",
        segmentId,
      ),
      obs(
        "inj-r",
        { kind: "injury", payload: { entity: "Mara", body_region: "shoulder", laterality: "right", condition: "open wound" } },
        { subject: "Mara", predicate: "injured", object: "right shoulder" },
        "CHAPTER FIVE",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s5) {
    return document(segmentId, [
      obs(
        "rel-spouse-a",
        { kind: "relationship", payload: { subject: "Mara", counterparty: "Dana", relationship_type: "spouse", state: "exists" } },
        { subject: "Mara", predicate: "married_to", object: "Dana" },
        "CHAPTER SEVEN",
        segmentId,
      ),
      obs(
        "rel-spouse-b",
        { kind: "relationship", payload: { subject: "Mara", counterparty: "Dana", relationship_type: "spouse", state: "exists" } },
        { subject: "Mara", predicate: "spouse_of", object: "Dana" },
        "CHAPTER EIGHT",
        segmentId,
      ),
      obs(
        "rel-sib",
        { kind: "relationship", payload: { subject: "Mara", counterparty: "Pax", relationship_type: "sibling", state: "exists" } },
        { subject: "Mara", predicate: "sister_of", object: "Pax" },
        "CHAPTER EIGHT",
        segmentId,
      ),
      obs(
        "rel-col",
        { kind: "relationship", payload: { subject: "Mara", counterparty: "Joss", relationship_type: "colleague", state: "exists" } },
        { subject: "Mara", predicate: "works_with", object: "Joss" },
        "CHAPTER EIGHT",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s6) {
    return document(segmentId, [
      obs(
        "loc-a",
        { kind: "location_presence", payload: { entity: "Mara", location: "harbor", presence: "present", time_reference_id: "night-1" } },
        { subject: "Mara", predicate: "present_at", object: "harbor" },
        "CHAPTER NINE",
        segmentId,
      ),
      obs(
        "loc-b",
        { kind: "location_presence", payload: { entity: "Mara", location: "coast", presence: "present", time_reference_id: "day-4" } },
        { subject: "Mara", predicate: "present_at", object: "coast" },
        "CHAPTER ELEVEN",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s7) {
    return document(segmentId, [
      obs(
        "obj-a",
        {
          kind: "object_equipment",
          payload: { entity: "Mara", object: "brass compass", object_identity: "compass-1", action_or_state: "held", time_reference_id: "dock" },
        },
        { subject: "Mara", predicate: "holds", object: "brass compass" },
        "CHAPTER TWELVE",
        segmentId,
      ),
      obs(
        "obj-b",
        {
          kind: "object_equipment",
          payload: { entity: "Joss", object: "brass compass", object_identity: "compass-1", action_or_state: "lost", time_reference_id: "dock" },
        },
        { subject: "Joss", predicate: "lost", object: "brass compass" },
        "CHAPTER TWELVE",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s8) {
    return document(segmentId, [
      obs(
        "cap-down",
        {
          kind: "operational_capability",
          payload: { entity: "unit 4", capability_type: "radio net", state: "unavailable", time_scope: "raid", source: "narration" },
        },
        { subject: "unit 4", predicate: "radio_net", object: "unavailable" },
        "CHAPTER FOURTEEN",
        segmentId,
      ),
      obs(
        "cap-used",
        {
          kind: "operational_capability",
          payload: { entity: "unit 4", capability_type: "radio net", state: "used", time_scope: "raid", source: "event" },
        },
        { subject: "unit 4", predicate: "radio_net", object: "used" },
        "CHAPTER FOURTEEN",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s9) {
    return document(segmentId, [
      obs(
        "dead-early",
        { kind: "event", payload: { actor: "Pax", action: "reported", object: "dead" } },
        { subject: "Pax", predicate: "reported", object: "dead" },
        "CHAPTER TWO",
        segmentId,
      ),
      obs(
        "alive-later",
        { kind: "event", payload: { actor: "Pax", action: "seen", object: "alive" } },
        { subject: "Pax", predicate: "seen", object: "alive" },
        "CHAPTER NINE",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s10) {
    return document(segmentId, [
      obs(
        "role-navy",
        { kind: "identity", payload: { surface_name: "Joss", identity_claim: "role", role: "Navy officer" } },
        { subject: "Joss", predicate: "role", object: "Navy officer" },
        "CHAPTER SEVENTEEN",
        segmentId,
      ),
      obs(
        "role-lead",
        { kind: "identity", payload: { surface_name: "Joss", identity_claim: "role", role: "team leader" } },
        { subject: "Joss", predicate: "role", object: "team leader" },
        "CHAPTER SEVENTEEN",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s11) {
    return document(segmentId, [
      obs(
        "seq-before",
        {
          kind: "event",
          payload: { actor: "Mara", action: "arrives", object: "gate", time_reference_id: "raid", result: "before" },
        },
        { subject: "Mara", predicate: "arrives", object: "gate", temporal_scope: "before the raid" },
        "CHAPTER TWENTY",
        segmentId,
      ),
      obs(
        "seq-after",
        {
          kind: "event",
          payload: { actor: "Mara", action: "arrives", object: "gate", time_reference_id: "raid", result: "after" },
        },
        { subject: "Mara", predicate: "arrives", object: "gate", temporal_scope: "after the raid" },
        "CHAPTER TWENTY",
        segmentId,
      ),
    ]);
  }
  if (segmentId === s12) {
    return document(
      segmentId,
      [
        obs(
          "amb-use",
          { kind: "knowledge", payload: { entity: "the captain", topic: "cipher key", knowledge_state: "known", perspective: "character" } },
          { subject: "the captain", predicate: "knows", object: "cipher key" },
          "CHAPTER TWENTY-TWO",
          segmentId,
        ),
        obs(
          "amb-learn",
          { kind: "knowledge", payload: { entity: "the captain", topic: "cipher key", knowledge_state: "learned", perspective: "character" } },
          { subject: "the captain", predicate: "learned", object: "cipher key" },
          "CHAPTER TWENTY-FOUR",
          segmentId,
        ),
      ],
      [{ alias: "the captain", reason: "surface title is ambiguous" }],
    );
  }
  if (segmentId === s13) {
    return document(segmentId, [
      obs(
        "unverified-a",
        { kind: "timestamp", payload: { raw_expression: "04:00", clock_time: "04:00", attached_event_id: "watch" } },
        { subject: "Mara", predicate: "checked_at", object: "04:00" },
        "CHAPTER TWENTY-FIVE",
        segmentId,
        { evidence_status: "unverified" },
      ),
      obs(
        "unverified-b",
        { kind: "timestamp", payload: { raw_expression: "04:20", clock_time: "04:20", attached_event_id: "watch" } },
        { subject: "Mara", predicate: "checked_at", object: "04:20" },
        "CHAPTER TWENTY-FIVE",
        segmentId,
        { evidence_status: "unverified" },
      ),
    ]);
  }
  if (segmentId === s14) {
    return document(segmentId, [
      obs(
        "tattoo-a",
        {
          kind: "object_equipment",
          payload: { entity: "Mara", object: "anchor tattoo", object_identity: "tattoo-wrist", action_or_state: "visible", time_reference_id: "later" },
        },
        { subject: "Mara", predicate: "has", object: "anchor tattoo" },
        "CHAPTER TWENTY-NINE",
        segmentId,
      ),
      obs(
        "tattoo-b",
        {
          kind: "object_equipment",
          payload: { entity: "Mara", object: "anchor tattoo", object_identity: "tattoo-wrist", action_or_state: "visible", time_reference_id: "later" },
        },
        { subject: "Mara", predicate: "bears", object: "anchor tattoo" },
        "CHAPTER TWENTY-NINE",
        segmentId,
      ),
    ]);
  }
  return document(segmentId, []);
}
