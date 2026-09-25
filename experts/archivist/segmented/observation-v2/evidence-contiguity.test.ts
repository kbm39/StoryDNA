import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptV2ProviderOutput } from "./adapter.ts";
import {
  V2_CAL2_SEGMENT_A_PROSE,
  V2_CAL2_SEGMENT_B_PROSE,
} from "./calibration-v2/fixtures.ts";
import {
  applySegmentEvidenceGate,
  excerptIsContiguousInSegment,
} from "./evidence-contiguity.ts";
import { observationIsConfirmationGrade } from "./validate.ts";
import type { V2Observation } from "./types.ts";

const STITCHED_TRAVEL =
  "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.";

const UNICODE_SOURCE = "The medic\u2019s note said the ribs were bruised.";

function travelDoc(excerpt: string) {
  return {
    schema: "archivist_segment_observation@v2",
    segment_id: "seg-v2-cal2-b",
    observations: [
      {
        observation_id: "obs-travel",
        kind: "travel_leg",
        proposition: {
          subject: "Lena",
          predicate: "traveled",
          object: "Ankara to Izmir",
          polarity: "true",
          source_kind: "narration",
        },
        traveler: "Lena",
        origin: "Ankara",
        destination: "Izmir",
        mode: "Sikorsky",
        locator: "CHAPTER CAL2-B",
        excerpt,
        source_segment: "seg-v2-cal2-b",
        confidence: "high",
        inferred: false,
      },
    ],
  };
}

describe("v2 contiguous evidence gate", () => {
  it("accepts exact contiguous sentences, multi-sentence spans, punctuation, unicode, and valid calibration excerpts", () => {
    assert.equal(
      excerptIsContiguousInSegment(V2_CAL2_SEGMENT_A_PROSE, 'She said, "Air support is unavailable."'),
      true,
    );
    assert.equal(
      excerptIsContiguousInSegment(
        V2_CAL2_SEGMENT_A_PROSE,
        "At 04:47, Mara stood on the north dock. She said, \"Air support is unavailable.\"",
      ),
      true,
    );
    assert.equal(
      excerptIsContiguousInSegment(V2_CAL2_SEGMENT_B_PROSE, "The brass compass was in Lena's jacket."),
      true,
    );
    assert.equal(excerptIsContiguousInSegment(UNICODE_SOURCE, UNICODE_SOURCE), true);
    const verified = applySegmentEvidenceGate({
      excerpt: "Cole pointed at the crate and used the name gray lantern.",
      segmentText: V2_CAL2_SEGMENT_A_PROSE,
    });
    assert.deepEqual(verified, { applied: true, contiguous: true, evidence_status: "verified" });
  });

  it("rejects stitched, paraphrased, reordered, cross-segment, and omitted-middle excerpts", () => {
    assert.equal(excerptIsContiguousInSegment(V2_CAL2_SEGMENT_B_PROSE, STITCHED_TRAVEL), false);
    assert.equal(
      excerptIsContiguousInSegment(V2_CAL2_SEGMENT_B_PROSE, "Lena departed Ankara on a helicopter."),
      false,
    );
    assert.equal(
      excerptIsContiguousInSegment(V2_CAL2_SEGMENT_B_PROSE, "Lena left Ankara at 05:17 aboard the Sikorsky"),
      false,
    );
    assert.equal(
      excerptIsContiguousInSegment(V2_CAL2_SEGMENT_A_PROSE, "The brass compass was in Lena's jacket."),
      false,
    );
    assert.equal(
      excerptIsContiguousInSegment(
        V2_CAL2_SEGMENT_B_PROSE,
        "At 05:17, Lena left Ankara with her sister Noor.",
      ),
      false,
    );
    assert.equal(
      excerptIsContiguousInSegment(UNICODE_SOURCE, "The medic's note said the ribs were bruised."),
      false,
    );
    const gate = applySegmentEvidenceGate({ excerpt: STITCHED_TRAVEL, segmentText: V2_CAL2_SEGMENT_B_PROSE });
    assert.deepEqual(gate, { applied: true, contiguous: false, evidence_status: "unverified" });
  });

  it("quarantines noncontiguous excerpts without rewriting them and skips the gate when segment text is absent", () => {
    const skipped = adaptV2ProviderOutput(travelDoc(STITCHED_TRAVEL), "seg-v2-cal2-b");
    assert.equal(skipped.ok, true);
    assert.equal(skipped.evidence_gate_applied, false);
    assert.equal(skipped.retained.length, 1);

    const gated = adaptV2ProviderOutput(travelDoc(STITCHED_TRAVEL), "seg-v2-cal2-b", {
      segmentText: V2_CAL2_SEGMENT_B_PROSE,
    });
    assert.equal(gated.ok, true);
    assert.equal(gated.evidence_gate_applied, true);
    assert.equal(gated.retained.length, 0);
    assert.equal(gated.evidence_verified_count, 0);
    const row = gated.quarantined.find((item) => item.reason === "non_contiguous_evidence");
    assert.ok(row);
    assert.equal(row?.excerpt, STITCHED_TRAVEL);
    assert.equal(row?.observation?.evidence.excerpt, STITCHED_TRAVEL);
    assert.equal(row?.evidence_status, "unverified");
    assert.equal(row?.observation ? observationIsConfirmationGrade(row.observation as V2Observation) : true, false);

    const ok = adaptV2ProviderOutput(travelDoc("The brass compass was in Lena's jacket."), "seg-v2-cal2-b", {
      segmentText: V2_CAL2_SEGMENT_B_PROSE,
    });
    assert.equal(ok.retained.length, 1);
    assert.equal(ok.retained[0]?.evidence.evidence_status, "verified");
    assert.equal(ok.evidence_verified_count, 1);
  });
});
