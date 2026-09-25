import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { HAIKU_V2_NATIVE_SHAPES } from "./calibration-v1/haiku-native-shapes.ts";
import { applySafeEnumNormalizations, parseAlsoKnownAsClaim } from "./enum-normalization.ts";
import type { V2Proposition } from "./types.ts";

const PROP: V2Proposition = {
  subject: "Cole",
  predicate: "uses",
  object: "gray lantern",
  polarity: "true",
  source_kind: "narration",
};

describe("v2 enum normalization", () => {
  it("recovers the measured Haiku native shapes without inventing rows", () => {
    const statement = adaptV2ProviderOutput(HAIKU_V2_NATIVE_SHAPES.statement_boolean_polarity);
    assert.equal(statement.ok, true);
    assert.equal(statement.retained.length, 1);
    assert.equal(statement.retained[0]?.proposition.polarity, "false");
    assert.equal(statement.quarantined.length, 0);
    assert.ok(statement.normalizations.some((item) => item.rule === "propagate_proposition_polarity"));

    const knowledge = adaptV2ProviderOutput(HAIKU_V2_NATIVE_SHAPES.knowledge_non_enum);
    assert.equal(knowledge.retained.length, 1);
    assert.equal(knowledge.quarantined.length, 0);
    const kn = knowledge.retained[0];
    assert.ok(kn && kn.kind === "knowledge");
    if (kn && kn.kind === "knowledge") {
      assert.equal(kn.payload.knowledge_state, "known");
      assert.equal(kn.payload.perspective, "character");
    }

    const identity = adaptV2ProviderOutput(HAIKU_V2_NATIVE_SHAPES.identity_prose_claim);
    assert.equal(identity.retained.length, 1);
    const id = identity.retained[0];
    assert.ok(id && id.kind === "identity");
    if (id && id.kind === "identity") {
      assert.equal(id.payload.identity_claim, "also_known_as");
      assert.equal(id.payload.alias, "Ibrahim");
    }

    const relationship = adaptV2ProviderOutput(HAIKU_V2_NATIVE_SHAPES.relationship_confirmed);
    assert.equal(relationship.retained.length, 1);
    const rel = relationship.retained[0];
    assert.ok(rel && rel.kind === "relationship");
    if (rel && rel.kind === "relationship") {
      assert.equal(rel.payload.state, "exists");
    }
  });

  it("does not over-normalize unsafe aliases", () => {
    const mentions = applySafeEnumNormalizations({
      observationId: "neg-mentions",
      kind: "knowledge",
      payload: { entity: "Cole", topic: "code", knowledge_state: "mentions", perspective: "character" },
      proposition: PROP,
      excerpt: "Cole mentions the code",
    });
    assert.equal(mentions.error, "knowledge_state mentions is not known");

    const possible = applySafeEnumNormalizations({
      observationId: "neg-possible",
      kind: "relationship",
      payload: { subject: "Lena", counterparty: "Noor", relationship_type: "sister", state: "possible" },
      proposition: { ...PROP, subject: "Lena", object: "Noor" },
      excerpt: "possibly her sister",
    });
    assert.equal(possible.error, "relationship state possible is not exists");

    assert.equal(parseAlsoKnownAsClaim("may be Ibrahim"), null);
    const maybe = applySafeEnumNormalizations({
      observationId: "neg-maybe",
      kind: "identity",
      payload: { surface_name: "contractor", identity_claim: "may be Ibrahim" },
      proposition: { ...PROP, subject: "contractor", object: "Ibrahim" },
      excerpt: "may be Ibrahim",
    });
    assert.equal(maybe.error, null);
    assert.equal(maybe.payload.identity_claim, "may be Ibrahim");

    const contradiction = applySafeEnumNormalizations({
      observationId: "neg-polar",
      kind: "statement",
      payload: { speaker: "Mara", proposition_topic: "air", polarity: "true" },
      proposition: { ...PROP, subject: "Mara", polarity: "false" },
      excerpt: "Air support is unavailable.",
    });
    assert.equal(contradiction.error, "contradictory polarity");

    const noUse = applySafeEnumNormalizations({
      observationId: "neg-uses",
      kind: "knowledge",
      payload: { entity: "Cole", topic: "code", knowledge_state: "uses", perspective: "character" },
      proposition: { ...PROP, predicate: "names", object: "code" },
      excerpt: "Cole names the crate",
    });
    assert.equal(noUse.error, "knowledge_state uses lacks demonstrated use");

    const maybeDoc = adaptV2ProviderOutput({
      schema: "archivist_segment_observation@v2",
      segment_id: "seg-v2-cal-b",
      observations: [
        {
          observation_id: "maybe-id",
          kind: "identity",
          proposition: {
            subject: "contractor",
            predicate: "may_be",
            object: "Ibrahim",
            polarity: "true",
            source_kind: "narration",
          },
          surface_name: "contractor",
          identity_claim: "may be Ibrahim",
          locator: "CHAPTER CAL-B",
          excerpt: "may be Ibrahim maybe",
          source_segment: "seg-v2-cal-b",
          confidence: "high",
        },
      ],
    });
    assert.equal(maybeDoc.retained.some((item) => item.kind === "identity"), false);
  });
});
