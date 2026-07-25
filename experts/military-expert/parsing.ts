/**
 * Deterministic Military Expert generation response parser — fail-closed, no model repair.
 */

import { MAX_CANONICAL_OUTPUT_BYTES } from "@/lib/expert-review-engine/canonical-output.ts";
import { normalizeMilitaryExpertGenerationEnums } from "./enum-normalization.ts";
import {
  coerceMilitaryExpertGenerationPayload,
  validateMilitaryExpertGenerationPayload,
  type MilitaryExpertGenerationPayload,
} from "./output-schema.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";

export type MilitaryExpertParseFailureCode =
  | "malformed_json"
  | "multiple_payloads"
  | "trailing_content"
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
}

export interface MilitaryExpertParseFailure {
  ok: false;
  code: MilitaryExpertParseFailureCode;
  message: string;
}

export type MilitaryExpertParseResult = MilitaryExpertParseSuccess | MilitaryExpertParseFailure;

export interface ParseMilitaryExpertGenerationResponseOptions {
  expectedCorrelationId?: string;
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

function extractJsonCandidate(raw: string): {
  jsonText: string;
  trailingContent: string;
  multiplePayloads: boolean;
} {
  let text = raw.replace(/\r\n/g, "\n").trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const multiplePayloads = /\}\s*\{/.test(text);

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { jsonText: text, trailingContent: "", multiplePayloads };
  }

  const jsonText = text.slice(start, end + 1);
  const trailingContent = text.slice(end + 1).trim();

  return { jsonText, trailingContent, multiplePayloads };
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

    const { jsonText, trailingContent, multiplePayloads } = extractJsonCandidate(raw.responseText);
    if (multiplePayloads) {
      return {
        ok: false,
        code: "multiple_payloads",
        message: "Multiple JSON payloads are not allowed",
      };
    }

    if (trailingContent.length > 0) {
      return {
        ok: false,
        code: "trailing_content",
        message: "Trailing content after JSON payload is not allowed",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      return {
        ok: false,
        code: "malformed_json",
        message: error instanceof Error ? error.message : "Malformed JSON",
      };
    }

    const { normalized, audits } = normalizeMilitaryExpertGenerationEnums(parsed);
    void audits;

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

    return { ok: true, payload, cleanedText: jsonText };
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
  let text = rawText.replace(/\r\n/g, "\n").trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return text.trim();
}
