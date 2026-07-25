import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
  CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE,
  estimateTokenCost,
  isHistoricalPricingProfile,
  isLiveEligiblePricingProfile,
} from "../cost-analysis.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { LIVE_CALIBRATION_DEFAULTS } from "./constants.ts";
import { LiveCalibrationError } from "./errors.ts";
import { validateLiveSmokeAuthorization } from "./live-authorization.ts";
import {
  ANTHROPIC_HAIKU_35_ALIAS,
  ANTHROPIC_HAIKU_35_MODEL_ID,
  ANTHROPIC_HAIKU_45_ALIAS,
  ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS,
  ANTHROPIC_HAIKU_45_MODEL_ID,
  getModelLifecycleRecord,
  validateLiveCliModelAlias,
  validateModelLifecycleForLivePlan,
  isLiveEligibleLifecycleStatus,
} from "./model-lifecycle.ts";
import {
  ANTHROPIC_HAIKU_45_PRICING_PROFILE,
  resolveHistoricalProviderSpec,
  resolveProviderSpec,
} from "./provider-allowlist.ts";
import { runLiveCalibration } from "./orchestrator.ts";
import { LIVE_CALIBRATION_ACK_TOKEN } from "./constants.ts";

function smokeArgs(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    mode: "dry-run" as const,
    expert: "military_expert" as const,
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1" as const,
    provider: "anthropic" as const,
    model: ANTHROPIC_HAIKU_45_ALIAS,
    runs: 1,
    maxCalls: 3,
    maxTotalCostUsd: LIVE_CALIBRATION_DEFAULTS.maxTotalCostUsd,
    maxCostPerCallUsd: LIVE_CALIBRATION_DEFAULTS.maxCostPerCallUsd,
    maxInputTokens: 50_000,
    maxOutputTokens: 50_000,
    timeoutMs: 120_000,
    maxRuntimeMs: 600_000,
    outputDir: ".calibration-results/test-haiku45",
    overwrite: true,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
    ...overrides,
  });
}

describe("Haiku 4.5 model lifecycle migration", () => {
  describe("model lifecycle records", () => {
    it("1 active Haiku 4.5 model resolves", () => {
      const record = getModelLifecycleRecord(ANTHROPIC_HAIKU_45_MODEL_ID);
      assert.equal(record?.status, "active");
      assert.equal(record?.modelAlias, ANTHROPIC_HAIKU_45_ALIAS);
    });

    it("2 retired Haiku 3.5 model recorded", () => {
      const record = getModelLifecycleRecord(ANTHROPIC_HAIKU_35_MODEL_ID);
      assert.equal(record?.status, "retired");
      assert.equal(record?.retirementDate, "2026-02-19");
      assert.equal(record?.recommendedReplacement, ANTHROPIC_HAIKU_45_MODEL_ID);
    });

    it("3 retired model rejected for live plan", () => {
      assert.throws(
        () => validateModelLifecycleForLivePlan(ANTHROPIC_HAIKU_35_MODEL_ID),
        LiveCalibrationError,
      );
    });

    it("4 old alias rejected for live CLI", () => {
      assert.throws(() => validateLiveCliModelAlias(ANTHROPIC_HAIKU_35_ALIAS), LiveCalibrationError);
    });

    it("5 convenience alias rejected for live CLI", () => {
      assert.throws(
        () => validateLiveCliModelAlias(ANTHROPIC_HAIKU_45_CONVENIENCE_ALIAS),
        LiveCalibrationError,
      );
    });

    it("6 arbitrary model rejected", () => {
      assert.throws(() => resolveProviderSpec("anthropic", "gpt-4"), LiveCalibrationError);
    });

    it("7 new alias resolves to Haiku 4.5 spec", () => {
      const spec = resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS);
      assert.equal(spec.modelId, ANTHROPIC_HAIKU_45_MODEL_ID);
      assert.equal(spec.pricingProfileId, ANTHROPIC_HAIKU_45_PRICING_PROFILE);
    });

    it("8 deprecated lifecycle fails closed", () => {
      assert.equal(isLiveEligibleLifecycleStatus("deprecated"), false);
    });

    it("9 unknown lifecycle fails closed", () => {
      assert.throws(
        () => validateModelLifecycleForLivePlan("claude-unknown-model"),
        LiveCalibrationError,
      );
    });
  });

  describe("pricing profiles", () => {
    it("10 Haiku 4.5 input rate is $1/M", () => {
      const cost = estimateTokenCost(1_000_000, 0, CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE);
      assert.equal(cost, 1);
    });

    it("11 Haiku 4.5 output rate is $5/M", () => {
      const cost = estimateTokenCost(0, 1_000_000, CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE);
      assert.equal(cost, 5);
    });

    it("12 old pricing profile remains historical", () => {
      assert.equal(isHistoricalPricingProfile(CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE), true);
      assert.equal(isLiveEligiblePricingProfile(CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE), false);
    });

    it("13 new pricing profile is live eligible", () => {
      assert.equal(isLiveEligiblePricingProfile(CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE), true);
    });

    it("13 historical provider spec readable for retired model", () => {
      const spec = resolveHistoricalProviderSpec("anthropic", ANTHROPIC_HAIKU_35_MODEL_ID);
      assert.ok(spec);
      assert.equal(spec!.pricingProfileId, CALIBRATION_ANTHROPIC_HAIKU_V1_PRICING_PROFILE);
    });

    it("14 historical spec cannot authorize new live plan", () => {
      const historical = resolveHistoricalProviderSpec("anthropic", ANTHROPIC_HAIKU_35_MODEL_ID);
      assert.ok(historical);
      assert.throws(
        () =>
          buildLiveCalibrationCallPlan({
            args: smokeArgs({ mode: "live", sessionId: "hist-test", ackToken: "x" }),
            providerSpec: historical!,
            correlationPrefix: "hist",
          }),
        LiveCalibrationError,
      );
    });
  });

  describe("smoke plan recalculation", () => {
    it("15 three-case plan uses Haiku 4.5 pricing", () => {
      const plan = buildLiveCalibrationCallPlan({
        args: smokeArgs(),
        providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
        correlationPrefix: "haiku45",
      });
      assert.equal(plan.calls.length, 3);
      assert.equal(plan.totalEstimatedCostUsd, 0.0468);
      for (const call of plan.calls) {
        assert.ok(call.estimatedCostUsd <= LIVE_CALIBRATION_DEFAULTS.maxCostPerCallUsd);
      }
    });

    it("16 plan includes lifecycle snapshot", () => {
      const plan = buildLiveCalibrationCallPlan({
        args: smokeArgs(),
        providerSpec: resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_45_ALIAS),
        correlationPrefix: "haiku45",
      });
      assert.equal(plan.modelLifecycle.model_id, ANTHROPIC_HAIKU_45_MODEL_ID);
      assert.equal(plan.modelLifecycle.status, "active");
    });

    it("17 retired model dry-run rejected", () => {
      assert.throws(
        () => resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_35_ALIAS),
        LiveCalibrationError,
      );
    });
  });

  describe("live authorization gates", () => {
    it("18 live auth rejects retired alias before provider", () => {
      const result = validateLiveSmokeAuthorization({
        args: smokeArgs({ mode: "live", sessionId: "sess-test", model: ANTHROPIC_HAIKU_35_ALIAS }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(result.ok, false);
      assert.equal(result.failureCode, "allowlist_violation");
    });

    it("19 live auth accepts Haiku 4.5 alias", () => {
      const result = validateLiveSmokeAuthorization({
        args: smokeArgs({ mode: "live", sessionId: "sess-test" }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(result.ok, true);
    });

    it("20 orchestrator live rejects retired model without api key path", async () => {
      let apiKeyRead = false;
      const result = await runLiveCalibration(
        smokeArgs({
          mode: "live",
          sessionId: "sess-retired-block",
          model: ANTHROPIC_HAIKU_35_ALIAS,
          ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        }),
        {
          bypassFeatureFlags: true,
          writeArtifacts: false,
          randomId: () => "retired-block",
          env: {
            ANTHROPIC_API_KEY: "should-not-be-read",
          },
          providerInvoker: async () => {
            apiKeyRead = true;
            throw new Error("invoker should not run");
          },
        },
      );
      assert.equal(result.ok, false);
      assert.equal(result.failureCode, "allowlist_violation");
      assert.equal(apiKeyRead, false);
    });
  });

  describe("budget defaults", () => {
    it("21 smoke defaults allow Haiku 4.5 plan", () => {
      assert.equal(LIVE_CALIBRATION_DEFAULTS.maxCostPerCallUsd, 0.03);
      assert.equal(LIVE_CALIBRATION_DEFAULTS.maxTotalCostUsd, 0.08);
    });
  });
});
