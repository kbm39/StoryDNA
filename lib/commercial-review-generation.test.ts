import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ACQUISITION_CATEGORIES,
  attachRubricToMemo,
  COMMERCIAL_MEMO_MAX_TOKENS,
  CRAFT_CATEGORIES,
  RUBRIC_JSON_MARKER,
} from "./commercial-fiction-rubric.ts";
import {
  assessRubricGenerationResult,
  classifyLegacyCombinedOutputFailure,
  combineMemoAndRubric,
  evaluateCallAGeneration,
  evaluatePostMemoValidation,
  isMemoOutputWithinBudget,
  memoContainsEmbeddedRubric,
  RUBRIC_PARSE_FAILURE_USER_MESSAGE,
  shouldRepairRubricJson,
  shouldRetryRubricGeneration,
  validateCombinedCommercialReview,
  validateMemoBeforeRubric,
} from "./commercial-review-generation.ts";
import { buildCommercialRubricGenerationPrompt } from "./commercial-fiction-rubric.ts";
import {
  buildMemoTruncationDiagnostics,
  writeMemoTruncationDiagnosticArtifact,
} from "./commercial-review-diagnostics.ts";
import {
  extractRubricPayload,
  parseRubricJsonString,
  validateRubricCategoryKeys,
} from "./rubric-validation.ts";
import { letterGradeFromScore } from "./grade-calculation.ts";
import { buildReviewStatistics } from "./review-statistics.ts";
import type { CommercialRubricPayload, RubricCategoryScore } from "./commercial-fiction-rubric.ts";
import type { GenerationMeta } from "./ai/shared.ts";

import { storyDnaAnalyticalOpening } from "./word-count-reporting.ts";

const HOLD_FAST_CANONICAL = 111_491;
const EXACT_OPENING = storyDnaAnalyticalOpening(HOLD_FAST_CANONICAL);

function sampleCategory(
  key: string,
  name: string,
  max: number,
  earned: number,
): RubricCategoryScore {
  return {
    category_key: key,
    category_name: name,
    points_earned: earned,
    maximum_points: max,
    deduction: max - earned,
    weighted_contribution: earned,
    confidence: "high",
    strengths: ["Strong prologue hook"],
    deductions: earned < max ? ["Back third sags"] : [],
    deduction_reasons: earned < max ? ["Denouement drains momentum"] : [],
    revision_to_recover: "Tighten post-climax chapters",
    examples: [
      { text: "The first round came through the wall.", location: "Prologue" },
      { text: "The children's names were Yasmin and Darius.", location: "Ch. 8" },
    ],
  };
}

function fullRubricPayload(craftEarned: number[], acqEarned: number[]): CommercialRubricPayload {
  return {
    craft_categories: CRAFT_CATEGORIES.map((c, i) =>
      sampleCategory(c.key, c.name, c.max, craftEarned[i] ?? 5),
    ),
    acquisition_categories: ACQUISITION_CATEGORIES.map((c, i) =>
      sampleCategory(c.key, c.name, c.max, acqEarned[i] ?? 3),
    ),
    length_recommendations: [],
  };
}

function longMemoWithoutRubric(): string {
  return `${EXACT_OPENING}\n\n${"Detailed editorial analysis paragraph. ".repeat(400)}`;
}

function truncatedRubricJson(): string {
  const partial = fullRubricPayload(
    CRAFT_CATEGORIES.map(() => 5),
    ACQUISITION_CATEGORIES.map(() => 3),
  );
  partial.acquisition_categories = partial.acquisition_categories.slice(0, 2);
  const json = JSON.stringify(partial);
  return json.slice(0, json.length - 40);
}

function stats() {
  return buildReviewStatistics({
    manuscriptId: "9f482ca2-a0f6-4709-8364-18a0ef950eb0",
    manuscriptVersionId: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
    extractedText: "word ".repeat(HOLD_FAST_CANONICAL),
    sentChars: 1000,
    storedWordCount: HOLD_FAST_CANONICAL,
  });
}

function meta(truncated: boolean): GenerationMeta {
  return {
    finishReason: truncated ? "max_tokens" : "end_turn",
    inputTokens: 1000,
    outputTokens: truncated ? 8000 : 2000,
    maxTokens: 8000,
    outputTruncated: truncated,
  };
}

describe("two-call commercial review generation", () => {
  it("long memo without rubric does not embed STORYDNA_RUBRIC_JSON", () => {
    const memo = longMemoWithoutRubric();
    assert.equal(memoContainsEmbeddedRubric(memo), false);
    const gate = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: HOLD_FAST_CANONICAL,
    });
    assert.equal(gate.ok, true);
  });

  it("valid memo + truncated rubric triggers rubric-only retry, not memo regeneration", () => {
    const memo = longMemoWithoutRubric();
    const rubricRaw = truncatedRubricJson();
    const assessment = assessRubricGenerationResult({
      rawContent: rubricRaw,
      generationMeta: meta(true),
      statistics: stats(),
      statisticsValid: true,
    });
    assert.equal(assessment.failureKind, "RUBRIC_GENERATION_TRUNCATED");
    assert.equal(shouldRetryRubricGeneration(assessment), true);
    assert.equal(memoContainsEmbeddedRubric(memo), false);
    assert.equal(validateMemoBeforeRubric({ memoContent: memo, canonicalWordCount: HOLD_FAST_CANONICAL }).ok, true);
  });

  it("second rubric failure blocks publication without memo mutation", () => {
    const rubricRaw = truncatedRubricJson();
    const second = assessRubricGenerationResult({
      rawContent: rubricRaw,
      generationMeta: meta(true),
      statistics: stats(),
      statisticsValid: true,
    });
    assert.equal(shouldRetryRubricGeneration(second), true);
    assert.equal(second.parsed.payload, null);
    assert.notEqual(second.failureKind, null);
  });

  it("requires exactly 14 category keys in rubric JSON", () => {
    const partial = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    partial.acquisition_categories = partial.acquisition_categories.slice(0, 2);
    const keys = validateRubricCategoryKeys(
      partial.craft_categories.map((c) => ({ category_key: c.category_key })),
      partial.acquisition_categories.map((c) => ({ category_key: c.category_key })),
    );
    assert.ok(keys.some((e) => e.includes("Expected 6 acquisition")));
  });

  it("application calculates grade after rubric validation", () => {
    const memo = `${EXACT_OPENING}\n\nSolid memo.`;
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const craft = payload.craft_categories.reduce((s, c) => s + c.points_earned, 0);
    const acq = payload.acquisition_categories.reduce((s, c) => s + c.points_earned, 0);
    const total = craft + acq;
    const result = validateCombinedCommercialReview({
      memoContent: memo,
      rubricPayload: payload,
      statistics: stats(),
      reviewMeta: null,
    });
    assert.equal(result.ok, true);
    assert.equal(result.result!.grading.manuscriptScore, total);
    assert.equal(result.result!.grading.letterGrade, letterGradeFromScore(total));
    assert.equal(result.result!.grading.craftScore, craft);
    assert.equal(result.result!.grading.acquisitionScore, acq);
  });

  it("retains canonical count 111491 across memo and rubric calls", () => {
    assert.equal(stats().canonical_word_count, HOLD_FAST_CANONICAL);
    const memo = `${EXACT_OPENING}\n\nAnalysis.`;
    assert.equal(
      validateMemoBeforeRubric({ memoContent: memo, canonicalWordCount: HOLD_FAST_CANONICAL }).ok,
      true,
    );
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const combined = combineMemoAndRubric(memo, payload);
    assert.match(combined, /111,491 words/);
    assert.ok(combined.includes(RUBRIC_JSON_MARKER));
  });

  it("memo with embedded rubric marker fails Call A gate", () => {
    const memo = `${EXACT_OPENING}\n\n${RUBRIC_JSON_MARKER}\n{}`;
    const gate = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: HOLD_FAST_CANONICAL,
    });
    assert.equal(gate.ok, false);
    assert.match(gate.error ?? "", /must not appear in Call A/);
  });

  it("truncated memo content fails memo validation when word count broken", () => {
    const memo = "This memo never states the canonical count.";
    const gate = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: HOLD_FAST_CANONICAL,
    });
    assert.equal(gate.ok, false);
  });
});

describe("Call A memo token budget and truncation gate", () => {
  const holdFastRealOutputTokens = 11_738;

  function memoMeta(overrides: Partial<GenerationMeta>): GenerationMeta {
    return {
      finishReason: "end_turn",
      inputTokens: 220_128,
      outputTokens: holdFastRealOutputTokens,
      maxTokens: COMMERCIAL_MEMO_MAX_TOKENS,
      outputTruncated: false,
      ...overrides,
    };
  }

  it("memo max token budget is 16000", () => {
    assert.equal(COMMERCIAL_MEMO_MAX_TOKENS, 16_000);
  });

  it("accepts a 11738-token completion within the 16000 budget", () => {
    const meta = memoMeta({ outputTokens: holdFastRealOutputTokens, finishReason: "end_turn" });
    assert.equal(isMemoOutputWithinBudget(meta), true);
    const gate = evaluateCallAGeneration({ generationMeta: meta });
    assert.equal(gate.proceedToMemoValidation, true);
    assert.equal(gate.failureKind, null);
    assert.equal(gate.invokeCallB, false);
    assert.equal(gate.invokePublishRpc, false);
  });

  it("blocks finish_reason=max_tokens with MEMO_GENERATION_TRUNCATED", () => {
    const meta = memoMeta({
      finishReason: "max_tokens",
      outputTokens: COMMERCIAL_MEMO_MAX_TOKENS,
      outputTruncated: true,
    });
    const gate = evaluateCallAGeneration({ generationMeta: meta });
    assert.equal(gate.proceedToMemoValidation, false);
    assert.equal(gate.failureKind, "MEMO_GENERATION_TRUNCATED");
    assert.equal(gate.invokeCallB, false);
    assert.equal(gate.invokePublishRpc, false);
    assert.match(gate.error ?? "", /truncated/i);
  });

  it("truncation failure diagnostics include complete GenerationMeta", () => {
    const meta = memoMeta({
      finishReason: "max_tokens",
      outputTokens: 12_000,
      maxTokens: 12_000,
      outputTruncated: true,
    });
    const diag = buildMemoTruncationDiagnostics({
      manuscriptId: "9f482ca2-a0f6-4709-8364-18a0ef950eb0",
      manuscriptVersionId: "4ba2909f-cdd6-40cb-9dbf-934df71246cd",
      statistics: stats(),
      storedWordCount: HOLD_FAST_CANONICAL,
      recomputedWordCount: HOLD_FAST_CANONICAL,
      memoContent: "Partial memo…",
      memoGenerationMeta: meta,
    });
    assert.equal(diag.failureKind, "MEMO_GENERATION_TRUNCATED");
    assert.equal(diag.failurePhase, "memo");
    assert.equal(diag.memoGenerationMeta?.finishReason, "max_tokens");
    assert.equal(diag.memoGenerationMeta?.inputTokens, 220_128);
    assert.equal(diag.memoGenerationMeta?.outputTokens, 12_000);
    assert.equal(diag.memoGenerationMeta?.maxTokens, 12_000);
    assert.equal(diag.memoGenerationMeta?.outputTruncated, true);
    assert.equal(diag.memoContent, "Partial memo…");
  });

  it("does not invoke Call B after truncated Call A", () => {
    const gate = evaluateCallAGeneration({
      generationMeta: memoMeta({ outputTruncated: true, finishReason: "max_tokens" }),
    });
    assert.equal(gate.invokeCallB, false);
    assert.equal(gate.proceedToMemoValidation, false);
    // Truncation stops the pipeline before memo validation, so Call B is never reached.
  });

  it("truncation gate blocks publish RPC and leaves prior active review unchanged", () => {
    const gate = evaluateCallAGeneration({
      generationMeta: memoMeta({ outputTruncated: true, finishReason: "max_tokens" }),
    });
    assert.equal(gate.invokePublishRpc, false);
    assert.equal(gate.proceedToMemoValidation, false);
    // Orchestrator returns before any DB mutation when gate fails.
  });

  it("non-truncated Call A proceeds to validation then Call B", () => {
    const memo = `${EXACT_OPENING}\n\n${"Analysis. ".repeat(50)}`;
    const callA = evaluateCallAGeneration({ generationMeta: memoMeta({}) });
    assert.equal(callA.proceedToMemoValidation, true);
    const memoGate = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: HOLD_FAST_CANONICAL,
    });
    assert.equal(memoGate.ok, true);
    const postMemo = evaluatePostMemoValidation({ memoGateOk: memoGate.ok });
    assert.equal(postMemo.invokeCallB, true);
    assert.equal(postMemo.invokePublishRpc, false);
  });

  it("writes truncation diagnostic artifact when diagnostics enabled", () => {
    const prev = process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS;
    const prevNode = process.env.NODE_ENV;
    process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS = "1";
    process.env.NODE_ENV = "test";
    try {
      const diag = buildMemoTruncationDiagnostics({
        manuscriptId: "m1",
        manuscriptVersionId: "v1",
        statistics: stats(),
        storedWordCount: HOLD_FAST_CANONICAL,
        recomputedWordCount: HOLD_FAST_CANONICAL,
        memoContent: "truncated",
        memoGenerationMeta: memoMeta({ outputTruncated: true, finishReason: "max_tokens" }),
      });
      const path = writeMemoTruncationDiagnosticArtifact(diag, "test-memo-truncation.json");
      assert.ok(path?.endsWith("test-memo-truncation.json"));
      assert.ok(existsSync(path!));
    } finally {
      if (prev === undefined) delete process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS;
      else process.env.STORYDNA_REVIEW_FAILURE_DIAGNOSTICS = prev;
      process.env.NODE_ENV = prevNode ?? "test";
    }
  });
});

describe("Hold Fast diagnostic replay (no AI)", () => {
  const diagPath = join(process.cwd(), ".review-failure-diagnostics/hold-fast-latest.json");

  it("legacy combined parser identifies truncation in saved artifact", () => {
    if (!existsSync(diagPath)) {
      return;
    }
    const diagnostic = JSON.parse(readFileSync(diagPath, "utf8")) as {
      originalReviewText: string;
      canonicalWordCount: number;
    };
    const extracted = extractRubricPayload(diagnostic.originalReviewText);
    assert.ok(extracted.parseError);
    const keys = (diagnostic.originalReviewText.match(/"category_key"/g) ?? []).length;
    assert.ok(keys < 14, `expected fewer than 14 keys, got ${keys}`);
  });

  it("new architecture classifies saved failure as RUBRIC_GENERATION_TRUNCATED", () => {
    if (!existsSync(diagPath)) {
      return;
    }
    const diagnostic = JSON.parse(readFileSync(diagPath, "utf8")) as {
      originalReviewText: string;
      canonicalWordCount: number;
    };
    const replay = classifyLegacyCombinedOutputFailure(
      diagnostic.originalReviewText,
      diagnostic.canonicalWordCount ?? HOLD_FAST_CANONICAL,
    );
    assert.equal(replay.memoWordCountValid, true);
    assert.equal(replay.rubricFailureKind, "RUBRIC_GENERATION_TRUNCATED");
    assert.equal(replay.wouldAttemptWordCountRepair, false);
    assert.equal(replay.wouldRetryRubricOnly, true);
  });

  it("parseRubricJsonString detects incomplete acquisition block", () => {
    if (!existsSync(diagPath)) {
      return;
    }
    const diagnostic = JSON.parse(readFileSync(diagPath, "utf8")) as { originalReviewText: string };
    const markerIdx = diagnostic.originalReviewText.indexOf(RUBRIC_JSON_MARKER);
    assert.ok(markerIdx >= 0);
    const rubricRaw = diagnostic.originalReviewText.slice(markerIdx + RUBRIC_JSON_MARKER.length);
    const parsed = parseRubricJsonString(rubricRaw);
    assert.ok(parsed.parseError);
    assert.ok(parsed.parseError || parsed.appearsTruncated);
  });
});

describe("malformed rubric JSON retry", () => {
  const malformed = '{"craft_categories":[{"category_key":"premise_hook"';

  it("malformed array JSON triggers rubric-only repair classification", () => {
    const assessment = assessRubricGenerationResult({
      rawContent: malformed,
      generationMeta: meta(false),
      statistics: stats(),
      statisticsValid: true,
    });
    assert.equal(assessment.failureKind, "RUBRIC_INVALID_JSON");
    assert.equal(shouldRepairRubricJson(assessment), true);
    assert.equal(shouldRetryRubricGeneration(assessment), true);
  });

  it("repair prompt includes parse error and malformed raw output", () => {
    const parsed = parseRubricJsonString(malformed);
    const prompt = buildCommercialRubricGenerationPrompt({
      canonicalWordCount: HOLD_FAST_CANONICAL,
      fullTextSupplied: true,
      memoContent: `${EXACT_OPENING}\n\nMemo preserved.`,
      repairContext: {
        parseError: parsed.parseError ?? "parse error",
        malformedRaw: malformed,
      },
    });
    assert.match(prompt, /RUBRIC REPAIR/);
    assert.match(prompt, /PARSE ERROR/);
    assert.match(prompt, /MALFORMED PREVIOUS OUTPUT/);
    assert.match(prompt, /craft_categories/);
    assert.doesNotMatch(prompt, /regenerate the memo/i);
  });

  it("valid retry assessment can publish while invalid retry blocks", () => {
    const memo = `${EXACT_OPENING}\n\nValid memo.`;
    const bad = assessRubricGenerationResult({
      rawContent: malformed,
      generationMeta: meta(false),
      statistics: stats(),
      statisticsValid: true,
    });
    assert.equal(bad.parsed.payload, null);

    const goodPayload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const good = assessRubricGenerationResult({
      rawContent: JSON.stringify(goodPayload),
      generationMeta: meta(false),
      statistics: stats(),
      statisticsValid: true,
    });
    assert.equal(good.failureKind, null);
    const combined = validateCombinedCommercialReview({
      memoContent: memo,
      rubricPayload: good.parsed.payload!,
      statistics: stats(),
      reviewMeta: null,
    });
    assert.equal(combined.ok, true);
    assert.equal(RUBRIC_PARSE_FAILURE_USER_MESSAGE.includes("memo completed"), true);
  });
});

describe("storage format", () => {
  it("attachRubricToMemo produces combined content for RPC storage", () => {
    const memo = `${EXACT_OPENING}\n\nMemo body.`;
    const payload = fullRubricPayload(CRAFT_CATEGORIES.map(() => 5), ACQUISITION_CATEGORIES.map(() => 3));
    const stored = attachRubricToMemo(memo, payload);
    const { payload: roundTrip, parseError } = extractRubricPayload(stored);
    assert.equal(parseError, null);
    assert.equal(roundTrip!.craft_categories.length, 8);
    assert.equal(roundTrip!.acquisition_categories.length, 6);
  });
});
