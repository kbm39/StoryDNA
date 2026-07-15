import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalReviewInput,
  verifyCanonicalWordCount,
} from "./canonical-review-input.ts";
import { calculateLengthCut, formatLengthCutBlock } from "./length-cut-arithmetic.ts";

const CANONICAL = 111_491;

describe("canonical review input", () => {
  it("loads canonical count when stored and recomputed match", () => {
    const text = "word ".repeat(CANONICAL);
    const result = buildCanonicalReviewInput({
      manuscriptVersionId: "version-1",
      extractedText: text,
      storedWordCount: CANONICAL,
      contentHash: "abc123",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.input.canonicalWordCount, CANONICAL);
    assert.equal(result.input.storedWordCount, CANONICAL);
    assert.equal(result.input.recomputedWordCount, CANONICAL);
    assert.equal(result.input.manuscriptVersionId, "version-1");
    assert.equal(result.input.manuscriptContentHash, "abc123");
    assert.equal(result.input.countMethod, "STORYDNA_UNICODE_V1");
  });

  it("blocks when stored count does not match independent recount", () => {
    const text = "word ".repeat(CANONICAL);
    const result = buildCanonicalReviewInput({
      manuscriptVersionId: "version-1",
      extractedText: text,
      storedWordCount: 111_441,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /does not match independent recount/);
    assert.equal(result.recomputedWordCount, CANONICAL);
    assert.equal(result.storedWordCount, 111_441);
  });

  it("verifyCanonicalWordCount requires match before AI", () => {
    const text = "word ".repeat(CANONICAL);
    assert.equal(verifyCanonicalWordCount({ storedWordCount: CANONICAL, extractedText: text }).ok, true);
    assert.equal(
      verifyCanonicalWordCount({ storedWordCount: 150_000, extractedText: text }).ok,
      false,
    );
  });
});

describe("length cut arithmetic", () => {
  it("calculates 15% cut from 111,491 application-side", () => {
    const calc = calculateLengthCut(111_491, 15);
    assert.equal(calc.current, 111_491);
    assert.equal(calc.cutAmount, 16_724);
    assert.equal(calc.resulting, 94_767);
    assert.match(formatLengthCutBlock(111_491, 15), /Current: 111,491/);
    assert.match(formatLengthCutBlock(111_491, 15), /Cut \(15%\): 16,724/);
    assert.match(formatLengthCutBlock(111_491, 15), /Result: 94,767/);
  });
});
