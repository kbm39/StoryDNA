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

  it("maps contrary evidence missing to MISSING_CONTRARY_EVIDENCE", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "evidence_missing",
        contraryEvidenceFailureCode: "MISSING_CONTRARY_EVIDENCE",
      }),
      "MISSING_CONTRARY_EVIDENCE",
    );
  });

  it("maps repair failure to CONTRARY_EVIDENCE_REPAIR_FAILED", () => {
    assert.equal(
      mapMilitaryExpertParseFailureToWorkflowErrorCode({
        parseFailureCode: "CONTRARY_EVIDENCE_REPAIR_FAILED",
      }),
      "CONTRARY_EVIDENCE_REPAIR_FAILED",
    );
  });
});
