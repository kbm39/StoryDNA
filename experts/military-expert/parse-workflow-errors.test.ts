import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMilitaryExpertParseFailureToWorkflowErrorCode } from "./parse-workflow-errors.ts";

describe("mapMilitaryExpertParseFailureToWorkflowErrorCode", () => {
  it("maps trailing prose to PROVIDER_TRAILING_PROSE", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "trailing_content",
        trailingCategory: "explanatory_prose",
      }),
      "PROVIDER_TRAILING_PROSE",
    );
  });

  it("maps multiple payloads to PROVIDER_MULTIPLE_JSON_PAYLOADS", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "multiple_payloads",
      }),
      "PROVIDER_MULTIPLE_JSON_PAYLOADS",
    );
  });

  it("maps partial duplicate trailing JSON to PROVIDER_MULTIPLE_JSON_PAYLOADS", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "trailing_content",
        trailingCategory: "partial_duplicate_json",
      }),
      "PROVIDER_MULTIPLE_JSON_PAYLOADS",
    );
  });

  it("maps truncation to PROVIDER_OUTPUT_TRUNCATED", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "provider_output_truncated",
      }),
      "PROVIDER_OUTPUT_TRUNCATED",
    );
  });
});
