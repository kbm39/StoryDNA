/**
 * Map Military Expert parse failures to Studio workflow-safe error codes.
 */

import type { ContraryEvidenceFailureCode } from "./contrary-evidence-schema-repair.ts";
import type { ModelJsonTrailingCategory } from "./model-json-extraction.ts";
import type { MilitaryExpertParseFailureCode } from "./parsing.ts";

export type MilitaryExpertWorkflowParseErrorCode =
  | "PROVIDER_TRAILING_PROSE"
  | "PROVIDER_MULTIPLE_JSON_PAYLOADS"
  | "PROVIDER_MARKDOWN_WRAPPER_INVALID"
  | "PROVIDER_JSON_REPAIR_FAILED"
  | "PROVIDER_OUTPUT_TRUNCATED"
  | "MISSING_CONTRARY_EVIDENCE"
  | "MISSING_UNCERTAINTY_NOTE"
  | "CONTRARY_EVIDENCE_REPAIR_FAILED"
  | "PIPELINE_FAILED";

export function mapContraryEvidenceFailureToWorkflowErrorCode(
  failureCode: ContraryEvidenceFailureCode,
): MilitaryExpertWorkflowParseErrorCode {
  switch (failureCode) {
    case "MISSING_CONTRARY_EVIDENCE":
      return "MISSING_CONTRARY_EVIDENCE";
    case "MISSING_UNCERTAINTY_NOTE":
      return "MISSING_UNCERTAINTY_NOTE";
    case "CONTRARY_EVIDENCE_REPAIR_FAILED":
      return "CONTRARY_EVIDENCE_REPAIR_FAILED";
    default:
      return "PIPELINE_FAILED";
  }
}

export function mapMilitaryExpertParseFailureToWorkflowErrorCode(args: {
  parseFailureCode: MilitaryExpertParseFailureCode | ContraryEvidenceFailureCode | string;
  trailingCategory?: ModelJsonTrailingCategory;
  contraryEvidenceFailureCode?: Exclude<
    ContraryEvidenceFailureCode,
    "CONTRARY_EVIDENCE_REPAIR_FAILED"
  >;
}): MilitaryExpertWorkflowParseErrorCode {
  const { parseFailureCode, trailingCategory, contraryEvidenceFailureCode } = args;

  if (parseFailureCode === "CONTRARY_EVIDENCE_REPAIR_FAILED") {
    return "CONTRARY_EVIDENCE_REPAIR_FAILED";
  }
  if (contraryEvidenceFailureCode === "MISSING_CONTRARY_EVIDENCE") {
    return "MISSING_CONTRARY_EVIDENCE";
  }
  if (contraryEvidenceFailureCode === "MISSING_UNCERTAINTY_NOTE") {
    return "MISSING_UNCERTAINTY_NOTE";
  }
  if (parseFailureCode === "evidence_missing") {
    return contraryEvidenceFailureCode ?? "MISSING_CONTRARY_EVIDENCE";
  }

  if (parseFailureCode === "provider_output_truncated") {
    return "PROVIDER_OUTPUT_TRUNCATED";
  }
  if (parseFailureCode === "multiple_payloads") {
    return "PROVIDER_MULTIPLE_JSON_PAYLOADS";
  }
  if (parseFailureCode === "trailing_content") {
    if (
      trailingCategory === "second_json_object" ||
      trailingCategory === "partial_duplicate_json"
    ) {
      return "PROVIDER_MULTIPLE_JSON_PAYLOADS";
    }
    if (
      trailingCategory === "closing_markdown_fence" ||
      trailingCategory === "other"
    ) {
      return "PROVIDER_MARKDOWN_WRAPPER_INVALID";
    }
    return "PROVIDER_TRAILING_PROSE";
  }
  if (parseFailureCode === "malformed_json") {
    return "PIPELINE_FAILED";
  }
  return "PIPELINE_FAILED";
}
