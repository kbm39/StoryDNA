import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LiveCalibrationSessionBudget } from "./contracts.ts";
import { LIVE_CALIBRATION_APPROVED_ROOT } from "./constants.ts";
import { LiveCalibrationError } from "./errors.ts";
import { usdToMicroUsd, microUsdToUsd } from "./budget-controller.ts";

export const LIVE_CALIBRATION_SESSION_SCHEMA_VERSION =
  "expert_calibration_session@v1" as const;

function sessionsDirectory(cwd: string = process.cwd()): string {
  return join(cwd, LIVE_CALIBRATION_APPROVED_ROOT, "sessions");
}

function sessionFilePath(sessionId: string, cwd: string = process.cwd()): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (safeId.length === 0 || safeId !== sessionId) {
    throw new LiveCalibrationError("invalid_configuration", "Invalid session ID");
  }
  return join(sessionsDirectory(cwd), `${safeId}.json`);
}

function ensureSessionsDirectory(cwd: string = process.cwd()): string {
  const dir = sessionsDirectory(cwd);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function parseSessionBudget(raw: string, sessionId: string): LiveCalibrationSessionBudget {
  const parsed = JSON.parse(raw) as LiveCalibrationSessionBudget;
  if (parsed.session_id !== sessionId) {
    throw new LiveCalibrationError("invalid_configuration", "Session ID mismatch in budget file");
  }
  if (parsed.schema_version !== LIVE_CALIBRATION_SESSION_SCHEMA_VERSION) {
    throw new LiveCalibrationError("invalid_configuration", "Unsupported session budget schema");
  }
  return parsed;
}

export function loadSessionBudget(
  sessionId: string,
  maxCostUsd: number,
  cwd: string = process.cwd(),
): LiveCalibrationSessionBudget {
  ensureSessionsDirectory(cwd);
  const path = sessionFilePath(sessionId, cwd);

  if (!existsSync(path)) {
    return Object.freeze({
      schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
      session_id: sessionId,
      max_cost_micro_usd: usdToMicroUsd(maxCostUsd),
      spent_cost_micro_usd: 0,
      version: 0,
      run_count: 0,
    });
  }

  return Object.freeze(parseSessionBudget(readFileSync(path, "utf8"), sessionId));
}

export function getSessionRemainingMicroUsd(budget: LiveCalibrationSessionBudget): number {
  return Math.max(0, budget.max_cost_micro_usd - budget.spent_cost_micro_usd);
}

export function canSessionAfford(
  budget: LiveCalibrationSessionBudget,
  estimatedCostUsd: number,
): boolean {
  return getSessionRemainingMicroUsd(budget) >= usdToMicroUsd(estimatedCostUsd);
}

export interface SessionBudgetReservation {
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly reservedMicroUsd: number;
}

export function reserveSessionBudget(
  sessionId: string,
  maxCostUsd: number,
  estimatedCostUsd: number,
  cwd: string = process.cwd(),
): SessionBudgetReservation {
  const budget = loadSessionBudget(sessionId, maxCostUsd, cwd);
  const reservedMicroUsd = usdToMicroUsd(estimatedCostUsd);

  if (!canSessionAfford(budget, estimatedCostUsd)) {
    throw new LiveCalibrationError(
      "cost_limit_exceeded",
      `Session budget exhausted (${microUsdToUsd(budget.spent_cost_micro_usd).toFixed(4)} / ${maxCostUsd.toFixed(2)} USD spent)`,
    );
  }

  return Object.freeze({
    sessionId,
    expectedVersion: budget.version,
    reservedMicroUsd,
  });
}

export function commitSessionSpend(
  sessionId: string,
  maxCostUsd: number,
  reservation: SessionBudgetReservation,
  actualCostUsd: number,
  cwd: string = process.cwd(),
): LiveCalibrationSessionBudget {
  ensureSessionsDirectory(cwd);
  const path = sessionFilePath(sessionId, cwd);
  const actualMicroUsd = usdToMicroUsd(actualCostUsd);

  const current = loadSessionBudget(sessionId, maxCostUsd, cwd);
  if (current.version !== reservation.expectedVersion) {
    throw new LiveCalibrationError(
      "correlation_mismatch",
      "Session budget version conflict — another run modified the session",
    );
  }

  const nextSpent = current.spent_cost_micro_usd + actualMicroUsd;
  if (nextSpent > current.max_cost_micro_usd) {
    throw new LiveCalibrationError("cost_limit_exceeded", "Session budget would be exceeded");
  }

  const next: LiveCalibrationSessionBudget = Object.freeze({
    schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    max_cost_micro_usd: current.max_cost_micro_usd,
    spent_cost_micro_usd: nextSpent,
    version: current.version + 1,
    run_count: current.run_count + 1,
  });

  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8");
  renameSync(tmpPath, path);
  return next;
}

export function writeSessionBudget(
  budget: LiveCalibrationSessionBudget,
  cwd: string = process.cwd(),
): string {
  ensureSessionsDirectory(cwd);
  const path = sessionFilePath(budget.session_id, cwd);
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(budget, null, 2), "utf8");
  renameSync(tmpPath, path);
  return path;
}
