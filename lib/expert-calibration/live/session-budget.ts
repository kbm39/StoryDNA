import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
  LiveCalibrationSessionBudget,
  LiveCalibrationSessionReservationRecord,
  LiveCalibrationSessionReservationStatus,
} from "./contracts.ts";
import { LIVE_CALIBRATION_APPROVED_ROOT } from "./constants.ts";
import { LiveCalibrationError } from "./errors.ts";
import { usdToMicroUsd, microUsdToUsd } from "./budget-controller.ts";

export const LIVE_CALIBRATION_SESSION_SCHEMA_VERSION =
  "expert_calibration_session@v2" as const;

export const LIVE_CALIBRATION_SESSION_SCHEMA_VERSION_V1 =
  "expert_calibration_session@v1" as const;

const MAX_CAS_RETRIES = 8;

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

interface LegacySessionBudgetV1 {
  readonly schema_version: typeof LIVE_CALIBRATION_SESSION_SCHEMA_VERSION_V1;
  readonly session_id: string;
  readonly max_cost_micro_usd: number;
  readonly spent_cost_micro_usd: number;
  readonly version: number;
  readonly run_count: number;
}

function normalizeSessionBudget(
  parsed: LegacySessionBudgetV1 | LiveCalibrationSessionBudget,
  sessionId: string,
): LiveCalibrationSessionBudget {
  if (parsed.session_id !== sessionId) {
    throw new LiveCalibrationError("invalid_configuration", "Session ID mismatch in budget file");
  }

  if (parsed.schema_version === LIVE_CALIBRATION_SESSION_SCHEMA_VERSION_V1) {
    return Object.freeze({
      schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
      session_id: sessionId,
      max_cost_micro_usd: parsed.max_cost_micro_usd,
      spent_estimated_micro_usd: parsed.spent_cost_micro_usd,
      spent_actual_micro_usd: parsed.spent_cost_micro_usd,
      reserved_micro_usd: 0,
      version: parsed.version,
      run_count: parsed.run_count,
      reservations: Object.freeze({}),
    });
  }

  if (parsed.schema_version !== LIVE_CALIBRATION_SESSION_SCHEMA_VERSION) {
    throw new LiveCalibrationError("invalid_configuration", "Unsupported session budget schema");
  }

  return Object.freeze({
    ...parsed,
    reservations: Object.freeze({ ...(parsed.reservations ?? {}) }),
  });
}

function parseSessionBudget(raw: string, sessionId: string): LiveCalibrationSessionBudget {
  const parsed = JSON.parse(raw) as LegacySessionBudgetV1 | LiveCalibrationSessionBudget;
  return normalizeSessionBudget(parsed, sessionId);
}

function createEmptySessionBudget(
  sessionId: string,
  maxCostUsd: number,
): LiveCalibrationSessionBudget {
  return Object.freeze({
    schema_version: LIVE_CALIBRATION_SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    max_cost_micro_usd: usdToMicroUsd(maxCostUsd),
    spent_estimated_micro_usd: 0,
    spent_actual_micro_usd: 0,
    reserved_micro_usd: 0,
    version: 0,
    run_count: 0,
    reservations: Object.freeze({}),
  });
}

function persistSessionBudget(budget: LiveCalibrationSessionBudget, cwd: string): void {
  ensureSessionsDirectory(cwd);
  const path = sessionFilePath(budget.session_id, cwd);
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(budget, null, 2), "utf8");
  renameSync(tmpPath, path);
}

export function loadSessionBudget(
  sessionId: string,
  maxCostUsd: number,
  cwd: string = process.cwd(),
): LiveCalibrationSessionBudget {
  ensureSessionsDirectory(cwd);
  const path = sessionFilePath(sessionId, cwd);

  if (!existsSync(path)) {
    return createEmptySessionBudget(sessionId, maxCostUsd);
  }

  return parseSessionBudget(readFileSync(path, "utf8"), sessionId);
}

export function getSessionAvailableMicroUsd(budget: LiveCalibrationSessionBudget): number {
  const available =
    budget.max_cost_micro_usd -
    budget.spent_estimated_micro_usd -
    budget.reserved_micro_usd;
  return Math.max(0, available);
}

/** Remaining budget including active reservations (legacy helper). */
export function getSessionRemainingMicroUsd(budget: LiveCalibrationSessionBudget): number {
  return getSessionAvailableMicroUsd(budget);
}

export function canSessionAfford(
  budget: LiveCalibrationSessionBudget,
  estimatedCostUsd: number,
): boolean {
  return getSessionAvailableMicroUsd(budget) >= usdToMicroUsd(estimatedCostUsd);
}

export interface SessionCallBudgetReservation {
  readonly reservationId: string;
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly reservedMicroUsd: number;
  readonly runId: string;
  readonly caseId: string;
  readonly correlationId: string;
}

export interface ReserveSessionCallBudgetInput {
  readonly sessionId: string;
  readonly maxCostUsd: number;
  readonly runId: string;
  readonly caseId: string;
  readonly correlationId: string;
  readonly reservedCostUsd: number;
  readonly reservationId?: string;
  readonly cwd?: string;
}

function findReservation(
  budget: LiveCalibrationSessionBudget,
  reservationId: string,
): LiveCalibrationSessionReservationRecord | null {
  return budget.reservations[reservationId] ?? null;
}

function updateReservationStatus(
  budget: LiveCalibrationSessionBudget,
  reservationId: string,
  status: LiveCalibrationSessionReservationStatus,
  settledAt: string | null,
): LiveCalibrationSessionBudget {
  const existing = findReservation(budget, reservationId);
  if (!existing) {
    throw new LiveCalibrationError("correlation_mismatch", "Unknown session reservation ID");
  }

  const nextReservations = {
    ...budget.reservations,
    [reservationId]: Object.freeze({
      ...existing,
      status,
      settled_at: settledAt,
    }),
  };

  return Object.freeze({
    ...budget,
    reservations: Object.freeze(nextReservations),
  });
}

type SessionBudgetMutator = (
  current: LiveCalibrationSessionBudget,
) => LiveCalibrationSessionBudget;

function atomicUpdateSessionBudget(
  sessionId: string,
  maxCostUsd: number,
  mutate: SessionBudgetMutator,
  cwd: string = process.cwd(),
): LiveCalibrationSessionBudget {
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const current = loadSessionBudget(sessionId, maxCostUsd, cwd);
    const next = mutate(current);

    if (next.version !== current.version + 1) {
      throw new LiveCalibrationError(
        "invalid_configuration",
        "Session budget mutation must increment version exactly once",
      );
    }

    if (getSessionAvailableMicroUsd(next) < 0) {
      throw new LiveCalibrationError("cost_limit_exceeded", "Session available budget became negative");
    }

    const path = sessionFilePath(sessionId, cwd);
    if (!existsSync(path)) {
      if (current.version !== 0) {
        continue;
      }
      persistSessionBudget(next, cwd);
      return next;
    }

    const onDisk = parseSessionBudget(readFileSync(path, "utf8"), sessionId);
    if (onDisk.version !== current.version) {
      continue;
    }

    persistSessionBudget(next, cwd);
    return next;
  }

  throw new LiveCalibrationError(
    "correlation_mismatch",
    "Session budget version conflict — concurrent reservation update failed",
  );
}

export function reserveSessionCallBudget(
  input: ReserveSessionCallBudgetInput,
): SessionCallBudgetReservation {
  const cwd = input.cwd ?? process.cwd();
  const reservedMicroUsd = usdToMicroUsd(input.reservedCostUsd);
  if (reservedMicroUsd <= 0) {
    throw new LiveCalibrationError("invalid_configuration", "Reservation amount must be positive");
  }

  const reservationId = input.reservationId ?? randomUUID();
  const createdAt = new Date().toISOString();

  atomicUpdateSessionBudget(
    input.sessionId,
    input.maxCostUsd,
    (current) => {
      if (getSessionAvailableMicroUsd(current) < reservedMicroUsd) {
        throw new LiveCalibrationError(
          "cost_limit_exceeded",
          `Session budget exhausted (${microUsdToUsd(current.spent_estimated_micro_usd).toFixed(4)} estimated spent, ${microUsdToUsd(current.reserved_micro_usd).toFixed(4)} reserved of ${input.maxCostUsd.toFixed(2)} USD max)`,
        );
      }

      if (current.reservations[reservationId]) {
        throw new LiveCalibrationError("correlation_mismatch", "Session reservation ID already exists");
      }

      const record: LiveCalibrationSessionReservationRecord = Object.freeze({
        reservation_id: reservationId,
        session_id: input.sessionId,
        run_id: input.runId,
        case_id: input.caseId,
        correlation_id: input.correlationId,
        reserved_micro_usd: reservedMicroUsd,
        status: "active",
        created_at: createdAt,
        settled_at: null,
      });

      return Object.freeze({
        ...current,
        reserved_micro_usd: current.reserved_micro_usd + reservedMicroUsd,
        version: current.version + 1,
        reservations: Object.freeze({
          ...current.reservations,
          [reservationId]: record,
        }),
      });
    },
    cwd,
  );

  const updated = loadSessionBudget(input.sessionId, input.maxCostUsd, cwd);
  return Object.freeze({
    reservationId,
    sessionId: input.sessionId,
    expectedVersion: updated.version,
    reservedMicroUsd,
    runId: input.runId,
    caseId: input.caseId,
    correlationId: input.correlationId,
  });
}

export interface SettleSessionReservationInput {
  readonly sessionId: string;
  readonly maxCostUsd: number;
  readonly reservationId: string;
  readonly actualCostUsd: number;
  readonly estimatedCostUsd: number;
  readonly cwd?: string;
}

export function settleSessionReservation(
  input: SettleSessionReservationInput,
): LiveCalibrationSessionBudget {
  const cwd = input.cwd ?? process.cwd();
  const actualMicroUsd = usdToMicroUsd(input.actualCostUsd);
  const estimatedMicroUsd = usdToMicroUsd(input.estimatedCostUsd);
  const settledAt = new Date().toISOString();

  return atomicUpdateSessionBudget(
    input.sessionId,
    input.maxCostUsd,
    (current) => {
      const reservation = findReservation(current, input.reservationId);
      if (!reservation) {
        throw new LiveCalibrationError("correlation_mismatch", "Unknown session reservation ID");
      }
      if (reservation.session_id !== input.sessionId) {
        throw new LiveCalibrationError("correlation_mismatch", "Reservation session mismatch");
      }
      if (reservation.status !== "active") {
        throw new LiveCalibrationError("correlation_mismatch", "Session reservation is not active");
      }

      const chargeEstimatedMicroUsd = Math.min(
        reservation.reserved_micro_usd,
        Math.max(actualMicroUsd, estimatedMicroUsd),
      );
      const chargeActualMicroUsd = Math.min(reservation.reserved_micro_usd, actualMicroUsd);

      let next = Object.freeze({
        ...current,
        reserved_micro_usd: current.reserved_micro_usd - reservation.reserved_micro_usd,
        spent_estimated_micro_usd: current.spent_estimated_micro_usd + chargeEstimatedMicroUsd,
        spent_actual_micro_usd: current.spent_actual_micro_usd + chargeActualMicroUsd,
        run_count: current.run_count + 1,
        version: current.version + 1,
      });

      next = updateReservationStatus(next, input.reservationId, "settled", settledAt);
      return next;
    },
    cwd,
  );
}

export interface MarkSessionReservationFailedInput {
  readonly sessionId: string;
  readonly maxCostUsd: number;
  readonly reservationId: string;
  readonly chargeEstimatedUsd?: number;
  readonly chargeActualUsd?: number;
  readonly cwd?: string;
}

/** Reconcile a failed or aborted attempt. Chargeable failures bill the reserved estimate. */
export function markSessionReservationFailed(
  input: MarkSessionReservationFailedInput,
): LiveCalibrationSessionBudget {
  const cwd = input.cwd ?? process.cwd();
  const chargeEstimatedMicroUsd = usdToMicroUsd(input.chargeEstimatedUsd ?? 0);
  const chargeActualMicroUsd = usdToMicroUsd(input.chargeActualUsd ?? 0);
  const settledAt = new Date().toISOString();

  return atomicUpdateSessionBudget(
    input.sessionId,
    input.maxCostUsd,
    (current) => {
      const reservation = findReservation(current, input.reservationId);
      if (!reservation) {
        throw new LiveCalibrationError("correlation_mismatch", "Unknown session reservation ID");
      }
      if (reservation.session_id !== input.sessionId) {
        throw new LiveCalibrationError("correlation_mismatch", "Reservation session mismatch");
      }
      if (reservation.status !== "active") {
        throw new LiveCalibrationError("correlation_mismatch", "Session reservation is not active");
      }

      const estimatedCharge = Math.min(reservation.reserved_micro_usd, chargeEstimatedMicroUsd);
      const actualCharge = Math.min(reservation.reserved_micro_usd, chargeActualMicroUsd);

      let next = Object.freeze({
        ...current,
        reserved_micro_usd: current.reserved_micro_usd - reservation.reserved_micro_usd,
        spent_estimated_micro_usd: current.spent_estimated_micro_usd + estimatedCharge,
        spent_actual_micro_usd: current.spent_actual_micro_usd + actualCharge,
        version: current.version + 1,
      });

      next = updateReservationStatus(next, input.reservationId, "failed", settledAt);
      return next;
    },
    cwd,
  );
}

/** Legacy run-level reservation — retained for compatibility tests only. */
export interface SessionBudgetReservation {
  readonly sessionId: string;
  readonly expectedVersion: number;
  readonly reservedMicroUsd: number;
}

/** @deprecated Use reserveSessionCallBudget for atomic per-call reservations. */
export function reserveSessionBudget(
  sessionId: string,
  maxCostUsd: number,
  estimatedCostUsd: number,
  cwd: string = process.cwd(),
): SessionBudgetReservation {
  const reservation = reserveSessionCallBudget({
    sessionId,
    maxCostUsd,
    runId: "legacy-run",
    caseId: "legacy-case",
    correlationId: "legacy-correlation",
    reservedCostUsd: estimatedCostUsd,
    cwd,
  });

  return Object.freeze({
    sessionId,
    expectedVersion: reservation.expectedVersion,
    reservedMicroUsd: reservation.reservedMicroUsd,
  });
}

/** @deprecated Use settleSessionReservation / markSessionReservationFailed. */
export function commitSessionSpend(
  sessionId: string,
  maxCostUsd: number,
  reservation: SessionBudgetReservation,
  actualCostUsd: number,
  cwd: string = process.cwd(),
): LiveCalibrationSessionBudget {
  const budget = loadSessionBudget(sessionId, maxCostUsd, cwd);
  const active = Object.values(budget.reservations).find(
    (entry) => entry.status === "active" && entry.reserved_micro_usd === reservation.reservedMicroUsd,
  );
  if (!active) {
    throw new LiveCalibrationError("correlation_mismatch", "Active session reservation not found for commit");
  }

  return settleSessionReservation({
    sessionId,
    maxCostUsd,
    reservationId: active.reservation_id,
    actualCostUsd,
    estimatedCostUsd: microUsdToUsd(reservation.reservedMicroUsd),
    cwd,
  });
}

export function writeSessionBudget(
  budget: LiveCalibrationSessionBudget,
  cwd: string = process.cwd(),
): string {
  persistSessionBudget(budget, cwd);
  return sessionFilePath(budget.session_id, cwd);
}
