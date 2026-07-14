import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  classifyLengthClaimContext,
  parseCompoundCutRanges,
  parseLinkedCutRecommendations,
  validateWordCountClaims,
  EDITORIAL_CUT_RANGE_TOLERANCE_WORDS,
} from "./word-count-validation.ts";
import { validateCommercialMemoOnly } from "./commercial-review-pipeline.ts";

const CANONICAL = 111_491;
const EXACT_OPENING = `The manuscript is ${CANONICAL.toLocaleString()} words.`;

const REAL_CUT_SENTENCE =
  "A 20% cut would bring the book to roughly 89,193 words and a 25% cut to roughly 83,618 words.";

const REAL_COMPOUND_SENTENCE =
  "a 12–18% reduction (approximately 13,400 to 20,100 words, bringing the manuscript to roughly 91,400–98,100 words)";

describe("length claim context classification", () => {
  it("classifies 20%/25% cut sentence as resulting totals", () => {
    const text = REAL_CUT_SENTENCE;
    const idx89193 = text.indexOf("89,193");
    const idx83618 = text.indexOf("83,618");
    assert.equal(classifyLengthClaimContext(text, idx89193, idx89193 + 6), "resulting_total");
    assert.equal(classifyLengthClaimContext(text, idx83618, idx83618 + 6), "resulting_total");
  });

  it("classifies current vs resulting vs cut amount examples", () => {
    assert.equal(
      classifyLengthClaimContext("The manuscript is roughly 89,193 words.", 25, 31),
      "current_total",
    );
    assert.equal(
      classifyLengthClaimContext("Target length: 89,193 words after a 20% cut.", 15, 21),
      "resulting_total",
    );
    assert.equal(
      classifyLengthClaimContext("Estimated savings: 13,379 words.", 20, 26),
      "cut_amount",
    );
    assert.equal(
      classifyLengthClaimContext("The draft currently runs 98,112 words.", 26, 32),
      "current_total",
    );
  });
});

describe("compound cut range parsing", () => {
  it("parses the exact real compound sentence with linked ranges", () => {
    const ranges = parseCompoundCutRanges(REAL_COMPOUND_SENTENCE, CANONICAL);
    assert.equal(ranges.length, 1);
    const r = ranges[0];
    assert.equal(r.cutPercentageMin, 12);
    assert.equal(r.cutPercentageMax, 18);
    assert.equal(r.cutAmountMin, 13_400);
    assert.equal(r.cutAmountMax, 20_100);
    assert.equal(r.resultingTotalMin, 91_400);
    assert.equal(r.resultingTotalMax, 98_100);
    assert.equal(r.valid, true);
  });

  it("validates range arithmetic with editorial rounding tolerance", () => {
    assert.equal(Math.round(CANONICAL * 0.12), 13_379);
    assert.equal(Math.round(CANONICAL * 0.18), 20_068);
    assert.equal(Math.round(CANONICAL * 0.88), 98_112);
    assert.equal(Math.round(CANONICAL * 0.82), 91_423);
    assert.ok(EDITORIAL_CUT_RANGE_TOLERANCE_WORDS >= 100);
  });

  it("passes real compound sentence with zero CURRENT_TOTAL contradictions", () => {
    const memo = `${EXACT_OPENING}\n\nSignificant tightening is warranted — ${REAL_COMPOUND_SENTENCE}.`;
    const r = validateWordCountClaims(memo, CANONICAL);
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
    assert.equal(r.contradictions.length, 0);
    assert.ok(!r.contradictions.some((c) => c.claimType === "current_total" || !c.claimType));
  });

  it("produces no duplicate claims for compound sentence", () => {
    const memo = `${EXACT_OPENING}\n\n${REAL_COMPOUND_SENTENCE}.`;
    const r = validateWordCountClaims(memo, CANONICAL);
    const keys = r.contradictions.map((c) => `${c.claimedWords}:${c.claimType}:${c.quotation.slice(0, 40)}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("The manuscript currently runs between 13,400 and 20,100 words → fails as CURRENT_TOTAL", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nThe manuscript currently runs between 13,400 and 20,100 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });

  it("Cut approximately 13,400–20,100 words → passes as CUT_AMOUNT", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nCut approximately 13,400–20,100 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
  });

  it("A 12–18% reduction would leave 91,400–98,100 words → passes", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nA 12–18% reduction would leave 91,400–98,100 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
  });

  it("The current draft is 91,400–98,100 words → fails", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nThe current draft is 91,400–98,100 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });

  it("Remove 13,400 words, leaving 98,091 words → validates linked arithmetic", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nRemove 13,400 words, leaving 98,091 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
    assert.equal(CANONICAL - 13_400, 98_091);
  });

  it("Remove 13,400 words, leaving 90,000 words → fails linked arithmetic", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nRemove 13,400 words, leaving 90,000 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
  });
});

describe("linked cut recommendation parsing", () => {
  it("parses two linked cut recommendations from real memo sentence", () => {
    const cuts = parseLinkedCutRecommendations(REAL_CUT_SENTENCE, CANONICAL);
    assert.equal(cuts.length, 2);
    assert.equal(cuts[0].cutPercentage, 20);
    assert.equal(cuts[0].resultingTotal, 89_193);
    assert.equal(cuts[0].valid, true);
    assert.equal(cuts[1].cutPercentage, 25);
    assert.equal(cuts[1].resultingTotal, 83_618);
    assert.equal(cuts[1].valid, true);
  });

  it("validates arithmetic: round(111491 × 0.80) = 89193 and round(111491 × 0.75) = 83618", () => {
    assert.equal(Math.round(CANONICAL * 0.8), 89_193);
    assert.equal(Math.round(CANONICAL * 0.75), 83_618);
  });
});

describe("real memo sentence regression", () => {
  it("passes with zero contradictions for canonical + real cut sentence", () => {
    const memo = `${EXACT_OPENING}\n\nFor reference, ${REAL_CUT_SENTENCE}`;
    const r = validateWordCountClaims(memo, CANONICAL);
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
    assert.equal(r.contradictions.length, 0);
  });

  it("produces no duplicate diagnostics for the real cut sentence", () => {
    const memo = `${EXACT_OPENING}\n\n${REAL_CUT_SENTENCE}`;
    const r = validateWordCountClaims(memo, CANONICAL);
    const keys = r.contradictions.map((c) => `${c.claimedWords}:${c.claimType}:${c.quotation.slice(0, 40)}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("The manuscript is roughly 89,193 words → fails as CURRENT_TOTAL", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nThe manuscript is roughly 89,193 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
    assert.ok(r.contradictions.some((c) => c.claimedWords === 89_193));
  });

  it("Target length: 89,193 words after a 20% cut → passes", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nTarget length: 89,193 words after a 20% cut.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
  });

  it("Estimated savings: 13,379 words → passes as CUT_AMOUNT", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nEstimated savings: 13,379 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
  });

  it("Remove 13,379 words, resulting in 98,112 words → both pass", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nRemove 13,379 words, resulting in 98,112 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, true, r.contradictions.map((c) => c.reason).join("; "));
    assert.equal(98_112, CANONICAL - 13_379);
  });

  it("The draft currently runs 98,112 words → fails", () => {
    const r = validateWordCountClaims(
      `${EXACT_OPENING}\n\nThe draft currently runs 98,112 words.`,
      CANONICAL,
    );
    assert.equal(r.valid, false);
    assert.ok(r.contradictions.some((c) => c.claimedWords === 98_112));
  });
});

describe("Hold Fast fresh-run diagnostic replay (no AI)", () => {
  const diagPath = join(process.cwd(), ".review-failure-diagnostics/hold-fast-fresh-run-latest.json");

  it("repaired memo passes memo gate and would proceed to Call B", () => {
    if (!existsSync(diagPath)) return;

    const diagnostic = JSON.parse(readFileSync(diagPath, "utf8")) as {
      memoContent: string;
      canonicalWordCount?: number;
    };
    const memo = diagnostic.memoContent;
    const canonical = diagnostic.canonicalWordCount ?? CANONICAL;

    const compounds = parseCompoundCutRanges(memo, canonical);
    assert.ok(compounds.length >= 1, "expected at least one compound cut clause");
    const main = compounds.find(
      (c) => c.cutAmountMin === 13_400 && c.cutAmountMax === 20_100,
    );
    assert.ok(main, "expected 13,400–20,100 cut-amount range");
    assert.equal(main!.valid, true);
    assert.ok(
      compounds.some((c) => c.resultingTotalMin === 91_400 && c.resultingTotalMax === 98_100),
      "expected 91,400–98,100 resulting-total range",
    );

    const wordVal = validateWordCountClaims(memo, canonical);
    assert.equal(wordVal.valid, true, wordVal.contradictions.map((c) => c.reason).join("; "));
    assert.equal(wordVal.contradictions.length, 0);

    const memoGate = validateCommercialMemoOnly({
      memoContent: memo,
      canonicalWordCount: canonical,
      repairAttempted: true,
    });
    assert.equal(memoGate.ok, true, memoGate.error ?? "");

    assert.match(memo, /The manuscript is 111,491 words/);
    assert.doesNotMatch(memo, /STORYDNA_RUBRIC_JSON/);
  });
});

describe("Hold Fast two-call diagnostic replay (no AI)", () => {
  const diagPath = join(process.cwd(), ".review-failure-diagnostics/hold-fast-two-call-latest.json");

  it("repaired memo passes memo gate and would proceed to Call B", () => {
    if (!existsSync(diagPath)) return;

    const diagnostic = JSON.parse(readFileSync(diagPath, "utf8")) as {
      memoContent: string;
      canonicalWordCount?: number;
    };
    const memo = diagnostic.memoContent;
    const canonical = diagnostic.canonicalWordCount ?? CANONICAL;

    const wordVal = validateWordCountClaims(memo, canonical);
    assert.equal(wordVal.valid, true, wordVal.contradictions.map((c) => c.reason).join("; "));
    assert.equal(wordVal.contradictions.length, 0);

    const memoGate = validateCommercialMemoOnly({
      memoContent: memo,
      canonicalWordCount: canonical,
      repairAttempted: true,
    });
    assert.equal(memoGate.ok, true, memoGate.error ?? "");

    const cuts = parseLinkedCutRecommendations(memo, canonical);
    const cut20 = cuts.find((c) => c.cutPercentage === 20);
    const cut25 = cuts.find((c) => c.cutPercentage === 25);
    assert.ok(cut20?.valid, "20% / 89,193 should pass");
    assert.ok(cut25?.valid, "25% / 83,618 should pass");

    assert.match(memo, /The manuscript is 111,491 words/);
    assert.doesNotMatch(memo, /STORYDNA_RUBRIC_JSON/);
  });
});
