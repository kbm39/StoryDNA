import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adaptV2ProviderOutput } from "./adapter.ts";
import { V2_CAL3_SEGMENT_B_PROSE } from "./calibration-v3/fixtures.ts";
import { applySafeEnumNormalizations, lateralityNamedInExcerpt } from "./enum-normalization.ts";
import { V2_LATERALITIES } from "./constants.ts";
import { observationIsConfirmationGrade } from "./validate.ts";
import type { V2Proposition } from "./types.ts";

const PROP: V2Proposition = {
  subject: "Lena",
  predicate: "had",
  object: "rib injury",
  polarity: "true",
  source_kind: "dialogue",
};

function injuryDoc(args: {
  id: string;
  laterality?: unknown;
  excerpt: string;
  extra?: Record<string, unknown>;
}) {
  return {
    schema: "archivist_segment_observation@v2",
    segment_id: "seg-v2-cal3-b",
    observations: [
      {
        observation_id: args.id,
        kind: "injury",
        proposition: PROP,
        entity: "Lena",
        body_region: "ribs",
        injury_type: "cracked",
        laterality: args.laterality,
        locator: "CHAPTER CAL3-B",
        excerpt: args.excerpt,
        source_segment: "seg-v2-cal3-b",
        confidence: "high",
        inferred: false,
        ...args.extra,
      },
    ],
  };
}

describe("v2 injury laterality default", () => {
  it("keeps the existing laterality enum without a schema change", () => {
    assert.deepEqual([...V2_LATERALITIES], ["left", "right", "bilateral", "unspecified"]);
  });

  it("defaults missing laterality to unspecified when the excerpt names no side", () => {
    const normalized = applySafeEnumNormalizations({
      observationId: "miss",
      kind: "injury",
      payload: { entity: "Lena", body_region: "ribs", condition: "cracked" },
      proposition: PROP,
      excerpt: "The same medic later wrote that the ribs were cracked",
    });
    assert.equal(normalized.error, null);
    assert.equal(normalized.payload.laterality, "unspecified");
    const adapted = adaptV2ProviderOutput(
      injuryDoc({
        id: "obs-miss",
        excerpt: "The same medic later wrote that the ribs were cracked",
      }),
      "seg-v2-cal3-b",
      { segmentText: V2_CAL3_SEGMENT_B_PROSE },
    );
    assert.equal(adapted.retained.length, 1);
    const row = adapted.retained[0];
    assert.ok(row && row.kind === "injury");
    if (row && row.kind === "injury") {
      assert.equal(row.payload.laterality, "unspecified");
    }
    assert.equal(row?.evidence.evidence_status, "verified");
  });

  it("preserves explicit laterality from the model or this excerpt only", () => {
    for (const side of ["right", "left", "bilateral"] as const) {
      const excerpt =
        side === "bilateral" ? "both sides of the ribs were bruised" : `Lena's ${side} ribs were bruised`;
      const adapted = adaptV2ProviderOutput(
        injuryDoc({ id: `obs-${side}`, laterality: side, excerpt }),
      );
      assert.equal(adapted.retained.length, 1, side);
      const row = adapted.retained[0];
      assert.ok(row && row.kind === "injury");
      if (row && row.kind === "injury") {
        assert.equal(row.payload.laterality, side);
      }
    }
    assert.equal(lateralityNamedInExcerpt("Chest, right side."), "right");
    assert.equal(lateralityNamedInExcerpt("the ribs were cracked"), null);
  });

  it("quarantines a model side that conflicts with this excerpt", () => {
    const adapted = adaptV2ProviderOutput(
      injuryDoc({
        id: "obs-conflict",
        laterality: "left",
        excerpt: "Lena's right ribs were bruised, not broken.",
      }),
      "seg-v2-cal3-b",
      { segmentText: V2_CAL3_SEGMENT_B_PROSE },
    );
    assert.equal(adapted.retained.length, 0);
    assert.ok(adapted.quarantined.some((item) => item.reason === "laterality_evidence_conflict"));
    assert.equal(adapted.quarantined[0]?.excerpt, "Lena's right ribs were bruised, not broken.");
  });

  it("does not copy laterality from another injury row or another chapter", () => {
    const adapted = adaptV2ProviderOutput(
      {
        schema: "archivist_segment_observation@v2",
        segment_id: "seg-v2-cal3-b",
        observations: [
          {
            observation_id: "obs-right",
            kind: "injury",
            proposition: { ...PROP, object: "right ribs bruised" },
            entity: "Lena",
            body_region: "ribs",
            laterality: "right",
            locator: "sentence 3",
            excerpt: "Lena's right ribs were bruised, not broken.",
            source_segment: "seg-v2-cal3-b",
            confidence: "high",
            inferred: false,
          },
          {
            observation_id: "obs-later",
            kind: "injury",
            proposition: { ...PROP, object: "ribs cracked" },
            entity: "Lena",
            body_region: "ribs",
            locator: "sentence 4",
            excerpt: "The same medic later wrote that the ribs were cracked",
            source_segment: "seg-v2-cal3-b",
            confidence: "high",
            inferred: false,
          },
        ],
      },
      "seg-v2-cal3-b",
      { segmentText: V2_CAL3_SEGMENT_B_PROSE },
    );
    const first = adapted.retained.find((item) => item.id === "obs-right");
    const second = adapted.retained.find((item) => item.id === "obs-later");
    assert.ok(first && first.kind === "injury");
    assert.ok(second && second.kind === "injury");
    if (first && first.kind === "injury") assert.equal(first.payload.laterality, "right");
    if (second && second.kind === "injury") assert.equal(second.payload.laterality, "unspecified");

    const otherChapter = applySafeEnumNormalizations({
      observationId: "other-ch",
      kind: "injury",
      payload: { entity: "Cole", body_region: "chest" },
      proposition: { ...PROP, subject: "Cole", object: "chest" },
      excerpt: "The basement fracture line was mentioned later.",
    });
    assert.equal(otherChapter.payload.laterality, "unspecified");
    assert.equal(lateralityNamedInExcerpt("Chest, right side. Something punched through"), "right");
  });

  it("keeps unspecified confirmation-grade when other evidence requirements are met", () => {
    const adapted = adaptV2ProviderOutput(
      {
        ...injuryDoc({
          id: "obs-grade",
          excerpt: "The same medic later wrote that the ribs were cracked",
        }),
        manuscript_id: "ms-test",
        manuscript_version_id: "mv-test",
        content_hash: "hash-test",
      },
      "seg-v2-cal3-b",
      { segmentText: V2_CAL3_SEGMENT_B_PROSE },
    );
    assert.equal(adapted.retained.length, 1);
    assert.equal(adapted.retained[0]?.evidence.evidence_status, "verified");
    assert.equal(observationIsConfirmationGrade(adapted.retained[0]!), true);
  });
});
