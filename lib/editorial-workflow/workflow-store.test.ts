import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTerminalWorkflowStatus } from "./types.ts";

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
