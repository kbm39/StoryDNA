import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeErrorForCode, errorCodeFromMessage } from "./safe-errors.ts";

describe("safe-errors", () => {
  it("never returns stack-like content", () => {
    const msg = safeErrorForCode("PIPELINE_FAILED", "Error: at Object.foo (file.ts:1:1)");
    assert.ok(!msg.includes("file.ts"));
    assert.ok(!msg.includes("Object.foo"));
  });

  it("maps author response messages", () => {
    assert.equal(
      errorCodeFromMessage("Cannot regenerate: 2 author responses have been recorded"),
      "AUTHOR_RESPONSES_PRESENT",
    );
  });

  it("maps version pin code to calm copy", () => {
    assert.match(safeErrorForCode("VERSION_PIN_MISMATCH"), /updated after this review started/i);
  });
});
