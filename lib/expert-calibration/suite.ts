import { createHash } from "node:crypto";
import {
  EXPERT_CALIBRATION_SUITE_SCHEMA_VERSION,
  MAX_CALIBRATION_CASES,
} from "./constants.ts";
import {
  caseValidationFailureCode,
  normalizeExpertCalibrationCase,
  validateExpertCalibrationCase,
} from "./evaluation-case.ts";
import type { ExpertCalibrationCase, ExpertCalibrationSuite } from "./contracts.ts";
import { calibrationFailure } from "./errors.ts";

export interface SuiteValidationResult {
  ok: boolean;
  errors: string[];
}

function sortCases(cases: readonly ExpertCalibrationCase[]): ExpertCalibrationCase[] {
  return [...cases].sort((a, b) => a.case_id.localeCompare(b.case_id));
}

/** Validate suite and all cases — deterministic ordering by case_id. */
export function validateExpertCalibrationSuite(
  suite: ExpertCalibrationSuite,
): SuiteValidationResult {
  const errors: string[] = [];

  if (suite.schema_version !== EXPERT_CALIBRATION_SUITE_SCHEMA_VERSION) {
    errors.push("schema_version mismatch");
  }
  if (!suite.suite_id?.trim()) errors.push("suite_id required");
  if (!suite.expert_key?.trim()) errors.push("expert_key required");
  if (suite.cases.length === 0) errors.push("suite_empty");
  if (suite.cases.length > MAX_CALIBRATION_CASES) errors.push("too many cases");

  const ids = new Set<string>();
  for (const c of suite.cases) {
    if (ids.has(c.case_id)) errors.push(`duplicate case_id: ${c.case_id}`);
    ids.add(c.case_id);
    const caseResult = validateExpertCalibrationCase(c);
    if (!caseResult.ok) {
      errors.push(...caseResult.errors.map((e) => `${c.case_id}: ${e}`));
    }
    if (c.expert_key !== suite.expert_key) {
      errors.push(`${c.case_id}: expert_key mismatch with suite`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Load and normalize an in-memory suite — no filesystem access. */
export function loadCalibrationSuite(
  suite: ExpertCalibrationSuite,
): { ok: true; suite: ExpertCalibrationSuite } | { ok: false; errors: string[] } {
  const validation = validateExpertCalibrationSuite(suite);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const normalizedCases = sortCases(suite.cases).map(normalizeExpertCalibrationCase);
  const normalized: ExpertCalibrationSuite = Object.freeze({
    ...suite,
    cases: Object.freeze(normalizedCases),
  });

  return { ok: true, suite: normalized };
}

export function suiteContentHash(suite: ExpertCalibrationSuite): string {
  const payload = JSON.stringify({
    suite_id: suite.suite_id,
    expert_key: suite.expert_key,
    case_ids: suite.cases.map((c) => c.case_id).sort(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export { caseValidationFailureCode, calibrationFailure };
