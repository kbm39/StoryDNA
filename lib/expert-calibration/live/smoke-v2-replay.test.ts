import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { executeLive } from "./live-executor.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { resolveProviderSpec } from "./provider-allowlist.ts";
import {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS,
} from "./constants.ts";
import type {
  LiveCalibrationCliArgs,
  LiveCalibrationProviderInvokeInput,
  LiveCalibrationProviderInvoker,
} from "./contracts.ts";
import {
  loadSessionBudget,
} from "./session-budget.ts";
import { SMOKE_V2_REPLAY_FIXTURES } from "@/experts/military-expert/smoke-v2-remediation-fixtures.ts";
import { CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "../cost-analysis.ts";

const SESSIONS_DIR = join(process.cwd(), ".calibration-results", "sessions");

function smokeArgs(overrides: Partial<LiveCalibrationCliArgs> = {}): LiveCalibrationCliArgs {
  return Object.freeze({
    mode: "live",
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
    outputDir: ".calibration-results/test-smoke-v2-replay",
    overwrite: true,
    ackToken: LIVE_CALIBRATION_ACK_TOKEN,
    sessionId: `smoke-v2-replay-${Date.now()}`,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
    ...overrides,
  });
}

function createReplayInvoker(): LiveCalibrationProviderInvoker {
  let callIndex = 0;
  const outputTokensByCall = [2175, 2500, 2400];

  return async (input: LiveCalibrationProviderInvokeInput) => {
    const fixture = SMOKE_V2_REPLAY_FIXTURES[input.caseId as keyof typeof SMOKE_V2_REPLAY_FIXTURES];
    if (!fixture) {
      return {
        ok: false,
        providerError: { code: "fixture_missing", message: `No fixture for ${input.caseId}` },
        durationMs: 1,
      };
    }

    const outputTokens = outputTokensByCall[callIndex] ?? 2500;
    callIndex += 1;

    return {
      ok: true,
      rawResponse: {
        ...fixture,
        correlationId: input.correlationId,
        inputTokens: 3114,
        outputTokens,
      },
      providerMetadata: {
        provider: "anthropic",
        model_id: input.modelId,
        sdk_version: "test",
        api_version: "2023-06-01",
        response_schema_version: "military_expert_output@v1-draft",
        pricing_profile_id: CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE,
        model_lifecycle_status: "active",
        model_lifecycle_verified_date: "2026-07-25",
        model_lifecycle_source: "test",
        recommended_replacement: null,
      },
      durationMs: 5,
    };
  };
}

function cleanupSession(sessionId: string): void {
  for (const suffix of [".json", ".audit.jsonl"]) {
    const path = join(SESSIONS_DIR, `${sessionId}${suffix}`);
    if (existsSync(path)) rmSync(path);
  }
}

describe("Military Expert smoke v2 mocked three-call replay", () => {
  it("authorizes, executes, parses, validates, and settles all three calls", async () => {
    const args = smokeArgs();
    const plan = buildLiveCalibrationCallPlan({
      args,
      providerSpec: resolveProviderSpec("anthropic", "haiku-4-5-v1"),
      correlationPrefix: "smoke-v2-replay",
    });

    assert.equal(plan.calls.length, 3);
    assert.equal(plan.runMaxOutputTokens, 12_288);
    assert.equal(plan.providerMaxOutputTokens, 4096);

    const result = await executeLive({
      args,
      callPlan: plan,
      runId: "cal-smoke-v2-replay-001",
      correlationId: "smoke-v2-replay-root",
      startedAt: 1_000,
      providerInvoker: createReplayInvoker(),
      writeArtifacts: false,
      bypassFeatureFlags: true,
      now: () => 2_000,
    });

    assert.equal(result.providerCalls, 3);
    assert.equal(result.modelCalls, 3);
    assert.notEqual(result.failureCode, "budget_exhausted");
    assert.equal(result.failureReason, null);

    const session = loadSessionBudget(args.sessionId!, 1.0);
    assert.equal(
      Object.values(session.reservations).filter((reservation) => reservation.status === "active")
        .length,
      0,
    );

    cleanupSession(args.sessionId!);
  });
});
