import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { recoverV2PropositionFromTypedPayload, V2_PROPOSITION_RECOVERY_MATRIX } from "./proposition-recovery.ts";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

function compactDoc(observations: Record<string, unknown>[], segmentId = "seg-prop") {
  return {
    schema: "archivist_segment_observation@v2",
    segment_id: segmentId,
    observations,
  };
}

describe("v2 compact proposition recovery", () => {
  it("recovers capability proposition from entity + capability_type + state", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "operational_capability",
      payload: { entity: "Ari/team", capability_type: "air_support", state: "unavailable", source: "statement" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.subject, "Ari/team");
    assert.equal(result.proposition?.predicate, "air_support");
    assert.equal(result.proposition?.object, "unavailable");
    assert.equal(result.proposition?.polarity, "false");
    assert.equal(result.audit?.proposition_source, "typed_payload_recovery");
    assert.equal(result.audit?.original_proposition_present, false);
  });

  it("does not invent a capability entity or state", () => {
    const missingEntity = recoverV2PropositionFromTypedPayload({
      kind: "operational_capability",
      payload: { capability_type: "air cover", state: "unavailable" },
    });
    assert.equal(missingEntity.proposition, null);
    assert.match(missingEntity.error ?? "", /entity/);
    const missingState = recoverV2PropositionFromTypedPayload({
      kind: "operational_capability",
      payload: { entity: "Hank", capability_type: "missile launch" },
    });
    assert.equal(missingState.proposition, null);
    assert.match(missingState.error ?? "", /state/);
  });

  it("recovers an event proposition from actor + action + object", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "event",
      payload: { actor: "Hank", action: "fired missiles", object: "lead vehicle" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.subject, "Hank");
    assert.equal(result.proposition?.predicate, "fired missiles");
    assert.equal(result.proposition?.object, "lead vehicle");
  });

  it("does not invent an event actor", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "event",
      payload: { action: "fired missiles", object: "lead vehicle" },
    });
    assert.equal(result.proposition, null);
    assert.match(result.error ?? "", /actor/);
  });

  it("recovers a statement proposition only when speaker and topic are explicit", () => {
    const ok = recoverV2PropositionFromTypedPayload({
      kind: "statement",
      payload: {
        speaker: "Ari",
        proposition_topic: "air_cover",
        polarity: "false",
        claim_value: "unavailable",
      },
    });
    assert.equal(ok.recovered, true);
    assert.equal(ok.proposition?.subject, "Ari");
    const missing = recoverV2PropositionFromTypedPayload({
      kind: "statement",
      payload: { proposition_topic: "lullaby", polarity: "true", claim_value: "Numi numi" },
    });
    assert.equal(missing.proposition, null);
    assert.match(missing.error ?? "", /speaker/);
  });

  it("quarantines a conflicting existing proposition instead of overwriting it", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-conflict",
          kind: "operational_capability",
          entity: "Hank",
          capability_type: "missile launch",
          state: "used",
          source: "event",
          proposition: {
            subject: "Ari",
            predicate: "air cover",
            object: "unavailable",
            polarity: "false",
            source_kind: "dialogue",
          },
          locator: "CHAPTER TEST",
          excerpt: "I have two missiles. Engaging now at the north wall.",
          source_segment: "seg-prop",
          confidence: "high",
        },
      ]),
      "seg-prop",
      { segmentText: "I have two missiles. Engaging now at the north wall." },
    );
    assert.equal(adapted.retained.length, 0);
    assert.equal(adapted.quarantined[0]?.reason, "proposition_payload_conflict");
  });

  it("does not let proposition recovery rescue noncontiguous evidence", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-stitch",
          kind: "operational_capability",
          entity: "Hank / platform",
          capability_type: "missile launch",
          state: "used",
          source: "event",
          locator: "CHAPTER TEST",
          excerpt: "I have two missiles. Copy. Engaging. Thirty seconds later the horizon lit orange.",
          source_segment: "seg-prop",
          confidence: "high",
        },
      ]),
      "seg-prop",
      {
        segmentText:
          "I have two missiles. Say the word. Hector answered. Copy. Engaging. Later the horizon lit orange.",
      },
    );
    assert.equal(adapted.quarantined[0]?.reason, "non_contiguous_evidence");
    assert.equal(adapted.retained.length, 0);
  });

  it("never reads another observation or Rule 8 expected keys", () => {
    const first = recoverV2PropositionFromTypedPayload({
      kind: "operational_capability",
      payload: { entity: "Ari", capability_type: "air cover", state: "unavailable", source: "statement" },
    });
    const second = recoverV2PropositionFromTypedPayload({
      kind: "operational_capability",
      payload: { capability_type: "missile launch", state: "used", source: "event" },
    });
    assert.equal(first.proposition?.subject, "Ari");
    assert.equal(second.proposition, null);
    const source = readFileSync(join(ROOT, "proposition-recovery.ts"), "utf8");
    assert.doesNotMatch(source, /RULE8|realCalExpected|benchmark/);
    assert.equal(RULE8_VERIFIED_CASES.length > 0, true);
  });

  it("recovers a compact capability through the adapter when evidence is contiguous", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-air",
          kind: "operational_capability",
          entity: "strike team or operation",
          capability_type: "air cover",
          state: "unavailable",
          source: "statement",
          locator: "CHAPTER TWELVE",
          excerpt: "No air cover. No strike package.",
          source_segment: "seg-prop",
          confidence: "high",
        },
      ]),
      "seg-prop",
      { segmentText: "Ari said, \"No air cover. No strike package. If this goes wrong, there is no phone call.\"" },
    );
    assert.equal(adapted.ok, true, adapted.hard_failure_detail ?? "");
    assert.equal(adapted.retained.length, 1);
    assert.equal(adapted.retained[0]?.proposition.object, "unavailable");
    assert.ok(adapted.normalizations.some((item) => item.rule === "operational_capability_typed_payload"));
  });

  it("publishes a kind-by-kind recovery matrix", () => {
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.length, 11);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "operational_capability")?.implemented, true);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "injury")?.implemented, true);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "travel_leg")?.implemented, true);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "timestamp")?.implemented, true);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "object_equipment")?.implemented, true);
  });

  it("recovers an injury proposition from entity + body_region without nested proposition", () => {
    const withCondition = recoverV2PropositionFromTypedPayload({
      kind: "injury",
      payload: { entity: "Bennett", body_region: "hip", laterality: "unspecified", condition: "grazed" },
    });
    assert.equal(withCondition.recovered, true);
    assert.equal(withCondition.proposition?.subject, "Bennett");
    assert.equal(withCondition.proposition?.predicate, "grazed");
    assert.equal(withCondition.proposition?.object, "hip");
    assert.equal(withCondition.audit?.recovery_rule, "injury_typed_payload");
    assert.equal(withCondition.audit?.original_proposition_present, false);

    const kindDefault = recoverV2PropositionFromTypedPayload({
      kind: "injury",
      payload: { entity: "Preacher", body_region: "ribs", laterality: "unspecified" },
    });
    assert.equal(kindDefault.recovered, true);
    assert.equal(kindDefault.proposition?.predicate, "injured");
    assert.equal(kindDefault.proposition?.object, "ribs");

    const missingEntity = recoverV2PropositionFromTypedPayload({
      kind: "injury",
      payload: { body_region: "ribs" },
    });
    assert.equal(missingEntity.proposition, null);
    assert.match(missingEntity.error ?? "", /entity/);

    const missingRegion = recoverV2PropositionFromTypedPayload({
      kind: "injury",
      payload: { entity: "Cole" },
    });
    assert.equal(missingRegion.proposition, null);
    assert.match(missingRegion.error ?? "", /body_region/);
  });

  it("recovers a travel_leg proposition from traveler + destination without nested proposition", () => {
    const withMode = recoverV2PropositionFromTypedPayload({
      kind: "travel_leg",
      payload: {
        traveler: "Dana and the kids",
        origin: "Rome",
        destination: "Istanbul",
        mode: "flight",
      },
    });
    assert.equal(withMode.recovered, true);
    assert.equal(withMode.proposition?.subject, "Dana and the kids");
    assert.equal(withMode.proposition?.predicate, "flight");
    assert.equal(withMode.proposition?.object, "Istanbul");
    assert.ok(withMode.audit?.fields_used.includes("origin"));
    assert.equal(withMode.audit?.recovery_rule, "travel_leg_typed_payload");

    const kindDefault = recoverV2PropositionFromTypedPayload({
      kind: "travel_leg",
      payload: { traveler: "strike team", origin: "port at Ashdod", destination: "Lebanese waters" },
    });
    assert.equal(kindDefault.recovered, true);
    assert.equal(kindDefault.proposition?.predicate, "travels");
    assert.equal(kindDefault.proposition?.object, "Lebanese waters");

    const missingTraveler = recoverV2PropositionFromTypedPayload({
      kind: "travel_leg",
      payload: { destination: "Istanbul" },
    });
    assert.equal(missingTraveler.proposition, null);
    assert.match(missingTraveler.error ?? "", /traveler/);

    const missingDestination = recoverV2PropositionFromTypedPayload({
      kind: "travel_leg",
      payload: { traveler: "Cole", origin: "Coronado" },
    });
    assert.equal(missingDestination.proposition, null);
    assert.match(missingDestination.error ?? "", /destination/);
  });

  it("retains compact injury and travel_leg rows through the adapter without nested proposition", () => {
    const segmentText =
      "Bennett took one in the hip. Dana and the kids flew from Rome to Istanbul.";
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-hip",
          kind: "injury",
          entity: "Bennett",
          body_region: "hip",
          laterality: "unspecified",
          condition: "gunshot",
          locator: "CHAPTER ONE",
          excerpt: "Bennett took one in the hip.",
          source_segment: "seg-prop",
          confidence: "high",
        },
        {
          observation_id: "obs-rome",
          kind: "travel_leg",
          traveler: "Dana and the kids",
          origin: "Rome",
          destination: "Istanbul",
          mode: "flew",
          locator: "CHAPTER ONE",
          excerpt: "Dana and the kids flew from Rome to Istanbul.",
          source_segment: "seg-prop",
          confidence: "high",
        },
      ]),
      "seg-prop",
      { segmentText },
    );
    assert.equal(adapted.ok, true, adapted.hard_failure_detail ?? "");
    assert.equal(adapted.retained.filter((item) => item.kind === "injury").length, 1);
    assert.equal(adapted.retained.filter((item) => item.kind === "travel_leg").length, 1);
    const injury = adapted.retained.find((item) => item.kind === "injury");
    const travel = adapted.retained.find((item) => item.kind === "travel_leg");
    assert.equal(injury && injury.kind === "injury" ? injury.payload.entity : null, "Bennett");
    assert.equal(travel && travel.kind === "travel_leg" ? travel.payload.destination : null, "Istanbul");
    assert.ok(adapted.normalizations.some((item) => item.rule === "injury_typed_payload"));
    assert.ok(adapted.normalizations.some((item) => item.rule === "travel_leg_typed_payload"));
  });

  it("still quarantines a combined injury region after proposition recovery", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-combined",
          kind: "injury",
          entity: "Cole Stratton",
          body_region: "ribs (third and fourth)",
          laterality: "unspecified",
          locator: "CHAPTER TWELVE",
          excerpt: "third and fourth ribs.",
          source_segment: "seg-prop",
          confidence: "high",
        },
      ]),
      "seg-prop",
      { segmentText: "Cole felt the third and fourth ribs." },
    );
    assert.equal(adapted.retained.length, 0);
    assert.equal(adapted.quarantined[0]?.reason, "combined_injury_region");
  });

  it("replays workflow b30594ca raw outputs and retains injury plus travel_leg", (t) => {
    const rawDir = join(
      ROOT,
      "../../../../.calibration-results/archivist-opus-v2-full-manuscript-eval-v2/raw/b30594ca-c56f-4379-b40b-6a2349f259ed",
    );
    if (!existsSync(rawDir)) {
      t.skip("saved eval-v2 raw archive is not present");
      return;
    }
    const files = readdirSync(rawDir).filter(
      (name) => name.includes("observation") || name.includes("repair"),
    );
    assert.ok(files.length >= 14, "expected observation/repair raw files");
    const retained = [];
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(rawDir, file), "utf8")) as {
        raw_text?: string;
        segment_id?: string;
        finish_reason?: string;
      };
      const adapted = adaptV2ProviderOutput(raw.raw_text, raw.segment_id, {
        finishReason: raw.finish_reason,
      });
      retained.push(...adapted.retained);
    }
    const injuries = retained.filter((item) => item.kind === "injury");
    const travels = retained.filter((item) => item.kind === "travel_leg");
    assert.ok(injuries.length >= 4, `expected >=4 injuries, got ${injuries.length}`);
    assert.ok(travels.length >= 3, `expected >=3 travel_leg, got ${travels.length}`);
    const injuryEntities = new Set(
      injuries.map((item) => (item.kind === "injury" ? item.payload.entity.toLowerCase() : "")),
    );
    const injuryRegions = injuries
      .filter((item) => item.kind === "injury")
      .map((item) => item.kind === "injury" ? `${item.payload.entity}|${item.payload.body_region}`.toLowerCase() : "");
    assert.ok(
      injuryRegions.some((row) => row.includes("bennett") && row.includes("hip")) ||
        injuryEntities.has("bennett"),
      "expected Bennett hip from this run raw",
    );
    assert.ok(
      injuryRegions.some((row) => row.includes("preacher") && row.includes("rib")),
      "expected Preacher ribs from this run raw",
    );
    const travelPairs = travels
      .filter((item) => item.kind === "travel_leg")
      .map((item) =>
        item.kind === "travel_leg"
          ? `${item.payload.origin ?? ""}>${item.payload.destination ?? ""}`.toLowerCase()
          : "",
      );
    assert.ok(
      travelPairs.some((row) => row.includes("rome") && row.includes("istanbul")) ||
        travelPairs.some((row) => row.includes("ashdod") && row.includes("lebanese")),
      "expected Rome→Istanbul or Ashdod→Lebanese waters from this run raw",
    );
    assert.equal(
      retained.filter((item) => item.evidence.evidence_status === "verified" && /lorem ipsum/i.test(item.evidence.excerpt)).length,
      0,
    );
  });
});
