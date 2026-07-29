/**
 * Bounded contrary-evidence schema repair for Military Expert generation payloads.
 * No manuscript resend, no invented evidence, one repair pass maximum.
 */

import { MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES } from "./contracts.ts";
import {
  MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
  validateMilitaryExpertGenerationPayload,
} from "./output-schema.ts";
import type { MilitaryExpertParseFailureCode } from "./parsing.ts";

export const MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_VERSION =
  "military_expert_contrary_evidence_repair@v1" as const;

/** Strict ceiling for the single optional schema-repair provider call. */
export const MILITARY_EXPERT_CONTRARY_EVIDENCE_REPAIR_CEILING = Object.freeze({
  maxOutputTokens: 4_096,
  maxCostUsd: 0.05,
  maxInputTokens: 32_000,
});

export type ContraryEvidenceFailureCode =
  | "MISSING_CONTRARY_EVIDENCE"
  | "MISSING_UNCERTAINTY_NOTE"
  | "CONTRARY_EVIDENCE_REPAIR_FAILED";

export interface ContraryEvidenceFindingViolation {
  findingIndex: number;
  findingId?: string;
  missingFields: readonly ("contrary_evidence" | "uncertainty_note")[];
  failureCode: Exclude<ContraryEvidenceFailureCode, "CONTRARY_EVIDENCE_REPAIR_FAILED">;
}

export interface ContraryEvidenceRepairAnalysis {
  repairable: boolean;
  violations: readonly ContraryEvidenceFindingViolation[];
  primaryFailureCode?: Exclude<
    ContraryEvidenceFailureCode,
    "CONTRARY_EVIDENCE_REPAIR_FAILED"
  >;
}

export interface ContraryEvidenceRepairEventPayload {
  finding_indexes: number[];
  missing_field_names: string[];
  repair_attempted: boolean;
  repair_succeeded: boolean;
  deterministic_normalization_applied: boolean;
  primary_failure_code?: ContraryEvidenceFailureCode;
}

const NO_CONTRARY_EVIDENCE_PATTERN =
  /(?:no contrary evidence|none was found|contrary evidence (?:was )?not found|did not find contrary|no meaningful contrary evidence)/i;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isNegativeRealismStatus(status: string): boolean {
  return (MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES as readonly string[]).includes(status);
}

function hasExplicitNoContraryStatement(...texts: readonly string[]): boolean {
  return texts.some((text) => text && NO_CONTRARY_EVIDENCE_PATTERN.test(text));
}

function uncertaintyNoteSatisfiesEmptyContrary(note: string): boolean {
  return note.length > 0 && NO_CONTRARY_EVIDENCE_PATTERN.test(note);
}

export function analyzeContraryEvidenceViolations(parsed: unknown): ContraryEvidenceRepairAnalysis {
  const violations: ContraryEvidenceFindingViolation[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { repairable: false, violations };
  }

  const root = parsed as Record<string, unknown>;
  const findings = Array.isArray(root.findings) ? root.findings : [];

  for (let index = 0; index < findings.length; index += 1) {
    const raw = findings[index];
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const realismStatus = str(record.realism_status);
    if (!isNegativeRealismStatus(realismStatus)) continue;

    const missingFields: ("contrary_evidence" | "uncertainty_note")[] = [];
    let failureCode: Exclude<ContraryEvidenceFailureCode, "CONTRARY_EVIDENCE_REPAIR_FAILED"> =
      "MISSING_CONTRARY_EVIDENCE";

    if (!("contrary_evidence" in record)) {
      missingFields.push("contrary_evidence");
    } else if (record.contrary_evidence !== undefined && !Array.isArray(record.contrary_evidence)) {
      return { repairable: false, violations: [] };
    } else if (
      Array.isArray(record.contrary_evidence) &&
      record.contrary_evidence.length === 0 &&
      !uncertaintyNoteSatisfiesEmptyContrary(str(record.uncertainty_note))
    ) {
      missingFields.push("uncertainty_note");
      failureCode = "MISSING_UNCERTAINTY_NOTE";
    } else if (
      Array.isArray(record.contrary_evidence) &&
      record.contrary_evidence.length > 0
    ) {
      continue;
    }

    if (missingFields.length === 0) continue;

    violations.push({
      findingIndex: index,
      findingId: str(record.finding_id) || undefined,
      missingFields,
      failureCode,
    });
  }

  return {
    repairable: violations.length > 0,
    violations,
    primaryFailureCode: violations[0]?.failureCode,
  };
}

export function isRepairableContraryEvidenceSchemaFailure(args: {
  parseFailureCode: MilitaryExpertParseFailureCode;
  validationErrors: readonly string[];
  parsed?: unknown;
}): boolean {
  if (args.parseFailureCode !== "evidence_missing") return false;

  const joined = args.validationErrors.join(" ");
  const contraryOnly =
    /contrary_evidence|contrary-evidence handling|uncertainty_note/.test(joined) &&
    !/manuscript_evidence: negative finding requires manuscript_evidence/.test(joined);

  if (!contraryOnly) return false;

  if (args.parsed !== undefined) {
    const analysis = analyzeContraryEvidenceViolations(args.parsed);
    if (!analysis.repairable) return false;
    if (analysis.violations.some((item) => item.missingFields.includes("contrary_evidence"))) {
      return true;
    }
    return analysis.violations.every((item) =>
      item.missingFields.every((field) => field === "uncertainty_note"),
    );
  }

  return contraryOnly;
}

export function mapContraryEvidenceValidationToFailureCode(
  validationErrors: readonly string[],
): Exclude<ContraryEvidenceFailureCode, "CONTRARY_EVIDENCE_REPAIR_FAILED"> | undefined {
  if (validationErrors.some((error) => /contrary_evidence: field is required/.test(error))) {
    return "MISSING_CONTRARY_EVIDENCE";
  }
  if (
    validationErrors.some((error) =>
      /contrary-evidence handling|uncertainty_note/.test(error),
    )
  ) {
    return "MISSING_UNCERTAINTY_NOTE";
  }
  return undefined;
}

export interface DeterministicContraryEvidenceNormalizationResult {
  normalized: unknown;
  applied: boolean;
  findingIndexes: number[];
}

/** Insert [] / uncertainty_note only when the model already stated no contrary evidence. */
export function applyDeterministicContraryEvidenceNormalization(
  parsed: unknown,
): DeterministicContraryEvidenceNormalizationResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { normalized: parsed, applied: false, findingIndexes: [] };
  }

  const root = structuredClone(parsed) as Record<string, unknown>;
  const findings = Array.isArray(root.findings) ? root.findings : [];
  const topLevelUncertainty = str(root.uncertainty_summary);
  const findingIndexes: number[] = [];

  for (let index = 0; index < findings.length; index += 1) {
    const raw = findings[index];
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    if (!isNegativeRealismStatus(str(record.realism_status))) continue;

    const observation = str(record.observation);
    const existingNote = str(record.uncertainty_note);
    const explicitNoContrary = hasExplicitNoContraryStatement(
      observation,
      existingNote,
      topLevelUncertainty,
    );

    if (!explicitNoContrary) continue;

    let changed = false;

    if (!("contrary_evidence" in record)) {
      record.contrary_evidence = [];
      record.uncertainty_note =
        existingNote && NO_CONTRARY_EVIDENCE_PATTERN.test(existingNote)
          ? existingNote
          : observation && NO_CONTRARY_EVIDENCE_PATTERN.test(observation)
            ? observation
            : MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE;
      changed = true;
    } else if (
      Array.isArray(record.contrary_evidence) &&
      record.contrary_evidence.length === 0 &&
      !uncertaintyNoteSatisfiesEmptyContrary(existingNote)
    ) {
      record.uncertainty_note =
        existingNote && NO_CONTRARY_EVIDENCE_PATTERN.test(existingNote)
          ? existingNote
          : observation && NO_CONTRARY_EVIDENCE_PATTERN.test(observation)
            ? observation
            : MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE;
      changed = true;
    }

    if (changed) findingIndexes.push(index);
  }

  return {
    normalized: root,
    applied: findingIndexes.length > 0,
    findingIndexes,
  };
}

export function buildContraryEvidenceSchemaRepairPrompt(args: {
  parsed: unknown;
  violations: readonly ContraryEvidenceFindingViolation[];
}): { systemPrompt: string; userPrompt: string } {
  const violationLines = args.violations.map((item) => {
    const id = item.findingId ? ` (${item.findingId})` : "";
    return `- findings[${item.findingIndex}]${id}: missing ${item.missingFields.join(", ")}`;
  });

  const systemPrompt = [
    "Military Expert JSON schema repair — structural correction only.",
    "Respond with ONE strict JSON object and nothing else.",
    "Preserve every existing fact, finding, excerpt, score, and enum value.",
    "Do not add, remove, or rewrite findings except to add required contrary-evidence fields.",
    "Do not invent contrary evidence excerpts or manuscript quotes.",
    "When no contrary evidence exists, set contrary_evidence: [] and add uncertainty_note explaining that no meaningful contrary evidence was identified.",
    "Never send null for contrary_evidence.",
    "Do not add top-level fields or remove required fields.",
  ].join("\n");

  const userPrompt = [
    "Repair the JSON object below so every negative finding includes contrary_evidence handling.",
    "",
    "Required corrections:",
    ...violationLines,
    "",
    "Compact valid empty-contrary fragment:",
    JSON.stringify(
      {
        contrary_evidence: [],
        uncertainty_note:
          "No meaningful contrary evidence was identified in the supplied manuscript evidence.",
      },
      null,
      0,
    ),
    "",
    "JSON to repair:",
    JSON.stringify(args.parsed),
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function buildContraryEvidenceRepairEventPayload(args: {
  violations: readonly ContraryEvidenceFindingViolation[];
  repairAttempted: boolean;
  repairSucceeded: boolean;
  deterministicNormalizationApplied: boolean;
  primaryFailureCode?: ContraryEvidenceFailureCode;
}): ContraryEvidenceRepairEventPayload {
  const missingFieldNames = [
    ...new Set(args.violations.flatMap((item) => [...item.missingFields])),
  ];

  return {
    finding_indexes: args.violations.map((item) => item.findingIndex),
    missing_field_names: missingFieldNames,
    repair_attempted: args.repairAttempted,
    repair_succeeded: args.repairSucceeded,
    deterministic_normalization_applied: args.deterministicNormalizationApplied,
    primary_failure_code: args.primaryFailureCode,
  };
}

export function validateNormalizedContraryEvidencePayload(parsed: unknown): {
  ok: boolean;
  errors: string[];
} {
  return validateMilitaryExpertGenerationPayload(parsed);
}
