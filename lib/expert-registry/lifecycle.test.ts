import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertLifecycleTransition,
  isImmutableLifecycleStatus,
  validateLifecycleTransition,
} from "./lifecycle.ts";

describe("lifecycle", () => {
  it("allows draft → active", () => {
    assert.equal(validateLifecycleTransition("draft", "active").ok, true);
  });

  it("allows active → deprecated", () => {
    assert.equal(validateLifecycleTransition("active", "deprecated").ok, true);
  });

  it("rejects active → draft", () => {
    const result = validateLifecycleTransition("active", "draft");
    assert.equal(result.ok, false);
  });

  it("rejects deprecated → active directly", () => {
    const result = validateLifecycleTransition("deprecated", "active");
    assert.equal(result.ok, false);
  });

  it("assertLifecycleTransition throws on invalid transition", () => {
    assert.throws(() => assertLifecycleTransition("archived", "active"));
  });

  it("isImmutableLifecycleStatus for active, deprecated, archived", () => {
    assert.equal(isImmutableLifecycleStatus("active"), true);
    assert.equal(isImmutableLifecycleStatus("deprecated"), true);
    assert.equal(isImmutableLifecycleStatus("archived"), true);
    assert.equal(isImmutableLifecycleStatus("draft"), false);
  });
});
