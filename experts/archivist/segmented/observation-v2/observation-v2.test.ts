import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { scoreVerifiedCases } from "@/experts/archivist/benchmarks/reckoning-rule8/score.ts";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { emptySegmentObservation, validateSegmentObservation } from "../observation-contract.ts";
import { ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA } from "../constants.ts";
import {
  ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2,
  RULE8_V1_FROZEN_BASELINE,
  RULE8_V2_COVERAGE_MATRIX,
  RULE8_V2_FIXTURE_OBSERVATIONS,
  assertMatrixCoversFrozenBenchmark,
  classifyV2PairingInterface,
  compactSegmentObservationV2,
  emptySegmentObservationV2,
  estimateV2TokenFootprint,
  observationIsConfirmationGrade,
  rule8V2FixtureDocument,
  scoreV2Representability,
  suppressDuplicateObservations,
  validateSegmentObservationV2,
} from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

describe("archivist_segment_observation@v2", () => {
  it("keeps the frozen Rule 8 v1 baseline unchanged", () => {
    const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(metrics.detected, RULE8_V1_FROZEN_BASELINE.detected);
    assert.equal(metrics.extracted_but_missed, RULE8_V1_FROZEN_BASELINE.extracted_but_missed);
    assert.equal(metrics.partially_extracted, RULE8_V1_FROZEN_BASELINE.partially_extracted);
    assert.equal(metrics.not_extracted, RULE8_V1_FROZEN_BASELINE.not_extracted);
    assert.equal(metrics.total_verified_defects, RULE8_V1_FROZEN_BASELINE.total_verified_defects);
    assert.equal(metrics.end_to_end_recall, RULE8_V1_FROZEN_BASELINE.end_to_end_recall);
    assert.equal(metrics.extraction_coverage, RULE8_V1_FROZEN_BASELINE.extraction_coverage);
  });

  it("does not reinterpret v1 observations as v2", () => {
    const v1 = emptySegmentObservation("seg-01");
    assert.equal(v1.schema, ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA);
    assert.equal(validateSegmentObservation(v1).ok, true);
    const asV2 = validateSegmentObservationV2(v1);
    assert.equal(asV2.ok, false);
    if (!asV2.ok) {
      assert.ok(asV2.errors.some((error) => error.includes("cannot be reinterpreted")));
    }
    const v2 = emptySegmentObservationV2("seg-01");
    assert.equal(v2.schema, ARCHIVIST_SEGMENT_OBSERVATION_SCHEMA_V2);
    assert.equal(validateSegmentObservation(v2).ok, false);
  });

  it("validates timestamps, events, statements, and evidence limits", () => {
    const document = rule8V2FixtureDocument();
    const result = validateSegmentObservationV2(document, "seg-rule8-v2-fixture");
    assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
    const invented = structuredClone(document);
    const stamp = invented.observations.find((item) => item.id === "r8-004-ts-morning");
    assert.ok(stamp && stamp.kind === "timestamp");
    stamp.payload.clock_time = "04:47";
    const rejected = validateSegmentObservationV2(invented);
    assert.equal(rejected.ok, false);
  });

  it("validates knowledge, travel, capability, injury, relationship, identity, location, and objects", () => {
    const kinds = new Set(RULE8_V2_FIXTURE_OBSERVATIONS.map((item) => item.kind));
    for (const kind of [
      "timestamp",
      "event",
      "statement",
      "knowledge",
      "travel_leg",
      "operational_capability",
      "injury",
      "relationship",
      "identity",
      "location_presence",
      "object_equipment",
    ]) {
      assert.ok(kinds.has(kind as never), kind);
    }
    const mixedInjury = rule8V2FixtureDocument();
    const injury = mixedInjury.observations.find((item) => item.id === "r8-029-inj-right");
    assert.ok(injury && injury.kind === "injury");
    injury.payload.body_region = "chest and arm";
    assert.equal(validateSegmentObservationV2(mixedInjury).ok, false);
    const narrationKnown = rule8V2FixtureDocument();
    const knowledge = narrationKnown.observations.find((item) => item.id === "r8-011-kn-use");
    assert.ok(knowledge && knowledge.kind === "knowledge");
    knowledge.payload.perspective = "narration";
    assert.equal(validateSegmentObservationV2(narrationKnown).ok, false);
  });

  it("requires evidence and blocks accepted canon", () => {
    const document = rule8V2FixtureDocument();
    for (const observation of document.observations) {
      assert.equal(observationIsConfirmationGrade(observation), true, observation.id);
    }
    const accepted = { ...document, status: "accepted" };
    assert.equal(validateSegmentObservationV2(accepted).ok, false);
    const withId = structuredClone(document);
    withId.entities[0] = { ...withId.entities[0], entity_id: "person:cole" } as never;
    assert.equal(validateSegmentObservationV2(withId).ok, false);
    const short = structuredClone(document);
    short.observations[0].evidence.excerpt = "short";
    assert.equal(validateSegmentObservationV2(short).ok, false);
  });

  it("suppresses duplicate observations", () => {
    const document = compactSegmentObservationV2(rule8V2FixtureDocument());
    const first = document.observations[0];
    const doubled = {
      ...document,
      observations: [...document.observations, { ...first, id: `${first.id}-dup` }],
    };
    const { suppressed, kept } = suppressDuplicateObservations(doubled.observations);
    assert.equal(suppressed, 1);
    assert.equal(kept.length, document.observations.length);
    const compact = compactSegmentObservationV2(doubled);
    assert.equal(compact.observations.length, document.observations.length);
  });

  it("maps all 24 verified cases to explicit V2 observations", () => {
    assert.deepEqual(assertMatrixCoversFrozenBenchmark(), []);
    assert.equal(RULE8_V2_COVERAGE_MATRIX.length, 24);
    const ids = new Set(RULE8_V2_FIXTURE_OBSERVATIONS.map((item) => item.id));
    for (const row of RULE8_V2_COVERAGE_MATRIX) {
      assert.ok(row.required_observations.length >= 2, row.benchmark_id);
      for (const required of row.required_observations) {
        assert.ok(ids.has(required.id), required.id);
      }
      const left = RULE8_V2_FIXTURE_OBSERVATIONS.find(
        (item) => item.id === row.required_observations.find((obs) => obs.role === "side_a")?.id,
      );
      const right = RULE8_V2_FIXTURE_OBSERVATIONS.find(
        (item) => item.id === row.required_observations.find((obs) => obs.role === "side_b")?.id,
      );
      assert.ok(left && right, row.benchmark_id);
      assert.equal(classifyV2PairingInterface(left, right), row.required_reasoning, row.benchmark_id);
    }
  });

  it("represents all 24 verified defects under V2 fixtures", () => {
    const report = scoreV2Representability();
    assert.equal(report.total_verified, 24);
    assert.equal(report.representable, 24, report.missing_features.join("; "));
    assert.deepEqual(report.not_representable, []);
    assert.deepEqual(report.missing_features, []);
  });

  it("estimates a smaller token footprint than a duplicated V1 dump", () => {
    const estimate = estimateV2TokenFootprint();
    assert.ok(estimate.v2_fixture_tokens > 0);
    assert.ok(estimate.v1_duplicated_equivalent_tokens > estimate.v2_fixture_tokens);
    assert.ok(estimate.v2_to_v1_ratio < 0.5);
  });

  it("does not import a provider or mutate canon", () => {
    const files = [
      "constants.ts",
      "types.ts",
      "validate.ts",
      "compactness.ts",
      "pairing-interface.ts",
      "fixtures.ts",
      "coverage-matrix.ts",
      "representability.ts",
      "token-estimate.ts",
      "prompt.ts",
      "adapter.ts",
      "fixture-provider.ts",
      "rehearsal.ts",
      "examples.ts",
      "index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /@anthropic-ai\/sdk|from "openai"|createAnthropic|runPaidSegmentedPilot/);
      assert.doesNotMatch(source, /saveBookGraph|saveCandidateReview|acceptCanon|writeAccepted/);
    }
  });
});
