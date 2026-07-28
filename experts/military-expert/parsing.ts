/**
 * Deterministic Military Expert generation response parser — fail-closed, no model repair.
 */

import { MAX_CANONICAL_OUTPUT_BYTES } from "@/lib/expert-review-engine/canonical-output.ts";
import {
  extractStrictModelJsonObject,
  isAllowedModelJsonTrailing,
} from "./model-json-extraction.ts";
import { normalizeMilitaryExpertGenerationEnums, type MilitaryExpertEnumNormalizationAudit } from "./enum-normalization.ts";
import {
  coerceMilitaryExpertGenerationPayload,
  validateMilitaryExpertGenerationPayload,
  type MilitaryExpertGenerationPayload,
} from "./output-schema.ts";
import {
  buildMilitaryExpertJsonParseDiagnostics,
  isLikelyProviderOutputTruncation,
  type MilitaryExpertJsonParseDiagnostics,
} from "./json-parse-diagnostics.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";

export type MilitaryExpertParseFailureCode =
  | "malformed_json"
  | "multiple_payloads"
  | "trailing_content"
  | "provider_output_truncated"
  | "schema_invalid"
  | "unsafe_content"
  | "evidence_missing"
  | "unsupported_category"
  | "unsupported_enum"
  | "output_too_large"
  | "correlation_mismatch"
  | "unexpected_parse_failure";

export interface MilitaryExpertParseSuccess {
  ok: true;
  payload: MilitaryExpertGenerationPayload;
  cleanedText: string;
  enumNormalizationAudits: readonly MilitaryExpertEnumNormalizationAudit[];
}

export interface MilitaryExpertParseFailure {
  ok: false;
  code: MilitaryExpertParseFailureCode;
  message: string;
  diagnostics?: MilitaryExpertJsonParseDiagnostics;
}

export type MilitaryExpertParseResult = MilitaryExpertParseSuccess | MilitaryExpertParseFailure;

export interface ParseMilitaryExpertGenerationResponseOptions {
  expectedCorrelationId?: string;
  maxOutputTokens?: number;
}

function classifySchemaErrors(errors: readonly string[]): MilitaryExpertParseFailureCode {
  const joined = errors.join(" ");
  if (/contrary-evidence|manuscript_evidence|negative finding requires/.test(joined)) {
    return "evidence_missing";
  }
  if (/unsupported value/.test(joined)) {
    return /category/.test(joined) ? "unsupported_category" : "unsupported_enum";
  }
  if (/safety-sensitive|service-history|fabricated source|letter grade/.test(joined)) {
    return "unsafe_content";
  }
  return "schema_invalid";
}

function measureUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Parse a provider-independent raw response envelope into a typed generation payload. */
export function parseMilitaryExpertGenerationResponse(
  raw: MilitaryExpertRawGenerationResponse,
  options: ParseMilitaryExpertGenerationResponseOptions = {},
): MilitaryExpertParseResult {
  try {
    if (
      options.expectedCorrelationId &&
      raw.correlationId !== options.expectedCorrelationId
    ) {
      return {
        ok: false,
        code: "correlation_mismatch",
        message: "Raw response correlationId does not match expected correlationId",
      };
    }

    if (measureUtf8Bytes(raw.responseText) > MAX_CANONICAL_OUTPUT_BYTES) {
      return {
        ok: false,
        code: "output_too_large",
        message: "Raw response exceeds maximum allowed output size",
      };
    }

    const extraction = extractStrictModelJsonObject(raw.responseText);
    const { jsonText, trailingContent, multiplePayloads, trailingCategory } = extraction;
    if (multiplePayloads) {
      return {
        ok: false,
        code: "multiple_payloads",
        message: "Multiple JSON payloads are not allowed",
      };
    }

    if (trailingContent.length > 0 && !isAllowedModelJsonTrailing(trailingCategory)) {
      return {
        ok: false,
        code: "trailing_content",
        message: "Trailing content after JSON payload is not allowed",
      };
    }

    if (trailingContent.length > 0 && !isAllowedModelJsonTrailing(trailingCategory)) {
      return {
        ok: false,
        code: "trailing_content",
        message: "Trailing content after JSON payload is not allowed",
      };
    }

    if (raw.finishStatus === "truncated") {
      return {
        ok: false,
        code: "provider_output_truncated",
        message: "Provider output was truncated before a complete JSON object was returned",
        diagnostics: buildMilitaryExpertJsonParseDiagnostics({
          raw,
          jsonText,
          maxOutputTokens: options.maxOutputTokens,
        }),
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      const parseMessage = error instanceof Error ? error.message : "Malformed JSON";
      const diagnostics = buildMilitaryExpertJsonParseDiagnostics({
        raw,
        jsonText,
        parseErrorMessage: parseMessage,
        maxOutputTokens: options.maxOutputTokens,
      });
      if (
        isLikelyProviderOutputTruncation({
          raw,
          jsonText,
          parseErrorMessage: parseMessage,
          maxOutputTokens: options.maxOutputTokens,
        })
      ) {
        return {
          ok: false,
          code: "provider_output_truncated",
          message: "Provider output was truncated before a complete JSON object was returned",
          diagnostics,
        };
      }
      return {
        ok: false,
        code: "malformed_json",
        message: parseMessage,
        diagnostics,
      };
    }

    const { normalized, audits } = normalizeMilitaryExpertGenerationEnums(parsed);

    const validation = validateMilitaryExpertGenerationPayload(normalized);
    if (!validation.ok) {
      return {
        ok: false,
        code: classifySchemaErrors(validation.errors),
        message: validation.errors.slice(0, 5).join("; "),
      };
    }

    const payload = coerceMilitaryExpertGenerationPayload(normalized);
    if (!payload) {
      return {
        ok: false,
        code: "unexpected_parse_failure",
        message: "Validated payload could not be coerced",
      };
    }

    return { ok: true, payload, cleanedText: jsonText, enumNormalizationAudits: audits };
  } catch (error) {
    return {
      ok: false,
      code: "unexpected_parse_failure",
      message: error instanceof Error ? error.message : "Unexpected parse failure",
    };
  }
}

/** Deterministic cleanup for approved outer formatting only. */
export function applyDeterministicMilitaryExpertCleanup(rawText: string): string {
  return extractStrictModelJsonObject(rawText).jsonText.trim();
}
