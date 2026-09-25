import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { V2_CAL2_SEGMENT_A_PROSE, V2_CAL2_SEGMENT_B_PROSE } from "./calibration-v2/fixtures.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2 } from "./constants.ts";
import {
  V2_TRUNCATED_PREFIX_RECOVERY_VERSION,
  recoverV2TruncatedObservations,
  v2OutputLooksTruncated,
} from "./truncated-prefix-recovery.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

const COMPLETE_CLOCK = {
  observation_id: "obs_clock",
  kind: "timestamp",
  raw_expression: "04:47",
  clock_time: "04:47",
  proposition: {
    subject: "Mara",
    predicate: "stood_at",
    object: "04:47",
    polarity: "true",
    source_kind: "narration",
  },
  locator: "CHAPTER CAL2-A",
  excerpt: "At 04:47, Mara stood on the north dock.",
  source_segment: "seg-trunc",
  confidence: "high",
  inferred: false,
};

const COMPLETE_AIR = {
  observation_id: "obs_air",
  kind: "statement",
  speaker: "Mara",
  proposition_topic: "air_cover",
  polarity: "false",
  claim_value: "unavailable",
  proposition: {
    subject: "Mara",
    predicate: "air_cover",
    object: "unavailable",
    polarity: "false",
    source_kind: "dialogue",
  },
  locator: "CHAPTER CAL2-A",
  excerpt: "She said, \"Air support is unavailable.\"",
  source_segment: "seg-trunc",
  confidence: "high",
  inferred: false,
};

function completeDocument(observations: unknown[]) {
  return {
    schema: ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
    segment_id: "seg-trunc",
    observations,
  };
}

function truncateAfterFirstObject(json: string): string {
  const marker = '"observation_id": "obs_air"';
  const idx = json.indexOf(marker);
  assert.ok(idx > 0);
  return json.slice(0, idx + 40);
}

describe("v2 truncated observations[] prefix recovery", () => {
  it("uses normal parse for valid complete JSON and does not invoke recovery", () => {
    const raw = JSON.stringify(completeDocument([COMPLETE_CLOCK]));
    const adapted = adaptV2ProviderOutput(raw, "seg-trunc", { segmentText: V2_CAL2_SEGMENT_A_PROSE });
    assert.equal(adapted.ok, true);
    assert.equal(adapted.truncation_recovery.recovery_method, "none");
    assert.equal(adapted.truncation_recovery.normal_parse_failed, false);
    assert.equal(adapted.truncation_recovery.truncated, false);
    assert.equal(adapted.retained.length, 1);
  });

  it("recovers complete prefix objects from a truncated observations[] array", () => {
    const json = JSON.stringify(completeDocument([COMPLETE_CLOCK, COMPLETE_AIR]), null, 2);
    const truncated = truncateAfterFirstObject(json);
    assert.equal(v2OutputLooksTruncated(truncated), true);
    const recovered = recoverV2TruncatedObservations(truncated, { finishReason: "max_tokens" });
    assert.equal(recovered.invoked, true);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.audit.recovery_method, "truncated_prefix_recovery");
    assert.equal(recovered.audit.normal_parse_failed, true);
    assert.equal(recovered.audit.truncated, true);
    assert.equal(recovered.audit.complete_objects_recovered, 1);
    assert.equal(recovered.audit.incomplete_objects_dropped, 1);
    assert.equal(recovered.audit.original_finish_reason, "max_tokens");
    const items = recovered.value?.observations as Array<{ observation_id?: string }>;
    assert.deepEqual(items.map((item) => item.observation_id), ["obs_clock"]);
  });

  it("drops the incomplete final observation and fail-closes before the first complete object", () => {
    const prefix = `{"schema":"${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}","segment_id":"seg-trunc","observations":[{"kind":"tim`;
    const recovered = recoverV2TruncatedObservations(prefix, { finishReason: "max_tokens" });
    assert.equal(recovered.invoked, true);
    assert.equal(recovered.ok, false);
    assert.equal(recovered.audit.complete_objects_recovered, 0);
    assert.equal(recovered.audit.unknown_unrecoverable, true);
    const adapted = adaptV2ProviderOutput(prefix, "seg-trunc", { finishReason: "max_tokens" });
    assert.equal(adapted.ok, false);
    assert.equal(adapted.hard_failure, "invalid_json");
    assert.equal(adapted.retained.length, 0);
  });

  it("does not invoke truncation recovery for malformed non-truncated JSON", () => {
    const malformed = `{"schema":"${ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2}","segment_id":"seg-trunc","observations":[],}`;
    assert.equal(v2OutputLooksTruncated(malformed), false);
    const recovered = recoverV2TruncatedObservations(malformed);
    assert.equal(recovered.invoked, false);
    const adapted = adaptV2ProviderOutput(malformed, "seg-trunc");
    assert.equal(adapted.ok, false);
    assert.equal(adapted.hard_failure, "invalid_json");
    assert.equal(adapted.truncation_recovery.recovery_method, "none");
  });

  it("still quarantines a recovered object whose evidence is not contiguous", () => {
    const stitched = {
      ...COMPLETE_CLOCK,
      excerpt:
        "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.",
      source_segment: "seg-v2-cal2-b",
    };
    const json = JSON.stringify(completeDocument([stitched, COMPLETE_AIR]), null, 2);
    const truncated = truncateAfterFirstObject(json);
    const adapted = adaptV2ProviderOutput(truncated, "seg-trunc", {
      segmentText: V2_CAL2_SEGMENT_B_PROSE,
      finishReason: "max_tokens",
    });
    assert.equal(adapted.ok, true);
    assert.equal(adapted.truncation_recovery.recovery_method, "truncated_prefix_recovery");
    assert.equal(adapted.retained.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "non_contiguous_evidence"));
    assert.equal(adapted.quarantined[0]?.excerpt, stitched.excerpt);
  });

  it("still quarantines a recovered object with an invalid semantic payload", () => {
    const bad = {
      ...COMPLETE_CLOCK,
      kind: "operational_capability",
      entity: "Cobras",
      capability_type: "thermal targeting",
      state: "used",
      source: "not-a-source",
      excerpt: "At 04:47, Mara stood on the north dock.",
    };
    const json = JSON.stringify(completeDocument([bad, COMPLETE_AIR]), null, 2);
    const truncated = truncateAfterFirstObject(json);
    const adapted = adaptV2ProviderOutput(truncated, "seg-trunc", {
      segmentText: V2_CAL2_SEGMENT_A_PROSE,
      finishReason: "max_tokens",
    });
    assert.equal(adapted.ok, true);
    assert.equal(adapted.retained.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "invalid_payload"));
  });

  it("still fail-closes recovered unsafe authority", () => {
    const accepted = { ...COMPLETE_CLOCK, status: "accepted" };
    const json = JSON.stringify(completeDocument([accepted, COMPLETE_AIR]), null, 2);
    const truncated = truncateAfterFirstObject(json);
    const adapted = adaptV2ProviderOutput(truncated, "seg-trunc", { finishReason: "max_tokens" });
    assert.equal(adapted.ok, false);
    assert.equal(adapted.hard_failure, "accepted_canon");
    assert.equal(adapted.truncation_recovery.recovery_method, "truncated_prefix_recovery");
  });

  it("does not inspect sibling cases or benchmark answer keys", () => {
    const source = readFileSync(join(ROOT, "truncated-prefix-recovery.ts"), "utf8");
    assert.doesNotMatch(source, /R8-\d{3}/);
    assert.doesNotMatch(source, /answer.key|RULE8_VERIFIED_CASES|expected_key/i);
    assert.equal(V2_TRUNCATED_PREFIX_RECOVERY_VERSION, "archivist_v2_truncated_prefix_recovery@v1");
    const recovered = recoverV2TruncatedObservations(
      JSON.stringify(completeDocument([COMPLETE_CLOCK])).slice(0, 80),
      { finishReason: "max_tokens" },
    );
    assert.equal(typeof recovered.audit.complete_objects_recovered, "number");
  });
});
