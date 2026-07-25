import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBudgetController,
  createBudgetControllerFromTokenLimits,
  usdToMicroUsd,
} from "./budget-controller.ts";
import {
  LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION,
  resolveTokenBudgetFromCliArgs,
  resolveTokenBudgetLimits,
} from "./token-budget.ts";
import { LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS } from "./constants.ts";
import { LiveCalibrationError } from "./errors.ts";
import type { LiveCalibrationCliArgs } from "./contracts.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "../cost-analysis.ts";

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

describe("Live calibration token budget v2", () => {
  it("treats --max-output-tokens as provider per-call cap", () => {
    const limits = resolveTokenBudgetLimits({
      maxOutputTokens: 4096,
      maxInputTokens: 50_000,
      maxCalls: 3,
    });
    assert.equal(limits.providerMaxOutputTokensPerCall, 4096);
    assert.equal(limits.policyVersion, LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION);
  });

  it("derives cumulative run ceiling as provider cap × max calls", () => {
    const limits = resolveTokenBudgetLimits({
      maxOutputTokens: 4096,
      maxInputTokens: 50_000,
      maxCalls: 3,
    });
    assert.equal(limits.runMaxOutputTokens, 12_288);
  });

  it("accepts explicit --max-run-output-tokens when sufficient", () => {
    const limits = resolveTokenBudgetLimits({
      maxOutputTokens: 4096,
      maxRunOutputTokens: 15_000,
      maxInputTokens: 50_000,
      maxCalls: 3,
    });
    assert.equal(limits.runMaxOutputTokens, 15_000);
  });

  it("rejects cumulative ceiling below per-call cap", () => {
    assert.throws(
      () =>
        resolveTokenBudgetLimits({
          maxOutputTokens: 4096,
          maxRunOutputTokens: 2048,
          maxInputTokens: 50_000,
          maxCalls: 3,
        }),
      LiveCalibrationError,
    );
  });

  it("rejects cumulative ceiling insufficient for all planned calls", () => {
    assert.throws(
      () =>
        resolveTokenBudgetLimits({
          maxOutputTokens: 4096,
          maxRunOutputTokens: 8192,
          maxInputTokens: 50_000,
          maxCalls: 3,
        }),
      (error: LiveCalibrationError) => error.code === "invalid_configuration",
    );
  });

  it("regression: 2175 + 4096 must not budget_exhaust after call 1 in three-call smoke", () => {
    const tokenLimits = resolveTokenBudgetFromCliArgs(
      smokeArgs({ maxOutputTokens: 4096, maxCalls: 3 }),
    );
    const budget = createBudgetControllerFromTokenLimits({
      maxCalls: 3,
      maxTotalCostUsd: 0.08,
      maxCostPerCallUsd: 0.03,
      tokenLimits,
    });

    budget.recordCall(0.014, 3114, 2175);

    const canAffordCall2 = budget.canAffordCall(0.0243, 3824, 4096);
    assert.equal(canAffordCall2, true, "2175 + 4096 <= 12288 must not budget_exhaust");

    budget.recordCall(0.014, 3824, 2500);
    const canAffordCall3 = budget.canAffordCall(0.0243, 3824, 4096);
    assert.equal(canAffordCall3, true);
  });

  it("blocks when genuine cumulative output-token exhaustion would occur", () => {
    const budget = createBudgetController({
      maxCalls: 3,
      maxTotalCostUsd: 1,
      maxCostPerCallUsd: 0.5,
      runMaxInputTokens: 50_000,
      runMaxOutputTokens: 5000,
      providerMaxOutputTokensPerCall: 4096,
    });
    budget.recordCall(0.01, 1000, 4500);
    assert.equal(budget.canAffordCall(0.01, 1000, 4096), false);
  });

  it("rejects per-call authorized output above provider cap", () => {
    const budget = createBudgetController({
      maxCalls: 3,
      maxTotalCostUsd: 1,
      maxCostPerCallUsd: 0.5,
      runMaxInputTokens: 50_000,
      runMaxOutputTokens: 50_000,
      providerMaxOutputTokensPerCall: 4096,
    });
    assert.equal(budget.canAffordCall(0.01, 1000, 5000), false);
  });

  it("reservations use authorized dollar cost and settlement uses actual usage", () => {
    const budget = createBudgetControllerFromTokenLimits({
      maxCalls: 3,
      maxTotalCostUsd: 0.08,
      maxCostPerCallUsd: 0.03,
      tokenLimits: resolveTokenBudgetFromCliArgs(smokeArgs()),
    });
    const authorizedMicro = usdToMicroUsd(0.0243);
    assert.equal(budget.canAffordCall(0.0243, 3824, 4096), true);
    budget.recordCall(0.014, 3824, 2175);
    const snap = budget.snapshot();
    assert.equal(snap.outputTokensUsed, 2175);
    assert.ok(snap.totalCostUsd < 0.0243);
    assert.ok(authorizedMicro > usdToMicroUsd(snap.totalCostUsd));
  });

  it("call plan exposes both per-call and cumulative output token limits", () => {
    const plan = buildLiveCalibrationCallPlan({
      args: smokeArgs(),
      providerSpec: {
        provider: "anthropic",
        modelId: "claude-haiku-4-5-20251001",
        modelAlias: "haiku-4-5-v1",
        pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
      },
      correlationPrefix: "token-budget-v2",
    });
    assert.equal(plan.providerMaxOutputTokens, 4096);
    assert.equal(plan.runMaxOutputTokens, 12_288);
    assert.equal(plan.tokenBudgetPolicyVersion, LIVE_CALIBRATION_TOKEN_BUDGET_POLICY_VERSION);
  });

  it("old ambiguous run ceiling below aggregate need fails at plan time", () => {
    assert.throws(
      () =>
        buildLiveCalibrationCallPlan({
          args: smokeArgs({ maxRunOutputTokens: 4096 }),
          providerSpec: {
            provider: "anthropic",
            modelId: "claude-haiku-4-5-20251001",
            modelAlias: "haiku-4-5-v1",
            pricingProfileId: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
          },
          correlationPrefix: "ambiguous-config",
        }),
      LiveCalibrationError,
    );
  });
});
