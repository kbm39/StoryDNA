import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
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
import { loadSessionBudget } from "./session-budget.ts";
import { SMOKE_V3_REPLAY_FIXTURES } from "@/experts/military-expert/smoke-v3-remediation-fixtures.ts";
import { CALIBRATION_ANTHROPIC_HAIKU_45_V1_PRICING_PROFILE } from "../cost-analysis.ts";
import type { CalibrationReport } from "../contracts.ts";

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
    outputDir: ".calibration-results/test-smoke-v3-replay",
    overwrite: true,
    ackToken: LIVE_CALIBRATION_ACK_TOKEN,
    sessionId: `smoke-v3-replay-${Date.now()}`,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
    ...overrides,
  });
}

function createReplayInvoker(): LiveCalibrationProviderInvoker {
  let callIndex = 0;
  const outputTokensByCall = [2615, 1359, 2130];

  return async (input: LiveCalibrationProviderInvokeInput) => {
    const fixture = SMOKE_V3_REPLAY_FIXTURES[input.caseId as keyof typeof SMOKE_V3_REPLAY_FIXTURES];
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
        inputTokens: 3430,
        outputTokens,
        modelIdentifier: "claude-haiku-4-5-20251001",
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

function cleanupOutputDir(outputDir: string, runId: string): void {
  for (const filename of [`${runId}-report.json`, "run-manifest.json"]) {
    const path = join(process.cwd(), outputDir, filename);
    if (existsSync(path)) rmSync(path);
  }
}

describe("Military Expert smoke v3 mocked three-call replay", () => {
  it("authorizes, executes, parses, validates, scores, and settles all three calls", async () => {
    const args = smokeArgs();
    const runId = "cal-smoke-v3-replay-001";
    const plan = buildLiveCalibrationCallPlan({
      args,
      providerSpec: resolveProviderSpec("anthropic", "haiku-4-5-v1"),
      correlationPrefix: "smoke-v3-replay",
    });

    assert.equal(plan.calls.length, 3);
    assert.equal(plan.runMaxOutputTokens, 12_288);
    assert.equal(plan.providerMaxOutputTokens, 4096);
    assert.ok(plan.calls.every((call) => call.authorizedWorstCaseCostUsd <= 0.03));

    const result = await executeLive({
      args,
      callPlan: plan,
      runId,
      correlationId: "smoke-v3-replay-root",
      startedAt: 1_000,
      providerInvoker: createReplayInvoker(),
      writeArtifacts: true,
      bypassFeatureFlags: true,
      now: () => 2_000,
    });

    assert.equal(result.ok, true, result.failureReason ?? "expected scoring success");
    assert.equal(result.exitCode, 0);
    assert.equal(result.providerCalls, 3);
    assert.equal(result.modelCalls, 3);
    assert.equal(result.failureReason, null);
    assert.notEqual(result.failureCode, "budget_exhausted");

    const reportPath = join(process.cwd(), args.outputDir, `${runId}-report.json`);
    assert.ok(existsSync(reportPath), "calibration report should be written");
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as CalibrationReport;
    assert.equal(report.suite_result.metrics.cases_passed, 3);
    assert.equal(report.suite_result.metrics.cases_failed, 0);
    assert.equal(report.suite_result.metrics.parser_failures, 0);
    assert.equal(report.suite_result.certification.status, "ready");
    assert.equal(report.suite_result.certification.certified, false);

    for (const caseResult of report.suite_result.case_results) {
      assert.equal(caseResult.ok, true, caseResult.case_id);
      assert.equal(caseResult.parse_status, "success", caseResult.case_id);
      assert.ok(caseResult.case_score > 0, `${caseResult.case_id} should have positive case_score`);
      assert.ok(
        caseResult.evidence_quality_score > 0,
        `${caseResult.case_id} should have positive evidence_quality_score`,
      );
    }

    const meCoc001 = report.suite_result.case_results.find((entry) => entry.case_id === "me-coc-001");
    assert.ok(meCoc001);
    assert.equal(meCoc001!.case_score, 1);

    const meOps004 = report.suite_result.case_results.find((entry) => entry.case_id === "me-ops-004");
    assert.ok(meOps004);
    assert.equal(meOps004!.safety_failure, false);

    const session = loadSessionBudget(args.sessionId!, 1.0);
    assert.equal(
      Object.values(session.reservations).filter((reservation) => reservation.status === "active")
        .length,
      0,
    );

    cleanupSession(args.sessionId!);
    cleanupOutputDir(args.outputDir, runId);
  });
});
