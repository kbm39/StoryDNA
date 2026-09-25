import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { adaptV2ProviderOutput } from "../adapter.ts";
import { V2_REAL_BREADTH_REMAINING_UNSEEN } from "../calibration-real-reckoning-breadth-v1/selection.ts";
import {
  REAL_BREADTH_OFFICIAL_CASES,
  REAL_BREADTH_OFFICIAL_METRICS,
} from "../calibration-real-reckoning-breadth-v1/official.ts";
import { scoreVerifiedCases } from "@/experts/archivist/benchmarks/reckoning-rule8/score.ts";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { RULE8_V1_FROZEN_BASELINE } from "../constants.ts";
import { V2_EVIDENCE_GATE_VERSION } from "../evidence-contiguity.ts";
import { buildV2ObservationSystemPrompt } from "../prompt.ts";
import { V2_EXTRACTION_PROMPT_VERSION } from "../prompt.ts";
import {
  PHASE1_OFFICIAL_BREADTH,
  PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC,
  PHASE1_OFFICIAL_PRIOR_REAL_PROSE,
  PHASE1_OFFICIAL_SYNTHETIC,
  PHASE1_R8007_OUT_OF_WINDOW_EXCERPT,
  PHASE1_R8010_MISSILE_STITCH_EXCERPT,
  PHASE1_R8012_DAUGHTER_STITCH_EXCERPT,
  PHASE1_R8012_VALID_SEGMENT,
  PHASE1_R8025_LONG_TRAVEL_EXCERPT,
  V2_REMEDIATION_PHASE1_CONSUMED_IDS,
  V2_REMEDIATION_PHASE1_EVIDENCE_GATE_CHANGED,
  V2_REMEDIATION_PHASE1_HELD_OUT_IDS,
  V2_REMEDIATION_PHASE1_IMPLEMENTATION_SHA,
  V2_REMEDIATION_PHASE1_PROMPT_CHANGED,
  V2_REMEDIATION_PHASE1_PROVIDER_CALLS,
  V2_REMEDIATION_PHASE1_SUFFICIENT_NONREGRESSION_IDS,
  officialR8007TruePositives,
  officialR8023IdentitiesUnmerged,
  phase1R8007OutOfWindowDocument,
  phase1R8010MissileStitchDocument,
  phase1R8010UsedValidDocument,
  phase1R8012DaughterStitchDocument,
  phase1R8012DaughterValidDocument,
  phase1R8025LongTravelDocument,
  phase1ReplaySelectionIds,
  PHASE1_R8007_WINDOW_SEGMENT,
  PHASE1_R8010_VALID_SEGMENT,
  replayNineConsumedRealProseCases,
} from "./index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

const SYNTHETIC_TRAVEL_SEGMENT = [
  "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. The brass compass was in Lena's jacket.",
  "Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.",
].join(" ");

const HELD_OUT_SCAN_FILES = [
  "lock.ts",
  "fixtures.ts",
  "official-locks.ts",
  "replay.ts",
  "index.ts",
];

describe("v2 remediaiton phase 1", () => {
  it("locks official historical scores and does not replace 4/6 with 5/9", () => {
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases, PHASE1_OFFICIAL_BREADTH.detection_sufficient_cases);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_denominator, 6);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.verdict, "MIXED GENERALIZATION");
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cost_usd, 0.106222);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.provider_calls, 6);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.input_tokens, 16682);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.output_tokens, 17908);
    assert.equal(PHASE1_OFFICIAL_PRIOR_REAL_PROSE.detection_sufficient_cases, 1);
    assert.equal(PHASE1_OFFICIAL_PRIOR_REAL_PROSE.detection_denominator, 3);
    assert.equal(PHASE1_OFFICIAL_PRIOR_REAL_PROSE.verdict, "REAL-PROSE V2 NEEDS REMEDIATION");
    assert.equal(PHASE1_OFFICIAL_PRIOR_REAL_PROSE.cost_usd, 0.048356);
    assert.equal(PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.sufficient, 5);
    assert.equal(PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.denominator, 9);
    assert.notEqual(PHASE1_OFFICIAL_BREADTH.detection_sufficient_cases, PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.sufficient);
    assert.equal(officialR8007TruePositives(), 0);
    assert.equal(officialR8023IdentitiesUnmerged(), true);
    assert.equal(V2_REMEDIATION_PHASE1_IMPLEMENTATION_SHA, "c55ffe2389cb457bfc806769872595e855ae061e");
    const rule8 = scoreVerifiedCases(RULE8_VERIFIED_CASES);
    assert.equal(rule8.detected, RULE8_V1_FROZEN_BASELINE.detected);
    assert.equal(rule8.total_verified_defects, 24);
    assert.equal(rule8.end_to_end_recall, 0);
    assert.equal(PHASE1_OFFICIAL_SYNTHETIC.v2_verdict, "C. INCONCLUSIVE");
    assert.equal(PHASE1_OFFICIAL_SYNTHETIC.v3_verdict, "V2/HAIKU NOT READY");
    assert.equal(PHASE1_OFFICIAL_SYNTHETIC.v1_true_positives, 10);
    assert.equal(PHASE1_OFFICIAL_SYNTHETIC.v3_true_positives, 16);
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-001"], "INSUFFICIENT");
  });

  it("keeps official R8-001 insufficient / 0 retained / invalid_json", () => {
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-001"], "INSUFFICIENT");
    const row = REAL_BREADTH_OFFICIAL_CASES.find((item) => item.benchmark_id === "R8-001");
    assert.equal(row?.detection, "INSUFFICIENT");
    assert.equal(row?.failure_category, "MODEL_EXTRACTION / OTHER");
    assert.equal(row?.finish_reason, "max_tokens");
  });

  it("does not change the V2 prompt or evidence gate in Phase 1", () => {
    assert.equal(V2_REMEDIATION_PHASE1_PROMPT_CHANGED, false);
    assert.equal(V2_REMEDIATION_PHASE1_EVIDENCE_GATE_CHANGED, false);
    assert.equal(V2_EXTRACTION_PROMPT_VERSION, "archivist_v2_extraction_prompt@v1");
    assert.equal(V2_EVIDENCE_GATE_VERSION, "archivist_v2_contiguous_evidence@v1");
    assert.match(buildV2ObservationSystemPrompt(), /Do not stitch sentences across intervening prose/);
  });

  it("locks B0 official stitch/out-of-window fixtures without rewriting excerpts", () => {
    const daughterStitch = adaptV2ProviderOutput(phase1R8012DaughterStitchDocument(), "seg-phase1-r8-012-stitch", {
      segmentText: PHASE1_R8012_VALID_SEGMENT,
    });
    assert.equal(daughterStitch.ok, true);
    assert.equal(daughterStitch.retained.length, 0);
    const daughterQ = daughterStitch.quarantined.find((item) => item.reason === "non_contiguous_evidence");
    assert.ok(daughterQ);
    assert.equal(daughterQ?.excerpt, PHASE1_R8012_DAUGHTER_STITCH_EXCERPT);

    const daughterOk = adaptV2ProviderOutput(phase1R8012DaughterValidDocument(), "seg-phase1-r8-012-valid", {
      segmentText: PHASE1_R8012_VALID_SEGMENT,
    });
    assert.equal(daughterOk.retained.length, 1);
    assert.equal(daughterOk.retained[0]?.kind, "relationship");
    assert.equal(daughterOk.retained[0]?.evidence.excerpt, "Lior had a daughter.");

    const missileStitch = adaptV2ProviderOutput(phase1R8010MissileStitchDocument(), "seg-phase1-r8-010-stitch", {
      segmentText: PHASE1_R8010_VALID_SEGMENT,
    });
    assert.equal(missileStitch.retained.length, 0);
    assert.ok(missileStitch.quarantined.some((item) => item.reason === "non_contiguous_evidence"));
    assert.equal(
      missileStitch.quarantined.find((item) => item.reason === "non_contiguous_evidence")?.excerpt,
      PHASE1_R8010_MISSILE_STITCH_EXCERPT,
    );

    const usedOk = adaptV2ProviderOutput(phase1R8010UsedValidDocument(), "seg-phase1-r8-010-valid", {
      segmentText: PHASE1_R8010_VALID_SEGMENT,
    });
    assert.equal(usedOk.retained.length, 1);
    assert.equal(usedOk.retained[0]?.kind, "operational_capability");
    assert.equal((usedOk.retained[0]?.payload as { state?: string }).state, "used");

    const longTravel = adaptV2ProviderOutput(phase1R8025LongTravelDocument(), "seg-phase1-r8-025-long");
    assert.equal(longTravel.retained.length, 0);
    assert.ok(longTravel.quarantined.some((item) => item.reason === "invalid_evidence"));
    assert.equal(
      longTravel.quarantined.find((item) => item.reason === "invalid_evidence")?.excerpt,
      PHASE1_R8025_LONG_TRAVEL_EXCERPT,
    );

    const outOfWindow = adaptV2ProviderOutput(phase1R8007OutOfWindowDocument(), "seg-phase1-r8-007-window", {
      segmentText: PHASE1_R8007_WINDOW_SEGMENT,
    });
    assert.equal(outOfWindow.retained.length, 0);
    const unverified = outOfWindow.quarantined.find((item) => item.reason === "non_contiguous_evidence");
    assert.ok(unverified);
    assert.equal(unverified?.excerpt, PHASE1_R8007_OUT_OF_WINDOW_EXCERPT);
    assert.equal(unverified?.evidence_status, "unverified");

    const syntheticTravel = adaptV2ProviderOutput(
      {
        schema: "archivist_segment_observation@v2",
        segment_id: "seg-v2-cal2-b",
        observations: [
          {
            observation_id: "obs-travel",
            kind: "travel_leg",
            traveler: "Lena",
            origin: "Ankara",
            destination: "Izmir",
            mode: "Sikorsky",
            proposition: {
              subject: "Lena",
              predicate: "traveled",
              object: "Ankara to Izmir",
              polarity: "true",
              source_kind: "narration",
            },
            locator: "CHAPTER CAL2-B",
            excerpt:
              "At 05:17, Lena left Ankara aboard the Sikorsky with her sister Noor. Forty minutes later, at 05:57, Lena arrived in Izmir aboard the Sikorsky.",
            source_segment: "seg-v2-cal2-b",
            confidence: "high",
            inferred: false,
          },
        ],
      },
      "seg-v2-cal2-b",
      { segmentText: SYNTHETIC_TRAVEL_SEGMENT },
    );
    assert.equal(syntheticTravel.retained.length, 0);
    assert.ok(syntheticTravel.quarantined.some((item) => item.reason === "non_contiguous_evidence"));
  });

  it("locks the exact 15 held-out IDs and keeps them out of Phase 1 fixtures, replay, and the model-facing prompt", () => {
    assert.deepEqual([...V2_REMEDIATION_PHASE1_HELD_OUT_IDS], [...V2_REAL_BREADTH_REMAINING_UNSEEN]);
    assert.equal(V2_REMEDIATION_PHASE1_HELD_OUT_IDS.length, 15);
    for (const id of V2_REMEDIATION_PHASE1_HELD_OUT_IDS) {
      assert.equal(V2_REMEDIATION_PHASE1_CONSUMED_IDS.includes(id as never), false);
    }
    assert.deepEqual([...phase1ReplaySelectionIds()], [...V2_REMEDIATION_PHASE1_CONSUMED_IDS]);
    const prompt = buildV2ObservationSystemPrompt();
    for (const id of V2_REMEDIATION_PHASE1_HELD_OUT_IDS) {
      assert.equal(prompt.includes(id), false, `prompt leaked ${id}`);
    }
    const fixtureSource = readFileSync(join(ROOT, "fixtures.ts"), "utf8");
    const replaySource = readFileSync(join(ROOT, "replay.ts"), "utf8");
    for (const id of V2_REMEDIATION_PHASE1_HELD_OUT_IDS) {
      assert.equal(fixtureSource.includes(id), false, `fixture selected ${id}`);
      assert.equal(replaySource.includes(`"${id}"`), false, `replay selected ${id}`);
    }
    for (const file of HELD_OUT_SCAN_FILES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /extractAuthorized|loadPinnedReckoning|side_a\.excerpt/);
      assert.doesNotMatch(source, /createPaidPilotAnthropicProvider|@anthropic-ai\/sdk|from "openai"/);
    }
  });

  it("replays the nine consumed cases at $0 without regressing official sufficient detections", () => {
    assert.equal(V2_REMEDIATION_PHASE1_PROVIDER_CALLS, 0);
    const report = replayNineConsumedRealProseCases();
    assert.equal(report.provider_calls, 0);
    assert.equal(report.incremental_cost_usd, 0);
    assert.equal(report.official_breadth_unrewritten, "MIXED GENERALIZATION");
    assert.equal(report.official_prior_unrewritten, "REAL-PROSE V2 NEEDS REMEDIATION");
    assert.deepEqual(
      report.cases.map((item) => item.benchmark_id),
      [...V2_REMEDIATION_PHASE1_CONSUMED_IDS],
    );
    const available = report.cases.filter((item) => item.artifact_available);
    if (available.length === 0) return;
    for (const id of V2_REMEDIATION_PHASE1_SUFFICIENT_NONREGRESSION_IDS) {
      const row = available.find((item) => item.benchmark_id === id);
      if (!row) continue;
      assert.equal(row.official_detection, "SUFFICIENT");
      assert.equal(row.replay_detection, "SUFFICIENT", `${id} lost detection sufficiency`);
      assert.notEqual(row.change, "regressed");
    }
    const r8001 = report.cases.find((item) => item.benchmark_id === "R8-001");
    assert.ok(r8001);
    if (r8001.artifact_available) {
      assert.equal(r8001.official_detection, "INSUFFICIENT");
      assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-001"], "INSUFFICIENT");
      assert.equal(r8001.complete_objects_recovered, 20);
      assert.equal(r8001.truncation_recovery_method, "truncated_prefix_recovery");
      assert.equal(r8001.replay_detection, "SUFFICIENT");
      assert.equal(report.replay_r8_001.required_0210_confirmation_grade, true);
      assert.equal(report.replay_r8_001.required_214_confirmation_grade, true);
      const findClock = (needle: string) =>
        report.replay_r8_001.timestamp_evidence.find((item) =>
          item.clock.toLowerCase().includes(needle.toLowerCase()),
        );
      assert.equal(findClock("02:10")?.evidence_match_method, "exact");
      assert.equal(findClock("2:14")?.evidence_match_method, "unicode_punctuation_equivalent");
      assert.equal(findClock("2:31")?.evidence_match_method, "exact");
      assert.equal(findClock("four minutes")?.evidence_match_method, "exact");
    }
    const r8012 = report.cases.find((item) => item.benchmark_id === "R8-012");
    if (r8012?.artifact_available) {
      assert.equal(r8012.official_detection, "INSUFFICIENT");
      assert.equal(REAL_BREADTH_OFFICIAL_METRICS.cases["R8-012"], "INSUFFICIENT");
      assert.equal(r8012.replay_detection, "SUFFICIENT");
    }
    const replaySufficient = available.filter((item) => item.replay_detection === "SUFFICIENT").length;
    assert.equal(replaySufficient, 7);
    assert.notEqual(replaySufficient, REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases);
    assert.notEqual(replaySufficient, PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.sufficient);
    const r8010 = report.cases.find((item) => item.benchmark_id === "R8-010");
    if (r8010?.artifact_available) {
      assert.equal(r8010.official_detection, "INSUFFICIENT");
      assert.equal(r8010.replay_detection, "INSUFFICIENT");
    }
    const r8011 = report.cases.find((item) => item.benchmark_id === "R8-011");
    if (r8011?.artifact_available) {
      assert.equal(r8011.replay_detection, "INSUFFICIENT");
    }
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
  });
});

