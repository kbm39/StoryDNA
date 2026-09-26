import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { V2_PHASE2_HELD_OUT_IDS } from "./phase-2/index.ts";
import {
  diagnoseV2ObservationPair,
  pairV2Observations,
  summarizeV2Comparisons,
} from "./comparison.ts";
import type {
  V2Observation,
  V2ObservationPayload,
  V2Proposition,
} from "./types.ts";

function obs(
  id: string,
  shaped: V2ObservationPayload,
  proposition: Partial<V2Proposition> & Pick<V2Proposition, "subject" | "predicate" | "object">,
  locator = "CHAPTER TWO",
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
      excerpt: `${proposition.subject} ${proposition.predicate} ${proposition.object}`,
      source_segment: "seg-test",
    },
    confidence: "high",
    inferred: false,
  };
}

describe("V2 observation comparison", () => {
  it("compares shared-event clocks and ignores unrelated timestamps", () => {
    const twoTen = obs(
      "ts-a",
      { kind: "timestamp", payload: { raw_expression: "02:10", clock_time: "02:10", attached_event_id: "raid" } },
      { subject: "Mara", predicate: "found_at", object: "02:10" },
    );
    const twoFourteen = obs(
      "ts-b",
      { kind: "timestamp", payload: { raw_expression: "2:14", clock_time: "02:14", attached_event_id: "raid" } },
      { subject: "note", predicate: "logged_at", object: "02:14" },
    );
    const later = obs(
      "ts-c",
      { kind: "timestamp", payload: { raw_expression: "05:17", clock_time: "05:17", attached_event_id: "other" } },
      { subject: "Mara", predicate: "arrives_at", object: "05:17" },
    );
    assert.equal(diagnoseV2ObservationPair(twoTen, twoFourteen).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(twoTen, twoFourteen).pairing_interface, "clock_vs_clock");
    assert.equal(diagnoseV2ObservationPair(twoTen, later).eligibility, "not_comparable");
  });

  it("pairs a statement against an incompatible event on the same topic", () => {
    const claim = obs(
      "st",
      {
        kind: "statement",
        payload: { speaker: "Joss", proposition_topic: "bridge intact", polarity: "true", target: "bridge" },
      },
      { subject: "Joss", predicate: "claims", object: "bridge intact", polarity: "true", source_kind: "dialogue" },
    );
    const event = obs(
      "ev",
      { kind: "event", payload: { actor: "convoy", action: "destroyed", object: "bridge" } },
      { subject: "convoy", predicate: "destroyed", object: "bridge", polarity: "false" },
    );
    const other = obs(
      "ev2",
      { kind: "event", payload: { actor: "convoy", action: "refueled", object: "truck" } },
      { subject: "convoy", predicate: "refueled", object: "truck" },
    );
    const conflict = diagnoseV2ObservationPair(claim, event);
    assert.equal(conflict.eligibility, "comparable");
    assert.equal(conflict.pairing_interface, "statement_vs_event");
    assert.equal(diagnoseV2ObservationPair(claim, other).eligibility, "not_comparable");
  });

  it("pairs knowledge use before acquisition of the same topic only", () => {
    const used = obs(
      "k-use",
      { kind: "knowledge", payload: { entity: "Mara", topic: "cipher key", knowledge_state: "known", perspective: "character" } },
      { subject: "Mara", predicate: "knows", object: "cipher key" },
      "CHAPTER TWO",
    );
    const learned = obs(
      "k-learn",
      { kind: "knowledge", payload: { entity: "Mara", topic: "cipher key", knowledge_state: "learned", perspective: "character" } },
      { subject: "Mara", predicate: "learned", object: "cipher key" },
      "CHAPTER FOUR",
    );
    const otherTopic = obs(
      "k-other",
      { kind: "knowledge", payload: { entity: "Mara", topic: "safe house", knowledge_state: "learned", perspective: "character" } },
      { subject: "Mara", predicate: "learned", object: "safe house" },
      "CHAPTER FOUR",
    );
    const unknownThenLearned = obs(
      "k-unknown",
      { kind: "knowledge", payload: { entity: "Mara", topic: "cipher key", knowledge_state: "unknown", perspective: "character" } },
      { subject: "Mara", predicate: "does_not_know", object: "cipher key" },
      "CHAPTER ONE",
    );
    assert.equal(diagnoseV2ObservationPair(used, learned).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(used, otherTopic).eligibility, "not_comparable");
    assert.equal(diagnoseV2ObservationPair(unknownThenLearned, learned).eligibility, "not_comparable");
  });

  it("compares travel legs only for the same route or same-time competing routes", () => {
    const first = obs(
      "tr-a",
      {
        kind: "travel_leg",
        payload: {
          traveler: "Mara",
          origin: "harbor",
          destination: "ridge",
          stated_duration: "two hours",
          departure_time_id: "t1",
        },
      },
      { subject: "Mara", predicate: "travels", object: "harbor to ridge" },
    );
    const competingDuration = obs(
      "tr-b",
      {
        kind: "travel_leg",
        payload: {
          traveler: "Mara",
          origin: "harbor",
          destination: "ridge",
          stated_duration: "twenty minutes",
          departure_time_id: "t1",
        },
      },
      { subject: "Mara", predicate: "travels", object: "harbor to ridge" },
    );
    const laterTrip = obs(
      "tr-c",
      {
        kind: "travel_leg",
        payload: { traveler: "Mara", origin: "ridge", destination: "coast", departure_time_id: "t9" },
      },
      { subject: "Mara", predicate: "travels", object: "ridge to coast" },
    );
    assert.equal(diagnoseV2ObservationPair(first, competingDuration).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(first, laterTrip).eligibility, "not_comparable");
  });

  it("compares injury laterality on the same region and refuses tattoo vs wound or unspecified side", () => {
    const leftShoulder = obs(
      "inj-l",
      {
        kind: "injury",
        payload: { entity: "Mara", body_region: "shoulder", laterality: "left", condition: "open wound" },
      },
      { subject: "Mara", predicate: "injured", object: "left shoulder" },
    );
    const rightShoulder = obs(
      "inj-r",
      {
        kind: "injury",
        payload: { entity: "Mara", body_region: "shoulder", laterality: "right", condition: "open wound" },
      },
      { subject: "Mara", predicate: "injured", object: "right shoulder" },
    );
    const eye = obs(
      "inj-eye",
      {
        kind: "injury",
        payload: { entity: "Mara", body_region: "eye", laterality: "left", condition: "split" },
      },
      { subject: "Mara", predicate: "injured", object: "left eye" },
    );
    const unspecified = obs(
      "inj-u",
      {
        kind: "injury",
        payload: { entity: "Mara", body_region: "shoulder", laterality: "unspecified", condition: "open wound" },
      },
      { subject: "Mara", predicate: "injured", object: "shoulder" },
    );
    const healed = obs(
      "inj-h",
      {
        kind: "injury",
        payload: { entity: "Mara", body_region: "shoulder", laterality: "left", condition: "healed" },
      },
      { subject: "Mara", predicate: "injured", object: "left shoulder healed" },
      "CHAPTER NINE",
    );
    assert.equal(diagnoseV2ObservationPair(leftShoulder, rightShoulder).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(leftShoulder, eye).eligibility, "not_comparable");
    assert.equal(diagnoseV2ObservationPair(leftShoulder, unspecified).eligibility, "insufficient_semantic_specificity");
    assert.equal(diagnoseV2ObservationPair(leftShoulder, healed).eligibility, "not_comparable");
  });

  it("compares the same relationship edge and ignores sister vs colleague", () => {
    const spouseExists = obs(
      "rel-a",
      {
        kind: "relationship",
        payload: { subject: "Mara", counterparty: "Dana", relationship_type: "spouse", state: "exists" },
      },
      { subject: "Mara", predicate: "married_to", object: "Dana" },
    );
    const spouseRestated = obs(
      "rel-b",
      {
        kind: "relationship",
        payload: { subject: "Mara", counterparty: "Dana", relationship_type: "spouse", state: "exists" },
      },
      { subject: "Mara", predicate: "spouse_of", object: "Dana" },
    );
    const spouseGone = obs(
      "rel-c",
      {
        kind: "relationship",
        payload: { subject: "Mara", counterparty: "Dana", relationship_type: "spouse", state: "does_not_exist" },
      },
      { subject: "Mara", predicate: "not_married_to", object: "Dana" },
    );
    const sibling = obs(
      "rel-d",
      {
        kind: "relationship",
        payload: { subject: "Mara", counterparty: "Pax", relationship_type: "sibling", state: "exists" },
      },
      { subject: "Mara", predicate: "sister_of", object: "Pax" },
    );
    const colleague = obs(
      "rel-e",
      {
        kind: "relationship",
        payload: { subject: "Mara", counterparty: "Joss", relationship_type: "colleague", state: "exists" },
      },
      { subject: "Mara", predicate: "works_with", object: "Joss" },
    );
    assert.equal(diagnoseV2ObservationPair(spouseExists, spouseRestated).eligibility, "equivalent");
    assert.equal(diagnoseV2ObservationPair(spouseExists, spouseGone).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(sibling, colleague).eligibility, "not_comparable");
  });

  it("does not silently merge identity names without an explicit claim", () => {
    const pax = obs(
      "id-a",
      { kind: "identity", payload: { surface_name: "Pax", identity_claim: "unlinked" } },
      { subject: "Pax", predicate: "named", object: "unlinked" },
    );
    const paxLane = obs(
      "id-b",
      { kind: "identity", payload: { surface_name: "Pax Lane", identity_claim: "also_known_as", alias: "Pax" } },
      { subject: "Pax Lane", predicate: "also_known_as", object: "Pax" },
    );
    const sameNameRole = obs(
      "id-c",
      { kind: "identity", payload: { surface_name: "Pax", identity_claim: "role", role: "courier" } },
      { subject: "Pax", predicate: "role", object: "courier" },
    );
    assert.equal(diagnoseV2ObservationPair(pax, paxLane).eligibility, "not_comparable");
    assert.equal(diagnoseV2ObservationPair(pax, sameNameRole).eligibility, "comparable");
  });

  it("compares presence only when time anchors match", () => {
    const harbor = obs(
      "loc-a",
      {
        kind: "location_presence",
        payload: { entity: "Mara", location: "harbor", presence: "present", time_reference_id: "night-1" },
      },
      { subject: "Mara", predicate: "present_at", object: "harbor" },
    );
    const ridge = obs(
      "loc-b",
      {
        kind: "location_presence",
        payload: { entity: "Mara", location: "ridge", presence: "present", time_reference_id: "night-1" },
      },
      { subject: "Mara", predicate: "present_at", object: "ridge" },
    );
    const later = obs(
      "loc-c",
      {
        kind: "location_presence",
        payload: { entity: "Mara", location: "coast", presence: "present", time_reference_id: "day-4" },
      },
      { subject: "Mara", predicate: "present_at", object: "coast" },
    );
    assert.equal(diagnoseV2ObservationPair(harbor, ridge).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(harbor, later).eligibility, "not_comparable");
  });

  it("compares stable object identity and refuses generic objects", () => {
    const compassHeld = obs(
      "obj-a",
      {
        kind: "object_equipment",
        payload: {
          entity: "Mara",
          object: "brass compass",
          object_identity: "compass-1",
          action_or_state: "held",
          time_reference_id: "dock",
        },
      },
      { subject: "Mara", predicate: "holds", object: "brass compass" },
    );
    const compassLost = obs(
      "obj-b",
      {
        kind: "object_equipment",
        payload: {
          entity: "Joss",
          object: "brass compass",
          object_identity: "compass-1",
          action_or_state: "lost",
          time_reference_id: "dock",
        },
      },
      { subject: "Joss", predicate: "lost", object: "brass compass" },
    );
    const genericBoat = obs(
      "obj-c",
      { kind: "object_equipment", payload: { entity: "Mara", object: "boat", action_or_state: "boarded" } },
      { subject: "Mara", predicate: "boards", object: "boat" },
    );
    const otherBoat = obs(
      "obj-d",
      { kind: "object_equipment", payload: { entity: "Joss", object: "boat", action_or_state: "sank" } },
      { subject: "Joss", predicate: "sank", object: "boat" },
    );
    assert.equal(diagnoseV2ObservationPair(compassHeld, compassLost).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(genericBoat, otherBoat).eligibility, "insufficient_semantic_specificity");
  });

  it("compares the same operational capability and ignores unrelated ones", () => {
    const radiosDown = obs(
      "cap-a",
      {
        kind: "operational_capability",
        payload: {
          entity: "unit 4",
          capability_type: "radio net",
          state: "unavailable",
          time_scope: "raid",
          source: "narration",
        },
      },
      { subject: "unit 4", predicate: "radio_net", object: "unavailable" },
    );
    const radiosUsed = obs(
      "cap-b",
      {
        kind: "operational_capability",
        payload: {
          entity: "unit 4",
          capability_type: "radio net",
          state: "used",
          time_scope: "raid",
          source: "event",
        },
      },
      { subject: "unit 4", predicate: "radio_net", object: "used" },
    );
    const boats = obs(
      "cap-c",
      {
        kind: "operational_capability",
        payload: {
          entity: "unit 4",
          capability_type: "boats",
          state: "used",
          time_scope: "raid",
          source: "event",
        },
      },
      { subject: "unit 4", predicate: "boats", object: "used" },
    );
    assert.equal(diagnoseV2ObservationPair(radiosDown, radiosUsed).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(radiosDown, boats).eligibility, "not_comparable");
  });

  it("treats alive then later dead as compatible and dead then later alive as comparable", () => {
    const aliveEarly = obs(
      "al-a",
      { kind: "event", payload: { actor: "Pax", action: "seen", object: "alive" } },
      { subject: "Pax", predicate: "seen", object: "alive" },
      "CHAPTER TWO",
    );
    const deadLater = obs(
      "al-b",
      { kind: "event", payload: { actor: "Pax", action: "reported", object: "dead" } },
      { subject: "Pax", predicate: "reported", object: "dead" },
      "CHAPTER NINE",
    );
    const deadEarly = obs(
      "al-c",
      { kind: "event", payload: { actor: "Pax", action: "reported", object: "dead" } },
      { subject: "Pax", predicate: "reported", object: "dead" },
      "CHAPTER TWO",
    );
    const aliveLater = obs(
      "al-d",
      { kind: "event", payload: { actor: "Pax", action: "seen", object: "alive" } },
      { subject: "Pax", predicate: "seen", object: "alive" },
      "CHAPTER NINE",
    );
    assert.equal(diagnoseV2ObservationPair(aliveEarly, deadLater).eligibility, "not_comparable");
    assert.equal(diagnoseV2ObservationPair(deadEarly, aliveLater).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(deadEarly, aliveLater).pairing_interface, "alive_dead");
  });

  it("treats a speaker's death claim as about the target, not the speaker", () => {
    const patterson = obs(
      "o17",
      {
        kind: "statement",
        payload: {
          speaker: "Ari",
          proposition_topic: "Patterson alive",
          polarity: "false",
          claim_value: "Patterson dead, shot in south lane",
          target: "Patterson",
        },
      },
      { subject: "Ari", predicate: "Patterson alive", object: "Patterson dead, shot in south lane", polarity: "false" },
    );
    const cyrus = obs(
      "o17",
      {
        kind: "statement",
        payload: {
          speaker: "Ari",
          proposition_topic: "Cyrus alive",
          polarity: "false",
          claim_value: "presumed dead, no body",
          target: "Cyrus",
        },
      },
      { subject: "Ari", predicate: "Cyrus alive", object: "presumed dead, no body", polarity: "false" },
      "CHAPTER TWENTY-SIX",
    );
    const result = diagnoseV2ObservationPair(patterson, cyrus);
    assert.equal(result.eligibility, "not_comparable");
    assert.equal(result.reason, "different_subject");
  });

  it("does not treat two death statements as alive_vs_dead because the topic says alive", () => {
    const kanaan = obs(
      "st-a",
      {
        kind: "statement",
        payload: {
          speaker: "Avi",
          proposition_topic: "Rashid Kanaan alive",
          polarity: "false",
          claim_value: "dead",
          target: "Rashid Kanaan",
        },
      },
      { subject: "Avi", predicate: "Rashid Kanaan alive", object: "dead", polarity: "false" },
    );
    const family = obs(
      "st-b",
      {
        kind: "statement",
        payload: {
          speaker: "Avi",
          proposition_topic: "Kanaan family alive",
          polarity: "false",
          claim_value: "killed the same night",
          target: "Kanaan family",
        },
      },
      { subject: "Avi", predicate: "Kanaan family alive", object: "killed the same night", polarity: "false" },
    );
    const result = diagnoseV2ObservationPair(kanaan, family);
    assert.equal(result.eligibility, "not_comparable");
    assert.notEqual(result.pairing_interface, "alive_dead");
  });

  it("does not treat rank and profession as the same identity dimension", () => {
    const profession = obs(
      "rk-a",
      { kind: "identity", payload: { surface_name: "Joss", identity_claim: "role", role: "Navy officer" } },
      { subject: "Joss", predicate: "role", object: "Navy officer" },
    );
    const teamLead = obs(
      "rk-b",
      { kind: "identity", payload: { surface_name: "Joss", identity_claim: "role", role: "team leader" } },
      { subject: "Joss", predicate: "role", object: "team leader" },
    );
    const result = diagnoseV2ObservationPair(profession, teamLead);
    assert.equal(result.eligibility, "not_comparable");
    assert.equal(result.pairing_interface, "rank_role");
  });

  it("compares events only when they impose competing sequence constraints", () => {
    const before = obs(
      "ch-a",
      {
        kind: "event",
        payload: { actor: "Mara", action: "arrives", object: "gate", time_reference_id: "raid", result: "before" },
      },
      { subject: "Mara", predicate: "arrives", object: "gate", temporal_scope: "before the raid" },
    );
    const after = obs(
      "ch-b",
      {
        kind: "event",
        payload: { actor: "Mara", action: "arrives", object: "gate", time_reference_id: "raid", result: "after" },
      },
      { subject: "Mara", predicate: "arrives", object: "gate", temporal_scope: "after the raid" },
    );
    assert.equal(diagnoseV2ObservationPair(before, after).eligibility, "comparable");
    assert.equal(diagnoseV2ObservationPair(before, after).pairing_interface, "chronology");
  });

  it("blocks confirmation when identity is ambiguous and does not silently merge aliases", () => {
    const left = obs(
      "amb-a",
      { kind: "knowledge", payload: { entity: "the captain", topic: "cipher key", knowledge_state: "known", perspective: "character" } },
      { subject: "the captain", predicate: "knows", object: "cipher key" },
      "CHAPTER TWO",
    );
    const right = obs(
      "amb-b",
      { kind: "knowledge", payload: { entity: "the captain", topic: "cipher key", knowledge_state: "learned", perspective: "character" } },
      { subject: "the captain", predicate: "learned", object: "cipher key" },
      "CHAPTER FOUR",
    );
    const result = diagnoseV2ObservationPair(left, right, { ambiguous_aliases: ["the captain"] });
    assert.equal(result.eligibility, "comparable");
    assert.equal(result.identity_status, "ambiguous");
    assert.equal(result.confirmation_blocked, true);
    const unlinked = diagnoseV2ObservationPair(
      obs(
        "n1",
        { kind: "knowledge", payload: { entity: "Pax", topic: "cipher key", knowledge_state: "known", perspective: "character" } },
        { subject: "Pax", predicate: "knows", object: "cipher key" },
      ),
      obs(
        "n2",
        { kind: "knowledge", payload: { entity: "Pax Lane", topic: "cipher key", knowledge_state: "learned", perspective: "character" } },
        { subject: "Pax Lane", predicate: "learned", object: "cipher key" },
      ),
    );
    assert.equal(unlinked.eligibility, "not_comparable");
  });

  it("is deterministic across repeated pairing", () => {
    const rows = [
      obs(
        "a",
        { kind: "timestamp", payload: { raw_expression: "02:10", clock_time: "02:10", attached_event_id: "raid" } },
        { subject: "Mara", predicate: "found_at", object: "02:10" },
      ),
      obs(
        "b",
        { kind: "timestamp", payload: { raw_expression: "2:14", clock_time: "02:14", attached_event_id: "raid" } },
        { subject: "note", predicate: "logged_at", object: "02:14" },
      ),
    ];
    const first = JSON.stringify(pairV2Observations(rows));
    const second = JSON.stringify(pairV2Observations(rows));
    assert.equal(first, second);
    const summary = summarizeV2Comparisons(pairV2Observations(rows));
    assert.equal(summary.comparable, 1);
    assert.equal(summary.comparable_by_interface.clock_vs_clock, 1);
  });

  it("keeps held-out Rule 8 IDs and answer keys out of pairing production code", () => {
    const production = readFileSync(fileURLToPath(new URL("./comparison.ts", import.meta.url)), "utf8");
    const tests = readFileSync(fileURLToPath(new URL("./comparison.test.ts", import.meta.url)), "utf8");
    for (const id of V2_PHASE2_HELD_OUT_IDS) {
      assert.equal(production.includes(id), false, id);
      assert.equal(tests.includes(id), false, id);
    }
    assert.equal(/R8-\d{3}/.test(production), false);
    assert.equal(/hold fast/i.test(production), false);
  });
});
