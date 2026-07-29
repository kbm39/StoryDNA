import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildValidMilitaryExpertReview } from "@/experts/military-expert/fixtures.ts";
import { hashMilitaryExpertParsedReview } from "@/experts/military-expert/generation-contract.ts";
import { isTerminalWorkflowStatus } from "./types.ts";
import { validateAuthoritativeResultId, INVALID_AUTHORITATIVE_RESULT_ID } from "./authoritative-result-id.ts";

const WORKFLOW_STORE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "workflow-store.ts"),
  "utf8",
);

const VALID_UUID = "3d6ab10a-d0ff-4aa9-b531-932554f1e826";
const VALID_HASH = hashMilitaryExpertParsedReview(buildValidMilitaryExpertReview());

describe("isTerminalWorkflowStatus", () => {
  it("treats completed, failed, and cancelled as terminal", () => {
    assert.equal(isTerminalWorkflowStatus("completed"), true);
    assert.equal(isTerminalWorkflowStatus("failed"), true);
    assert.equal(isTerminalWorkflowStatus("cancelled"), true);
  });

  it("treats running as non-terminal", () => {
    assert.equal(isTerminalWorkflowStatus("running"), false);
    assert.equal(isTerminalWorkflowStatus("queued"), false);
  });
});

describe("markWorkflowCompleted UUID validation", () => {
  it("workflow-store validates authoritativeResultId before update", () => {
    assert.match(WORKFLOW_STORE_SRC, /validateAuthoritativeResultId\(args\.authoritativeResultId\)/);
  });

  it("accepts UUID values for completion", () => {
    assert.doesNotThrow(() => validateAuthoritativeResultId(VALID_UUID));
  });

  it("rejects SHA256 hex values for completion", () => {
    assert.throws(
      () => validateAuthoritativeResultId(VALID_HASH),
      (error: unknown) => error instanceof Error && error.message === INVALID_AUTHORITATIVE_RESULT_ID,
    );
  });
});
