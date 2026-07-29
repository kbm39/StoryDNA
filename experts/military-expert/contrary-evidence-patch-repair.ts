/**
 * Patch-only contrary-evidence schema repair for Military Expert generation payloads.
 * Sends only affected finding context; applies validated patches to the original report.
 */

import {
  MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
} from "./output-schema.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import type { ContraryEvidenceFindingViolation } from "./contrary-evidence-schema-repair.ts";

export const MILITARY_EXPERT_CONTRARY_EVIDENCE_PATCH_REPAIR_VERSION =
  "military_expert_contrary_evidence_patch_repair@v1" as const;

export type ContraryEvidencePatchField = "contrary_evidence" | "uncertainty_note";

export interface ContraryEvidenceRepairPatch {
  finding_index: number;
  field: ContraryEvidencePatchField;
  value: unknown;
}

export interface ContraryEvidencePatchResponse {
  repairs: ContraryEvidenceRepairPatch[];
}

export type ContraryEvidencePatchFailureCode =
  | "patch_malformed_json"
  | "patch_multiple_payloads"
  | "patch_trailing_content"
  | "provider_output_truncated"
  | "patch_unknown_finding_index"
  | "patch_unrequested_field"
  | "patch_duplicate"
  | "patch_missing_repair"
  | "patch_invalid_value"
  | "patch_extra_field";

export interface ContraryEvidencePatchParseResult {
  ok: true;
  patch: ContraryEvidencePatchResponse;
}

export interface ContraryEvidencePatchParseFailure {
  ok: false;
  code: ContraryEvidencePatchFailureCode;
  message: string;
}

export type ContraryEvidencePatchParseOutcome =
  | ContraryEvidencePatchParseResult
  | ContraryEvidencePatchParseFailure;

export interface ContraryEvidencePatchApplicationResult {
  ok: true;
  patched: unknown;
  appliedPatchCount: number;
  rejectedPatchCount: number;
}

export interface ContraryEvidencePatchApplicationFailure {
  ok: false;
  code: ContraryEvidencePatchFailureCode;
  message: string;
  appliedPatchCount: number;
  rejectedPatchCount: number;
}

export type ContraryEvidencePatchApplicationOutcome =
  | ContraryEvidencePatchApplicationResult
  | ContraryEvidencePatchApplicationFailure;

export interface ContraryEvidencePatchDiagnostics {
  repair_mode: "patch_only";
  affected_finding_indexes: number[];
  requested_fields: string[];
  returned_patch_count?: number;
  applied_patch_count?: number;
  rejected_patch_count?: number;
  patch_parse_result?: string;
  patch_application_result?: string;
}

const ALLOWED_PATCH_FIELDS = new Set<ContraryEvidencePatchField>([
  "contrary_evidence",
  "uncertainty_note",
]);

const NO_CONTRARY_EVIDENCE_PATTERN =
  /(?:no contrary evidence|none was found|contrary evidence (?:was )?not found|did not find contrary|no meaningful contrary evidence)/i;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildRequiredContraryEvidencePatches(
  violations: readonly ContraryEvidenceFindingViolation[],
): Array<{ findingIndex: number; field: ContraryEvidencePatchField }> {
  const required: Array<{ findingIndex: number; field: ContraryEvidencePatchField }> = [];
  const seen = new Set<string>();

  for (const violation of violations) {
    for (const field of violation.missingFields) {
      const key = `${violation.findingIndex}:${field}`;
      if (!seen.has(key)) {
        seen.add(key);
        required.push({ findingIndex: violation.findingIndex, field });
      }
      if (field === "contrary_evidence") {
        const noteKey = `${violation.findingIndex}:uncertainty_note`;
        if (!seen.has(noteKey)) {
          seen.add(noteKey);
          required.push({ findingIndex: violation.findingIndex, field: "uncertainty_note" });
        }
      }
    }
  }

  return required;
}

function extractAffectedFindingContext(
  parsed: unknown,
  violations: readonly ContraryEvidenceFindingViolation[],
): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const findings = Array.isArray((parsed as Record<string, unknown>).findings)
    ? ((parsed as Record<string, unknown>).findings as unknown[])
    : [];

  return violations.map((violation) => {
    const raw = findings[violation.findingIndex];
    if (!raw || typeof raw !== "object") {
      return {
        finding_index: violation.findingIndex,
        finding_id: violation.findingId ?? null,
        missing_fields: [...violation.missingFields],
      };
    }
    const record = raw as Record<string, unknown>;
    return {
      finding_index: violation.findingIndex,
      finding_id: str(record.finding_id) || violation.findingId || null,
      realism_status: str(record.realism_status) || null,
      observation: str(record.observation) || null,
      missing_fields: [...violation.missingFields],
      ...(record.contrary_evidence !== undefined
        ? { contrary_evidence: record.contrary_evidence }
        : {}),
      ...(record.uncertainty_note !== undefined
        ? { uncertainty_note: record.uncertainty_note }
        : {}),
    };
  });
}

export function buildContraryEvidencePatchRepairPrompt(args: {
  parsed: unknown;
  violations: readonly ContraryEvidenceFindingViolation[];
}): { systemPrompt: string; userPrompt: string } {
  const required = buildRequiredContraryEvidencePatches(args.violations);
  const violationLines = args.violations.map((item) => {
    const id = item.findingId ? ` (${item.findingId})` : "";
    return `- findings[${item.findingIndex}]${id}: missing ${item.missingFields.join(", ")}`;
  });
  const requiredPatchLines = required.map(
    (item) => `- findings[${item.findingIndex}].${item.field}`,
  );
  const affectedFindings = extractAffectedFindingContext(args.parsed, args.violations);

  const systemPrompt = [
    "Military Expert contrary-evidence PATCH repair — structural correction only.",
    "Respond with ONE strict JSON patch object and nothing else.",
    "Do not return the full report, summary, or unaffected findings.",
    "Do not invent contrary evidence excerpts or manuscript quotes.",
    "Repair ONLY the listed fields on the listed finding indexes.",
    "When no contrary evidence exists, set contrary_evidence to [] and provide a non-empty uncertainty_note.",
    "Never send null for contrary_evidence.",
    "Do not change severity, recommendation, evidence, title, observation, or unrelated fields.",
    "No Markdown, prose, headings, or commentary.",
  ].join("\n");

  const userPrompt = [
    "Return a patch JSON object with this exact shape:",
    '{"repairs":[{"finding_index":0,"field":"uncertainty_note","value":"No meaningful contrary evidence was identified in the supplied manuscript evidence."}]}',
    "",
    "Allowed fields: contrary_evidence (array), uncertainty_note (non-empty string).",
    "",
    "Required corrections:",
    ...violationLines,
    "",
    "Required patch targets:",
    ...requiredPatchLines,
    "",
    "Example empty-contrary patch pair:",
    JSON.stringify(
      {
        repairs: [
          { finding_index: 0, field: "contrary_evidence", value: [] },
          {
            finding_index: 0,
            field: "uncertainty_note",
            value: MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE,
          },
        ],
      },
      null,
      0,
    ),
    "",
    "Affected finding context (only these indexes):",
    JSON.stringify(affectedFindings, null, 0),
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function parseContraryEvidencePatchResponse(args: {
  responseText: string;
  finishStatus?: string;
  outputTokens?: number;
  maxOutputTokens: number;
}): ContraryEvidencePatchParseOutcome {
  if (
    args.finishStatus === "truncated" ||
    (typeof args.outputTokens === "number" && args.outputTokens >= args.maxOutputTokens)
  ) {
    return {
      ok: false,
      code: "provider_output_truncated",
      message: "Patch repair provider output was truncated.",
    };
  }

  let extraction;
  try {
    extraction = extractStrictModelJsonObject(args.responseText);
  } catch (error) {
    return {
      ok: false,
      code: "patch_malformed_json",
      message: error instanceof Error ? error.message : "Patch response is not valid JSON.",
    };
  }

  if (extraction.multiplePayloads) {
    return {
      ok: false,
      code: "patch_multiple_payloads",
      message: "Patch repair response contained multiple JSON payloads.",
    };
  }

  if (
    extraction.trailingCategory !== "none" &&
    extraction.trailingCategory !== "whitespace_only" &&
    extraction.trailingCategory !== "closing_markdown_fence"
  ) {
    return {
      ok: false,
      code: "patch_trailing_content",
      message: "Patch repair response contained unsafe trailing content.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extraction.jsonText) as unknown;
  } catch {
    return {
      ok: false,
      code: "patch_malformed_json",
      message: "Patch response JSON could not be parsed.",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "patch_malformed_json",
      message: "Patch response must be a JSON object.",
    };
  }

  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.repairs)) {
    return {
      ok: false,
      code: "patch_malformed_json",
      message: "Patch response must include a repairs array.",
    };
  }

  const repairs: ContraryEvidenceRepairPatch[] = [];
  for (const raw of root.repairs) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        ok: false,
        code: "patch_malformed_json",
        message: "Each repair entry must be an object.",
      };
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.finding_index !== "number" || !Number.isInteger(record.finding_index)) {
      return {
        ok: false,
        code: "patch_malformed_json",
        message: "Each repair must include an integer finding_index.",
      };
    }
    if (typeof record.field !== "string" || !ALLOWED_PATCH_FIELDS.has(record.field as ContraryEvidencePatchField)) {
      return {
        ok: false,
        code: "patch_extra_field",
        message: "Patch includes a disallowed or unknown field.",
      };
    }
    if (!("value" in record)) {
      return {
        ok: false,
        code: "patch_malformed_json",
        message: "Each repair must include a value.",
      };
    }
    repairs.push({
      finding_index: record.finding_index,
      field: record.field as ContraryEvidencePatchField,
      value: record.value,
    });
  }

  return { ok: true, patch: { repairs } };
}

function validatePatchValue(field: ContraryEvidencePatchField, value: unknown): boolean {
  if (field === "contrary_evidence") {
    return Array.isArray(value);
  }
  if (field === "uncertainty_note") {
    const note = str(value);
    return note.length > 0 && NO_CONTRARY_EVIDENCE_PATTERN.test(note);
  }
  return false;
}

export function applyContraryEvidencePatches(args: {
  parsedRoot: unknown;
  patch: ContraryEvidencePatchResponse;
  violations: readonly ContraryEvidenceFindingViolation[];
}): ContraryEvidencePatchApplicationOutcome {
  if (!args.parsedRoot || typeof args.parsedRoot !== "object" || Array.isArray(args.parsedRoot)) {
    return {
      ok: false,
      code: "patch_unknown_finding_index",
      message: "Original report is not patchable.",
      appliedPatchCount: 0,
      rejectedPatchCount: args.patch.repairs.length,
    };
  }

  const required = buildRequiredContraryEvidencePatches(args.violations);
  const requiredKeys = new Set(required.map((item) => `${item.findingIndex}:${item.field}`));
  const seenPatchKeys = new Set<string>();
  let rejectedPatchCount = 0;

  const root = structuredClone(args.parsedRoot) as Record<string, unknown>;
  const findings = Array.isArray(root.findings) ? root.findings : [];
  if (!Array.isArray(root.findings)) {
    root.findings = findings;
  }

  for (const repair of args.patch.repairs) {
    const patchKey = `${repair.finding_index}:${repair.field}`;
    if (seenPatchKeys.has(patchKey)) {
      return {
        ok: false,
        code: "patch_duplicate",
        message: `Duplicate patch for findings[${repair.finding_index}].${repair.field}.`,
        appliedPatchCount: 0,
        rejectedPatchCount: args.patch.repairs.length,
      };
    }
    seenPatchKeys.add(patchKey);

    const finding = findings[repair.finding_index];
    if (!finding || typeof finding !== "object") {
      return {
        ok: false,
        code: "patch_unknown_finding_index",
        message: `Patch references unknown finding index ${repair.finding_index}.`,
        appliedPatchCount: 0,
        rejectedPatchCount: args.patch.repairs.length,
      };
    }

    if (!requiredKeys.has(patchKey)) {
      return {
        ok: false,
        code: "patch_unrequested_field",
        message: `Patch targets unrequested field findings[${repair.finding_index}].${repair.field}.`,
        appliedPatchCount: 0,
        rejectedPatchCount: args.patch.repairs.length,
      };
    }

    if (!validatePatchValue(repair.field, repair.value)) {
      rejectedPatchCount += 1;
      return {
        ok: false,
        code: "patch_invalid_value",
        message: `Invalid patch value for findings[${repair.finding_index}].${repair.field}.`,
        appliedPatchCount: 0,
        rejectedPatchCount,
      };
    }

    const record = finding as Record<string, unknown>;
    record[repair.field] = repair.field === "uncertainty_note" ? str(repair.value) : repair.value;
  }

  for (const req of required) {
    const key = `${req.findingIndex}:${req.field}`;
    if (!seenPatchKeys.has(key)) {
      return {
        ok: false,
        code: "patch_missing_repair",
        message: `Missing required patch for findings[${req.findingIndex}].${req.field}.`,
        appliedPatchCount: seenPatchKeys.size,
        rejectedPatchCount: 0,
      };
    }
  }

  return {
    ok: true,
    patched: root,
    appliedPatchCount: seenPatchKeys.size,
    rejectedPatchCount: 0,
  };
}

export function buildContraryEvidencePatchDiagnostics(args: {
  violations: readonly ContraryEvidenceFindingViolation[];
  returnedPatchCount?: number;
  appliedPatchCount?: number;
  rejectedPatchCount?: number;
  patchParseResult?: string;
  patchApplicationResult?: string;
}): ContraryEvidencePatchDiagnostics {
  const required = buildRequiredContraryEvidencePatches(args.violations);
  return {
    repair_mode: "patch_only",
    affected_finding_indexes: [...new Set(args.violations.map((item) => item.findingIndex))],
    requested_fields: required.map((item) => `${item.findingIndex}:${item.field}`),
    returned_patch_count: args.returnedPatchCount,
    applied_patch_count: args.appliedPatchCount,
    rejected_patch_count: args.rejectedPatchCount,
    patch_parse_result: args.patchParseResult,
    patch_application_result: args.patchApplicationResult,
  };
}
