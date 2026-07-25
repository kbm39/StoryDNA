import {
  CREDENTIAL_PATTERN,
  EXPERT_CALIBRATION_CASE_SCHEMA_VERSION,
  MAX_CALIBRATION_CASES,
  MAX_CALIBRATION_EXCERPT_CHARS,
  MAX_CALIBRATION_FIELD_CHARS,
  MAX_CALIBRATION_TAGS,
} from "./constants.ts";
import type {
  CalibrationCaseKind,
  CalibrationFailureCode,
  ExpertCalibrationCase,
  ExpectedFinding,
} from "./contracts.ts";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_AMBIGUITY = new Set(["low", "medium", "high"]);
const VALID_KINDS = new Set<CalibrationCaseKind>(["synthetic", "approved", "edge"]);
const VALID_PRIORITIES = new Set(["required", "recommended", "optional"]);
const VALID_SAFETY = new Set([
  "editorial_only",
  "unsafe_operational_trap",
  "domain_boundary",
  "dramatic_preservation",
]);
const VALID_APPROVAL = new Set(["approved", "pending", "rejected"]);
const VALID_PROVENANCE = new Set(["synthetic", "approved_excerpt", "regression"]);
const VALID_ADJUDICATION = new Set(["automatic", "human_required", "hybrid"]);
const VALID_MATCH = new Set(["exact", "identifier", "controlled_text", "human_required"]);
const VALID_SCOPES = new Set(["scene", "chapter_set", "sample", "full_manuscript"]);

export interface CaseValidationResult {
  ok: boolean;
  errors: string[];
}

function boundedString(field: string, value: unknown, max: number): string | null {
  if (typeof value !== "string") return `${field} must be a string`;
  if (value.trim().length === 0) return `${field} must not be empty`;
  if (value.length > max) return `${field} exceeds max length ${max}`;
  return null;
}

function validateExpectedFinding(f: ExpectedFinding, index: number): string[] {
  const errors: string[] = [];
  const prefix = `expected_findings[${index}]`;
  if (!f.finding_key?.trim()) errors.push(`${prefix}.finding_key required`);
  if (!f.category?.trim()) errors.push(`${prefix}.category required`);
  if (!VALID_MATCH.has(f.match_mode)) errors.push(`${prefix}.match_mode invalid`);
  if (typeof f.weight !== "number" || f.weight <= 0) errors.push(`${prefix}.weight must be > 0`);
  if (f.title_pattern) {
    try {
      new RegExp(f.title_pattern, "i");
    } catch {
      errors.push(`${prefix}.title_pattern invalid regex`);
    }
  }
  return errors;
}

/** Validate a single calibration case — deterministic, no mutation. */
export function validateExpertCalibrationCase(
  input: ExpertCalibrationCase,
): CaseValidationResult {
  const errors: string[] = [];

  if (input.schema_version !== EXPERT_CALIBRATION_CASE_SCHEMA_VERSION) {
    errors.push("schema_version mismatch");
  }

  for (const field of [
    ["case_id", input.case_id],
    ["expert_key", input.expert_key],
    ["expert_version", input.expert_version],
    ["definition_hash", input.definition_hash],
    ["title", input.title],
    ["domain", input.domain],
  ] as const) {
    const err = boundedString(field[0], field[1], MAX_CALIBRATION_FIELD_CHARS);
    if (err) errors.push(err);
  }

  if (!VALID_KINDS.has(input.case_kind)) errors.push("invalid case_kind");
  if (!VALID_PRIORITIES.has(input.priority)) errors.push("invalid priority");
  if (!VALID_DIFFICULTIES.has(input.difficulty)) errors.push("invalid difficulty");
  if (!VALID_AMBIGUITY.has(input.ambiguity_level)) errors.push("invalid ambiguity_level");
  if (!VALID_SAFETY.has(input.safety_classification)) errors.push("invalid safety_classification");
  if (!VALID_ADJUDICATION.has(input.adjudication.mode)) errors.push("invalid adjudication.mode");
  if (!input.adjudication.rationale?.trim()) errors.push("missing adjudication rationale");

  if (!VALID_PROVENANCE.has(input.provenance.source)) errors.push("invalid provenance.source");
  if (!VALID_APPROVAL.has(input.provenance.approval_status)) {
    errors.push("invalid provenance.approval_status");
  }

  if (input.provenance.source !== "synthetic" && input.case_kind === "synthetic") {
    errors.push("contradictory: synthetic case_kind with non-synthetic provenance");
  }

  if (input.provenance.source === "approved_excerpt" && input.provenance.approval_status !== "approved") {
    errors.push("unapproved real-manuscript provenance");
  }

  if (input.domain_tags.length > MAX_CALIBRATION_TAGS) errors.push("too many domain_tags");

  const ms = input.manuscript;
  if (!VALID_SCOPES.has(ms.scope)) errors.push("invalid manuscript.scope");
  if (ms.text.length > MAX_CALIBRATION_EXCERPT_CHARS) errors.push("oversized excerpt");
  if (CREDENTIAL_PATTERN.test(ms.text)) errors.push("credential-shaped value in manuscript");
  if (CREDENTIAL_PATTERN.test(input.context ?? "")) errors.push("credential-shaped value in context");

  for (const nf of input.expected_non_findings) {
    if (!nf.rationale?.trim()) errors.push(`missing rationale for non_finding ${nf.non_finding_key}`);
  }
  for (const u of input.expected_uncertainties) {
    if (!u.rationale?.trim()) errors.push(`missing rationale for uncertainty ${u.uncertainty_key}`);
  }
  for (const p of input.prohibited_findings) {
    if (!p.rationale?.trim()) errors.push(`missing rationale for prohibited ${p.prohibited_key}`);
  }

  input.expected_findings.forEach((f, i) => errors.push(...validateExpectedFinding(f, i)));

  const findingKeys = new Set<string>();
  for (const f of input.expected_findings) {
    if (findingKeys.has(f.finding_key)) {
      errors.push(`duplicate expected finding_key: ${f.finding_key}`);
    }
    findingKeys.add(f.finding_key);
  }

  for (const f of input.expected_findings) {
    if (f.realism_status === "accurate" && f.severity_min === "critical") {
      errors.push(`contradictory expectations for ${f.finding_key}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Deep-freeze clone for deterministic normalization without mutating input. */
export function normalizeExpertCalibrationCase(
  input: ExpertCalibrationCase,
): ExpertCalibrationCase {
  const clone = structuredClone(input) as ExpertCalibrationCase;
  return Object.freeze(clone);
}

export function caseValidationFailureCode(errors: string[]): CalibrationFailureCode {
  if (errors.some((e) => e.includes("duplicate"))) return "duplicate_case_id";
  if (errors.some((e) => e.includes("oversized"))) return "oversized_excerpt";
  if (errors.some((e) => e.includes("invalid"))) return "invalid_enum";
  if (errors.some((e) => e.includes("rationale"))) return "missing_rationale";
  if (errors.some((e) => e.includes("contradictory") || e.includes("unapproved"))) {
    return "contradictory_expectations";
  }
  if (errors.some((e) => e.includes("unapproved real-manuscript"))) return "unapproved_provenance";
  if (errors.some((e) => e.includes("credential"))) return "credential_detected";
  return "invalid_case";
}

export { MAX_CALIBRATION_CASES };
