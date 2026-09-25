import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "injury")?.implemented, false);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "travel_leg")?.implemented, false);
    assert.equal(V2_PROPOSITION_RECOVERY_MATRIX.find((item) => item.kind === "timestamp")?.implemented, false);
  });
});
