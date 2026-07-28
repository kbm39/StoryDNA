/**
 * Deterministic Military Expert repair classification — no provider repair execution.
 */

import {
  parseMilitaryExpertGenerationResponse,
  applyDeterministicMilitaryExpertCleanup,
  type MilitaryExpertParseFailureCode,
} from "./parsing.ts";
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
