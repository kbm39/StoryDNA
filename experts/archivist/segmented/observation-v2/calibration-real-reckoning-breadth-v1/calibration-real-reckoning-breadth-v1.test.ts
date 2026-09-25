import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { scoreVerifiedCases } from "@/experts/archivist/benchmarks/reckoning-rule8/score.ts";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { assertExpectedKeysCoverKinds } from "../calibration-v1/fixtures.ts";
import { RULE8_V1_FROZEN_BASELINE } from "../constants.ts";
import { buildV2ObservationUserPrompt } from "../prompt.ts";
import {
  V2_REAL_BREADTH_AUTHORIZED_TO_RUN,
  V2_REAL_BREADTH_BENCHMARK_IDS,
  V2_REAL_BREADTH_CEILING_USD,
  V2_REAL_BREADTH_CONTENT_HASH,
  V2_REAL_BREADTH_DESIGN_ONLY,
  V2_REAL_BREADTH_EXCLUDED_NEAR_DUPLICATES,
  V2_REAL_BREADTH_EXCLUDED_PRIOR_IDS,
  V2_REAL_BREADTH_MAX_PRIMARY_CALLS,
  V2_REAL_BREADTH_MAX_REPAIR_CALLS,
  V2_REAL_BREADTH_MODEL,
  V2_REAL_BREADTH_R8001_ANCHORS,
  V2_REAL_BREADTH_R8001_EXPECTED,
  V2_REAL_BREADTH_R8007_ANCHORS,
  V2_REAL_BREADTH_R8012_ANCHORS,
  V2_REAL_BREADTH_R8016_ANCHORS,
  V2_REAL_BREADTH_R8023_ANCHORS,
  V2_REAL_BREADTH_R8025_ANCHORS,
  V2_REAL_BREADTH_REJECTED,
  V2_REAL_BREADTH_REMAINING_UNSEEN,
  V2_REAL_BREADTH_SESSION_ID,
  ARCHIVIST_V2_REAL_RECKONING_BREADTH_20260925_V1,
  REAL_BREADTH_IMPLEMENTATION_SHA,
  REAL_BREADTH_OFFICIAL_CASES,
  REAL_BREADTH_OFFICIAL_METRICS,
  REAL_BREADTH_PRIOR_REAL_PROSE,
  V2_REAL_BREADTH_WIRED_TO_PAID_PATH,
  breadthRequiredKinds,
  extractAuthorizedBreadthWindows,
  leakageHitsInBreadthPrompt,
  projectBreadthSessionCost,
  r8001DetectionSufficient,
  r8007DetectionSufficient,
  r8012DetectionSufficient,
  r8016DetectionSufficient,
  r8023DetectionSufficient,
  r8025DetectionSufficient,
} from "./index.ts";
import type { V2Observation } from "../types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

function fake(args: {
  id: string;
  kind: V2Observation["kind"];
  subject: string;
  object: string;
  excerpt: string;
  payload?: Record<string, unknown>;
}): V2Observation {
  return {
    id: args.id,
    kind: args.kind,
    payload: (args.payload ?? { value: args.object }) as never,
    proposition: {
      subject: args.subject,
      predicate: "observed",
      object: args.object,
      polarity: "true",
      source_kind: "narration",
    },
    evidence: {
      locator: "CHAPTER TEST",
      excerpt: args.excerpt,
      source_segment: "seg-test",
    },
    confidence: "high",
    inferred: false,
  };
}

describe("archivist v2 real-Reckoning breadth design 20260925-v1", () => {
  it("freezes a design-only six-call session that is not authorized to run", () => {
    assert.equal(V2_REAL_BREADTH_SESSION_ID, "archivist-v2-real-reckoning-breadth-20260925-v1");
    assert.equal(V2_REAL_BREADTH_MODEL, "claude-haiku-4-5-20251001");
    assert.equal(V2_REAL_BREADTH_MAX_PRIMARY_CALLS, 6);
    assert.equal(V2_REAL_BREADTH_MAX_REPAIR_CALLS, 0);
    assert.equal(V2_REAL_BREADTH_AUTHORIZED_TO_RUN, false);
    assert.equal(V2_REAL_BREADTH_DESIGN_ONLY, true);
    assert.equal(V2_REAL_BREADTH_WIRED_TO_PAID_PATH, false);
    assert.deepEqual([...V2_REAL_BREADTH_BENCHMARK_IDS], [
      "R8-001",
      "R8-007",
      "R8-012",
      "R8-016",
      "R8-023",
      "R8-025",
    ]);
    assert.equal(
      V2_REAL_BREADTH_CONTENT_HASH,
      "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    );
  });

  it("selects six unseen dimensions and keeps the other fifteen unused", () => {
    assert.deepEqual([...V2_REAL_BREADTH_EXCLUDED_PRIOR_IDS], ["R8-010", "R8-011", "R8-029"]);
    for (const id of V2_REAL_BREADTH_BENCHMARK_IDS) {
      assert.equal(V2_REAL_BREADTH_EXCLUDED_PRIOR_IDS.includes(id as never), false);
    }
    const dimensions = V2_REAL_BREADTH_BENCHMARK_IDS.map((id) => {
      const row = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === id);
      assert.ok(row);
      return row.required_reasoning_type;
    });
    assert.equal(new Set(dimensions).size, 6);
    assert.equal(V2_REAL_BREADTH_REMAINING_UNSEEN.length, 15);
    for (const id of V2_REAL_BREADTH_REMAINING_UNSEEN) {
      assert.equal(V2_REAL_BREADTH_BENCHMARK_IDS.includes(id as never), false);
    }
    assert.deepEqual(
      V2_REAL_BREADTH_EXCLUDED_NEAR_DUPLICATES.map((pair) => [...pair]),
      [
        ["R8-004", "R8-027"],
        ["R8-014", "R8-018"],
      ],
    );
    assert.ok(V2_REAL_BREADTH_REJECTED.some((item) => item.id === "R8-011"));
  });

  it("freezes expected keys from Rule 8 excerpts before any provider call", () => {
    const cases = {
      "R8-001": V2_REAL_BREADTH_R8001_ANCHORS,
      "R8-007": V2_REAL_BREADTH_R8007_ANCHORS,
      "R8-012": V2_REAL_BREADTH_R8012_ANCHORS,
      "R8-016": V2_REAL_BREADTH_R8016_ANCHORS,
      "R8-023": V2_REAL_BREADTH_R8023_ANCHORS,
      "R8-025": V2_REAL_BREADTH_R8025_ANCHORS,
    } as const;
    for (const [id, anchors] of Object.entries(cases)) {
      const row = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === id);
      assert.ok(row);
      assert.equal(anchors.side_a_excerpt, row.side_a.excerpt);
      assert.equal(anchors.side_b_excerpt, row.side_b.excerpt);
    }
    assert.deepEqual(
      assertExpectedKeysCoverKinds(V2_REAL_BREADTH_R8001_EXPECTED, breadthRequiredKinds("seg-v2-breadth-r8-001")),
      [],
    );
    assert.equal(
      V2_REAL_BREADTH_R8001_EXPECTED.some((item) => item.excerpt_must_include === "0210"),
      true,
    );
  });

  it("extracts smallest windows from pinned-like manuscript text", () => {
    const manuscript = [
      "CHAPTER TWELVE",
      V2_REAL_BREADTH_R8001_ANCHORS.side_a_excerpt,
      "CHAPTER FIFTEEN",
      V2_REAL_BREADTH_R8001_ANCHORS.side_b_excerpt,
      V2_REAL_BREADTH_R8016_ANCHORS.side_b_excerpt,
      V2_REAL_BREADTH_R8023_ANCHORS.side_b_excerpt,
      "CHAPTER TWENTY-SEVEN",
      V2_REAL_BREADTH_R8007_ANCHORS.side_a_excerpt,
      "CHAPTER TWENTY-THREE",
      V2_REAL_BREADTH_R8007_ANCHORS.side_b_excerpt,
      "CHAPTER EIGHT",
      V2_REAL_BREADTH_R8012_ANCHORS.side_a_excerpt,
      V2_REAL_BREADTH_R8023_ANCHORS.side_a_excerpt,
      "CHAPTER TWENTY-FOUR",
      V2_REAL_BREADTH_R8012_ANCHORS.side_b_excerpt,
      "CHAPTER SIXTEEN",
      V2_REAL_BREADTH_R8016_ANCHORS.side_a_excerpt,
      "CHAPTER TWENTY",
      V2_REAL_BREADTH_R8025_ANCHORS.side_a_excerpt,
      "CHAPTER TWENTY-ONE",
      V2_REAL_BREADTH_R8025_ANCHORS.side_b_excerpt,
      "CHAPTER THIRTEEN",
      "Unrelated chapter text that must not be sent.",
    ].join("\n");
    const windows = extractAuthorizedBreadthWindows(manuscript);
    assert.equal(windows.r8001.prose.includes("0210"), true);
    assert.equal(windows.r8001.prose.includes("2:14"), true);
    assert.equal(windows.r8007.prose.includes("Zodiac"), true);
    assert.equal(windows.r8012.prose.includes("Lior had a daughter"), true);
    assert.equal(windows.r8016.prose.includes("never vetted him ourselves"), true);
    assert.equal(windows.r8023.prose.includes("Ibrahim"), true);
    assert.equal(windows.r8025.prose.includes("0447"), true);
    assert.equal(windows.r8025.prose.includes("Sikorskys"), true);
    assert.equal(windows.r8001.prose.includes("Unrelated chapter"), false);
  });

  it("does not leak Rule 8 diagnosis into the user prompt", () => {
    const user = buildV2ObservationUserPrompt({
      segmentId: "seg-v2-breadth-r8-001",
      segmentText: "Lior Benzvi, found hanged in Cell 7 at the 0210 check.",
    });
    assert.deepEqual(leakageHitsInBreadthPrompt(user), []);
  });

  it("treats detection sufficiency as the required observation pair", () => {
    assert.equal(
      r8001DetectionSufficient([
        fake({ id: "a", kind: "timestamp", subject: "Lior", object: "0210", excerpt: "0210 check" }),
        fake({ id: "b", kind: "timestamp", subject: "Avi", object: "2:14", excerpt: "logged at 2:14" }),
      ]),
      true,
    );
    assert.equal(
      r8007DetectionSufficient([
        fake({ id: "a", kind: "object_equipment", subject: "Cyrus", object: "launch", excerpt: "into a launch" }),
        fake({ id: "b", kind: "object_equipment", subject: "boat", object: "Zodiac", excerpt: "Zodiac, engines running" }),
      ]),
      true,
    );
    assert.equal(
      r8012DetectionSufficient([
        fake({ id: "a", kind: "relationship", subject: "Lior", object: "daughter", excerpt: "Lior had a daughter" }),
        fake({
          id: "b",
          kind: "relationship",
          subject: "wife",
          object: "pregnant",
          excerpt: "She was pregnant. She is the one who will have to tell the child.",
        }),
      ]),
      true,
    );
    assert.equal(
      r8016DetectionSufficient([
        fake({
          id: "a",
          kind: "statement",
          subject: "Galit",
          object: "vetting",
          excerpt: "ran that vetting program for four years",
        }),
        fake({
          id: "b",
          kind: "statement",
          subject: "Avi",
          object: "never vetted",
          excerpt: "never vetted him ourselves. The vendor vets its own people",
        }),
      ]),
      true,
    );
    assert.equal(
      r8023DetectionSufficient([
        fake({
          id: "a",
          kind: "location_presence",
          subject: "contractor",
          object: "office",
          excerpt: "pushed a cart of cabling past her office",
        }),
        fake({ id: "b", kind: "identity", subject: "Cyrus", object: "Ibrahim", excerpt: "Cyrus, Ibrahim" }),
      ]),
      true,
    );
    assert.equal(
      r8025DetectionSufficient([
        fake({
          id: "a",
          kind: "timestamp",
          subject: "roof",
          object: "0447",
          excerpt: "Sultanahmet Rooftop, Istanbul, 0447 Hours",
        }),
        fake({
          id: "b",
          kind: "timestamp",
          subject: "base",
          object: "0517",
          excerpt: "NATO Base, Izmir, Turkey, 0517 Hours",
        }),
      ]),
      true,
    );
  });

  it("projects six-call cost under the design ceiling", () => {
    const projection = projectBreadthSessionCost([400, 400, 400, 400, 400, 400]);
    assert.equal(projection.calls, 6);
    assert.equal(projection.ceiling_usd, V2_REAL_BREADTH_CEILING_USD);
    assert.equal(projection.within_ceiling, true);
    assert.ok(projection.expected_usd < projection.max_usd);
    assert.ok(projection.max_usd <= V2_REAL_BREADTH_CEILING_USD);
  });

  it("does not change the frozen Rule 8 baseline or live gates", () => {
    const metrics = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(metrics.detected, RULE8_V1_FROZEN_BASELINE.detected);
    assert.equal(metrics.not_extracted, RULE8_V1_FROZEN_BASELINE.not_extracted);
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });

  it("does not import a provider in the $0 design path", () => {
    for (const file of ["lock.ts", "fixtures.ts", "selection.ts", "windows.ts", "cost.ts", "official.ts", "index.ts"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /@anthropic-ai\/sdk|from "openai"|createPaidPilotAnthropicProvider/);
    }
  });

  it("does not rewrite the official breadth result", () => {
    assert.equal(ARCHIVIST_V2_REAL_RECKONING_BREADTH_20260925_V1, "archivist_v2_real_reckoning_breadth_20260925_v1");
    assert.equal(REAL_BREADTH_IMPLEMENTATION_SHA, "c55ffe2389cb457bfc806769872595e855ae061e");
    assert.deepEqual(
      REAL_BREADTH_OFFICIAL_CASES.map((item) => item.benchmark_id),
      ["R8-001", "R8-007", "R8-012", "R8-016", "R8-023", "R8-025"],
    );
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.verdict, "MIXED GENERALIZATION");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases, 4);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_denominator, 6);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.true_positives, 6);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.recall, 0.462);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.precision, 0.167);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.evidence_accuracy, 1);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.fabricated_evidence, 0);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.hallucinated, 0);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.quarantined, 31);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.provider_calls, 6);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.repairs, 0);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.input_tokens, 16682);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.output_tokens, 17908);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cost_usd, 0.106222);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-001"], "INSUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-007"], "SUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-012"], "INSUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-016"], "SUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-023"], "SUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-025"], "SUFFICIENT");
    assert.equal(REAL_BREADTH_OFFICIAL_CASES[0]?.failure_category, "MODEL_EXTRACTION / OTHER");
    assert.equal(REAL_BREADTH_OFFICIAL_CASES[2]?.failure_category, "EVIDENCE");
    assert.equal(REAL_BREADTH_PRIOR_REAL_PROSE.detection_sufficient_cases, 1);
    assert.equal(REAL_BREADTH_PRIOR_REAL_PROSE.detection_denominator, 3);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.combined_diagnostic_sufficient, 5);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.combined_diagnostic_denominator, 9);
    assert.notEqual(
      REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases,
      REAL_BREADTH_OFFICIAL_METRICS.combined_diagnostic_sufficient,
    );
    assert.equal(V2_REAL_BREADTH_REMAINING_UNSEEN.length, 15);
    assert.deepEqual([...V2_REAL_BREADTH_REMAINING_UNSEEN], [
      "R8-004",
      "R8-005",
      "R8-006",
      "R8-013",
      "R8-014",
      "R8-015",
      "R8-018",
      "R8-019",
      "R8-020",
      "R8-021",
      "R8-026",
      "R8-027",
      "R8-031",
      "R8-038",
      "R8-042",
    ]);
    for (const id of V2_REAL_BREADTH_REMAINING_UNSEEN) {
      assert.equal(V2_REAL_BREADTH_BENCHMARK_IDS.includes(id as never), false);
    }
    const officialSource = readFileSync(join(ROOT, "official.ts"), "utf8");
    assert.doesNotMatch(officialSource, /He went over the side|numi numi|Chest, right side/);
    assert.doesNotMatch(officialSource, /```json|"raw":/);
  });

  it("scores the saved breadth window artifact when present", () => {
    const path = join(process.cwd(), ".calibration-results", `${V2_REAL_BREADTH_SESSION_ID}.windows.json`);
    if (!existsSync(path)) return;
    const saved = JSON.parse(readFileSync(path, "utf8")) as {
      provider_calls?: number;
      authorized_to_run?: boolean;
      design_only?: boolean;
      overlap_with_prior?: unknown[];
      intra_set_overlap?: unknown[];
      projection?: { max_usd?: number; ceiling_usd?: number; within_ceiling?: boolean };
    };
    assert.equal(saved.provider_calls, 0);
    assert.equal(saved.authorized_to_run, false);
    assert.equal(saved.design_only, true);
    assert.deepEqual(saved.overlap_with_prior, []);
    assert.deepEqual(saved.intra_set_overlap, []);
    assert.equal(saved.projection?.within_ceiling, true);
    assert.ok((saved.projection?.max_usd ?? 99) <= (saved.projection?.ceiling_usd ?? 0));
  });

  it("scores the saved official breadth artifact when present", () => {
    const path = join(process.cwd(), ".calibration-results", `${V2_REAL_BREADTH_SESSION_ID}.json`);
    if (!existsSync(path)) return;
    const saved = JSON.parse(readFileSync(path, "utf8")) as {
      provider_calls?: number;
      repairs?: number;
      total_cost_usd?: number;
      detection_sufficient_cases?: number;
      overall?: { true_positives?: number; fabricated_evidence?: number; evidence_accuracy?: number };
    };
    assert.equal(saved.provider_calls, REAL_BREADTH_OFFICIAL_METRICS.provider_calls);
    assert.equal(saved.repairs, 0);
    assert.equal(saved.detection_sufficient_cases, REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases);
    assert.equal(saved.overall?.true_positives, REAL_BREADTH_OFFICIAL_METRICS.true_positives);
    assert.equal(saved.overall?.fabricated_evidence, 0);
    assert.equal(saved.overall?.evidence_accuracy, 1);
    assert.ok((saved.total_cost_usd ?? 99) <= 0.25);
  });
});
