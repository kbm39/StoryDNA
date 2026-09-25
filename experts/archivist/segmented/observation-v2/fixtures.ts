import { RECKONING_REVISED_13_SOURCE_PIN } from "@/experts/archivist/reckoning-revised-13-source-pin.ts";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "./constants.ts";
import type {
  ArchivistSegmentObservationV2,
  V2Evidence,
  V2Observation,
  V2ObservationPayload,
  V2Proposition,
} from "./types.ts";

const PIN = RECKONING_REVISED_13_SOURCE_PIN;

function caseEvidence(benchmarkId: string, side: "side_a" | "side_b"): V2Evidence {
  const row = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === benchmarkId);
  if (!row) throw new Error(`missing benchmark ${benchmarkId}`);
  const evidence = row[side];
  return {
    locator: evidence.locator,
    excerpt: evidence.excerpt,
    source_segment: `seg-fixture-${evidence.locator.replace(/\s+/g, "-")}`,
    manuscript_id: PIN.manuscript_id,
    manuscript_version_id: PIN.manuscript_version_id,
    content_hash: PIN.content_hash,
  };
}

function obs(
  id: string,
  shaped: V2ObservationPayload,
  proposition: V2Proposition,
  evidence: V2Evidence,
): V2Observation {
  return {
    id,
    ...shaped,
    proposition,
    evidence,
    confidence: "high",
    inferred: false,
  };
}

export const RULE8_V2_FIXTURE_OBSERVATIONS: V2Observation[] = [
  obs("r8-001-ts-0210", { kind: "timestamp", payload: { raw_expression: "0210", clock_time: "02:10", attached_event_id: "r8-001-ev-found" } }, { subject: "Lior Benzvi", predicate: "found_at", object: "02:10", polarity: "true", source_kind: "narration" }, caseEvidence("R8-001", "side_a")),
  obs("r8-001-ev-found", { kind: "event", payload: { actor: "duty officer", action: "found_hanged", object: "Lior Benzvi", location: "Cell 7", time_reference_id: "r8-001-ts-0210", result: "discovered" } }, { subject: "Lior Benzvi", predicate: "found_hanged", object: "Cell 7", polarity: "true", source_kind: "event" }, caseEvidence("R8-001", "side_a")),
  obs("r8-001-ts-214", { kind: "timestamp", payload: { raw_expression: "2:14 in the morning", clock_time: "02:14", attached_event_id: "r8-001-ev-logged" } }, { subject: "scrap of paper", predicate: "logged_at", object: "02:14", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-001", "side_b")),
  obs("r8-001-ts-231", { kind: "timestamp", payload: { raw_expression: "2:31", clock_time: "02:31", attached_event_id: "r8-001-ev-opened" } }, { subject: "Meridian account", predicate: "opened_file_at", object: "02:31", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-001", "side_b")),
  obs("r8-001-ev-logged", { kind: "event", payload: { actor: "Avi's man", action: "logged", object: "scrap of paper", time_reference_id: "r8-001-ts-214", result: "in case file" } }, { subject: "scrap of paper", predicate: "logged", object: "case file", polarity: "true", source_kind: "event" }, caseEvidence("R8-001", "side_b")),

  obs("r8-004-st-morning", { kind: "statement", payload: { speaker: "Avi", proposition_topic: "dalia_talking_since", polarity: "true", claim_value: "this morning", target: "Dalia" } }, { subject: "Dalia", predicate: "talking_since", object: "this morning", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-004", "side_a")),
  obs("r8-004-ts-morning", { kind: "timestamp", payload: { raw_expression: "Since this morning", day_reference: "this morning" } }, { subject: "Dalia", predicate: "time_scope", object: "this morning", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-004", "side_a")),
  obs("r8-004-ev-holding", { kind: "event", payload: { actor: "Avi", action: "placed_in_holding", object: "Dalia", location: "holding room four", result: "debrief protocol" } }, { subject: "Dalia", predicate: "placed_in_holding", object: "holding room four", polarity: "true", source_kind: "event" }, caseEvidence("R8-004", "side_b")),
  obs("r8-004-loc-holding", { kind: "location_presence", payload: { entity: "Dalia", location: "holding room four", presence: "present", event_context: "debrief before compound" } }, { subject: "Dalia", predicate: "present_at", object: "holding room four", polarity: "true", source_kind: "narration" }, caseEvidence("R8-004", "side_b")),

  obs("r8-005-st-avi-told", { kind: "statement", payload: { speaker: "Avi", proposition_topic: "warrant_undo_told_to_ari", polarity: "true", claim_value: "walked into a station", target: "Ari" } }, { subject: "Avi", predicate: "told", object: "warrant undo", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-005", "side_a")),
  obs("r8-005-st-kessler", { kind: "statement", payload: { speaker: "Kessler", proposition_topic: "warrant_undo_told_to_ari", polarity: "false", claim_value: "Avi did not tell you", target: "Ari" } }, { subject: "Avi", predicate: "told", object: "warrant undo", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-005", "side_b")),
  obs("r8-005-kn-ari", { kind: "knowledge", payload: { entity: "Ari", topic: "warrant_undo_told_to_ari", knowledge_state: "known", perspective: "character", acquisition_source: "Avi" } }, { subject: "Ari", predicate: "knows", object: "warrant undo", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-005", "side_a")),

  obs("r8-006-st-capital", { kind: "statement", payload: { speaker: "Kaan", proposition_topic: "istanbul_is_capital", polarity: "true", claim_value: "my capital", target: "Istanbul" } }, { subject: "Istanbul", predicate: "is_capital", object: "Turkey", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-006", "side_a")),
  obs("r8-006-loc-sultanahmet", { kind: "location_presence", payload: { entity: "rooftop fight", location: "Sultanahmet Rooftop, Istanbul", presence: "present", event_context: "0447 Hours" } }, { subject: "rooftop fight", predicate: "located_in", object: "Istanbul", polarity: "true", source_kind: "narration" }, caseEvidence("R8-006", "side_b")),

  obs("r8-007-obj-launch", { kind: "object_equipment", payload: { entity: "Cyrus", object: "launch", object_identity: "perespolis_exfil_boat", action_or_state: "escaped_into" } }, { subject: "Cyrus", predicate: "escaped_into", object: "launch", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-007", "side_a")),
  obs("r8-007-obj-zodiac", { kind: "object_equipment", payload: { entity: "Cyrus", object: "Zodiac", object_identity: "perespolis_exfil_boat", action_or_state: "staged_exfil" } }, { subject: "Cyrus", predicate: "escaped_into", object: "Zodiac", polarity: "true", source_kind: "narration" }, caseEvidence("R8-007", "side_b")),

  obs("r8-010-st-air", { kind: "statement", payload: { speaker: "Ari", proposition_topic: "air_cover", polarity: "false", claim_value: "unavailable" } }, { subject: "operation", predicate: "air_cover", object: "unavailable", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-010", "side_a")),
  obs("r8-010-st-strike", { kind: "statement", payload: { speaker: "Ari", proposition_topic: "strike_package", polarity: "false", claim_value: "unavailable" } }, { subject: "operation", predicate: "strike_package", object: "unavailable", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-010", "side_a")),
  obs("r8-010-cap-air", { kind: "operational_capability", payload: { entity: "compound team", capability_type: "air_cover", state: "unavailable", source: "statement", location_or_operation: "Bekaa compound" } }, { subject: "operation", predicate: "air_cover", object: "unavailable", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-010", "side_a")),
  obs("r8-010-ev-missiles", { kind: "event", payload: { actor: "Hank", action: "missile_launch", object: "lead vehicle", result: "destroyed", equipment: "missiles", participants: ["Hector"] } }, { subject: "Hank", predicate: "missile_launch", object: "lead vehicle", polarity: "true", source_kind: "event" }, caseEvidence("R8-010", "side_b")),
  obs("r8-010-cap-used", { kind: "operational_capability", payload: { entity: "Hank", capability_type: "air_cover", state: "used", quantity: "2", source: "event", location_or_operation: "Bekaa compound" } }, { subject: "operation", predicate: "air_cover", object: "used", polarity: "true", source_kind: "event" }, caseEvidence("R8-010", "side_b")),

  obs("r8-011-kn-use", { kind: "knowledge", payload: { entity: "Cole", topic: "numi_numi", knowledge_state: "known", perspective: "character", assertion_time_id: "r8-011-use" } }, { subject: "Cole", predicate: "uses_name", object: "numi numi", polarity: "true", source_kind: "narration" }, caseEvidence("R8-011", "side_a")),
  obs("r8-011-kn-learn", { kind: "knowledge", payload: { entity: "Cole", topic: "numi_numi", knowledge_state: "learned", perspective: "character", acquisition_source: "Ari" } }, { subject: "Cole", predicate: "learns_name", object: "numi numi", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-011", "side_b")),

  obs("r8-012-rel-daughter", { kind: "relationship", payload: { subject: "Lior Benzvi", counterparty: "daughter", relationship_type: "parent", state: "exists" } }, { subject: "Lior Benzvi", predicate: "has_daughter", object: "daughter", polarity: "true", source_kind: "narration" }, caseEvidence("R8-012", "side_a")),
  obs("r8-012-rel-unborn", { kind: "relationship", payload: { subject: "Lior Benzvi", counterparty: "unborn child", relationship_type: "parent", state: "exists", time_scope: "wife pregnant" } }, { subject: "Lior Benzvi", predicate: "has_unborn_child", object: "the child", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-012", "side_b")),
  obs("r8-012-st-child", { kind: "statement", payload: { speaker: "Ari", proposition_topic: "has_daughter", polarity: "true", claim_value: "tell the child", target: "Lior's wife" } }, { subject: "Lior Benzvi", predicate: "has_daughter", object: "the child", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-012", "side_b")),

  obs("r8-013-ev-brief", { kind: "event", payload: { actor: "Viper", action: "briefed", object: "unauthorized SEAL extraction", participants: ["Mitchell"], result: "Mitchell informed" } }, { subject: "Mitchell", predicate: "informed_unauthorized_flight", object: "true", polarity: "true", source_kind: "event" }, caseEvidence("R8-013", "side_a")),
  obs("r8-013-st-not-told", { kind: "statement", payload: { speaker: "Mitchell", proposition_topic: "informed_unauthorized_flight", polarity: "false", claim_value: "delivered after the fact" } }, { subject: "Mitchell", predicate: "informed_unauthorized_flight", object: "false", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-013", "side_b")),
  obs("r8-013-kn-mitchell", { kind: "knowledge", payload: { entity: "Mitchell", topic: "informed_unauthorized_flight", knowledge_state: "unknown", perspective: "character" } }, { subject: "Mitchell", predicate: "knows", object: "unauthorized flight", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-013", "side_b")),

  obs("r8-014-st-earpiece", { kind: "statement", payload: { speaker: "Cyrus", proposition_topic: "heard_earpiece", polarity: "true", target: "Cole" } }, { subject: "Cyrus", predicate: "heard_earpiece", object: "Noa's voice", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-014", "side_a")),
  obs("r8-014-loc-stack", { kind: "location_presence", payload: { entity: "Noa", location: "container stack", presence: "present", event_context: "forty meters, second row" } }, { subject: "Noa", predicate: "present_at", object: "container stack", polarity: "true", source_kind: "narration" }, caseEvidence("R8-014", "side_b")),
  obs("r8-014-loc-cole", { kind: "location_presence", payload: { entity: "Cole", location: "container stack", presence: "present", event_context: "port fight" } }, { subject: "Cole", predicate: "present_at", object: "container stack", polarity: "true", source_kind: "narration" }, caseEvidence("R8-014", "side_b")),

  obs("r8-015-st-kj", { kind: "statement", payload: { speaker: "Preacher", proposition_topic: "bible_book", polarity: "true", claim_value: "King James" } }, { subject: "Preacher", predicate: "named_book", object: "King James", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-015", "side_b")),
  obs("r8-015-st-ruth", { kind: "statement", payload: { speaker: "Galit", proposition_topic: "bible_book", polarity: "true", claim_value: "Ruth" } }, { subject: "Galit", predicate: "named_book", object: "Ruth", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-015", "side_a")),
  obs("r8-015-kn-galit", { kind: "knowledge", payload: { entity: "Galit", topic: "preacher_book_is_ruth", knowledge_state: "known", perspective: "character" } }, { subject: "Galit", predicate: "knows", object: "Ruth", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-015", "side_a")),

  obs("r8-016-st-galit", { kind: "statement", payload: { speaker: "Galit", proposition_topic: "mossad_vetted_cyrus", polarity: "true", claim_value: "ran that vetting program" } }, { subject: "Galit", predicate: "vetted", object: "Cyrus", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-016", "side_a")),
  obs("r8-016-st-avi", { kind: "statement", payload: { speaker: "Avi", proposition_topic: "mossad_vetted_cyrus", polarity: "false", claim_value: "vendor vets its own people" } }, { subject: "Mossad", predicate: "vetted", object: "Cyrus", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-016", "side_b")),

  obs("r8-018-st-dock", { kind: "statement", payload: { speaker: "Hector", proposition_topic: "pickup_location", polarity: "true", claim_value: "dock", target: "Cole and Noa" } }, { subject: "Cole and Noa", predicate: "picked_up_at", object: "dock", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-018", "side_a")),

  obs("r8-019-st-door", { kind: "statement", payload: { speaker: "Cole", proposition_topic: "dana_roof_position", polarity: "true", claim_value: "stood in the door", target: "Dana" } }, { subject: "Dana", predicate: "position", object: "door", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-019", "side_a")),
  obs("r8-019-loc-ac", { kind: "location_presence", payload: { entity: "Dana", location: "behind air conditioning unit", presence: "present", event_context: "Istanbul rooftop" } }, { subject: "Dana", predicate: "position", object: "air conditioning unit", polarity: "true", source_kind: "narration" }, caseEvidence("R8-019", "side_b")),

  obs("r8-020-inj-bruise", { kind: "injury", payload: { entity: "Preacher", injury_event_id: "rooftop_vest_hit", body_region: "ribs", laterality: "unspecified", diagnosis: "bruised", condition: "not_broken" } }, { subject: "Preacher", predicate: "ribs_broken", object: "false", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-020", "side_a")),
  obs("r8-020-st-bruise", { kind: "statement", payload: { speaker: "Preacher", proposition_topic: "ribs_broken", polarity: "false", claim_value: "Bruised, not broken" } }, { subject: "Preacher", predicate: "ribs_broken", object: "false", polarity: "false", source_kind: "dialogue" }, caseEvidence("R8-020", "side_a")),
  obs("r8-020-inj-cracked", { kind: "injury", payload: { entity: "Preacher", injury_event_id: "rooftop_vest_hit", body_region: "ribs", laterality: "unspecified", diagnosis: "cracked", condition: "cracked" } }, { subject: "Preacher", predicate: "ribs_broken", object: "cracked", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-020", "side_b")),

  obs("r8-021-st-tarmac", { kind: "statement", payload: { speaker: "Ghost", proposition_topic: "preacher_second_hit_location", polarity: "true", claim_value: "this tarmac" } }, { subject: "Preacher", predicate: "second_hit_location", object: "Tel Aviv tarmac", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-021", "side_a")),
  obs("r8-021-loc-izmir", { kind: "location_presence", payload: { entity: "Preacher", location: "Izmir", presence: "present", event_context: "forearm graze" } }, { subject: "Preacher", predicate: "second_hit_location", object: "Izmir", polarity: "true", source_kind: "narration" }, caseEvidence("R8-021", "side_b")),
  obs("r8-021-inj-graze", { kind: "injury", payload: { entity: "Preacher", injury_event_id: "izmir_graze", body_region: "forearm", laterality: "unspecified", injury_type: "graze" } }, { subject: "Preacher", predicate: "grazed_at", object: "Izmir", polarity: "true", source_kind: "narration" }, caseEvidence("R8-021", "side_b")),

  obs("r8-023-id-contractor", { kind: "identity", payload: { surface_name: "Meridian Systems contractor", identity_claim: "unlinked", role: "contractor" } }, { subject: "contractor", predicate: "identity", object: "unlinked", polarity: "true", source_kind: "narration" }, caseEvidence("R8-023", "side_a")),
  obs("r8-023-loc-office", { kind: "location_presence", payload: { entity: "Meridian Systems contractor", location: "Dalia's office corridor", presence: "present", event_context: "every few weeks" } }, { subject: "contractor", predicate: "present_at", object: "Dalia's corridor", polarity: "true", source_kind: "narration" }, caseEvidence("R8-023", "side_a")),
  obs("r8-023-id-ibrahim", { kind: "identity", payload: { surface_name: "Cyrus", identity_claim: "also_known_as", alias: "Ibrahim", role: "handler" } }, { subject: "Cyrus", predicate: "also_known_as", object: "Ibrahim", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-023", "side_b")),
  obs("r8-023-kn-dalia", { kind: "knowledge", payload: { entity: "Dalia", topic: "contractor_is_ibrahim", knowledge_state: "unknown", perspective: "character" } }, { subject: "Dalia", predicate: "recognizes", object: "Ibrahim", polarity: "false", source_kind: "narration" }, caseEvidence("R8-023", "side_a")),

  obs("r8-025-ts-0447", { kind: "timestamp", payload: { raw_expression: "0447 Hours", clock_time: "04:47" } }, { subject: "Istanbul rooftop", predicate: "cleared_at", object: "04:47", polarity: "true", source_kind: "narration" }, caseEvidence("R8-025", "side_a")),
  obs("r8-025-ts-0517", { kind: "timestamp", payload: { raw_expression: "0517 Hours", clock_time: "05:17" } }, { subject: "Izmir", predicate: "arrived_at", object: "05:17", polarity: "true", source_kind: "narration" }, caseEvidence("R8-025", "side_b")),
  obs("r8-025-travel", { kind: "travel_leg", payload: { traveler: "Dana family / Sikorsky crew", origin: "Istanbul", destination: "Izmir", departure_time_id: "r8-025-ts-0447", arrival_time_id: "r8-025-ts-0517", mode: "Sikorsky" } }, { subject: "Sikorsky", predicate: "flew", object: "Istanbul to Izmir", polarity: "true", source_kind: "narration" }, caseEvidence("R8-025", "side_b")),

  obs("r8-026-st-flew", { kind: "statement", payload: { speaker: "Ari", proposition_topic: "dana_departure", polarity: "true", claim_value: "the moment she heard", target: "Dana" } }, { subject: "Dana", predicate: "departed", object: "immediately", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-026", "side_a")),
  obs("r8-026-ts-three", { kind: "timestamp", payload: { raw_expression: "Three Days Later", sequence_marker: "Three Days Later", relative_time: "three days later" } }, { subject: "hospital scene", predicate: "occurs", object: "three days later", polarity: "true", source_kind: "narration" }, caseEvidence("R8-026", "side_b")),

  obs("r8-027-st-three", { kind: "statement", payload: { speaker: "Avi", proposition_topic: "dalia_decision_duration", polarity: "true", claim_value: "three days" } }, { subject: "Dalia decision", predicate: "running_for", object: "three days", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-027", "side_a")),
  obs("r8-027-ts-three", { kind: "timestamp", payload: { raw_expression: "three days now", duration: "three days" } }, { subject: "Dalia decision", predicate: "duration", object: "three days", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-027", "side_a")),

  obs("r8-029-inj-right", { kind: "injury", payload: { entity: "Cole", injury_event_id: "port_chest_round", body_region: "chest", laterality: "right", injury_type: "gunshot", cause: "vest-gap round" } }, { subject: "Cole", predicate: "chest_wound_laterality", object: "right", polarity: "true", source_kind: "narration" }, caseEvidence("R8-029", "side_a")),
  obs("r8-029-inj-left-rib", { kind: "injury", payload: { entity: "Cole", injury_event_id: "basement_ribs", body_region: "third rib", laterality: "left", injury_type: "fracture", cause: "basement" } }, { subject: "Cole", predicate: "rib_laterality", object: "left", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-029", "side_b")),
  obs("r8-029-ev-tracked", { kind: "event", payload: { actor: "surgeon", action: "tracked", object: "chest round", result: "near basement third-rib fracture" } }, { subject: "port_chest_round", predicate: "tracked_to", object: "basement third rib", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-029", "side_b")),

  obs("r8-031-loc-ankara", { kind: "location_presence", payload: { entity: "Viper", location: "Ankara", presence: "present", event_context: "night before Camp David" } }, { subject: "Viper", predicate: "located_in", object: "Ankara", polarity: "true", source_kind: "narration" }, caseEvidence("R8-031", "side_a")),
  obs("r8-031-travel", { kind: "travel_leg", payload: { traveler: "Viper", origin: "Ankara", destination: "Washington", mode: "flight" } }, { subject: "Viper", predicate: "flies", object: "Ankara to Washington", polarity: "true", source_kind: "narration" }, caseEvidence("R8-031", "side_a")),
  obs("r8-031-loc-ta", { kind: "location_presence", payload: { entity: "Viper", location: "Tel Aviv", presence: "departing", event_context: "straight from Tel Aviv to Camp David" } }, { subject: "Viper", predicate: "located_in", object: "Tel Aviv", polarity: "true", source_kind: "narration" }, caseEvidence("R8-031", "side_b")),

  obs("r8-038-obj-storage", { kind: "object_equipment", payload: { object: "unit 214", object_identity: "culver_city_site", action_or_state: "storage_facility", location: "Culver City" } }, { subject: "Culver City site", predicate: "building_type", object: "storage facility", polarity: "true", source_kind: "dialogue" }, caseEvidence("R8-038", "side_a")),
  obs("r8-038-loc-mall", { kind: "location_presence", payload: { entity: "unit 214", location: "strip mall", presence: "present", event_context: "satellite frame" } }, { subject: "Culver City site", predicate: "building_type", object: "strip mall", polarity: "true", source_kind: "narration" }, caseEvidence("R8-038", "side_b")),

  obs("r8-042-ts-1009", { kind: "timestamp", payload: { raw_expression: "10:09", clock_time: "10:09" } }, { subject: "detention facility", predicate: "cameras_at", object: "10:09", polarity: "true", source_kind: "narration" }, caseEvidence("R8-042", "side_a")),
  obs("r8-042-ts-forty", { kind: "timestamp", payload: { raw_expression: "forty minutes after", relative_time: "forty minutes later", attached_event_id: "r8-042-travel-eilat" } }, { subject: "Eilat CCTV", predicate: "timestamped", object: "forty minutes later", polarity: "true", source_kind: "narration" }, caseEvidence("R8-042", "side_b")),
  obs("r8-042-travel-eilat", { kind: "travel_leg", payload: { traveler: "Dalia decoy", origin: "detention facility", destination: "Eilat", departure_time_id: "r8-042-ts-1009", arrival_time_id: "r8-042-ts-forty", stated_duration: "forty minutes later" } }, { subject: "Dalia decoy", predicate: "traveled", object: "facility to Eilat", polarity: "true", source_kind: "narration" }, caseEvidence("R8-042", "side_b")),
];

export function rule8V2FixtureDocument(): ArchivistSegmentObservationV2 {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: "seg-rule8-v2-fixture",
    entities: [
      { alias: "Cole", entity_type: "person", local_mentions: ["Cole"] },
      { alias: "Ari", entity_type: "person", local_mentions: ["Ari"] },
      { alias: "Hank", entity_type: "person", local_mentions: ["Hank"] },
      { alias: "Dalia", entity_type: "person", local_mentions: ["Dalia"] },
      { alias: "Cyrus", entity_type: "person", local_mentions: ["Cyrus", "Ibrahim"] },
    ],
    observations: structuredClone(RULE8_V2_FIXTURE_OBSERVATIONS),
    local_continuity_concerns: [],
    entity_ambiguities: [
      { alias: "Cyrus", reason: "also claimed as Ibrahim; do not silently merge" },
    ],
    manuscript_id: PIN.manuscript_id,
    manuscript_version_id: PIN.manuscript_version_id,
    content_hash: PIN.content_hash,
    contract_version: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  };
}
