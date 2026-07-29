/**
 * Deterministic Military Expert repair classification — no provider repair execution.
 */

import {
  analyzeContraryEvidenceViolations,
  isRepairableContraryEvidenceSchemaFailure,
} from "./contrary-evidence-schema-repair.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums } from "./enum-normalization.ts";
import {
  parseMilitaryExpertGenerationResponse,
  applyDeterministicMilitaryExpertCleanup,
  type MilitaryExpertParseFailureCode,
} from "./parsing.ts";
import { validateMilitaryExpertGenerationPayload } from "./output-schema.ts";
import type {
  MilitaryExpertRawGenerationResponse,
  MilitaryExpertRepairDecision,
} from "./generation-types.ts";

export type { MilitaryExpertRepairDecision };

export interface MilitaryExpertRepairClassification {
  decision: MilitaryExpertRepairDecision;
  parseFailureCode?: MilitaryExpertParseFailureCode;
  message?: string;
  cleanedText?: string;
  contraryEvidenceFailureCode?: "MISSING_CONTRARY_EVIDENCE" | "MISSING_UNCERTAINTY_NOTE";
}

const PROVIDER_REPAIR_CODES = new Set<MilitaryExpertParseFailureCode>([
  "malformed_json",
  "multiple_payloads",
]);

const REJECT_CODES = new Set<MilitaryExpertParseFailureCode>([
  "schema_invalid",
  "unsafe_content",
  "evidence_missing",
  "unsupported_category",
  "unsupported_enum",
  "output_too_large",
  "correlation_mismatch",
  "unexpected_parse_failure",
  "trailing_content",
  "provider_output_truncated",
]);

function extractParsedRoot(rawText: string): unknown | undefined {
  try {
    const extraction = extractStrictModelJsonObject(rawText);
    const parsed = JSON.parse(extraction.jsonText) as unknown;
    return normalizeMilitaryExpertGenerationEnums(parsed).normalized;
  } catch {
    return undefined;
  }
}

function classifyContraryEvidenceRepair(args: {
  parseFailureCode: MilitaryExpertParseFailureCode;
  message: string;
  parsed?: unknown;
}): MilitaryExpertRepairClassification | null {
  if (args.parseFailureCode !== "evidence_missing") return null;

  const validation = args.parsed
    ? validateMilitaryExpertGenerationPayload(args.parsed)
    : { ok: false, errors: [args.message] };

  if (
    !isRepairableContraryEvidenceSchemaFailure({
      parseFailureCode: args.parseFailureCode,
      validationErrors: validation.errors,
      parsed: args.parsed,
    })
  ) {
    return null;
  }

  const analysis = args.parsed ? analyzeContraryEvidenceViolations(args.parsed) : null;

  return {
    decision: "schema_repair_required",
    parseFailureCode: args.parseFailureCode,
    message: args.message,
    contraryEvidenceFailureCode: analysis?.primaryFailureCode,
  };
}

/** Classify whether a raw response can be cleaned deterministically or needs provider repair. */
export function classifyMilitaryExpertRepairNeed(args: {
  raw: MilitaryExpertRawGenerationResponse;
  expectedCorrelationId?: string;
}): MilitaryExpertRepairClassification {
  const initial = parseMilitaryExpertGenerationResponse(args.raw, {
    expectedCorrelationId: args.expectedCorrelationId,
  });
  if (initial.ok) {
    return { decision: "no_repair_needed" };
  }

  if (initial.code === "trailing_content" || initial.code === "multiple_payloads") {
    return {
      decision: "reject_output",
      parseFailureCode: initial.code,
      message: initial.message,
    };
  }

  if (initial.code === "provider_output_truncated") {
    return {
      decision: "reject_output",
      parseFailureCode: initial.code,
      message: initial.message,
    };
  }

  const parsedRoot = extractParsedRoot(args.raw.responseText);
  const contraryRepair = classifyContraryEvidenceRepair({
    parseFailureCode: initial.code,
    message: initial.message,
    parsed: parsedRoot,
  });
  if (contraryRepair) return contraryRepair;

  const trimmed = args.raw.responseText.trim();
  const cleaned = applyDeterministicMilitaryExpertCleanup(args.raw.responseText);
  if (cleaned !== trimmed) {
    const retried = parseMilitaryExpertGenerationResponse(
      { ...args.raw, responseText: cleaned },
      { expectedCorrelationId: args.expectedCorrelationId },
    );
    if (retried.ok) {
      return {
        decision: "deterministic_cleanup_allowed",
        cleanedText: cleaned,
      };
    }
    const retriedContraryRepair = classifyContraryEvidenceRepair({
      parseFailureCode: retried.code,
      message: retried.message,
      parsed: extractParsedRoot(cleaned),
    });
    if (retriedContraryRepair) return retriedContraryRepair;
    if (REJECT_CODES.has(retried.code)) {
      return {
        decision: "reject_output",
        parseFailureCode: retried.code,
        message: retried.message,
      };
    }
  }

  if (PROVIDER_REPAIR_CODES.has(initial.code)) {
    return {
      decision: "provider_repair_required",
      parseFailureCode: initial.code,
      message: initial.message,
    };
  }

  if (REJECT_CODES.has(initial.code)) {
    return {
      decision: "reject_output",
      parseFailureCode: initial.code,
      message: initial.message,
    };
  }

  return {
    decision: "provider_repair_required",
    parseFailureCode: initial.code,
    message: initial.message,
  };
}
