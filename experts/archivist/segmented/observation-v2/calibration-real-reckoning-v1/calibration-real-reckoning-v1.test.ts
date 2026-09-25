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
import { buildV2ObservationSystemPrompt, buildV2ObservationUserPrompt } from "../prompt.ts";
import {
  REAL_RECKONING_OFFICIAL_METRICS,
  V2_REAL_CAL_R8010_ANCHORS,
  V2_REAL_CAL_R8010_EXPECTED,
  V2_REAL_CAL_R8011_ANCHORS,
  V2_REAL_CAL_R8011_EXPECTED,
  V2_REAL_CAL_R8029_ANCHORS,
  V2_REAL_CAL_R8029_EXPECTED,
  V2_REAL_RECKONING_CAL_V1_AUTHORIZED_TO_RUN,
  V2_REAL_RECKONING_CAL_V1_BENCHMARK,
  V2_REAL_RECKONING_CAL_V1_BENCHMARK_IDS,
  V2_REAL_RECKONING_CAL_V1_CONTENT_HASH,
  V2_REAL_RECKONING_CAL_V1_MANUSCRIPT_ID,
  V2_REAL_RECKONING_CAL_V1_MAX_PRIMARY_CALLS,
  V2_REAL_RECKONING_CAL_V1_MAX_REPAIR_CALLS,
  V2_REAL_RECKONING_CAL_V1_MODEL,
  V2_REAL_RECKONING_CAL_V1_SESSION_ID,
  V2_REAL_RECKONING_CAL_V1_WIRED_TO_PAID_PATH,
  extractAuthorizedRealReckoningWindows,
  leakageHitsInPrompt,
  r8010ExtractionPasses,
  r8011ExtractionPasses,
  r8029ExtractionPasses,
  realCalRequiredKinds,
  replaySavedRealReckoningCalibration,
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

describe("archivist v2 real-Reckoning calibration 20260925-v1", () => {
  it("freezes an isolated three-call session and stays unwired", () => {
    assert.equal(V2_REAL_RECKONING_CAL_V1_SESSION_ID, "archivist-v2-real-reckoning-cal-20260925-v1");
    assert.equal(V2_REAL_RECKONING_CAL_V1_MODEL, "claude-haiku-4-5-20251001");
    assert.equal(V2_REAL_RECKONING_CAL_V1_MAX_PRIMARY_CALLS, 3);
    assert.equal(V2_REAL_RECKONING_CAL_V1_MAX_REPAIR_CALLS, 0);
    assert.equal(V2_REAL_RECKONING_CAL_V1_AUTHORIZED_TO_RUN, true);
    assert.equal(V2_REAL_RECKONING_CAL_V1_WIRED_TO_PAID_PATH, false);
    assert.equal(V2_REAL_RECKONING_CAL_V1_BENCHMARK, "archivist_reckoning_rule8_benchmark@v1");
    assert.deepEqual([...V2_REAL_RECKONING_CAL_V1_BENCHMARK_IDS], ["R8-010", "R8-011", "R8-029"]);
    assert.equal(V2_REAL_RECKONING_CAL_V1_MANUSCRIPT_ID, "9478ddf1-4564-4019-96a4-0d1852ee56f9");
    assert.equal(
      V2_REAL_RECKONING_CAL_V1_CONTENT_HASH,
      "d1e3fb40bb864399c1459414e5286e7d3806740dd0788343c298620676602a8f",
    );
  });

  it("freezes expected keys from Rule 8 excerpts before any provider call", () => {
    const r8010 = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === "R8-010");
    const r8011 = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === "R8-011");
    const r8029 = RULE8_VERIFIED_CASES.find((item) => item.benchmark_id === "R8-029");
    assert.ok(r8010 && r8011 && r8029);
    assert.equal(V2_REAL_CAL_R8010_ANCHORS.side_a_excerpt, r8010.side_a.excerpt);
    assert.equal(V2_REAL_CAL_R8011_ANCHORS.side_a_excerpt, r8011.side_a.excerpt);
    assert.equal(V2_REAL_CAL_R8029_ANCHORS.side_b_excerpt.includes("third rib"), true);
    assert.deepEqual(
      assertExpectedKeysCoverKinds(V2_REAL_CAL_R8010_EXPECTED, realCalRequiredKinds("seg-v2-real-r8-010")),
      [],
    );
    assert.deepEqual(
      assertExpectedKeysCoverKinds(V2_REAL_CAL_R8011_EXPECTED, realCalRequiredKinds("seg-v2-real-r8-011")),
      [],
    );
    assert.deepEqual(
      assertExpectedKeysCoverKinds(V2_REAL_CAL_R8029_EXPECTED, realCalRequiredKinds("seg-v2-real-r8-029")),
      [],
    );
    assert.equal(
      V2_REAL_CAL_R8029_EXPECTED.some((item) => item.object_tokens.includes("left")),
      false,
    );
  });

  it("extracts smallest windows from pinned-like manuscript text without sending whole chapters", () => {
    const manuscript = [
      "CHAPTER TWELVE",
      "Ari said the compound plan out loud.",
      V2_REAL_CAL_R8010_ANCHORS.side_a_excerpt,
      "He folded the map.",
      "CHAPTER THIRTEEN",
      "Unrelated chapter text that must not be sent.",
      "CHAPTER FOURTEEN",
      "Hank checked the drone feed.",
      V2_REAL_CAL_R8010_ANCHORS.side_b_excerpt,
      "The vehicle stopped.",
      "CHAPTER TEN",
      V2_REAL_CAL_R8011_ANCHORS.side_a_excerpt,
      "CHAPTER ELEVEN",
      "Ari looked at Cole.",
      V2_REAL_CAL_R8011_ANCHORS.side_b_excerpt,
      "CHAPTER TWENTY-FOUR",
      V2_REAL_CAL_R8029_ANCHORS.side_a_excerpt,
      "CHAPTER TWENTY-SIX",
      V2_REAL_CAL_R8029_ANCHORS.side_b_excerpt,
    ].join("\n");
    const windows = extractAuthorizedRealReckoningWindows(manuscript);
    assert.equal(windows.r8010.prose.includes("CHAPTER THIRTEEN"), false);
    assert.equal(windows.r8010.prose.includes("Unrelated chapter"), false);
    assert.equal(windows.r8010.prose.includes("No air cover"), true);
    assert.equal(windows.r8010.prose.includes("Engaging"), true);
    assert.equal(windows.r8011.prose.includes("numi numi"), true);
    assert.equal(windows.r8029.prose.includes("Chest, right side"), true);
    assert.ok(windows.r8010.word_count < 400);
  });

  it("does not leak Rule 8 diagnosis into the user prompt", () => {
    const user = buildV2ObservationUserPrompt({
      segmentId: "seg-v2-real-r8-010",
      segmentText: "CHAPTER TWELVE\n\nAri said something ordinary.",
    });
    assert.deepEqual(leakageHitsInPrompt(user), []);
    assert.doesNotMatch(user, /Rule 8|R8-010|this is inconsistent|expected contradiction/);
    const system = buildV2ObservationSystemPrompt();
    assert.doesNotMatch(system, /Rule 8|R8-010|this is inconsistent|expected contradiction/);
    assert.match(system, /laterality='unspecified'/);
  });

  it("treats case success as the required reasoning pair, not contradiction classification", () => {
    assert.equal(
      r8010ExtractionPasses([
        fake({
          id: "a",
          kind: "statement",
          subject: "Ari",
          object: "air cover unavailable",
          excerpt: "No air cover. No strike package.",
        }),
        fake({
          id: "b",
          kind: "event",
          subject: "Hank",
          object: "two missiles",
          excerpt: "I have two missiles. Engaging.",
        }),
      ]),
      true,
    );
    assert.equal(
      r8011ExtractionPasses([
        fake({
          id: "a",
          kind: "knowledge",
          subject: "Cole",
          object: "numi numi",
          excerpt: "numi numi",
          payload: { knowledge_state: "known" },
        }),
        fake({
          id: "b",
          kind: "knowledge",
          subject: "Cole",
          object: "lullaby",
          excerpt: "Our mother sang it to her",
          payload: { knowledge_state: "learned" },
        }),
      ]),
      true,
    );
    assert.equal(
      r8029ExtractionPasses([
        fake({
          id: "a",
          kind: "injury",
          subject: "Cole",
          object: "right chest",
          excerpt: "Chest, right side",
          payload: { laterality: "right", body_region: "chest" },
        }),
        fake({
          id: "b",
          kind: "injury",
          subject: "Cole",
          object: "third rib",
          excerpt: "fracture line on your third rib, the one from the basement",
          payload: { laterality: "unspecified", body_region: "rib" },
        }),
      ]),
      true,
    );
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

  it("does not import a provider in the $0 fixture path", () => {
    for (const file of ["lock.ts", "fixtures.ts", "index.ts", "windows.ts", "replay.ts"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /@anthropic-ai\/sdk|from "openai"|createPaidPilotAnthropicProvider/);
    }
  });

  it("scores the saved real-Reckoning artifact when present", () => {
    const path = join(process.cwd(), ".calibration-results", `${V2_REAL_RECKONING_CAL_V1_SESSION_ID}.json`);
    if (!existsSync(path)) return;
    const saved = JSON.parse(readFileSync(path, "utf8")) as {
      provider_calls?: number;
      repairs?: number;
      overall?: { fabricated_evidence?: number; evidence_accuracy?: number; true_positives?: number };
      answer_key_frozen_before_provider?: boolean;
      raw?: { r8010?: string; r8011?: string; r8029?: string };
    };
    assert.ok((saved.provider_calls ?? 99) <= 3);
    assert.equal(saved.repairs, 0);
    assert.equal(saved.answer_key_frozen_before_provider, true);
    assert.equal(saved.overall?.fabricated_evidence, 0);
    assert.equal(saved.overall?.evidence_accuracy, 1);
    assert.equal(saved.overall?.true_positives, REAL_RECKONING_OFFICIAL_METRICS.true_positives);
    assert.equal(typeof saved.raw?.r8010, "string");
    const report = replaySavedRealReckoningCalibration({
      r8010: saved.raw!.r8010!,
      r8011: saved.raw!.r8011!,
      r8029: saved.raw!.r8029!,
    });
    assert.equal(report.provider_calls, 0);
    assert.equal(report.official.true_positives, 3);
    assert.equal(report.official_verdict_unrewritten, "REAL-PROSE V2 NEEDS REMEDIATION");
    assert.equal(report.overall.fabricated_evidence, 0);
    assert.equal(report.overall.evidence_accuracy, 1);
    assert.equal(report.detection.r8029, true);
    assert.equal(report.r8029.injuries.some((item) => item.laterality === "right"), true);
    assert.equal(report.r8029.injuries.some((item) => item.laterality === "unspecified"), true);
  });
});
