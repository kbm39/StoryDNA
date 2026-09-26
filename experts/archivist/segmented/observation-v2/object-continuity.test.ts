import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnoseAllV2Pairs } from "./opus-v2-full-manuscript-eval/runner.ts";
import { countRepeatedObjectContinuityChains, objectContinuityKey } from "./object-continuity.ts";
import { namespacedObservationId } from "./entity-resolution.ts";
import type { V2Observation, V2ObservationPayload, V2Proposition } from "./types.ts";

function obj(
  id: string,
  payload: Extract<V2ObservationPayload, { kind: "object_equipment" }>["payload"],
  locator: string,
  source_segment = "seg-14-chapter-29-chapter-29",
): V2Observation {
  const proposition: V2Proposition = {
    subject: payload.object,
    predicate: payload.action_or_state ?? "held",
    object: payload.object_identity ?? payload.object,
    polarity: "true",
    source_kind: "narration",
  };
  return {
    id,
    kind: "object_equipment",
    payload,
    proposition,
    evidence: { locator, excerpt: payload.object, source_segment },
    confidence: "high",
    inferred: false,
  };
}

describe("repeated-object continuity chains", () => {
  it("counts the team coin across two actions in one segment", () => {
    const rows = [
      obj(
        "o2",
        {
          object: "team coin",
          object_identity: "Preacher's team coin, brass, trident over flag, verse Ruth 1:16-17",
          action_or_state: "set on coffee table as gift to Cole",
          location: "coffee table",
        },
        "coffee table",
      ),
      obj(
        "o4",
        {
          object: "team coin",
          object_identity: "Preacher's team coin",
          action_or_state: "received by Cole",
        },
        "CHAPTER TWENTY-NINE",
      ),
    ];
    assert.equal(objectContinuityKey(rows[0]!), "preacher's team coin");
    assert.equal(objectContinuityKey(rows[1]!), "preacher's team coin");
    assert.equal(countRepeatedObjectContinuityChains(rows), 1);
  });

  it("does not chain a bare generic laptop across segments", () => {
    const rows = [
      obj("a", { object: "laptop", action_or_state: "opened" }, "CHAPTER TEN", "seg-10"),
      obj("b", { object: "laptop", action_or_state: "closed" }, "CHAPTER TWELVE", "seg-12"),
    ];
    assert.equal(objectContinuityKey(rows[0]!), null);
    assert.equal(countRepeatedObjectContinuityChains(rows), 0);
  });

  it("chains a distinctive insurance laptop in one segment", () => {
    const rows = [
      obj(
        "o9",
        {
          object: "laptop labeled 'Insurance' in Farsi",
          object_identity: "Cyrus's insurance laptop",
          action_or_state: "found hidden under floor stone",
        },
        "Hebron safe house",
        "seg-10-chapter-20-chapter-21",
      ),
      obj(
        "o10",
        {
          object: "laptop labeled 'Insurance'",
          object_identity: "Cyrus's insurance laptop",
          action_or_state: "taken by Ari",
        },
        "Hebron safe house",
        "seg-10-chapter-20-chapter-21",
      ),
    ];
    assert.equal(countRepeatedObjectContinuityChains(rows), 1);
  });
});

describe("namespaced local observation IDs", () => {
  it("prefixes model-local o17 with the source segment", () => {
    const row = obj("o17", { object: "team coin", action_or_state: "held" }, "CHAPTER TWENTY-NINE");
    assert.equal(namespacedObservationId(row), "seg-14-chapter-29-chapter-29:o17");
    assert.equal(namespacedObservationId({ ...row, id: "rel-spouse-a" }), "rel-spouse-a");
  });

  it("keeps colliding o17 pair keys distinct across segments", () => {
    const patterson: V2Observation = {
      id: "o17",
      kind: "statement",
      payload: {
        speaker: "Ari",
        proposition_topic: "Patterson alive",
        polarity: "false",
        claim_value: "Patterson dead",
        target: "Patterson",
      },
      proposition: {
        subject: "Ari",
        predicate: "Patterson alive",
        object: "Patterson dead",
        polarity: "false",
        source_kind: "dialogue",
      },
      evidence: {
        locator: "after Patterson shot",
        excerpt: "He is gone. The fight is not.",
        source_segment: "seg-07-chapter-14-chapter-14",
      },
      confidence: "high",
      inferred: false,
    };
    const cyrus: V2Observation = {
      ...patterson,
      payload: {
        speaker: "Ari",
        proposition_topic: "Cyrus alive",
        polarity: "false",
        claim_value: "presumed dead",
        target: "Cyrus",
      },
      proposition: {
        subject: "Ari",
        predicate: "Cyrus alive",
        object: "presumed dead",
        polarity: "false",
        source_kind: "dialogue",
      },
      evidence: {
        locator: "Ch26 black site",
        excerpt: "Officially, Cyrus is presumed dead",
        source_segment: "seg-13-chapter-27-chapter-28",
      },
    };
    const pair = diagnoseAllV2Pairs([patterson, cyrus])[0];
    assert.ok(pair);
    assert.equal(pair.left_id, "seg-07-chapter-14-chapter-14:o17");
    assert.equal(pair.right_id, "seg-13-chapter-27-chapter-28:o17");
    assert.equal(pair.reason, "different_subject");
  });
});
