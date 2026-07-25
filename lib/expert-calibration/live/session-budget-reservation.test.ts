import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { LiveCalibrationError } from "./errors.ts";
import {
  loadSessionBudget,
  reserveSessionCallBudget,
  settleSessionReservation,
  markSessionReservationFailed,
  getSessionAvailableMicroUsd,
  writeSessionBudget,
  LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
} from "./session-budget.ts";
import { usdToMicroUsd } from "./budget-controller.ts";

function tempSessionsRoot(): string {
  return mkdtempSync(join(tmpdir(), "cal-session-budget-"));
}

function cleanupDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function sessionPath(cwd: string, sessionId: string): string {
  return join(cwd, ".calibration-results", "sessions", `${sessionId}.json`);
}

describe("Expert Calibration Live session budget atomic reservations", () => {
  it("1 reservation persists before provider invocation would occur", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "persist-before-provider";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 1,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });
      assert.ok(existsSync(sessionPath(cwd, sessionId)));
      const budget = loadSessionBudget(sessionId, 1, cwd);
      assert.equal(budget.reservations[reservation.reservationId]?.status, "active");
      assert.equal(budget.reserved_micro_usd, reservation.reservedMicroUsd);
    } finally {
      cleanupDir(cwd);
    }
  });

  it("2 concurrent reservations cannot both exceed the session ceiling", async () => {
    const cwd = tempSessionsRoot();
    const sessionId = "concurrent-ceiling";
    try {
      const first = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.03,
        runId: "run-a",
        caseId: "me-coc-001",
        correlationId: "corr-a",
        reservedCostUsd: 0.02,
        reservationId: "res-a",
        cwd,
      });
      assert.ok(first.reservationId);

      assert.throws(
        () =>
          reserveSessionCallBudget({
            sessionId,
            maxCostUsd: 0.03,
            runId: "run-b",
            caseId: "me-coc-002",
            correlationId: "corr-b",
            reservedCostUsd: 0.02,
            reservationId: "res-b",
            cwd,
          }),
        LiveCalibrationError,
      );
    } finally {
      cleanupDir(cwd);
    }
  });

  it("3 losing reservation fails before provider invoker is called", async () => {
    const { executeLive } = await import("./live-executor.ts");
    const { buildLiveCalibrationCallPlan } = await import("./call-planner.ts");
    const { resolveProviderSpec } = await import("./provider-allowlist.ts");
    const cwd = tempSessionsRoot();
    const sessionId = "loser-before-provider";
    let invokerCalls = 0;

    try {
      writeSessionBudget(
        {
          schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
          session_id: sessionId,
          max_cost_micro_usd: usdToMicroUsd(0.01),
          spent_estimated_micro_usd: usdToMicroUsd(0.01),
          spent_actual_micro_usd: usdToMicroUsd(0.01),
          reserved_micro_usd: 0,
          version: 1,
          run_count: 1,
          reservations: Object.freeze({}),
        },
        cwd,
      );

      const args = Object.freeze({
        mode: "live" as const,
        expert: "military_expert" as const,
        suite: "military_expert_v1_draft_golden",
        subset: "military_expert_smoke_v1" as const,
        provider: "anthropic" as const,
        model: "haiku-v1",
        runs: 1,
        maxCalls: 3,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.02,
        maxInputTokens: 50_000,
        maxOutputTokens: 50_000,
        timeoutMs: 120_000,
        maxRuntimeMs: 600_000,
        outputDir: ".calibration-results/test-live",
        overwrite: true,
        sessionId,
        sessionMaxCostUsd: 0.01,
        retainRawResponses: false,
      });

      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "res-loss",
      });

      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "run-loss",
        correlationId: "corr-loss",
        startedAt: 1,
        providerInvoker: async () => {
          invokerCalls += 1;
          return { ok: false, providerError: { code: "should_not_run", message: "fail" }, durationMs: 1 };
        },
        writeArtifacts: false,
        bypassFeatureFlags: true,
        cwd,
      });

      assert.equal(result.providerCalls, 0);
      assert.equal(invokerCalls, 0);
      assert.equal(result.failureCode, "cost_limit_exceeded");
    } finally {
      cleanupDir(cwd);
    }
  });

  it("4 two reservations succeed when combined amount remains within budget", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "dual-within-budget";
    try {
      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        reservationId: "res-1",
        cwd,
      });
      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-002",
        correlationId: "corr-2",
        reservedCostUsd: 0.02,
        reservationId: "res-2",
        cwd,
      });
      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(budget.reserved_micro_usd, usdToMicroUsd(0.04));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("5 reserved budget reduces available budget immediately", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "available-reduced";
    try {
      const before = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(getSessionAvailableMicroUsd(before), usdToMicroUsd(0.05));

      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      const after = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(getSessionAvailableMicroUsd(after), usdToMicroUsd(0.03));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("6 settlement releases unused reserved capacity", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "settle-release";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      settleSessionReservation({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.02,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(budget.reserved_micro_usd, 0);
      assert.equal(getSessionAvailableMicroUsd(budget), usdToMicroUsd(0.03));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("7 settlement records estimated and actual amounts distinctly", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "settle-distinct";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      settleSessionReservation({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.02,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(budget.spent_actual_micro_usd, usdToMicroUsd(0.01));
      assert.equal(budget.spent_estimated_micro_usd, usdToMicroUsd(0.02));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("8 failed provider attempt charges reserved estimate", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "failed-charge";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      markSessionReservationFailed({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        chargeEstimatedUsd: 0.02,
        chargeActualUsd: 0,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(budget.spent_estimated_micro_usd, usdToMicroUsd(0.02));
      assert.equal(budget.reserved_micro_usd, 0);
      assert.equal(budget.reservations[reservation.reservationId]?.status, "failed");
    } finally {
      cleanupDir(cwd);
    }
  });

  it("9 timeout reconciliation leaves auditable failed reservation", async () => {
    const { executeLive } = await import("./live-executor.ts");
    const { buildLiveCalibrationCallPlan } = await import("./call-planner.ts");
    const { resolveProviderSpec } = await import("./provider-allowlist.ts");
    const cwd = tempSessionsRoot();
    const sessionId = "timeout-reservation";

    try {
      const args = Object.freeze({
        mode: "live" as const,
        expert: "military_expert" as const,
        suite: "military_expert_v1_draft_golden",
        subset: "military_expert_smoke_v1" as const,
        provider: "anthropic" as const,
        model: "haiku-v1",
        runs: 1,
        maxCalls: 3,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.02,
        maxInputTokens: 50_000,
        maxOutputTokens: 50_000,
        timeoutMs: 120_000,
        maxRuntimeMs: 600_000,
        outputDir: ".calibration-results/test-live",
        overwrite: true,
        sessionId,
        sessionMaxCostUsd: 1,
        retainRawResponses: false,
      });

      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "timeout-res",
      });

      await executeLive({
        args,
        callPlan: plan,
        runId: "run-timeout",
        correlationId: "corr-timeout",
        startedAt: 1,
        providerInvoker: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
        writeArtifacts: false,
        bypassFeatureFlags: true,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 1, cwd);
      const activeOrFailed = Object.values(budget.reservations).filter(
        (entry) => entry.status === "failed" || entry.status === "active",
      );
      assert.ok(activeOrFailed.length >= 1);
      assert.notEqual(activeOrFailed[0]?.settled_at, null);
    } finally {
      cleanupDir(cwd);
    }
  });

  it("10 abort before provider releases reservation without charge", async () => {
    const cwd = tempSessionsRoot();
    const sessionId = "abort-no-charge";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      markSessionReservationFailed({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        chargeEstimatedUsd: 0,
        chargeActualUsd: 0,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(budget.spent_estimated_micro_usd, 0);
      assert.equal(budget.reserved_micro_usd, 0);
    } finally {
      cleanupDir(cwd);
    }
  });

  it("11 version conflict fails closed on double settlement", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "double-settle";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      settleSessionReservation({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.02,
        cwd,
      });

      assert.throws(
        () =>
          settleSessionReservation({
            sessionId,
            maxCostUsd: 0.05,
            reservationId: reservation.reservationId,
            actualCostUsd: 0.01,
            estimatedCostUsd: 0.02,
            cwd,
          }),
        LiveCalibrationError,
      );
    } finally {
      cleanupDir(cwd);
    }
  });

  it("12 crash-like active reservation remains reserved", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "crash-active";
    try {
      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        reservationId: "crash-res",
        cwd,
      });

      const reloaded = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(reloaded.reservations["crash-res"]?.status, "active");
      assert.equal(reloaded.reserved_micro_usd, usdToMicroUsd(0.02));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("13 active reservation is not silently expired", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "no-auto-expire";
    try {
      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        reservationId: "stay-active",
        cwd,
      });

      const later = loadSessionBudget(sessionId, 0.05, cwd);
      assert.equal(later.reservations["stay-active"]?.status, "active");
      assert.equal(later.reserved_micro_usd, usdToMicroUsd(0.02));
    } finally {
      cleanupDir(cwd);
    }
  });

  it("14 available budget never becomes negative", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "non-negative";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      settleSessionReservation({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.02,
        cwd,
      });

      const budget = loadSessionBudget(sessionId, 0.05, cwd);
      assert.ok(getSessionAvailableMicroUsd(budget) >= 0);
    } finally {
      cleanupDir(cwd);
    }
  });

  it("15 double settlement rejected", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "no-double-settle";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      settleSessionReservation({
        sessionId,
        maxCostUsd: 0.05,
        reservationId: reservation.reservationId,
        actualCostUsd: 0.01,
        estimatedCostUsd: 0.02,
        cwd,
      });

      assert.throws(
        () =>
          settleSessionReservation({
            sessionId,
            maxCostUsd: 0.05,
            reservationId: reservation.reservationId,
            actualCostUsd: 0.01,
            estimatedCostUsd: 0.02,
            cwd,
          }),
        (error: unknown) =>
          error instanceof LiveCalibrationError && error.code === "correlation_mismatch",
      );
    } finally {
      cleanupDir(cwd);
    }
  });

  it("16 unknown reservation ID rejected", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "unknown-reservation";
    try {
      assert.throws(
        () =>
          settleSessionReservation({
            sessionId,
            maxCostUsd: 0.05,
            reservationId: "missing-id",
            actualCostUsd: 0.01,
            estimatedCostUsd: 0.02,
            cwd,
          }),
        LiveCalibrationError,
      );
    } finally {
      cleanupDir(cwd);
    }
  });

  it("17 reservation cannot be settled by a different session", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "session-a";
    try {
      const reservation = reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      assert.throws(
        () =>
          settleSessionReservation({
            sessionId: "session-b",
            maxCostUsd: 0.05,
            reservationId: reservation.reservationId,
            actualCostUsd: 0.01,
            estimatedCostUsd: 0.02,
            cwd,
          }),
        LiveCalibrationError,
      );
    } finally {
      cleanupDir(cwd);
    }
  });

  it("18 provider invocation is never reached after failed reservation", async () => {
    const { executeLive } = await import("./live-executor.ts");
    const { buildLiveCalibrationCallPlan } = await import("./call-planner.ts");
    const { resolveProviderSpec } = await import("./provider-allowlist.ts");
    const cwd = tempSessionsRoot();
    const sessionId = "never-invoke";
    let invokerCalls = 0;

    try {
      writeSessionBudget(
        {
          schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
          session_id: sessionId,
          max_cost_micro_usd: usdToMicroUsd(0.001),
          spent_estimated_micro_usd: usdToMicroUsd(0.001),
          spent_actual_micro_usd: usdToMicroUsd(0.001),
          reserved_micro_usd: 0,
          version: 2,
          run_count: 1,
          reservations: Object.freeze({}),
        },
        cwd,
      );

      const args = Object.freeze({
        mode: "live" as const,
        expert: "military_expert" as const,
        suite: "military_expert_v1_draft_golden",
        subset: "military_expert_smoke_v1" as const,
        provider: "anthropic" as const,
        model: "haiku-v1",
        runs: 1,
        maxCalls: 3,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.02,
        maxInputTokens: 50_000,
        maxOutputTokens: 50_000,
        timeoutMs: 120_000,
        maxRuntimeMs: 600_000,
        outputDir: ".calibration-results/test-live",
        overwrite: true,
        sessionId,
        sessionMaxCostUsd: 0.001,
        retainRawResponses: false,
      });

      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "never-invoke",
      });

      await executeLive({
        args,
        callPlan: plan,
        runId: "run-never",
        correlationId: "corr-never",
        startedAt: 1,
        providerInvoker: async () => {
          invokerCalls += 1;
          return { ok: true, rawResponse: undefined, durationMs: 1 };
        },
        writeArtifacts: false,
        bypassFeatureFlags: true,
        cwd,
      });

      assert.equal(invokerCalls, 0);
    } finally {
      cleanupDir(cwd);
    }
  });

  it("19 concurrent test uses separate store roots", () => {
    const cwdA = tempSessionsRoot();
    const cwdB = tempSessionsRoot();
    try {
      reserveSessionCallBudget({
        sessionId: "shared-id",
        maxCostUsd: 0.05,
        runId: "run-a",
        caseId: "me-coc-001",
        correlationId: "corr-a",
        reservedCostUsd: 0.02,
        cwd: cwdA,
      });
      reserveSessionCallBudget({
        sessionId: "shared-id",
        maxCostUsd: 0.05,
        runId: "run-b",
        caseId: "me-coc-002",
        correlationId: "corr-b",
        reservedCostUsd: 0.02,
        cwd: cwdB,
      });

      const budgetA = loadSessionBudget("shared-id", 0.05, cwdA);
      const budgetB = loadSessionBudget("shared-id", 0.05, cwdB);
      assert.equal(budgetA.reserved_micro_usd, usdToMicroUsd(0.02));
      assert.equal(budgetB.reserved_micro_usd, usdToMicroUsd(0.02));
    } finally {
      cleanupDir(cwdA);
      cleanupDir(cwdB);
    }
  });

  it("20 artifacts remain confined to approved result root", () => {
    const cwd = tempSessionsRoot();
    const sessionId = "artifact-root";
    try {
      reserveSessionCallBudget({
        sessionId,
        maxCostUsd: 0.05,
        runId: "run-1",
        caseId: "me-coc-001",
        correlationId: "corr-1",
        reservedCostUsd: 0.02,
        cwd,
      });

      const path = sessionPath(cwd, sessionId);
      assert.ok(path.includes(".calibration-results"));
      assert.ok(path.includes("sessions"));
      const raw = readFileSync(path, "utf8");
      assert.doesNotMatch(raw, /sk-ant/);
      assert.doesNotMatch(raw, /systemPrompt/);
    } finally {
      cleanupDir(cwd);
    }
  });
});
