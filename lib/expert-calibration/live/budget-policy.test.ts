import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "../cost-analysis.ts";
import {
  deriveAuthorizedOutputTokenPolicy,
  validateAuthorizedTokenPolicy,
  LIVE_CALIBRATION_OUTPUT_TOKEN_SAFETY_BPS,
} from "./budget-policy.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS } from "./constants.ts";
import { serializeUsd, sumSerializedUsd } from "./budget-controller.ts";
import { LiveCalibrationError } from "./errors.ts";
import type { LiveCalibrationCliArgs } from "./contracts.ts";

function smokeArgs(overrides: Partial<LiveCalibrationCliArgs> = {}): LiveCalibrationCliArgs {
  return Object.freeze({
    mode: "dry-run",
    expert: "military_expert",
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1",
    provider: "anthropic",
    model: "haiku-4-5-v1",
    runs: 1,
    maxCalls: 3,
    maxTotalCostUsd: 0.08,
    maxCostPerCallUsd: 0.03,
    maxInputTokens: 50_000,
    maxOutputTokens: LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS,
    timeoutMs: 120_000,
    maxRuntimeMs: 600_000,
    outputDir: ".calibration-results/test",
    overwrite: false,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
    ...overrides,
  });
}

describe("Live calibration budget policy", () => {
  it("derives bounded provider output tokens from pricing ceilings", () => {
    const policy = deriveAuthorizedOutputTokenPolicy({
      maxCostPerCallUsd: 0.03,
      maxTotalCostUsd: 0.08,
      plannedCallCount: 3,
      plannedInputTokensPerCall: 3114,
      pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
      cliMaxOutputTokens: 50_000,
    });

    assert.ok(policy.providerMaxOutputTokens <= 4_500);
    assert.ok(policy.providerMaxOutputTokens >= 512);
    assert.equal(policy.policyVersion, "live_calibration_output_tokens@v2");
  });

  it("keeps expected and authorized worst-case costs distinct", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: {
        provider: "anthropic",
        modelId: "claude-haiku-4-5-20251001",
        modelAlias: "haiku-4-5-v1",
        pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
      },
      correlationPrefix: "budget-test",
    });

    assert.ok(plan.totalEstimatedCostUsd > 0);
    assert.ok(plan.totalAuthorizedWorstCaseCostUsd > plan.totalEstimatedCostUsd);
    for (const call of plan.calls) {
      assert.ok(call.authorizedWorstCaseCostUsd > call.estimatedCostUsd);
      assert.equal(call.providerMaxOutputTokens, plan.providerMaxOutputTokens);
    }
  });

  it("keeps three-call authorized worst case within $0.08 and per-call within $0.03", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: {
        provider: "anthropic",
        modelId: "claude-haiku-4-5-20251001",
        modelAlias: "haiku-4-5-v1",
        pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
      },
      correlationPrefix: "ceiling-test",
    });

    assert.ok(plan.totalAuthorizedWorstCaseCostUsd <= 0.08);
    for (const call of plan.calls) {
      assert.ok(call.authorizedWorstCaseCostUsd <= 0.03);
    }
  });

  it("fails closed when CLI max output tokens cannot fit per-call ceiling", () => {
    assert.throws(
      () =>
        validateAuthorizedTokenPolicy({
          policy: deriveAuthorizedOutputTokenPolicy({
            maxCostPerCallUsd: 0.001,
            maxTotalCostUsd: 0.002,
            plannedCallCount: 3,
            plannedInputTokensPerCall: 3114,
            pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
            cliMaxOutputTokens: 50_000,
          }),
          maxCostPerCallUsd: 0.001,
          maxTotalCostUsd: 0.002,
          plannedCallCount: 3,
        }),
      LiveCalibrationError,
    );
  });

  it("serializes USD deterministically via micro-USD round trip", () => {
    const amounts = [0.0156, 0.0249, 0.0173];
    const total = sumSerializedUsd(amounts);
    assert.equal(typeof total, "number");
    assert.equal(serializeUsd(total), total);
  });

  it("documents safety margin in derivation notes", () => {
    const policy = deriveAuthorizedOutputTokenPolicy({
      maxCostPerCallUsd: 0.03,
      maxTotalCostUsd: 0.08,
      plannedCallCount: 3,
      plannedInputTokensPerCall: 3114,
      pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
      cliMaxOutputTokens: LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS,
    });
    assert.ok(
      policy.derivationNotes.some((note) => note.includes(String(LIVE_CALIBRATION_OUTPUT_TOKEN_SAFETY_BPS))),
    );
  });
});
