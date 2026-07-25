import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { LIVE_CALIBRATION_DEFAULTS } from "./constants.ts";
import { executeDryRun } from "./dry-run-executor.ts";
import { serializeUsd, sumSerializedUsd, usdToMicroUsd } from "./budget-controller.ts";
import { resolveProviderSpec } from "./provider-allowlist.ts";
import { ANTHROPIC_HAIKU_45_ALIAS } from "./model-lifecycle.ts";
import { estimateTokenCost, CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "../cost-analysis.ts";
import { LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE, LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE } from "./constants.ts";

function smokeArgs() {
  return Object.freeze({
    mode: "dry-run" as const,
    expert: "military_expert" as const,
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1" as const,
    provider: "anthropic" as const,
    model: ANTHROPIC_HAIKU_45_ALIAS,
    runs: 1,
    maxCalls: 3,
    ...LIVE_CALIBRATION_DEFAULTS,
    outputDir: ".calibration-results/test-cost-serialization",
    overwrite: true,
  });
}

describe("deterministic USD cost serialization", () => {
  it("1 per-call Haiku 4.5 estimate serializes to 0.0156", () => {
    const raw = estimateTokenCost(
      LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE,
      LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE,
      CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
    );
    assert.equal(serializeUsd(raw), 0.0156);
  });

  it("2 three-call total serializes to 0.0468", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
      correlationPrefix: "cost-ser",
    });
    assert.equal(plan.totalEstimatedCostUsd, 0.0468);
    assert.equal(sumSerializedUsd(plan.calls.map((c) => c.estimatedCostUsd)), 0.0468);
  });

  it("3 JSON output contains no floating-point noise", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
      correlationPrefix: "cost-ser",
    });
    const json = JSON.stringify({ estimated_cost_usd: plan.totalEstimatedCostUsd });
    assert.equal(json, '{"estimated_cost_usd":0.0468}');
  });

  it("4 micro-USD total for smoke plan is 46800", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
      correlationPrefix: "cost-ser",
    });
    assert.equal(usdToMicroUsd(plan.totalEstimatedCostUsd), 46_800);
  });

  it("5 dry-run manifest serializes cost deterministically", async () => {
    const args = smokeArgs();
    const callPlan = buildLiveCalibrationCallPlan({
      args,
      providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
      correlationPrefix: "cost-ser",
    });
    const result = await executeDryRun({
      args,
      callPlan,
      runId: "cost-ser-run",
      correlationId: "cost-ser-corr",
      startedAt: Date.now(),
      writeArtifacts: false,
    });
    assert.equal(result.manifest.estimated_cost_usd, 0.0468);
    const manifestJson = JSON.stringify(result.manifest);
    assert.match(manifestJson, /"estimated_cost_usd":0\.0468/);
    assert.doesNotMatch(manifestJson, /999999999994/);
  });
});
