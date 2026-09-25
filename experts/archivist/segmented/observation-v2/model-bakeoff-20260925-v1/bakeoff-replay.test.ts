import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { RULE8_VERIFIED_CASES } from "@/experts/archivist/benchmarks/reckoning-rule8/fixture.ts";
import { scoreVerifiedCases } from "@/experts/archivist/benchmarks/reckoning-rule8/score.ts";
import { ARCHIVIST_CONSTITUTION } from "../../../constitution.ts";
import { isArchivistLiveExecutionAllowed } from "../../../live-flags.ts";
import { archivistRuntimeDefinition } from "../../../runtime-definition.ts";
import { REAL_BREADTH_OFFICIAL_METRICS } from "../calibration-real-reckoning-breadth-v1/official.ts";
import { REAL_RECKONING_OFFICIAL_METRICS } from "../calibration-real-reckoning-v1/replay.ts";
import { RULE8_V1_FROZEN_BASELINE } from "../constants.ts";
import { V2_EVIDENCE_GATE_VERSION } from "../evidence-contiguity.ts";
import { V2_PHASE2_HELD_OUT_IDS } from "../phase-2/index.ts";
import { PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC } from "../remediation-phase-1/official-locks.ts";
import { replayNineConsumedRealProseCases } from "../remediation-phase-1/replay.ts";
import {
  STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS,
  STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS_WIRED,
  V2_MODEL_BAKEOFF_HISTORICAL,
  V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC,
} from "./official.ts";
import { replaySavedModelBakeoff } from "./replay.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

describe("archivist v2 model bake-off $0 replay", () => {
  it("locks the paid historical bake-off numbers and does not replace them", () => {
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.haiku.detection_sufficient, 0);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.haiku.required_correct, 5);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.haiku.recall, 0.313);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.haiku.evidence_accuracy, 1);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.haiku.cost_usd, 0.042334);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.opus.detection_sufficient, 1);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.opus.required_correct, 9);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.opus.recall, 0.563);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.opus.evidence_accuracy, 1);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.opus.cost_usd, 0.326236);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.combined_cost_usd, 0.36857);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.provider_calls, 8);
    assert.equal(V2_MODEL_BAKEOFF_HISTORICAL.verdict_unrewritten, "HYBRID CANDIDATE");
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.detection_sufficient, 2);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.required_correct, 10);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.recall, 0.625);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.detection_sufficient, 3);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.required_correct, 14);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.recall, 0.875);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.r8016_required_correct, 0);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.r8016_required_correct, 2);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.r8011_cole_learned, false);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.r8011_cole_learned, true);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.r8011_cole_known_numi_numi, false);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.r8011_cole_known_numi_numi, false);
    assert.equal(V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.label, "replay_diagnostic_not_historical");
    assert.equal(STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS, "OPUS_FIRST");
    assert.equal(STORYDNA_EDITORIAL_MODEL_POLICY_HYPOTHESIS_WIRED, false);
  });

  it("replays eight saved outputs at $0 without calling a provider", () => {
    const report = replaySavedModelBakeoff();
    assert.equal(report.provider_calls, 0);
    assert.equal(report.incremental_cost_usd, 0);
    assert.equal(report.historical.haiku.required_correct, 5);
    assert.equal(report.historical.opus.required_correct, 9);
    if (!report.artifact_available) return;
    assert.equal(report.cases.length, 8);
    assert.equal(report.cases.filter((item) => item.arm === "haiku").length, 4);
    assert.equal(report.cases.filter((item) => item.arm === "opus").length, 4);
    const syntheticHaiku = report.cases.find((item) => item.scenario === "synthetic" && item.arm === "haiku");
    const syntheticOpus = report.cases.find((item) => item.scenario === "synthetic" && item.arm === "opus");
    const r8001Haiku = report.cases.find((item) => item.scenario === "R8-001" && item.arm === "haiku");
    const r8001Opus = report.cases.find((item) => item.scenario === "R8-001" && item.arm === "opus");
    assert.equal(syntheticHaiku?.details.clock, true);
    assert.equal(syntheticOpus?.details.clock, true);
    assert.equal(syntheticHaiku?.details.both_compass_states, true);
    assert.equal(syntheticOpus?.details.both_compass_states, true);
    assert.equal(r8001Haiku?.replay_detection, true);
    assert.equal(r8001Opus?.replay_detection, true);
    assert.equal(r8001Haiku?.replay_required_correct, 2);
    assert.equal(r8001Opus?.replay_required_correct, 2);
    const r8016Haiku = report.cases.find((item) => item.scenario === "R8-016" && item.arm === "haiku");
    const r8016Opus = report.cases.find((item) => item.scenario === "R8-016" && item.arm === "opus");
    const r8011Haiku = report.cases.find((item) => item.scenario === "R8-011" && item.arm === "haiku");
    const r8011Opus = report.cases.find((item) => item.scenario === "R8-011" && item.arm === "opus");
    assert.equal(report.haiku.detection_sufficient, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.detection_sufficient);
    assert.equal(report.haiku.required_correct, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.required_correct);
    assert.equal(report.haiku.recall, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.haiku.recall);
    assert.equal(report.opus.detection_sufficient, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.detection_sufficient);
    assert.equal(report.opus.required_correct, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.required_correct);
    assert.equal(report.opus.recall, V2_MODEL_BAKEOFF_REPLAY_DIAGNOSTIC.opus.recall);
    assert.equal(r8016Haiku?.replay_required_correct, 0);
    assert.equal(r8016Opus?.replay_required_correct, 2);
    assert.equal(r8011Haiku?.replay_required_correct, 0);
    assert.equal(r8011Opus?.replay_required_correct, 1);
    assert.ok(r8011Haiku?.missed.includes("r8-011-kn-learn"));
    assert.ok(r8011Haiku?.missed.includes("r8-011-kn-use"));
    assert.ok(r8011Opus?.matched.some((item) => item.expected_id === "r8-011-kn-learn"));
    assert.ok(r8011Opus?.missed.includes("r8-011-kn-use"));
  });

  it("keeps official historical scores, Phase 1 replay diagnostic, and held-out IDs untouched", () => {
    assert.equal(REAL_BREADTH_OFFICIAL_METRICS.detection_sufficient_cases, 4);
    assert.equal(REAL_RECKONING_OFFICIAL_METRICS.verdict, "REAL-PROSE V2 NEEDS REMEDIATION");
    assert.equal(PHASE1_OFFICIAL_COMBINED_DIAGNOSTIC.sufficient, 5);
    assert.equal(scoreVerifiedCases(RULE8_VERIFIED_CASES).detected, 0);
    assert.equal(RULE8_V1_FROZEN_BASELINE.detected, 0);
    const phase1 = replayNineConsumedRealProseCases();
    const available = phase1.cases.filter((item) => item.artifact_available);
    if (available.length > 0) {
      assert.equal(available.filter((item) => item.replay_detection === "SUFFICIENT").length, 7);
    }
    assert.equal(V2_EVIDENCE_GATE_VERSION, "archivist_v2_contiguous_evidence@v1");
    assert.equal(isArchivistLiveExecutionAllowed(), false);
    assert.equal(ARCHIVIST_CONSTITUTION.execution_wired, false);
    assert.equal(archivistRuntimeDefinition().enabled, false);
    assert.equal(ARCHIVIST_CONSTITUTION.studio_selectable, false);
    for (const file of ["official.ts", "replay.ts", "fixtures.ts", "lock.ts", "bakeoff-replay.test.ts"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      for (const id of V2_PHASE2_HELD_OUT_IDS) {
        assert.equal(source.includes(id), false, `${file} selected ${id}`);
      }
    }
    for (const file of ["official.ts", "replay.ts", "fixtures.ts", "lock.ts"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      assert.doesNotMatch(source, /createPaidPilotAnthropicProvider|@anthropic-ai\/sdk|from "openai"/);
    }
  });
});
