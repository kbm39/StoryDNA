import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LiveCalibrationAuditEvent } from "./contracts.ts";
import { LIVE_CALIBRATION_APPROVED_ROOT } from "./constants.ts";

export const LIVE_CALIBRATION_AUDIT_SCHEMA_VERSION =
  "expert_calibration_audit_event@v1" as const;

function auditDirectory(cwd: string = process.cwd()): string {
  return join(cwd, LIVE_CALIBRATION_APPROVED_ROOT, "sessions");
}

function auditFilePath(sessionId: string, cwd: string = process.cwd()): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(auditDirectory(cwd), `${safeId}.audit.jsonl`);
}

export function appendAuditEvent(
  event: LiveCalibrationAuditEvent,
  cwd: string = process.cwd(),
): string {
  const dir = auditDirectory(cwd);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const path = auditFilePath(event.session_id, cwd);
  const line = JSON.stringify({
    schema_version: LIVE_CALIBRATION_AUDIT_SCHEMA_VERSION,
    ...event,
  });
  appendFileSync(path, `${line}\n`, "utf8");
  return path;
}

export function createAuditEvent(
  partial: Omit<LiveCalibrationAuditEvent, "timestamp"> & { timestamp?: string },
): LiveCalibrationAuditEvent {
  return Object.freeze({
    timestamp: partial.timestamp ?? new Date().toISOString(),
    session_id: partial.session_id,
    run_id: partial.run_id,
    event_type: partial.event_type,
    detail: partial.detail,
  });
}
