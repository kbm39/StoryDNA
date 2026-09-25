import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { recoverV2PropositionFromTypedPayload } from "./proposition-recovery.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const SYNTHETIC = "At 07:12 the ferry left. Later Nia told Joss, \"Blue means the cache is live.\" Pax pocketed the brass compass. After the chart came out, Pax set the brass compass on the chart.";
const CLOCK_0210 = "Lior Benzvi, found hanged in Cell 7 at the 0210 check.";
const CLOCK_214 = "Avi's man logged the scrap of paper into the case file at 2:14 in the morning.";

function compactDoc(observations: Record<string, unknown>[], segmentId = "seg-ts-obj") {
  return {
    schema: "archivist_segment_observation@v2",
    segment_id: segmentId,
    observations,
  };
}

describe("v2 timestamp typed-payload proposition recovery", () => {
  it("recovers an explicit 07:12 clock from same-row clock_time", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { clock_time: "07:12" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.predicate, "clock_time");
    assert.equal(result.proposition?.object, "07:12");
    assert.doesNotMatch(result.proposition?.subject ?? "", /ferry|obs-/i);
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-0712",
          kind: "timestamp",
          clock_time: "07:12",
          locator: "CHAPTER TEST",
          excerpt: "At 07:12 the ferry left.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 1);
    assert.equal(adapted.retained[0]?.kind, "timestamp");
    assert.match(JSON.stringify(adapted.retained[0]?.payload), /07:12/);
  });

  it("recovers an explicit 0210 clock from raw_expression + clock_time", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { raw_expression: "0210", clock_time: "0210" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.object, "0210");
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-0210",
          kind: "timestamp",
          raw_expression: "0210",
          clock_time: "0210",
          locator: "CHAPTER TWELVE",
          excerpt: CLOCK_0210,
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: CLOCK_0210 },
    );
    assert.equal(adapted.retained.length, 1);
    assert.match(JSON.stringify(adapted.retained[0]), /0210/);
  });

  it("recovers an explicit 2:14 clock without inventing 02:14 digits beyond the payload", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { raw_expression: "2:14 in the morning", clock_time: "02:14" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.object, "02:14");
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-214",
          kind: "timestamp",
          raw_expression: "2:14 in the morning",
          clock_time: "02:14",
          locator: "CHAPTER FIFTEEN",
          excerpt: CLOCK_214,
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: CLOCK_214 },
    );
    assert.equal(adapted.retained.length, 1);
    assert.match(adapted.retained[0]?.evidence.excerpt ?? "", /2:14/);
  });

  it("does not turn vague later into an exact clock", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { raw_expression: "Later", sequence_marker: "later" },
    });
    assert.equal(result.recovered, true);
    assert.doesNotMatch(result.proposition?.object ?? "", /\d{1,2}:\d{2}|07:12|0210/);
    assert.equal(result.proposition?.object.toLowerCase().includes("later"), true);
  });

  it("keeps four minutes later relative unless an explicit clock exists", () => {
    const relative = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { raw_expression: "four minutes later", duration: "four minutes", relative_time: "four minutes later" },
    });
    assert.equal(relative.recovered, true);
    assert.doesNotMatch(relative.proposition?.object ?? "", /02:\d{2}|2:18|0218/);
    assert.match(relative.proposition?.object ?? "", /four minutes/i);
    const withClock = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: {
        raw_expression: "Forty minutes later, at 07:52",
        relative_time: "Forty minutes later",
        clock_time: "07:52",
      },
    });
    assert.equal(withClock.proposition?.object, "07:52");
    assert.equal(withClock.proposition?.predicate, "clock_time");
  });

  it("fails closed when timestamp semantics are missing", () => {
    const empty = recoverV2PropositionFromTypedPayload({ kind: "timestamp", payload: {} });
    assert.equal(empty.proposition, null);
    assert.match(empty.error ?? "", /no safe typed-payload/);
    const eventOnly = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { attached_event_id: "obs-ferry" },
    });
    assert.equal(eventOnly.proposition, null);
  });

  it("fails closed when an explicit proposition conflicts with the typed clock", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-conflict",
          kind: "timestamp",
          raw_expression: "07:12",
          clock_time: "07:12",
          proposition: {
            subject: "timestamp",
            predicate: "clock_time",
            object: "07:52",
            polarity: "true",
            source_kind: "narration",
          },
          locator: "CHAPTER TEST",
          excerpt: "At 07:12 the ferry left.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 0);
    assert.equal(adapted.quarantined[0]?.reason, "proposition_payload_conflict");
  });

  it("still fail-closes unsafe accepted authority on a recoverable timestamp", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-accepted",
          kind: "timestamp",
          clock_time: "07:12",
          raw_expression: "07:12",
          status: "accepted",
          locator: "CHAPTER TEST",
          excerpt: "At 07:12 the ferry left.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.ok, false);
    assert.equal(adapted.hard_failure, "accepted_canon");
    assert.equal(adapted.retained.length, 0);
  });

  it("does not let timestamp recovery rescue noncontiguous evidence", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-stitch",
          kind: "timestamp",
          raw_expression: "07:12",
          clock_time: "07:12",
          locator: "CHAPTER TEST",
          excerpt: "At 07:12 the ferry left. Pax set the brass compass on the chart.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "non_contiguous_evidence"));
  });

  it("never borrows a sibling timestamp or attached event", () => {
    const first = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { clock_time: "07:12", raw_expression: "At 07:12" },
    });
    const second = recoverV2PropositionFromTypedPayload({
      kind: "timestamp",
      payload: { attached_event_id: first.proposition?.object },
    });
    assert.equal(first.proposition?.object, "07:12");
    assert.equal(second.proposition, null);
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-a",
          kind: "timestamp",
          clock_time: "07:12",
          locator: "CHAPTER TEST",
          excerpt: "At 07:12 the ferry left.",
          source_segment: "seg-ts-obj",
        },
        {
          observation_id: "obs-b",
          kind: "timestamp",
          attached_event_id: "obs-a",
          locator: "CHAPTER TEST",
          excerpt: "Later Nia told Joss, \"Blue means the cache is live.\"",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.filter((item) => item.kind === "timestamp").length, 1);
    assert.equal(adapted.quarantined.some((item) => item.observation_id === "obs-b"), true);
    const source = readFileSync(join(ROOT, "proposition-recovery.ts"), "utf8");
    assert.doesNotMatch(source, /RULE8|realCalExpected|benchmark|sibling/);
    assert.doesNotMatch(source, /attached_event_id/);
  });
});

describe("v2 object_equipment typed-payload proposition recovery", () => {
  it("recovers an explicit brass compass + pocketed state", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object_identity: "brass compass", action_or_state: "pocketed" },
    });
    assert.equal(result.recovered, true);
    assert.match(result.proposition?.object ?? "", /brass compass/i);
    assert.match(result.proposition?.predicate ?? "", /pocketed/i);
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-pocket",
          kind: "object_equipment",
          object: "brass compass",
          object_identity: "brass compass",
          action_or_state: "pocketed",
          locator: "CHAPTER TEST",
          excerpt: "Pax pocketed the brass compass.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 1);
    assert.match(adapted.retained[0]?.evidence.excerpt ?? "", /pocketed the brass compass/);
    const identityOnly = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-identity-only",
          kind: "object_equipment",
          object_identity: "brass compass",
          action_or_state: "pocketed",
          locator: "CHAPTER TEST",
          excerpt: "Pax pocketed the brass compass.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(identityOnly.retained.length, 1);
  });

  it("recovers the same explicit compass later placed on the chart", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "compass", object_identity: "the brass compass", action_or_state: "placed on chart" },
    });
    assert.equal(result.recovered, true);
    assert.match(result.proposition?.predicate ?? "", /placed on chart|set/i);
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-chart",
          kind: "object_equipment",
          object: "compass",
          object_identity: "the brass compass",
          action_or_state: "placed on chart",
          locator: "CHAPTER TEST",
          excerpt: "Pax set the brass compass on the chart.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 1);
    assert.match(adapted.retained[0]?.evidence.excerpt ?? "", /on the chart/);
  });

  it("fails closed when action_or_state is missing", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "brass compass", location: "on the chart" },
    });
    assert.equal(result.proposition, null);
    assert.match(result.error ?? "", /action_or_state/);
  });

  it("fails closed when object identity is missing", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { action_or_state: "pocketed", entity: "Pax" },
    });
    assert.equal(result.proposition, null);
    assert.match(result.error ?? "", /object_identity|object/);
  });

  it("does not turn a generic boat into a Zodiac", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "boat", action_or_state: "escaped_into" },
    });
    assert.equal(result.recovered, true);
    assert.equal(result.proposition?.object, "boat");
    assert.doesNotMatch(result.proposition?.object ?? "", /zodiac/i);
  });

  it("does not turn a generic weapon into another weapon", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "weapon", action_or_state: "carried" },
    });
    assert.equal(result.proposition?.object, "weapon");
    assert.doesNotMatch(result.proposition?.object ?? "", /rifle|missile/i);
  });

  it("does not treat proximity as possession", () => {
    const result = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "brass compass", location: "on the chart" },
    });
    assert.equal(result.proposition, null);
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-near",
          kind: "object_equipment",
          object: "brass compass",
          location: "on the chart",
          locator: "CHAPTER TEST",
          excerpt: "Pax set the brass compass on the chart.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 0);
    assert.equal(adapted.quarantined[0]?.reason, "missing_proposition");
  });

  it("fails closed when an explicit proposition conflicts with the typed object", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-conflict",
          kind: "object_equipment",
          object: "boat",
          action_or_state: "escaped_into",
          proposition: {
            subject: "Cyrus",
            predicate: "escaped_into",
            object: "Zodiac",
            polarity: "true",
            source_kind: "narration",
          },
          locator: "CHAPTER TEST",
          excerpt: "Pax pocketed the brass compass.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 0);
    assert.equal(adapted.quarantined[0]?.reason, "proposition_payload_conflict");
  });

  it("does not let object recovery rescue noncontiguous evidence", () => {
    const adapted = adaptV2ProviderOutput(
      compactDoc([
        {
          observation_id: "obs-stitch",
          kind: "object_equipment",
          object: "brass compass",
          object_identity: "brass compass",
          action_or_state: "pocketed then placed",
          locator: "CHAPTER TEST",
          excerpt: "Pax pocketed the brass compass. Pax set the brass compass on the chart.",
          source_segment: "seg-ts-obj",
        },
      ]),
      "seg-ts-obj",
      { segmentText: SYNTHETIC },
    );
    assert.equal(adapted.retained.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "non_contiguous_evidence"));
  });

  it("never borrows a sibling object identity", () => {
    const first = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { object: "Zodiac", action_or_state: "staged" },
    });
    const second = recoverV2PropositionFromTypedPayload({
      kind: "object_equipment",
      payload: { action_or_state: "escaped_into" },
    });
    assert.equal(first.proposition?.object, "Zodiac");
    assert.equal(second.proposition, null);
    const source = readFileSync(join(ROOT, "proposition-recovery.ts"), "utf8");
    assert.doesNotMatch(source, /Zodiac|RULE8|sibling/);
  });
});
