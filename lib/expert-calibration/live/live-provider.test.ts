import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_DEFAULTS,
  LIVE_CALIBRATION_LIVE_SMOKE,
  LIVE_CALIBRATION_SESSION_DEFAULTS,
} from "./constants.ts";
import type {
  LiveCalibrationCliArgs,
  LiveCalibrationProviderInvokeInput,
  LiveCalibrationProviderInvoker,
} from "./contracts.ts";
import { LiveCalibrationError, LIVE_CALIBRATION_EXIT } from "./errors.ts";
import { readAnthropicApiKey, hasAnthropicApiKey, ANTHROPIC_API_KEY_ENV } from "./api-key.ts";
import {
  loadSessionBudget,
  reserveSessionBudget,
  commitSessionSpend,
  canSessionAfford,
  getSessionRemainingMicroUsd,
  writeSessionBudget,
} from "./session-budget.ts";
import { appendAuditEvent, createAuditEvent } from "./audit-log.ts";
import { validateLiveSmokeAuthorization } from "./live-authorization.ts";
import { parseLiveCalibrationCliArgs } from "./cli-parser.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { resolveProviderSpec } from "./provider-allowlist.ts";
import { executeLive } from "./live-executor.ts";
import { runLiveCalibration } from "./orchestrator.ts";
import { buildSyntheticSuccessRawResponse } from "./synthetic-adapter.ts";
import { usdToMicroUsd, microUsdToUsd } from "./budget-controller.ts";
import {
  EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME,
  EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME,
  EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME,
} from "./feature-flags.ts";
import { EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME } from "../feature-flags.ts";
import { EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME } from "@/lib/expert-review-engine/feature-flags.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SESSIONS_DIR = join(process.cwd(), ".calibration-results", "sessions");

function smokeArgs(overrides: Partial<LiveCalibrationCliArgs> = {}): LiveCalibrationCliArgs {
  return Object.freeze({
    mode: "dry-run" as const,
    expert: "military_expert" as const,
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1" as const,
    provider: "anthropic" as const,
    model: "haiku-v1",
    runs: 1,
    maxCalls: 3,
    maxTotalCostUsd: 0.05,
    maxCostPerCallUsd: 0.02,
    maxInputTokens: 50_000,
    maxOutputTokens: 50_000,
    timeoutMs: 120_000,
    maxRuntimeMs: 600_000,
    outputDir: ".calibration-results/test-live",
    overwrite: true,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
    ...overrides,
  });
}

function liveSmokeArgs(overrides: Partial<LiveCalibrationCliArgs> = {}): LiveCalibrationCliArgs {
  return smokeArgs({
    mode: "live",
    ackToken: LIVE_CALIBRATION_ACK_TOKEN,
    sessionId: `test-session-${Date.now()}`,
    ...overrides,
  });
}

function cliArgv(overrides: Record<string, string> = {}): string[] {
  const base: Record<string, string> = {
    mode: "dry-run",
    expert: "military_expert",
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1",
    provider: "anthropic",
    model: "haiku-v1",
    runs: "1",
    "max-calls": "3",
    "max-total-cost": "0.05",
    "max-cost-per-call": "0.02",
    "max-input-tokens": "50000",
    "max-output-tokens": "50000",
    "timeout-ms": "120000",
    "max-runtime-ms": "600000",
    "output-dir": ".calibration-results/test-live",
    overwrite: "true",
    ...overrides,
  };
  const argv: string[] = [];
  for (const [key, value] of Object.entries(base)) {
    argv.push(`--${key}`, value);
  }
  return argv;
}

function createMockInvoker(
  options: { failOnCase?: string; failAll?: boolean } = {},
): LiveCalibrationProviderInvoker {
  return async (input: LiveCalibrationProviderInvokeInput) => {
    if (options.failAll || input.caseId === options.failOnCase) {
      return {
        ok: false,
        providerError: { code: "mock_error", message: "Mock provider failure" },
        durationMs: 1,
      };
    }
    return {
      ok: true,
      rawResponse: buildSyntheticSuccessRawResponse(input.correlationId, input.caseId),
      durationMs: 5,
    };
  };
}

function cleanupSession(sessionId: string): void {
  const budgetPath = join(SESSIONS_DIR, `${sessionId}.json`);
  const auditPath = join(SESSIONS_DIR, `${sessionId}.audit.jsonl`);
  if (existsSync(budgetPath)) rmSync(budgetPath);
  if (existsSync(auditPath)) rmSync(auditPath);
}

describe("Expert Calibration Live PR 3B-2", () => {
  describe("constants", () => {
    it("1 live smoke subset is military_expert_smoke_v1", () => {
      assert.equal(LIVE_CALIBRATION_LIVE_SMOKE.subset, "military_expert_smoke_v1");
    });
    it("2 live smoke runs is 1", () => {
      assert.equal(LIVE_CALIBRATION_LIVE_SMOKE.runs, 1);
    });
    it("3 live smoke maxCalls is 3", () => {
      assert.equal(LIVE_CALIBRATION_LIVE_SMOKE.maxCalls, 3);
    });
    it("4 session default max cost is 1.00", () => {
      assert.equal(LIVE_CALIBRATION_SESSION_DEFAULTS.sessionMaxCostUsd, 1.0);
    });
    it("5 run default max cost is 0.05", () => {
      assert.equal(LIVE_CALIBRATION_SESSION_DEFAULTS.runMaxCostUsd, 0.05);
    });
    it("6 defaults include sessionMaxCostUsd", () => {
      assert.equal(LIVE_CALIBRATION_DEFAULTS.sessionMaxCostUsd, 1.0);
    });
    it("7 defaults retainRawResponses false", () => {
      assert.equal(LIVE_CALIBRATION_DEFAULTS.retainRawResponses, false);
    });
  });

  describe("api-key", () => {
    it("8 readAnthropicApiKey returns null when missing", () => {
      assert.equal(readAnthropicApiKey({}), null);
    });
    it("9 readAnthropicApiKey returns null for empty string", () => {
      assert.equal(readAnthropicApiKey({ [ANTHROPIC_API_KEY_ENV]: "  " }), null);
    });
    it("10 readAnthropicApiKey returns trimmed value", () => {
      assert.equal(readAnthropicApiKey({ [ANTHROPIC_API_KEY_ENV]: "  key-value  " }), "key-value");
    });
    it("11 hasAnthropicApiKey false when missing", () => {
      assert.equal(hasAnthropicApiKey({}), false);
    });
    it("12 hasAnthropicApiKey true when present", () => {
      assert.equal(hasAnthropicApiKey({ [ANTHROPIC_API_KEY_ENV]: "present" }), true);
    });
    it("13 api key env name is ANTHROPIC_API_KEY", () => {
      assert.equal(ANTHROPIC_API_KEY_ENV, "ANTHROPIC_API_KEY");
    });
  });

  describe("cli parser live flags", () => {
    it("14 rejects --api-key flag", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs([...cliArgv(), "--api-key", "sk-test"]),
        LiveCalibrationError,
      );
    });
    it("15 rejects --anthropic-api-key flag", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs([...cliArgv(), "--anthropic-api-key", "sk-test"]),
        LiveCalibrationError,
      );
    });
    it("16 rejects --base-url flag", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs([...cliArgv(), "--base-url", "http://evil"]),
        LiveCalibrationError,
      );
    });
    it("17 rejects --endpoint flag", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs([...cliArgv(), "--endpoint", "http://evil"]),
        LiveCalibrationError,
      );
    });
    it("18 parses --session-id", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv({ "session-id": "sess-abc" }));
      assert.equal(args.sessionId, "sess-abc");
    });
    it("19 parses --session-max-cost default 1.00", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv());
      assert.equal(args.sessionMaxCostUsd, 1.0);
    });
    it("20 parses --session-max-cost override", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv({ "session-max-cost": "2.50" }));
      assert.equal(args.sessionMaxCostUsd, 2.5);
    });
    it("21 parses --retain-raw-responses", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv({ "retain-raw-responses": "true" }));
      assert.equal(args.retainRawResponses, true);
    });
  });

  describe("live authorization", () => {
    it("22 dry-run passes live smoke auth", () => {
      assert.equal(validateLiveSmokeAuthorization({ args: smokeArgs() }).ok, true);
    });
    it("23 live requires session-id", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ sessionId: undefined }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
      assert.match(r.message ?? "", /session-id/i);
    });
    it("24 live requires ack token", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs(),
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("25 live rejects wrong subset", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ subset: "military_expert_core_v1" }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
      assert.equal(r.failureCode, "allowlist_violation");
    });
    it("26 live rejects runs != 1", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ runs: 2 }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("27 live rejects maxCalls != 3", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ maxCalls: 5 }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("28 live rejects wrong suite", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ suite: "wrong_suite" }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("29 live rejects wrong provider", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ provider: "openai" as never }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("30 live rejects unknown model", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ model: "claude-opus-4" }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, false);
    });
    it("31 live passes with bypass and valid smoke args", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs(),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, true);
    });
    it("32 live requires all feature flags without bypass", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs(),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        env: {},
      });
      assert.equal(r.ok, false);
    });
    it("33 live passes with all flags set", () => {
      const env = {
        [EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME]: "true",
        [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "true",
        [EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME]: "true",
        [EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME]: "true",
        [EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME]: "true",
      };
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs(),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        env,
      });
      assert.equal(r.ok, true);
    });
  });

  describe("session budget", () => {
    const sessionId = `budget-test-${Date.now()}`;

    it("34 loadSessionBudget creates fresh budget", () => {
      cleanupSession(sessionId);
      const budget = loadSessionBudget(sessionId, 1.0);
      assert.equal(budget.spent_cost_micro_usd, 0);
      assert.equal(budget.version, 0);
      assert.equal(budget.max_cost_micro_usd, usdToMicroUsd(1.0));
    });
    it("35 canSessionAfford within budget", () => {
      const budget = loadSessionBudget(sessionId, 1.0);
      assert.equal(canSessionAfford(budget, 0.05), true);
    });
    it("36 canSessionAfford rejects over budget", () => {
      const budget = loadSessionBudget(sessionId, 0.01);
      assert.equal(canSessionAfford(budget, 0.05), false);
    });
    it("37 reserveSessionBudget returns reservation", () => {
      cleanupSession(sessionId);
      const reservation = reserveSessionBudget(sessionId, 1.0, 0.05);
      assert.equal(reservation.sessionId, sessionId);
      assert.equal(reservation.expectedVersion, 0);
    });
    it("38 commitSessionSpend increments version", () => {
      cleanupSession(sessionId);
      const reservation = reserveSessionBudget(sessionId, 1.0, 0.05);
      const next = commitSessionSpend(sessionId, 1.0, reservation, 0.03);
      assert.equal(next.version, 1);
      assert.equal(next.spent_cost_micro_usd, usdToMicroUsd(0.03));
    });
    it("39 getSessionRemainingMicroUsd calculates remainder", () => {
      const budget = loadSessionBudget(sessionId, 1.0);
      const remaining = getSessionRemainingMicroUsd(budget);
      assert.ok(remaining >= 0);
      assert.equal(microUsdToUsd(remaining), microUsdToUsd(budget.max_cost_micro_usd - budget.spent_cost_micro_usd));
    });
    it("40 reserve rejects exhausted session", () => {
      cleanupSession(sessionId);
      writeSessionBudget({
        schema_version: "expert_calibration_session@v1",
        session_id: sessionId,
        max_cost_micro_usd: usdToMicroUsd(0.01),
        spent_cost_micro_usd: usdToMicroUsd(0.01),
        version: 1,
        run_count: 1,
      });
      assert.throws(() => reserveSessionBudget(sessionId, 0.01, 0.001), LiveCalibrationError);
      cleanupSession(sessionId);
    });
    it("41 commit rejects version conflict", () => {
      cleanupSession(sessionId);
      const reservation = reserveSessionBudget(sessionId, 1.0, 0.05);
      commitSessionSpend(sessionId, 1.0, reservation, 0.01);
      assert.throws(
        () => commitSessionSpend(sessionId, 1.0, reservation, 0.01),
        LiveCalibrationError,
      );
      cleanupSession(sessionId);
    });
  });

  describe("audit log", () => {
    const sessionId = `audit-test-${Date.now()}`;

    it("42 appendAuditEvent creates audit file", () => {
      const path = appendAuditEvent(
        createAuditEvent({
          session_id: sessionId,
          run_id: "run-1",
          event_type: "live_run_started",
          detail: { planned_calls: 3 },
        }),
      );
      assert.ok(existsSync(path));
      cleanupSession(sessionId);
    });
    it("43 audit events are append-only jsonl", () => {
      appendAuditEvent(
        createAuditEvent({
          session_id: sessionId,
          run_id: "run-1",
          event_type: "live_run_started",
          detail: {},
        }),
      );
      appendAuditEvent(
        createAuditEvent({
          session_id: sessionId,
          run_id: "run-1",
          event_type: "live_run_completed",
          detail: { ok: true },
        }),
      );
      const content = readFileSync(join(SESSIONS_DIR, `${sessionId}.audit.jsonl`), "utf8");
      assert.equal(content.trim().split("\n").length, 2);
      cleanupSession(sessionId);
    });
    it("44 createAuditEvent adds timestamp", () => {
      const event = createAuditEvent({
        session_id: sessionId,
        run_id: "run-1",
        event_type: "authorization_denied",
        detail: { reason: "test" },
      });
      assert.ok(event.timestamp.length > 0);
    });
  });

  describe("live executor with mock provider", () => {
    it("45 mock live 3 calls success", async () => {
      const sessionId = `exec-success-${Date.now()}`;
      cleanupSession(sessionId);
      const args = liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "live-mock",
      });
      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "live-mock-1",
        correlationId: "live-mock-corr",
        startedAt: 1_000,
        providerInvoker: createMockInvoker(),
        writeArtifacts: false,
        bypassFeatureFlags: true,
        now: () => 2_000,
      });
      assert.equal(result.modelCalls, 3);
      assert.equal(result.providerCalls, 3);
      assert.equal(result.productionExecutionOccurred, false);
      cleanupSession(sessionId);
    });
    it("46 live manifest mode is live", async () => {
      const sessionId = `exec-manifest-${Date.now()}`;
      cleanupSession(sessionId);
      const args = liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "live-mock",
      });
      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "live-mock-2",
        correlationId: "live-mock-corr",
        startedAt: 1_000,
        providerInvoker: createMockInvoker(),
        writeArtifacts: false,
        bypassFeatureFlags: true,
        now: () => 2_000,
      });
      assert.equal(result.manifest.mode, "live");
      cleanupSession(sessionId);
    });
    it("47 provider failure stops sequential loop", async () => {
      const sessionId = `exec-fail-${Date.now()}`;
      cleanupSession(sessionId);
      const args = liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "live-mock",
      });
      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "live-mock-3",
        correlationId: "live-mock-corr",
        startedAt: 1_000,
        providerInvoker: createMockInvoker({ failOnCase: "me-coc-002" }),
        writeArtifacts: false,
        bypassFeatureFlags: true,
      });
      assert.equal(result.ok, false);
      assert.equal(result.providerCalls, 2);
      assert.equal(result.exitCode, LIVE_CALIBRATION_EXIT.providerError);
      cleanupSession(sessionId);
    });
    it("48 live executor records session spend", async () => {
      const sessionId = `exec-spend-${Date.now()}`;
      cleanupSession(sessionId);
      const args = liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "live-mock",
      });
      await executeLive({
        args,
        callPlan: plan,
        runId: "live-mock-4",
        correlationId: "live-mock-corr",
        startedAt: 1_000,
        providerInvoker: createMockInvoker(),
        writeArtifacts: false,
        bypassFeatureFlags: true,
        now: () => 2_000,
      });
      const budget = loadSessionBudget(sessionId, 1.0);
      assert.ok(budget.spent_cost_micro_usd > 0);
      cleanupSession(sessionId);
    });
  });

  describe("orchestrator live path", () => {
    it("49 live without api key fails closed", async () => {
      const result = await runLiveCalibration(liveSmokeArgs(), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "orch-no-key",
        env: {},
      });
      assert.equal(result.ok, false);
      assert.equal(result.failureCode, "missing_api_key");
    });
    it("50 live without session-id fails at smoke auth", async () => {
      const result = await runLiveCalibration(
        liveSmokeArgs({ sessionId: undefined }),
        {
          bypassFeatureFlags: true,
          writeArtifacts: false,
          randomId: () => "orch-no-session",
          env: { [ANTHROPIC_API_KEY_ENV]: "fake-key" },
        },
      );
      assert.equal(result.ok, false);
      assert.equal(result.failureCode, "authorization_failure");
    });
    it("51 live with mock invoker succeeds", async () => {
      const sessionId = `orch-success-${Date.now()}`;
      cleanupSession(sessionId);
      const result = await runLiveCalibration(liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 }), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "orch-live-ok",
        env: { [ANTHROPIC_API_KEY_ENV]: "fake-key-not-used" },
        providerInvoker: createMockInvoker(),
      });
      assert.equal(result.ok, true);
      assert.equal(result.mode, "live");
      if (result.mode === "live") {
        assert.equal(result.modelCalls, 3);
        assert.equal(result.providerCalls, 3);
      }
      cleanupSession(sessionId);
    });
    it("52 dry-run still zero calls", async () => {
      const result = await runLiveCalibration(smokeArgs(), {
        writeArtifacts: false,
        randomId: () => "orch-dry",
      });
      assert.equal(result.mode, "dry-run");
      if (result.mode === "dry-run") {
        assert.equal(result.modelCalls, 0);
        assert.equal(result.providerCalls, 0);
      }
    });
    it("53 synthetic still zero calls", async () => {
      const result = await runLiveCalibration(smokeArgs({ mode: "synthetic" }), {
        writeArtifacts: false,
        bypassFeatureFlags: true,
        randomId: () => "orch-syn",
      });
      if (result.mode === "synthetic") {
        assert.equal(result.modelCalls, 0);
        assert.equal(result.providerCalls, 0);
      }
    });
    it("54 live rejects non-smoke subset via orchestrator", async () => {
      const result = await runLiveCalibration(
        liveSmokeArgs({ subset: "military_expert_core_v1" }),
        {
          bypassFeatureFlags: true,
          writeArtifacts: false,
          randomId: () => "orch-bad-subset",
          env: { [ANTHROPIC_API_KEY_ENV]: "fake" },
        },
      );
      assert.equal(result.ok, false);
      assert.equal(result.failureCode, "allowlist_violation");
    });
  });

  describe("SDK isolation", () => {
    const liveDir = join(ROOT, "lib/expert-calibration/live");
    const sdkPattern = /@anthropic-ai\/sdk/;

    it("55 anthropic invoke imports SDK", () => {
      const src = readFileSync(join(liveDir, "providers/anthropic/invoke.ts"), "utf8");
      assert.match(src, sdkPattern);
    });
    it("56 orchestrator does not import SDK", () => {
      const src = readFileSync(join(liveDir, "orchestrator.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("57 live-executor does not import SDK", () => {
      const src = readFileSync(join(liveDir, "live-executor.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("58 synthetic-executor does not import SDK", () => {
      const src = readFileSync(join(liveDir, "synthetic-executor.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("59 dry-run-executor does not import SDK", () => {
      const src = readFileSync(join(liveDir, "dry-run-executor.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("60 api-key does not import SDK", () => {
      const src = readFileSync(join(liveDir, "api-key.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("61 live-authorization does not import SDK", () => {
      const src = readFileSync(join(liveDir, "live-authorization.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("62 session-budget does not import SDK", () => {
      const src = readFileSync(join(liveDir, "session-budget.ts"), "utf8");
      assert.doesNotMatch(src, sdkPattern);
    });
    it("63 invoke sets maxRetries 0", () => {
      const src = readFileSync(join(liveDir, "providers/anthropic/invoke.ts"), "utf8");
      assert.match(src, /maxRetries:\s*0/);
    });
    it("64 only invoke.ts under live imports SDK", () => {
      const filesWithSdk: string[] = [];
      function scan(dir: string): void {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full);
          } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
            const src = readFileSync(full, "utf8");
            if (sdkPattern.test(src)) filesWithSdk.push(full);
          }
        }
      }
      scan(liveDir);
      assert.equal(filesWithSdk.length, 1);
      assert.ok(filesWithSdk[0]!.endsWith("providers/anthropic/invoke.ts"));
    });
  });

  describe("discriminated result types", () => {
    it("65 dry-run result has zero call counts", async () => {
      const result = await runLiveCalibration(smokeArgs(), {
        writeArtifacts: false,
        randomId: () => "disc-dry",
      });
      assert.equal(result.mode, "dry-run");
      if (result.mode === "dry-run") {
        assert.equal(result.modelCalls, 0);
        assert.equal(result.providerCalls, 0);
      }
    });
    it("66 live result has numeric call counts", async () => {
      const sessionId = `disc-live-${Date.now()}`;
      cleanupSession(sessionId);
      const result = await runLiveCalibration(liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 }), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "disc-live",
        env: { [ANTHROPIC_API_KEY_ENV]: "fake" },
        providerInvoker: createMockInvoker(),
      });
      assert.equal(result.mode, "live");
      if (result.mode === "live") {
        assert.equal(typeof result.modelCalls, "number");
        assert.equal(typeof result.providerCalls, "number");
        assert.equal(typeof result.sessionId, "string");
      }
      cleanupSession(sessionId);
    });
    it("67 live result includes sessionId", async () => {
      const sessionId = `disc-sess-${Date.now()}`;
      cleanupSession(sessionId);
      const result = await runLiveCalibration(liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 }), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "disc-sess",
        env: { [ANTHROPIC_API_KEY_ENV]: "fake" },
        providerInvoker: createMockInvoker(),
      });
      if (result.mode === "live") {
        assert.equal(result.sessionId, sessionId);
      }
      cleanupSession(sessionId);
    });
  });

  describe("regression", () => {
    it("68 live mode no longer returns not_implemented", async () => {
      const result = await runLiveCalibration(liveSmokeArgs(), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "regression",
        env: {},
      });
      assert.notEqual(result.failureCode, "live_execution_not_implemented" as never);
    });
    it("69 missing_api_key failure code exists", () => {
      const e = new LiveCalibrationError("missing_api_key", "test");
      assert.equal(e.exitCode, LIVE_CALIBRATION_EXIT.authorizationFailure);
    });
    it("70 production writes remain zero in live", async () => {
      const sessionId = `reg-prod-${Date.now()}`;
      cleanupSession(sessionId);
      const result = await runLiveCalibration(liveSmokeArgs({ sessionId, maxTotalCostUsd: 1 }), {
        bypassFeatureFlags: true,
        writeArtifacts: false,
        randomId: () => "reg-prod",
        env: { [ANTHROPIC_API_KEY_ENV]: "fake" },
        providerInvoker: createMockInvoker(),
      });
      assert.equal(result.productionWrites, 0);
      assert.equal(result.productionExecutionOccurred, false);
      cleanupSession(sessionId);
    });
    it("71 call plan still has 3 smoke calls", () => {
      const args = liveSmokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "reg",
      });
      assert.equal(plan.calls.length, 3);
    });
    it("72 live auth accepts model id directly", () => {
      const r = validateLiveSmokeAuthorization({
        args: liveSmokeArgs({ model: "claude-3-5-haiku-20241022" }),
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, true);
    });
    it("73 runbook doc exists", () => {
      const path = join(ROOT, "docs/architecture/expert-calibration-live-3b2.md");
      assert.ok(existsSync(path));
      const content = readFileSync(path, "utf8");
      assert.match(content, /PR 3B-2/);
      assert.match(content, /session-id/);
    });
  });
});
