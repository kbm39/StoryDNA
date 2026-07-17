import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newWorkflowIdempotencyKey, isUniqueViolation, PG_UNIQUE_VIOLATION } from "./idempotency.ts";

describe("idempotency", () => {
  it("generates unique keys per call", () => {
    const a = newWorkflowIdempotencyKey();
    const b = newWorkflowIdempotencyKey();
    assert.notEqual(a, b);
    assert.match(a, /^[0-9a-f-]{36}$/i);
  });

  it("detects postgres unique violations", () => {
    assert.equal(isUniqueViolation({ code: PG_UNIQUE_VIOLATION }), true);
    assert.equal(isUniqueViolation({ code: "23503" }), false);
    assert.equal(isUniqueViolation(null), false);
  });
});
