import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { applySegmentEvidenceGate, excerptIsContiguousInSegment } from "./evidence-contiguity.ts";
import {
  V2_TYPOGRAPHIC_PUNCTUATION_MAP,
  V2_UNICODE_PUNCTUATION_EQUIVALENCE_VERSION,
  canonicalizeTypographicPunctuation,
} from "./unicode-punctuation-equivalence.ts";

const CURLY_APOS = "The medic\u2019s note said the ribs were bruised.";
const STRAIGHT_APOS = "The medic's note said the ribs were bruised.";
const LEFT_RIGHT_SINGLE = "She said \u2018hold fast\u2019 and waited.";
const STRAIGHT_SINGLE = "She said 'hold fast' and waited.";
const CURLY_DOUBLE = "She said, \u201CAir support is unavailable.\u201D";
const STRAIGHT_DOUBLE = 'She said, "Air support is unavailable."';
const STITCH =
  "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.";
const SOURCE_TWO_SENTENCES = [
  "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor.",
  "The brass compass was in Lena's jacket.",
  "Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.",
].join(" ");

describe("v2 unicode punctuation equivalence", () => {
  it("matches straight vs curly apostrophes and left/right single quotes without rewriting the excerpt", () => {
    const apos = applySegmentEvidenceGate({ excerpt: STRAIGHT_APOS, segmentText: CURLY_APOS });
    assert.equal(apos.applied, true);
    if (apos.applied) {
      assert.equal(apos.contiguous, true);
      assert.equal(apos.evidence_status, "verified");
      assert.equal(apos.evidence_match_method, "unicode_punctuation_equivalent");
      assert.equal(apos.normalized_punctuation, true);
      assert.equal(apos.raw_excerpt, STRAIGHT_APOS);
      assert.ok(apos.raw_source_match_window?.includes("\u2019"));
    }
    const singles = applySegmentEvidenceGate({ excerpt: STRAIGHT_SINGLE, segmentText: LEFT_RIGHT_SINGLE });
    assert.equal(singles.applied && singles.contiguous, true);
    if (singles.applied) {
      assert.equal(singles.evidence_match_method, "unicode_punctuation_equivalent");
      assert.equal(singles.raw_excerpt, STRAIGHT_SINGLE);
    }
    assert.equal(canonicalizeTypographicPunctuation("Avi\u2019s"), "Avi's");
    assert.deepEqual(Object.keys(V2_TYPOGRAPHIC_PUNCTUATION_MAP), ["\u2018", "\u2019", "\u201C", "\u201D"]);
    assert.equal(V2_UNICODE_PUNCTUATION_EQUIVALENCE_VERSION, "archivist_v2_unicode_punctuation_equivalent@v1");
  });

  it("matches straight vs curly double quotes when the words are otherwise identical", () => {
    const gate = applySegmentEvidenceGate({ excerpt: STRAIGHT_DOUBLE, segmentText: CURLY_DOUBLE });
    assert.equal(gate.applied && gate.contiguous, true);
    if (gate.applied) {
      assert.equal(gate.evidence_match_method, "unicode_punctuation_equivalent");
      assert.equal(gate.normalized_punctuation, true);
      assert.equal(gate.raw_excerpt, STRAIGHT_DOUBLE);
    }
  });

  it("keeps an original exact match exact and does not report it as normalized", () => {
    const gate = applySegmentEvidenceGate({ excerpt: CURLY_APOS, segmentText: CURLY_APOS });
    assert.equal(gate.applied, true);
    if (gate.applied) {
      assert.equal(gate.contiguous, true);
      assert.equal(gate.evidence_match_method, "exact");
      assert.equal(gate.normalized_punctuation, false);
      assert.equal(gate.raw_source_match_window, null);
    }
  });

  it("still rejects stitch, omitted middle, paraphrase, reorder, wrong word, and wrong segment", () => {
    assert.equal(excerptIsContiguousInSegment(SOURCE_TWO_SENTENCES, STITCH), false);
    assert.equal(
      excerptIsContiguousInSegment(SOURCE_TWO_SENTENCES, "At 05:17, Lena left Ankara with her sister Noor."),
      false,
    );
    assert.equal(excerptIsContiguousInSegment(SOURCE_TWO_SENTENCES, "Lena departed Ankara on a helicopter."), false);
    assert.equal(
      excerptIsContiguousInSegment(SOURCE_TWO_SENTENCES, "Lena left Ankara at 05:17 aboard the Sikorsky"),
      false,
    );
    assert.equal(excerptIsContiguousInSegment(CURLY_APOS, "The nurse\u2019s note said the ribs were bruised."), false);
    assert.equal(excerptIsContiguousInSegment("Other chapter. No medic.", STRAIGHT_APOS), false);
  });

  it("does not let punctuation equivalence rescue a missing word or a noncontiguous join", () => {
    assert.equal(excerptIsContiguousInSegment(CURLY_APOS, "The medic's note said the ribs bruised."), false);
    const stitchedCurly = applySegmentEvidenceGate({
      excerpt:
        "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.",
      segmentText: SOURCE_TWO_SENTENCES.replace("Lena's", "Lena\u2019s"),
    });
    assert.equal(stitchedCurly.applied && stitchedCurly.contiguous, false);
  });

  it("does not apply NFKC or other semantic Unicode folding", () => {
    assert.equal(excerptIsContiguousInSegment("The cafe opened at 2.", "The café opened at 2."), false);
    assert.equal(excerptIsContiguousInSegment("Area 2 was quiet.", "Area ² was quiet."), false);
    assert.equal(canonicalizeTypographicPunctuation("café ²"), "café ²");
  });

  it("does not mutate the stored excerpt when punctuation-equivalent evidence is retained", () => {
    const adapted = adaptV2ProviderOutput(
      {
        schema: "archivist_segment_observation@v2",
        segment_id: "seg-punct",
        observations: [
          {
            observation_id: "obs-medic",
            kind: "injury",
            entity: "patient",
            body_region: "ribs",
            laterality: "unspecified",
            diagnosis: "bruised",
            proposition: {
              subject: "patient",
              predicate: "ribs",
              object: "bruised",
              polarity: "true",
              source_kind: "narration",
            },
            locator: "NOTE",
            excerpt: STRAIGHT_APOS,
            source_segment: "seg-punct",
            confidence: "high",
            inferred: false,
          },
        ],
      },
      "seg-punct",
      { segmentText: CURLY_APOS },
    );
    assert.equal(adapted.retained.length, 1);
    assert.equal(adapted.retained[0]?.evidence.excerpt, STRAIGHT_APOS);
    assert.equal(adapted.retained[0]?.evidence.evidence_match_method, "unicode_punctuation_equivalent");
    assert.equal(adapted.retained[0]?.evidence.normalized_punctuation, true);
    assert.ok(adapted.retained[0]?.evidence.raw_source_match_window?.includes("\u2019"));
  });
});
