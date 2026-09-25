import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "@/experts/archivist/contracts.ts";
import {
  ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION,
  RULE8_BENCHMARK_IDENTITY,
  RULE8_CONTINUITY_INVENTORY,
  RULE8_VERIFIED_CASES,
  RULE8_VERSION_CASES,
  buildRule8FactMap,
  countExcerptWords,
  currentFactGroups,
  loadReckoningRule8Benchmark,
  scoreVerifiedCases,
} from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));
const BENCHMARK_SOURCE_FILES = [
  "index.ts",
  "constants.ts",
  "inventory.ts",
  "fixture.ts",
  "score.ts",
  "schema-gap.ts",
  "fact-map.ts",
  "types.ts",
];

describe("archivist_reckoning_rule8_benchmark@v1", () => {
  it("freezes benchmark and manuscript identity", () => {
    const artifact = loadReckoningRule8Benchmark();
    assert.equal(artifact.identity.benchmark_version, ARCHIVIST_RECKONING_RULE8_BENCHMARK_VERSION);
    assert.equal(artifact.identity.source_review.generated, "September 24, 2026, 4:47 PM PT");
    assert.equal(
      artifact.identity.target_manuscript.content_hash,
      "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    );
    assert.equal(artifact.identity.target_manuscript.manuscript_id, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(artifact.identity.measurement_only, true);
    assert.equal(artifact.identity.provider_calls, 0);
    assert.equal(artifact.inventoried, 42);
    assert.equal(artifact.applicability_counts.VERIFIED_IN_REVISED_13, 24);
  });

  it("requires two located evidence sides on every verified case", () => {
    assert.equal(RULE8_VERIFIED_CASES.length, 24);
    for (const item of RULE8_VERIFIED_CASES) {
      for (const side of [item.side_a, item.side_b]) {
        assert.ok(side.locator.startsWith("CHAPTER "), item.benchmark_id);
        assert.ok(side.excerpt.length >= 8, item.benchmark_id);
        assert.ok(side.proposition.length > 0, item.benchmark_id);
        const words = countExcerptWords(side.excerpt);
        assert.ok(words >= 3, `${item.benchmark_id} ${side.locator}`);
        assert.ok(
          words <= ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS,
          `${item.benchmark_id} excerpt is ${words} words`,
        );
      }
      assert.equal(item.expected_outcome, "continuity_defect");
      assert.notEqual(item.side_a.excerpt, item.side_b.excerpt, item.benchmark_id);
    }
  });

  it("excludes version-mismatch and out-of-scope items from the recall denominator", () => {
    const artifact = loadReckoningRule8Benchmark();
    const verifiedIds = new Set(RULE8_VERIFIED_CASES.map((item) => item.benchmark_id));
    const versionIds = new Set(RULE8_VERSION_CASES.map((item) => item.benchmark_id));
    for (const item of RULE8_CONTINUITY_INVENTORY) {
      if (item.applicability === "VERIFIED_IN_REVISED_13") {
        assert.ok(verifiedIds.has(item.benchmark_id), item.benchmark_id);
        assert.equal(item.version_outcome, undefined);
      } else {
        assert.ok(!verifiedIds.has(item.benchmark_id), item.benchmark_id);
      }
    }
    for (const id of versionIds) {
      assert.ok(!verifiedIds.has(id), id);
    }
    assert.equal(artifact.metrics.total_verified_defects, verifiedIds.size);
    assert.equal(
      artifact.metrics.total_verified_defects,
      artifact.applicability_counts.VERIFIED_IN_REVISED_13,
    );
  });

  it("classifies outcomes and computes recall metrics", () => {
    const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(metrics.detected, 0);
    assert.equal(metrics.extracted_but_missed, 1);
    assert.equal(metrics.partially_extracted, 2);
    assert.equal(metrics.not_extracted, 21);
    assert.equal(metrics.end_to_end_recall, 0);
    assert.equal(metrics.extraction_coverage, 1 / 24);
    assert.equal(metrics.reasoning_recall_given_sufficient_extraction, 0);
    assert.equal(
      metrics.detected + metrics.extracted_but_missed + metrics.partially_extracted + metrics.not_extracted,
      metrics.total_verified_defects,
    );
    const chest = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === "R8-029");
    assert.equal(chest?.primary_outcome, "EXTRACTED_BUT_MISSED");
    assert.equal(RULE8_VERIFIED_CASES.filter((item) => item.primary_outcome === "DETECTED").length, 0);
  });

  it("aggregates metrics by reasoning type", () => {
    const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(metrics.by_reasoning_type.INJURY_CONTINUITY.total, 3);
    assert.equal(metrics.by_reasoning_type.INJURY_CONTINUITY.extracted_but_missed, 1);
    assert.equal(metrics.by_reasoning_type.INJURY_CONTINUITY.extraction_coverage, 1 / 3);
    assert.equal(metrics.by_reasoning_type.TRAVEL_TIME_IMPOSSIBILITY.total, 2);
    assert.equal(metrics.by_reasoning_type.TRAVEL_TIME_IMPOSSIBILITY.detected, 0);
    assert.equal(metrics.by_reasoning_type.KNOWLEDGE_BEFORE_ACQUISITION.total, 3);
    assert.equal(metrics.by_reasoning_type.OPERATIONAL_CAPABILITY.total, 1);
    assert.equal(metrics.by_reasoning_type.CLOCK_TIME_CONTRADICTION.partially_extracted, 1);
  });

  it("maps 126 retained facts against verified defects", () => {
    const factMap = buildRule8FactMap();
    assert.equal(factMap.retained_fact_count, 126);
    assert.equal(factMap.relevant_fact_count, 8);
    assert.equal(factMap.irrelevant_fact_count, 118);
    assert.equal(factMap.defects_with_zero_relevant_facts.length, 22);
    assert.ok(!factMap.defects_with_zero_relevant_facts.includes("R8-029"));
    assert.ok(!factMap.defects_with_zero_relevant_facts.includes("R8-023"));
    assert.ok(currentFactGroups().includes("knowledge"));
    assert.ok(currentFactGroups().includes("events"));
    assert.ok(!currentFactGroups().includes("travel_legs"));
    assert.ok(!currentFactGroups().includes("statements"));
  });

  it("does not import a provider or mutate canon", () => {
    for (const file of BENCHMARK_SOURCE_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(
        source,
        /@anthropic-ai\/sdk|from "openai"|createAnthropic|executeExpert|runPaidSegmentedPilot/,
      );
      assert.doesNotMatch(
        source,
        /saveBookGraph|saveCandidateReview|acceptCanon|writeAccepted|seriesBible/,
      );
    }
    assert.equal(RULE8_BENCHMARK_IDENTITY.provider_calls, 0);
    assert.equal(RULE8_BENCHMARK_IDENTITY.target_manuscript.persisted_review_findings, 0);
  });
});
