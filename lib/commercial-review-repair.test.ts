import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCommercialMemoRepairPrompt,
  normalizeCommercialMemoStatistics,
} from "./commercial-review-repair.ts";
import { validateCommercialMemoOnly } from "./commercial-review-pipeline.ts";
import { validateMemoBeforeRubric } from "./commercial-review-generation.ts";
import {
  validateWordCountClaims,
} from "./word-count-validation.ts";
import { canonicalManuscriptLengthSentence } from "./word-count-reporting.ts";

const PROD_CANONICAL = 108_296;
const STALE_CANONICAL = 111_491;
const PROD_OPENING = canonicalManuscriptLengthSentence(PROD_CANONICAL);

const PRODUCTION_FAILURE_MEMO = `The manuscript is 111,491 words.

## Suggested Cuts

For reference against the authoritative total, a 20% cut would bring the book to roughly 89,193 words and a 25% cut to roughly 83,618 words.`;

describe("buildCommercialMemoRepairPrompt", () => {
  it("requires rewriting stale totals and recalculated cut math from runtime canonical", () => {
    const prompt = buildCommercialMemoRepairPrompt({
      canonicalWordCount: PROD_CANONICAL,
      memoContent: PRODUCTION_FAILURE_MEMO,
      wordCountContradictions: [],
    });

    assert.match(prompt, /Preserve the memo's editorial analysis/);
    assert.match(prompt, new RegExp(PROD_OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(prompt, /Never reuse word counts from earlier manuscript versions/);
    assert.match(prompt, /20% cut from 108,296 → ~86,637 words/);
    assert.match(prompt, /25% cut from 108,296 → ~81,222 words/);
  });
});

describe("normalizeCommercialMemoStatistics — Hold Fast production reproduction", () => {
  it("1. replaces stale 111,491 opening with exact canonical sentence", () => {
    const result = normalizeCommercialMemoStatistics({
      memoContent: PRODUCTION_FAILURE_MEMO,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true);
    assert.match(result.content, new RegExp(`^${PROD_OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.doesNotMatch(result.content, /111,491 words\./);
  });

  it("2. recomputes 20% cut to approximately 86,637", () => {
    const result = normalizeCommercialMemoStatistics({
      memoContent: PRODUCTION_FAILURE_MEMO,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true);
    assert.match(result.content, /86,637 words/);
    assert.doesNotMatch(result.content, /89,193 words/);
  });

  it("3. recomputes 25% cut to approximately 81,222", () => {
    const result = normalizeCommercialMemoStatistics({
      memoContent: PRODUCTION_FAILURE_MEMO,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true);
    assert.match(result.content, /81,222 words/);
    assert.doesNotMatch(result.content, /83,618 words/);
  });

  it("4. removes stale 111,491 current-total claims from repaired prose", () => {
    const memo = `${PRODUCTION_FAILURE_MEMO}

Watch the length claims in any query — at 111,491 words it's right-sized for the category.`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true);
    assert.doesNotMatch(result.content, /111,491/);
    assert.match(result.content, /108,296 words/);
  });

  it("12. production reproduction passes deterministic normalization and final validation", () => {
    const normalized = normalizeCommercialMemoStatistics({
      memoContent: PRODUCTION_FAILURE_MEMO,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(normalized.ok, true, normalized.ok ? "" : normalized.error);

    const wordVal = validateWordCountClaims(normalized.content, PROD_CANONICAL);
    assert.equal(wordVal.valid, true, wordVal.contradictions.map((c) => c.reason).join("; "));

    const gate = validateMemoBeforeRubric({
      memoContent: normalized.content,
      canonicalWordCount: PROD_CANONICAL,
      repairAttempted: true,
    });
    assert.equal(gate.ok, true, gate.error ?? "");
  });
});

describe("normalizeCommercialMemoStatistics — fail-closed guards", () => {
  it("5. duplicate canonical sentences still fail", () => {
    const memo = `${PROD_OPENING}

${PROD_OPENING}`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /Duplicate canonical current-total sentences/);
  });

  it("6. missing canonical sentence fails when an ambiguous claim remains", () => {
    const memo = "The draft currently runs 98,112 words.";
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, false);
    assert.ok(result.unclassifiedContradictions.length > 0);
  });

  it("7. stale 150k claims still fail closed", () => {
    const memo = `${PROD_OPENING}

This 150,000 word manuscript needs substantial cuts.`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, false);
    const gate = validateCommercialMemoOnly({
      memoContent: result.content,
      canonicalWordCount: PROD_CANONICAL,
      repairAttempted: true,
    });
    assert.equal(gate.ok, false);
    assert.match(gate.error ?? "", /AUTHORITATIVE STATISTICS CONTRADICTED/);
  });

  it("11. ambiguous unclassifiable length claim fails closed rather than being silently altered", () => {
    const memo = `${PROD_OPENING}

The draft currently runs 98,112 words.`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /98,112|current-total|contradict/i);
  });
});

describe("normalizeCommercialMemoStatistics — preserved safe patterns", () => {
  const YA_CANONICAL = 83_665;
  const YA_OPENING = canonicalManuscriptLengthSentence(YA_CANONICAL);

  it("8. category target ranges such as 70,000–80,000 remain allowed", () => {
    const memo = `${YA_OPENING}

The manuscript exceeds the ideal 70,000–80,000 word range for the category.`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: YA_CANONICAL,
    });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.match(result.content, /70,000–80,000/);
    assert.equal(validateWordCountClaims(result.content, YA_CANONICAL).valid, true);
  });

  it("9. compound descriptors such as 108k-word thriller do not become competing totals", () => {
    const memo = `${PROD_OPENING}

This 108k-word thriller opens with a strong hook.`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.match(result.content, /108k-word thriller/);
    assert.equal(validateWordCountClaims(result.content, PROD_CANONICAL).valid, true);
  });

  it("10. scene-level cut amounts and savings percentages are not rewritten as manuscript totals", () => {
    const memo = `${PROD_OPENING}

## Suggested Cuts

- Chapter 22 compression. *Est. savings: ~2,000–2,500 words.*
- Overall tightening on the order of roughly 6–9% of the whole.*`;
    const result = normalizeCommercialMemoStatistics({
      memoContent: memo,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(result.ok, true, result.ok ? "" : result.error);
    assert.match(result.content, /2,000–2,500 words/);
    assert.match(result.content, /6–9% of the whole/);
  });
});

describe("normalizeCommercialMemoStatistics — stale version mismatch", () => {
  it("does not accept stale cut math computed from 111,491 when canonical is 108,296", () => {
    const before = validateWordCountClaims(PRODUCTION_FAILURE_MEMO, PROD_CANONICAL);
    assert.equal(before.valid, false);

    const after = normalizeCommercialMemoStatistics({
      memoContent: PRODUCTION_FAILURE_MEMO,
      canonicalWordCount: PROD_CANONICAL,
    });
    assert.equal(after.ok, true);
    assert.equal(validateWordCountClaims(after.content, PROD_CANONICAL).valid, true);
    assert.equal(validateWordCountClaims(PRODUCTION_FAILURE_MEMO, STALE_CANONICAL).valid, true);
  });
});
