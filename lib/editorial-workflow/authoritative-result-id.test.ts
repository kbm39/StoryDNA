import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVALID_AUTHORITATIVE_RESULT_ID,
  buildAuthoritativeResultIdDiagnostics,
  classifyAuthoritativeResultIdValue,
  isInvalidAuthoritativeResultIdError,
  validateAuthoritativeResultId,
} from "./authoritative-result-id.ts";

import { buildValidMilitaryExpertReview } from "@/experts/military-expert/fixtures.ts";
import { hashMilitaryExpertParsedReview } from "@/experts/military-expert/generation-contract.ts";

const VALID_UUID = "3d6ab10a-d0ff-4aa9-b531-932554f1e826";
const VALID_HASH = hashMilitaryExpertParsedReview(buildValidMilitaryExpertReview());
/** Truncated hash from the stuck workflow failure (62 chars, not UUID). */
const STUCK_WORKFLOW_HASH = "7e08a44c0e23b9465dc6ab4100bc82e392a526206b652ea40d5c3c85e01020";

describe("authoritative-result-id", () => {
  it("1. accepts canonical UUID values", () => {
    assert.equal(classifyAuthoritativeResultIdValue(VALID_UUID), "uuid");
    assert.equal(validateAuthoritativeResultId(VALID_UUID), VALID_UUID);
  });

  it("2. classifies 64-char SHA256 hex separately from UUID", () => {
    assert.equal(VALID_HASH.length, 64);
    assert.equal(classifyAuthoritativeResultIdValue(VALID_HASH), "sha256_hex");
  });

  it("3. rejects SHA256 hex with INVALID_AUTHORITATIVE_RESULT_ID", () => {
    assert.throws(() => validateAuthoritativeResultId(VALID_HASH), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, INVALID_AUTHORITATIVE_RESULT_ID);
      return true;
    });
  });

  it("4. diagnostics identify expected uuid and received sha256_hex without full hash", () => {
    const diagnostics = buildAuthoritativeResultIdDiagnostics(VALID_HASH);
    assert.equal(diagnostics.expected, "uuid");
    assert.equal(diagnostics.received, "sha256_hex");
    assert.equal(diagnostics.length, 64);
    assert.equal(diagnostics.prefix, VALID_HASH.slice(0, 8));
    assert.doesNotMatch(JSON.stringify(diagnostics), new RegExp(VALID_HASH));
  });

  it("7. stuck-workflow hash shape is rejected as non-UUID", () => {
    assert.equal(STUCK_WORKFLOW_HASH.length, 62);
    assert.equal(classifyAuthoritativeResultIdValue(STUCK_WORKFLOW_HASH), "invalid");
    assert.throws(() => validateAuthoritativeResultId(STUCK_WORKFLOW_HASH));
  });

  it("5. rejects malformed values as invalid", () => {
    assert.equal(classifyAuthoritativeResultIdValue("not-a-uuid-or-hash"), "invalid");
    assert.throws(() => validateAuthoritativeResultId("not-a-uuid-or-hash"));
  });

  it("6. exposes typed invalid error helper", () => {
    try {
      validateAuthoritativeResultId(VALID_HASH);
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(isInvalidAuthoritativeResultIdError(error), true);
    }
  });
});
