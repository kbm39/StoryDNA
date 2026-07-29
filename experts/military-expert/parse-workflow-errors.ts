/**
 * Map Military Expert parse failures to Studio workflow-safe error codes.
 */

import type { ModelJsonTrailingCategory } from "./model-json-extraction.ts";
import type { MilitaryExpertParseFailureCode } from "./parsing.ts";

export type MilitaryExpertWorkflowParseErrorCode =
  | "PROVIDER_TRAILING_PROSE"
  | "PROVIDER_MULTIPLE_JSON_PAYLOADS"
  | "PROVIDER_MARKDOWN_WRAPPER_INVALID"
  | "PROVIDER_JSON_REPAIR_FAILED"
  | "PROVIDER_OUTPUT_TRUNCATED"
  | "PIPELINE_FAILED";

export function mapMilitaryExpertParseFailureToWorkflowErrorCode(args: {
  parseFailureCode: MilitaryExpertParseFailureCode;
  trailingCategory?: ModelJsonTrailingCategory;
}): MilitaryExpertWorkflowParseErrorCode {
  const { parseFailureCode, trailingCategory } = args;

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
