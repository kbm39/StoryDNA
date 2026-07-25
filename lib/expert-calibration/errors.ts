import type { CalibrationFailureCode } from "./contracts.ts";

export class ExpertCalibrationError extends Error {
  readonly code: CalibrationFailureCode;
  readonly caseId?: string;

  constructor(code: CalibrationFailureCode, message: string, caseId?: string) {
    super(message);
    this.name = "ExpertCalibrationError";
    this.code = code;
    this.caseId = caseId;
  }
}

export function calibrationFailure(
  code: CalibrationFailureCode,
  message: string,
  caseId?: string,
): { ok: false; code: CalibrationFailureCode; message: string; caseId?: string } {
  return { ok: false, code, message, caseId };
}
