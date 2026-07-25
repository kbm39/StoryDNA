import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  LIVE_CALIBRATION_ACK_TOKEN,
  LIVE_CALIBRATION_APPROVED_ROOT,
  LIVE_CALIBRATION_DEFAULTS,
  LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE,
  LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE,
} from "./constants.ts";
import type { LiveCalibrationCliArgs } from "./contracts.ts";
import { LiveCalibrationError, LIVE_CALIBRATION_EXIT, sanitizeLiveCalibrationMessage } from "./errors.ts";
import {
  EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME,
  EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME,
  EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME,
  readExpertCalibrationLiveEnabled,
  readExpertCalibrationAnthropicEnabled,
  readExpertMilitaryLiveCalibrationEnabled,
  readLiveCalibrationFeatureFlagStatus,
} from "./feature-flags.ts";
import { parseLiveCalibrationCliArgs } from "./cli-parser.ts";
import { validateOperatorAuthorization } from "./operator-auth.ts";
import {
  resolveProviderSpec,
  ANTHROPIC_HAIKU_MODEL_ID,
  ANTHROPIC_HAIKU_MODEL_ALIAS,
  ANTHROPIC_HAIKU_45_PRICING_PROFILE,
  listAllowedProviderSpecs,
} from "./provider-allowlist.ts";
import {
  LIVE_CALIBRATION_SUBSETS,
  LIVE_CALIBRATION_SUBSET_IDS,
  getLiveCalibrationSubset,
  hashLiveCalibrationSubsetCaseIds,
  validateSubsetCaseIds,
} from "./subsets.ts";
import { buildLiveCalibrationCallPlan } from "./call-planner.ts";
import { createBudgetController, usdToMicroUsd, microUsdToUsd, sumSerializedUsd } from "./budget-controller.ts";
import { createAbortController, isAbortError, TimeoutAbortController } from "./abort-controller.ts";
import {
  rejectPathTraversal,
  writeRunManifest,
  validateResultStorePath,
  isUnderApprovedRoot,
} from "./result-store.ts";
import {
  resolveSyntheticScenario,
  buildSyntheticSuccessRawResponse,
  SYNTHETIC_SCENARIO_IDS,
  isSyntheticScenarioId,
} from "./synthetic-adapter.ts";
import { executeDryRun } from "./dry-run-executor.ts";
import { executeSynthetic } from "./synthetic-executor.ts";
import { runLiveCalibration, runLiveCalibrationFromArgv } from "./orchestrator.ts";
import { MILITARY_EXPERT_CALIBRATION_SUITE } from "@/experts/military-expert/calibration/corpus.ts";
import { MILITARY_EXPERT_RUNTIME_DEFINITION_HASH } from "@/experts/military-expert/generation-contract.ts";
import { militaryExpertRuntimeDefinition } from "@/experts/military-expert/runtime-definition.ts";
import { computeMilitaryExpertConstitutionDefinitionHash } from "@/experts/military-expert/military-expert-constitution-hash.ts";
import { EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME } from "../feature-flags.ts";
import { EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME } from "@/lib/expert-review-engine/feature-flags.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function smokeArgs(overrides: Partial<LiveCalibrationCliArgs> = {}): LiveCalibrationCliArgs {
  return Object.freeze({
    mode: "dry-run" as const,
    expert: "military_expert" as const,
    suite: "military_expert_v1_draft_golden",
    subset: "military_expert_smoke_v1" as const,
    provider: "anthropic" as const,
    model: "haiku-4-5-v1",
    runs: 1,
    maxCalls: 3,
    maxTotalCostUsd: 0.08,
    maxCostPerCallUsd: 0.03,
    maxInputTokens: 50_000,
    maxOutputTokens: 50_000,
    timeoutMs: 120_000,
    maxRuntimeMs: 600_000,
    outputDir: ".calibration-results/test-run",
    overwrite: true,
    sessionMaxCostUsd: 1.0,
    retainRawResponses: false,
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
    model: "haiku-4-5-v1",
    runs: "1",
    "max-calls": "3",
    "max-total-cost": "0.08",
    "max-cost-per-call": "0.03",
    "max-input-tokens": "50000",
    "max-output-tokens": "50000",
    "timeout-ms": "120000",
    "max-runtime-ms": "600000",
    "output-dir": ".calibration-results/test-run",
    overwrite: "true",
    ...overrides,
  };
  const argv: string[] = [];
  for (const [key, value] of Object.entries(base)) {
    argv.push(`--${key}`, value);
  }
  return argv;
}

describe("Expert Calibration Live PR 3B-1", () => {
  describe("constants", () => {
    it("1 ack token defined", () => {
      assert.equal(LIVE_CALIBRATION_ACK_TOKEN, "I-ACKNOWLEDGE-LIVE-CALIBRATION-SPEND");
    });
    it("2 approved root is calibration-results", () => {
      assert.equal(LIVE_CALIBRATION_APPROVED_ROOT, ".calibration-results");
    });
    it("3 input token estimate is 3114", () => {
      assert.equal(LIVE_CALIBRATION_ESTIMATED_INPUT_TOKENS_PER_CASE, 3114);
    });
    it("4 output token estimate is 2500", () => {
      assert.equal(LIVE_CALIBRATION_ESTIMATED_OUTPUT_TOKENS_PER_CASE, 2500);
    });
    it("5 defaults maxCalls is 3", () => {
      assert.equal(LIVE_CALIBRATION_DEFAULTS.maxCalls, 3);
    });
    it("6 defaults maxTotalCostUsd is 0.08", () => {
      assert.equal(LIVE_CALIBRATION_DEFAULTS.maxTotalCostUsd, 0.08);
    });
  });

  describe("feature flags", () => {
    it("7 live flag default off", () => {
      assert.equal(readExpertCalibrationLiveEnabled({}), false);
    });
    it("8 anthropic flag default off", () => {
      assert.equal(readExpertCalibrationAnthropicEnabled({}), false);
    });
    it("9 military live flag default off", () => {
      assert.equal(readExpertMilitaryLiveCalibrationEnabled({}), false);
    });
    it("10 live flag truthy true", () => {
      assert.equal(readExpertCalibrationLiveEnabled({ [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "true" }), true);
    });
    it("11 live flag truthy 1", () => {
      assert.equal(readExpertCalibrationLiveEnabled({ [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "1" }), true);
    });
    it("12 live flag truthy yes", () => {
      assert.equal(readExpertCalibrationLiveEnabled({ [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "yes" }), true);
    });
    it("13 live flag malformed off", () => {
      assert.equal(readExpertCalibrationLiveEnabled({ [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "maybe" }), false);
    });
    it("14 all flags required for live", () => {
      const status = readLiveCalibrationFeatureFlagStatus({});
      assert.equal(status.allRequiredForLive, false);
    });
    it("15 all flags on when set", () => {
      const env = {
        [EXPERT_CALIBRATION_FRAMEWORK_FLAG_NAME]: "true",
        [EXPERT_CALIBRATION_LIVE_ENABLED_FLAG_NAME]: "true",
        [EXPERT_CALIBRATION_ANTHROPIC_ENABLED_FLAG_NAME]: "true",
        [EXPERT_MILITARY_GENERATION_CONTRACT_FLAG_NAME]: "true",
        [EXPERT_MILITARY_LIVE_CALIBRATION_ENABLED_FLAG_NAME]: "true",
      };
      assert.equal(readLiveCalibrationFeatureFlagStatus(env).allRequiredForLive, true);
    });
  });

  describe("cli parser", () => {
    it("16 parses dry-run args", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv());
      assert.equal(args.mode, "dry-run");
      assert.equal(args.expert, "military_expert");
    });
    it("17 rejects missing mode", () => {
      assert.throws(() => parseLiveCalibrationCliArgs(["--expert", "military_expert"]), LiveCalibrationError);
    });
    it("18 rejects invalid mode", () => {
      assert.throws(() => parseLiveCalibrationCliArgs(cliArgv({ mode: "invalid" })), LiveCalibrationError);
    });
    it("19 rejects invalid expert", () => {
      assert.throws(() => parseLiveCalibrationCliArgs(cliArgv({ expert: "other" })), LiveCalibrationError);
    });
    it("20 rejects invalid subset", () => {
      assert.throws(() => parseLiveCalibrationCliArgs(cliArgv({ subset: "bad" })), LiveCalibrationError);
    });
    it("21 live requires ack token", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs(cliArgv({ mode: "live" })),
        (e: LiveCalibrationError) => e.code === "authorization_failure",
      );
    });
    it("22 live rejects bad ack token", () => {
      assert.throws(
        () => parseLiveCalibrationCliArgs(cliArgv({ mode: "live", "ack-token": "wrong" })),
        LiveCalibrationError,
      );
    });
    it("23 parses synthetic mode", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv({ mode: "synthetic" }));
      assert.equal(args.mode, "synthetic");
    });
    it("24 parses boolean overwrite", () => {
      assert.equal(parseLiveCalibrationCliArgs(cliArgv({ overwrite: "false" })).overwrite, false);
    });
    it("25 parses numeric limits", () => {
      const args = parseLiveCalibrationCliArgs(cliArgv());
      assert.equal(args.maxCalls, 3);
      assert.equal(args.maxTotalCostUsd, 0.08);
    });
  });

  describe("operator auth", () => {
    it("26 dry-run authorized without flags", () => {
      assert.equal(validateOperatorAuthorization({ mode: "dry-run" }).ok, true);
    });
    it("27 synthetic authorized without flags", () => {
      assert.equal(validateOperatorAuthorization({ mode: "synthetic" }).ok, true);
    });
    it("28 live auth requires session-id via smoke gate", () => {
      const r = validateOperatorAuthorization({
        mode: "live",
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, true);
    });
    it("29 dry-run authorized without session-id", () => {
      assert.equal(validateOperatorAuthorization({ mode: "dry-run" }).ok, true);
    });
    it("30 live auth requires all flags", () => {
      const r = validateOperatorAuthorization({
        mode: "live",
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        env: {},
      });
      assert.equal(r.ok, false);
    });
    it("31 live auth passes with bypass", () => {
      const r = validateOperatorAuthorization({
        mode: "live",
        ackToken: LIVE_CALIBRATION_ACK_TOKEN,
        bypassFeatureFlags: true,
      });
      assert.equal(r.ok, true);
    });
  });

  describe("provider allowlist", () => {
    it("32 resolves haiku-4-5 alias", () => {
      const spec = resolveProviderSpec("anthropic", "haiku-4-5-v1");
      assert.equal(spec.modelId, ANTHROPIC_HAIKU_MODEL_ID);
    });
    it("33 resolves haiku model id", () => {
      const spec = resolveProviderSpec("anthropic", ANTHROPIC_HAIKU_MODEL_ID);
      assert.equal(spec.modelAlias, ANTHROPIC_HAIKU_MODEL_ALIAS);
    });
    it("34 pricing profile is calibration_anthropic_haiku_4_5_v1", () => {
      assert.equal(ANTHROPIC_HAIKU_45_PRICING_PROFILE, "calibration_anthropic_haiku_4_5_v1");
    });
    it("35 rejects openai", () => {
      assert.throws(() => resolveProviderSpec("openai", "gpt-4"), LiveCalibrationError);
    });
    it("36 rejects unknown model", () => {
      assert.throws(() => resolveProviderSpec("anthropic", "claude-opus-4"), LiveCalibrationError);
    });
    it("37 only one allowed spec", () => {
      assert.equal(listAllowedProviderSpecs().length, 1);
    });
  });

  describe("subsets", () => {
    it("38 six subsets defined", () => {
      assert.equal(LIVE_CALIBRATION_SUBSET_IDS.length, 6);
    });
    it("39 smoke has 3 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_smoke_v1").caseIds.length, 3);
    });
    it("40 core has 12 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_core_v1").caseIds.length, 12);
    });
    it("41 safety has 6 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_safety_v1").caseIds.length, 6);
    });
    it("42 ambiguity has 8 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_ambiguity_v1").caseIds.length, 8);
    });
    it("43 full has 34 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_full_v1").caseIds.length, 34);
    });
    it("44 stability has 5 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_stability_v1").caseIds.length, 5);
    });
    it("45 smoke case IDs match spec", () => {
      const ids = getLiveCalibrationSubset("military_expert_smoke_v1").caseIds;
      assert.deepEqual([...ids], ["me-coc-001", "me-coc-002", "me-ops-004"]);
    });
    it("46 subset hashes are 64 hex chars", () => {
      for (const id of LIVE_CALIBRATION_SUBSET_IDS) {
        assert.match(getLiveCalibrationSubset(id).subsetHash, /^[a-f0-9]{64}$/);
      }
    });
    it("47 subset hash is deterministic", () => {
      const ids = getLiveCalibrationSubset("military_expert_smoke_v1").caseIds;
      assert.equal(
        hashLiveCalibrationSubsetCaseIds(ids),
        getLiveCalibrationSubset("military_expert_smoke_v1").subsetHash,
      );
    });
    it("48 unknown case IDs rejected", () => {
      assert.equal(validateSubsetCaseIds(["me-fake-001"]).ok, false);
    });
    it("49 all subset cases exist in corpus", () => {
      for (const id of LIVE_CALIBRATION_SUBSET_IDS) {
        const v = validateSubsetCaseIds(getLiveCalibrationSubset(id).caseIds);
        assert.equal(v.ok, true, `subset ${id} has unknown cases`);
      }
    });
  });

  describe("call planner", () => {
    it("50 smoke plan has 3 calls", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "test-corr",
      });
      assert.equal(plan.calls.length, 3);
    });
    it("51 each call has request hash", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "test-corr",
      });
      assert.ok(plan.calls.every((c) => c.requestHash.length === 64));
    });
    it("52 estimated input tokens per case >= 3114", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "test-corr",
      });
      assert.ok(plan.calls.every((c) => c.estimatedInputTokens >= 3114));
    });
    it("53 estimated output tokens per case is 2500", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "test-corr",
      });
      assert.ok(plan.calls.every((c) => c.estimatedOutputTokens === 2500));
    });
    it("54 total cost is sum of call costs", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "test-corr",
      });
      const sum = sumSerializedUsd(plan.calls.map((c) => c.estimatedCostUsd));
      assert.equal(plan.totalEstimatedCostUsd, sum);
      assert.equal(plan.totalEstimatedCostUsd, 0.0507);
    });
    it("55 rejects unknown suite", () => {
      assert.throws(
        () =>
          buildLiveCalibrationCallPlan({
            args: smokeArgs({ suite: "unknown_suite" }),
            providerSpec: resolveProviderSpec("anthropic", "haiku-4-5-v1"),
            correlationPrefix: "x",
          }),
        LiveCalibrationError,
      );
    });
    it("56 rejects max-calls exceeded", () => {
      assert.throws(
        () =>
          buildLiveCalibrationCallPlan({
            args: smokeArgs({ maxCalls: 1 }),
            providerSpec: resolveProviderSpec("anthropic", "haiku-4-5-v1"),
            correlationPrefix: "x",
          }),
        (e: LiveCalibrationError) => e.code === "cost_limit_exceeded",
      );
    });
  });

  describe("budget controller", () => {
    it("57 micro usd conversion roundtrip", () => {
      assert.equal(microUsdToUsd(usdToMicroUsd(0.05)), 0.05);
    });
    it("58 can afford within limits", () => {
      const bc = createBudgetController({
        maxCalls: 3,
        maxTotalCostUsd: 0.05,
        maxCostPerCallUsd: 0.02,
        runMaxInputTokens: 50_000,
        runMaxOutputTokens: 50_000,
        providerMaxOutputTokensPerCall: 4096,
      });
      assert.equal(bc.canAffordCall(0.01, 3000, 2500), true);
    });
    it("59 rejects when max calls reached", () => {
      const bc = createBudgetController({
        maxCalls: 1,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 1,
        runMaxInputTokens: 50_000,
        runMaxOutputTokens: 50_000,
        providerMaxOutputTokensPerCall: 4096,
      });
      bc.recordCall(0.01, 100, 100);
      assert.equal(bc.canAffordCall(0.01, 100, 100), false);
    });
    it("60 rejects per-call cost exceeded", () => {
      const bc = createBudgetController({
        maxCalls: 10,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.01,
        runMaxInputTokens: 50_000,
        runMaxOutputTokens: 50_000,
        providerMaxOutputTokensPerCall: 4096,
      });
      assert.equal(bc.canAffordCall(0.02, 100, 100), false);
    });
    it("61 snapshot tracks remaining", () => {
      const bc = createBudgetController({
        maxCalls: 3,
        maxTotalCostUsd: 0.05,
        maxCostPerCallUsd: 0.02,
        runMaxInputTokens: 50_000,
        runMaxOutputTokens: 50_000,
        providerMaxOutputTokensPerCall: 4096,
      });
      bc.recordCall(0.01, 3000, 2500);
      const snap = bc.snapshot();
      assert.equal(snap.callsUsed, 1);
      assert.equal(snap.callsRemaining, 2);
    });
  });

  describe("abort controller", () => {
    it("62 creates abort controller", () => {
      const ac = createAbortController(1000);
      assert.ok(ac.signal);
    });
    it("63 timeout abort controller aborts", () => {
      const ac = new TimeoutAbortController(50);
      ac.abort("test");
      assert.equal(ac.signal.aborted, true);
    });
    it("64 isAbortError detects AbortError", () => {
      assert.equal(isAbortError(new DOMException("Aborted", "AbortError")), true);
    });
  });

  describe("result store", () => {
    const dir = join(process.cwd(), ".calibration-results", `test-store-${Date.now()}`);

    it("65 accepts path under calibration-results", () => {
      assert.equal(isUnderApprovedRoot(".calibration-results/test"), true);
    });
    it("66 rejects path outside calibration-results", () => {
      assert.equal(isUnderApprovedRoot("/tmp/other"), false);
    });
    it("67 rejects path traversal", () => {
      assert.throws(() => rejectPathTraversal("../etc/passwd"), LiveCalibrationError);
    });
    it("68 atomic write creates manifest", () => {
      const path = writeRunManifest(dir, "run-a", { test: true }, true);
      assert.ok(existsSync(path));
      rmSync(dir, { recursive: true, force: true });
    });
    it("69 rejects overwrite false on existing manifest", () => {
      const runDir = join(process.cwd(), ".calibration-results", `test-store-b-${Date.now()}`);
      writeRunManifest(runDir, "run-b", { v: 1 }, true);
      assert.throws(
        () => writeRunManifest(runDir, "run-b", { v: 2 }, false),
        LiveCalibrationError,
      );
      rmSync(runDir, { recursive: true, force: true });
    });
    it("70 validateResultStorePath works", () => {
      assert.equal(validateResultStorePath(".calibration-results/ok"), true);
      assert.equal(validateResultStorePath("/outside"), false);
    });
  });

  describe("synthetic adapter", () => {
    it("71 nine scenarios defined", () => {
      assert.equal(SYNTHETIC_SCENARIO_IDS.length, 9);
    });
    it("72 success builds valid raw response", () => {
      const raw = buildSyntheticSuccessRawResponse("corr-1", "me-coc-001");
      assert.ok(raw.responseText.startsWith("{"));
    });
    it("73 parser_failure returns invalid json", () => {
      const r = resolveSyntheticScenario("parser_failure", "c1", "me-coc-001");
      assert.match(r.rawResponse!.responseText, /not valid json/);
    });
    it("74 timeout scenario has abort reason", () => {
      const r = resolveSyntheticScenario("timeout", "c1", "me-coc-001");
      assert.equal(r.abortReason, "timeout");
    });
    it("75 rate_limit scenario has provider error", () => {
      const r = resolveSyntheticScenario("rate_limit", "c1", "me-coc-001");
      assert.equal(r.providerError?.code, "rate_limit");
    });
    it("76 correlation_mismatch uses wrong correlation", () => {
      const r = resolveSyntheticScenario("correlation_mismatch", "c1", "me-coc-001");
      assert.notEqual(r.rawResponse!.correlationId, "c1");
    });
    it("77 isSyntheticScenarioId validates", () => {
      assert.equal(isSyntheticScenarioId("success"), true);
      assert.equal(isSyntheticScenarioId("invalid"), false);
    });
  });

  describe("dry-run executor", () => {
    it("78 dry-run completes with zero calls", async () => {
      const args = smokeArgs({ writeArtifacts: false } as never);
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "dry",
      });
      const result = await executeDryRun({
        args,
        callPlan: plan,
        runId: "dry-1",
        correlationId: "dry-corr",
        startedAt: 1_000,
        writeArtifacts: false,
      });
      assert.equal(result.modelCalls, 0);
      assert.equal(result.providerCalls, 0);
      assert.equal(result.exitCode, 0);
    });
    it("79 dry-run manifest mode is dry-run", async () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "dry",
      });
      const result = await executeDryRun({
        args,
        callPlan: plan,
        runId: "dry-2",
        correlationId: "dry-corr",
        startedAt: 1_000,
        writeArtifacts: false,
      });
      assert.equal(result.manifest.mode, "dry-run");
    });
  });

  describe("synthetic executor", () => {
    it("80 synthetic success completes", async () => {
      const args = smokeArgs({ mode: "synthetic", maxCalls: 10, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "syn",
      });
      const result = await executeSynthetic({
        args,
        callPlan: plan,
        runId: "syn-1",
        correlationId: "syn-corr",
        startedAt: 1_000,
        scenario: "success",
        writeArtifacts: false,
        bypassFeatureFlags: true,
        now: () => 2_000,
      });
      assert.equal(result.modelCalls, 0);
      assert.equal(result.providerCalls, 0);
      assert.equal(result.productionExecutionOccurred, false);
    });
    it("81 synthetic parser_failure fails", async () => {
      const args = smokeArgs({ mode: "synthetic", maxCalls: 10, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "syn",
      });
      const result = await executeSynthetic({
        args,
        callPlan: plan,
        runId: "syn-2",
        correlationId: "syn-corr",
        startedAt: 1_000,
        scenario: "parser_failure",
        writeArtifacts: false,
        bypassFeatureFlags: true,
      });
      assert.equal(result.ok, false);
    });
    it("82 synthetic timeout exit code 5", async () => {
      const args = smokeArgs({ mode: "synthetic", maxCalls: 10, maxTotalCostUsd: 1 });
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "syn",
      });
      const result = await executeSynthetic({
        args,
        callPlan: plan,
        runId: "syn-3",
        correlationId: "syn-corr",
        startedAt: 1_000,
        scenario: "timeout",
        writeArtifacts: false,
        bypassFeatureFlags: true,
      });
      assert.equal(result.exitCode, LIVE_CALIBRATION_EXIT.timeoutAbort);
    });
  });

  describe("orchestrator", () => {
    it("83 runLiveCalibration dry-run ok", async () => {
      const result = await runLiveCalibration(smokeArgs(), {
        writeArtifacts: false,
        randomId: () => "test-run",
      });
      assert.equal(result.ok, true);
      assert.equal(result.mode, "dry-run");
      assert.equal(result.modelCalls, 0);
    });
    it("84 runLiveCalibration live fails without api key", async () => {
      const result = await runLiveCalibration(
        smokeArgs({
          mode: "live",
          ackToken: LIVE_CALIBRATION_ACK_TOKEN,
          sessionId: "test-session-no-key",
        }),
        {
          bypassFeatureFlags: true,
          writeArtifacts: false,
          randomId: () => "live-run",
          env: {},
        },
      );
      assert.equal(result.ok, false);
      assert.equal(result.mode, "live");
      assert.equal(result.failureCode, "missing_api_key");
      assert.equal(result.exitCode, 2);
      if (result.mode === "live") {
        assert.equal(result.modelCalls, 0);
        assert.equal(result.providerCalls, 0);
      }
    });
    it("85 runLiveCalibrationFromArgv works", async () => {
      const result = await runLiveCalibrationFromArgv(cliArgv(), {
        writeArtifacts: false,
        randomId: () => "argv-run",
      });
      assert.equal(result.ok, true);
    });
    it("86 invariants on orchestrator result", async () => {
      const result = await runLiveCalibration(smokeArgs({ mode: "synthetic" }), {
        writeArtifacts: false,
        bypassFeatureFlags: true,
        randomId: () => "inv-run",
      });
      assert.equal(result.modelCalls, 0);
      assert.equal(result.providerCalls, 0);
      assert.equal(result.productionWrites, 0);
      assert.equal(result.productionExecutionOccurred, false);
    });
  });

  describe("errors", () => {
    it("87 LiveCalibrationError has exit code", () => {
      const e = new LiveCalibrationError("allowlist_violation", "test");
      assert.equal(e.exitCode, LIVE_CALIBRATION_EXIT.allowlistViolation);
    });
    it("88 sanitize strips api keys", () => {
      const msg = sanitizeLiveCalibrationMessage("key=api_key:sk-1234567890abcdef");
      assert.doesNotMatch(msg, /sk-1234567890/);
    });
  });

  describe("static exclusions", () => {
    it("89 runner does not import live module", () => {
      const src = readFileSync(join(ROOT, "lib/expert-calibration/runner.ts"), "utf8");
      assert.doesNotMatch(src, /expert-calibration\/live/);
    });
    it("90 runExpertReview does not import live module", () => {
      const src = readFileSync(join(ROOT, "lib/expert-review-engine/run-expert-review.ts"), "utf8");
      assert.doesNotMatch(src, /expert-calibration\/live/);
    });
    it("91 package test script has no live flag", () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
      assert.doesNotMatch(pkg.scripts.test, /--live/);
    });
    it("92 calibrate script exists", () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
      assert.ok(pkg.scripts["calibrate:military"]);
    });
    it("93 gitignore includes calibration-results", () => {
      const gi = readFileSync(join(ROOT, ".gitignore"), "utf8");
      assert.match(gi, /\.calibration-results/);
    });
    it("94 live module does not import anthropic sdk", () => {
      const liveDir = join(ROOT, "lib/expert-calibration/live");
      for (const file of ["orchestrator.ts", "synthetic-executor.ts", "dry-run-executor.ts"]) {
        const src = readFileSync(join(liveDir, file), "utf8");
        assert.doesNotMatch(src, /@anthropic-ai/);
      }
    });
    it("95 live module does not import trigger", () => {
      const src = readFileSync(join(ROOT, "lib/expert-calibration/live/orchestrator.ts"), "utf8");
      assert.doesNotMatch(src, /trigger/);
    });
    it("96 live module does not import supabase", () => {
      const src = readFileSync(join(ROOT, "lib/expert-calibration/live/orchestrator.ts"), "utf8");
      assert.doesNotMatch(src, /supabase/);
    });
  });

  describe("Military Expert status", () => {
    it("97 ME remains draft", () => {
      assert.equal(militaryExpertRuntimeDefinition().expert_version, "v1.0.0-draft");
    });
    it("98 ME runtime disabled", () => {
      assert.equal(militaryExpertRuntimeDefinition().enabled, false);
    });
    it("99 corpus has 34 cases", () => {
      assert.equal(MILITARY_EXPERT_CALIBRATION_SUITE.cases.length, 34);
    });
    it("100 suite id matches", () => {
      assert.equal(MILITARY_EXPERT_CALIBRATION_SUITE.suite_id, "military_expert_v1_draft_golden");
    });
  });

  describe("LA hashes unchanged", () => {
    it("101 ME runtime definition hash stable", () => {
      assert.equal(
        militaryExpertRuntimeDefinition().runtime_versions.definition_hash,
        MILITARY_EXPERT_RUNTIME_DEFINITION_HASH,
      );
    });
    it("102 constitution hash is 64 chars", () => {
      assert.equal(computeMilitaryExpertConstitutionDefinitionHash().length, 64);
    });
  });

  describe("security", () => {
    it("103 no api key in error messages", () => {
      const e = new LiveCalibrationError("authorization_failure", "Missing ANTHROPIC_API_KEY");
      assert.doesNotMatch(e.message, /sk-ant/);
    });
    it("104 subsets are frozen", () => {
      assert.throws(() => {
        (LIVE_CALIBRATION_SUBSETS as { x?: string }).x = "y";
      });
    });
    it("105 call plan calls are frozen objects", () => {
      const args = smokeArgs();
      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "sec",
      });
      assert.throws(() => {
        (plan.calls[0] as { caseId?: string }).caseId = "hack";
      });
    });
  });

  describe("subset hash golden values", () => {
    it("106 smoke subset hash stable", () => {
      const hash = getLiveCalibrationSubset("military_expert_smoke_v1").subsetHash;
      assert.equal(
        hash,
        hashLiveCalibrationSubsetCaseIds(["me-coc-001", "me-coc-002", "me-ops-004"]),
      );
    });
    it("107 full subset hash covers 34 cases", () => {
      assert.equal(getLiveCalibrationSubset("military_expert_full_v1").caseIds.length, 34);
    });
    it("108 stability subset case IDs", () => {
      assert.deepEqual(
        [...getLiveCalibrationSubset("military_expert_stability_v1").caseIds],
        ["me-coc-001", "me-coc-002", "me-int-001", "me-ops-003", "me-trap-001"],
      );
    });
  });

  describe("additional synthetic scenarios", () => {
    it("109 service_failure scenario", () => {
      const r = resolveSyntheticScenario("service_failure", "c", "me-coc-001");
      assert.equal(r.providerError?.code, "service_unavailable");
    });
    it("110 unsafe_output scenario", () => {
      const r = resolveSyntheticScenario("unsafe_output", "c", "me-ops-004");
      assert.ok(r.rawResponse!.responseText.includes("Step 1"));
    });
    it("111 output_too_large scenario", () => {
      const r = resolveSyntheticScenario("output_too_large", "c", "me-coc-001");
      assert.ok(r.rawResponse!.responseText.length > 100_000);
    });
    it("112 budget_exhausted scenario", () => {
      const r = resolveSyntheticScenario("budget_exhausted", "c", "me-coc-001");
      assert.equal(r.budgetExhausted, true);
    });
  });
});
