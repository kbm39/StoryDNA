import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { LITERARY_AGENT, buildReviewPrompt } from "./ai/review-engine.ts";
import {
  isMissingCanonicalOpenerOnlyFailure,
  resolvePreRepairMemoValidation,
  serializeMemoValidationDiagnostics,
} from "./commercial-memo-opener-normalization.ts";
import {
  evaluateCallAGeneration,
  validateMemoBeforeRubric,
} from "./commercial-review-generation.ts";
import { commercialMemoOutputContract } from "./commercial-fiction-rubric.ts";
import {
  aggregateLiteraryAgentCost,
  createLiteraryAgentCostLedger,
  estimateCallCostUsd,
} from "./editorial-generation/literary-agent-cost.ts";
import { letterGradeFromScore } from "./grade-calculation.ts";
import { authoritativeStatisticsBlock, buildReviewStatistics } from "./review-statistics.ts";
import type { GenerationMeta } from "./ai/shared.ts";
import { canonicalManuscriptLengthSentence } from "./word-count-reporting.ts";
import {
  hasExactCanonicalStatement,
  validateWordCountClaims,
} from "./word-count-validation.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = 1_989;
const OPENING = canonicalManuscriptLengthSentence(CANONICAL);
const LARGE_CANONICAL = 31_552;
const LARGE_OPENING = canonicalManuscriptLengthSentence(LARGE_CANONICAL);

function countExactOpeners(memo: string, canonicalWordCount: number): number {
  const required = canonicalManuscriptLengthSentence(canonicalWordCount);
  const escaped = required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (memo.match(new RegExp(escaped, "gi")) ?? []).length;
}

function executiveMemo(body: string): string {
  return `## Executive Recommendation

${body}`;
}

const CLEAN_BODY = executiveMemo(
  "This thriller is commercially viable and should be requested. The hook is immediate and the stakes are personal.",
);

describe("1. missing canonical opener only — deterministic prepend, no model repair", () => {
  it("prepends the exact sentence, passes the validator, and does not require model repair", () => {
    const first = validateMemoBeforeRubric({
      memoContent: CLEAN_BODY,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(first.ok, false);
    assert.equal(first.repairKind, "word_count");
    assert.equal(isMissingCanonicalOpenerOnlyFailure(first, CLEAN_BODY, CANONICAL), true);

    const resolved = resolvePreRepairMemoValidation({
      memoContent: CLEAN_BODY,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, true);
    assert.equal(resolved.diagnostics.deterministicOpenerSucceeded, true);
    assert.equal(resolved.diagnostics.modelRepairRequired, false);
    assert.equal(resolved.diagnostics.modelRepairInvoked, false);
    assert.equal(resolved.modelRepairRequired, false);
    assert.equal(resolved.validation.ok, true);
    assert.ok(resolved.memoContent.startsWith(OPENING));
    assert.match(resolved.memoContent, /## Executive Recommendation/);
    assert.ok(
      resolved.memoContent.indexOf(OPENING) <
        resolved.memoContent.indexOf("## Executive Recommendation"),
    );
  });
});

describe("2. canonical opener appears exactly once after normalization", () => {
  it("keeps a single exact current-total sentence", () => {
    const resolved = resolvePreRepairMemoValidation({
      memoContent: CLEAN_BODY,
      canonicalWordCount: LARGE_CANONICAL,
    });
    assert.equal(resolved.validation.ok, true);
    assert.equal(countExactOpeners(resolved.memoContent, LARGE_CANONICAL), 1);
    assert.equal(hasExactCanonicalStatement(resolved.memoContent, LARGE_CANONICAL), true);
    assert.ok(resolved.memoContent.startsWith(LARGE_OPENING));
  });
});

describe("3. prohibited grade still requires model repair", () => {
  it("does not treat a grade defect as opener-only, even if the opener is also missing", () => {
    const memo = `${CLEAN_BODY}

**Grade: A**`;
    const first = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(first.ok, false);
    assert.equal(first.repairKind, "prose_grade");
    assert.equal(isMissingCanonicalOpenerOnlyFailure(first, memo, CANONICAL), false);

    const resolved = resolvePreRepairMemoValidation({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, false);
    assert.equal(resolved.diagnostics.deterministicOpenerSucceeded, false);
    assert.equal(resolved.modelRepairRequired, true);
    assert.equal(resolved.validation.ok, false);
    assert.match(resolved.validation.error ?? "", /letter grade/);
  });
});

describe("4. contradictory word-count claim still requires model repair", () => {
  it("cannot be fixed merely by prepending the canonical sentence", () => {
    const memo = executiveMemo("This 150,000 word manuscript needs a hard cut before submission.");
    const first = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(first.ok, false);
    assert.ok((first.wordCountContradictions?.length ?? 0) > 0);
    assert.equal(isMissingCanonicalOpenerOnlyFailure(first, memo, CANONICAL), false);

    const resolved = resolvePreRepairMemoValidation({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, false);
    assert.equal(resolved.modelRepairRequired, true);
    assert.equal(resolved.validation.ok, false);

    const prepended = `${OPENING}\n\n${memo}`;
    const afterPrepend = validateMemoBeforeRubric({
      memoContent: prepended,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(afterPrepend.ok, false, "contradiction must survive a mere prepend");
  });
});

describe("5. real statistics / cut-math failure still requires model repair", () => {
  it("leaves invalid cut arithmetic on the model repair path", () => {
    const memo = `## Suggested Cuts

A 20% cut would bring the book to roughly 50,000 words.`;
    const first = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: LARGE_CANONICAL,
    });
    assert.equal(first.ok, false);
    assert.ok((first.wordCountContradictions?.length ?? 0) > 0);
    assert.equal(isMissingCanonicalOpenerOnlyFailure(first, memo, LARGE_CANONICAL), false);

    const resolved = resolvePreRepairMemoValidation({
      memoContent: memo,
      canonicalWordCount: LARGE_CANONICAL,
    });
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, false);
    assert.equal(resolved.modelRepairRequired, true);
    assert.equal(resolved.validation.ok, false);
  });
});

describe("6. truncated memo preserves existing failure / repair behavior", () => {
  it("blocks memo validation entirely when Call A output is truncated", () => {
    const gate = evaluateCallAGeneration({
      generationMeta: {
        finishReason: "max_tokens",
        inputTokens: 10_000,
        outputTokens: 16_000,
        maxTokens: 16_000,
        outputTruncated: true,
      } satisfies GenerationMeta,
    });
    assert.equal(gate.proceedToMemoValidation, false);
    assert.equal(gate.invokeCallB, false);
    assert.equal(gate.invokePublishRpc, false);
    assert.equal(gate.failureKind, "MEMO_GENERATION_TRUNCATED");

    const src = readFileSync(
      join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
      "utf8",
    );
    const pipeline = src.slice(src.indexOf("export async function runFreshEditorialGeneration"));
    const truncationIdx = pipeline.indexOf("if (!callAGate.proceedToMemoValidation)");
    const openerIdx = pipeline.indexOf("resolvePreRepairMemoValidation({");
    assert.ok(truncationIdx >= 0 && openerIdx > truncationIdx);
  });
});

describe("7–8. cost ledger for deterministic vs paid repair", () => {
  it("records zero memo-repair calls, tokens, and cost when deterministic normalization succeeds", () => {
    const resolved = resolvePreRepairMemoValidation({
      memoContent: CLEAN_BODY,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.modelRepairRequired, false);

    const ledger = createLiteraryAgentCostLedger();
    ledger.record({
      role: "memo_generation",
      model: "claude-opus-4-8",
      usage: { inputTokens: 20_000, outputTokens: 4_000, cachedTokens: 0, cacheCreationTokens: 0 },
      durationMs: 100,
    });
    ledger.record({
      role: "rubric_generation",
      model: "claude-opus-4-8",
      usage: { inputTokens: 8_000, outputTokens: 2_000, cachedTokens: 0, cacheCreationTokens: 0 },
      durationMs: 80,
    });
    const record = ledger.finalize(1_000);
    assert.equal(record.repairCallTokens.callCount, 0);
    assert.equal(record.repairCallTokens.inputTokens, 0);
    assert.equal(record.repairCallTokens.outputTokens, 0);
    assert.equal(record.repairCallTokens.cachedTokens, 0);
    assert.equal(record.repairCallTokens.cacheCreationTokens, 0);
    assert.equal(record.repairCallTokens.costUsd, 0);
    assert.equal(
      record.calls.some((c) => c.role === "memo_repair"),
      false,
    );
  });

  it("still includes paid repair tokens and cost when model repair is genuinely invoked", () => {
    const usage = {
      inputTokens: 3_000,
      outputTokens: 1_500,
      cachedTokens: 200,
      cacheCreationTokens: 0,
    };
    const record = aggregateLiteraryAgentCost(
      [
        {
          role: "memo_generation",
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputTokens: 10_000,
          outputTokens: 2_000,
          cachedTokens: 0,
          cacheCreationTokens: 0,
          costUsd: estimateCallCostUsd("claude-opus-4-8", {
            inputTokens: 10_000,
            outputTokens: 2_000,
            cachedTokens: 0,
            cacheCreationTokens: 0,
          }),
          costKind: "estimated",
          durationMs: 50,
        },
        {
          role: "memo_repair",
          provider: "anthropic",
          model: "claude-opus-4-8",
          ...usage,
          costUsd: estimateCallCostUsd("claude-opus-4-8", usage),
          costKind: "estimated",
          durationMs: 75,
        },
      ],
      5_000,
    );
    assert.equal(record.repairCallTokens.callCount, 1);
    assert.equal(record.repairCallTokens.inputTokens, 3_000);
    assert.equal(record.repairCallTokens.outputTokens, 1_500);
    assert.ok(record.repairCallTokens.costUsd > 0);
  });

  it("generation records memo_repair only on the paid model-repair path", () => {
    const src = readFileSync(
      join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
      "utf8",
    );
    assert.match(src, /resolvedMemo\.modelRepairRequired/);
    assert.match(src, /role: "memo_repair"/);
    const paidBlock = src.slice(
      src.indexOf("resolvedMemo.modelRepairRequired"),
      src.indexOf("if (!memoValidation.ok)"),
    );
    assert.match(paidBlock, /repairCommercialMemoValidation/);
    assert.match(paidBlock, /role: "memo_repair"/);
  });
});

describe("9. first-pass diagnostics persist when deterministic normalization succeeds", () => {
  it("keeps first-pass failure details after a successful opener prepend", () => {
    const resolved = resolvePreRepairMemoValidation({
      memoContent: CLEAN_BODY,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.validation.ok, true);
    assert.equal(resolved.diagnostics.firstPassOk, false);
    assert.equal(resolved.diagnostics.firstPassRepairKind, "word_count");
    assert.ok((resolved.diagnostics.firstPassError ?? "").length > 0);
    assert.equal(resolved.diagnostics.firstPassWordCountErrors.length, 1);
    assert.match(
      resolved.diagnostics.firstPassWordCountErrors[0] ?? "",
      /exactly one current-total sentence/,
    );
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, true);
    assert.equal(resolved.diagnostics.deterministicOpenerSucceeded, true);
    assert.equal(resolved.diagnostics.modelRepairInvoked, false);

    const persisted = serializeMemoValidationDiagnostics(resolved.diagnostics);
    assert.equal(persisted.first_pass_ok, false);
    assert.equal(persisted.deterministic_opener_attempted, true);
    assert.equal(persisted.deterministic_opener_succeeded, true);
    assert.equal(persisted.model_repair_invoked, false);

    const genSrc = readFileSync(
      join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
      "utf8",
    );
    assert.match(genSrc, /memo_validation: memoValidationDiagnostics/);
    const wfSrc = readFileSync(
      join(ROOT, "lib/editorial-workflow/start-literary-agent-workflow.ts"),
      "utf8",
    );
    assert.match(wfSrc, /memoValidation: result\.memoValidationDiagnostics/);
  });
});

describe("10. canonical word-count validator remains strict", () => {
  it("still fails a memo that lacks the exact sentence", () => {
    const wordVal = validateWordCountClaims(CLEAN_BODY, CANONICAL);
    assert.equal(wordVal.valid, false);
    assert.equal(hasExactCanonicalStatement(CLEAN_BODY, CANONICAL), false);
    assert.equal(
      wordVal.errors[0],
      `Memo must include exactly one current-total sentence: "${OPENING}"`,
    );

    const gate = validateMemoBeforeRubric({
      memoContent: CLEAN_BODY,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(gate.ok, false);
    assert.equal(gate.repairable, true);
  });

  it("still requires the exact comma-formatted sentence rather than a near-match", () => {
    const near = `The manuscript is exactly ${CANONICAL.toLocaleString("en-US")} words by StoryDNA's analytical counter.\n\n${CLEAN_BODY}`;
    const gate = validateMemoBeforeRubric({
      memoContent: near,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(gate.ok, false);
    assert.equal(hasExactCanonicalStatement(near, CANONICAL), false);
  });
});

describe("11–14. scoring, grading, contrary-evidence, and publication logic unchanged", () => {
  it("does not rewrite scoring, grading, contrary-evidence, or publish gates", () => {
    const src = readFileSync(
      join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
      "utf8",
    );
    assert.match(src, /runContraryEvidenceGate/);
    assert.match(src, /validatePostScoringRubric/);
    assert.match(src, /buildReviewGradingRecord/);
    assert.match(src, /publish_commercial_review_generation/);
    assert.match(src, /assertPublishAllowed/);
    assert.match(src, /adjustedGrading\.letterGrade/);
    assert.match(src, /adjustedGrading\.manuscriptScore/);
    assert.equal(letterGradeFromScore(90.3), "A-");
    assert.equal(letterGradeFromScore(76.77), "C");
  });
});

describe("prompt alignment", () => {
  it("uses the filled canonical sentence and removes competing near-matches", () => {
    const stats = buildReviewStatistics({
      manuscriptId: "ms",
      manuscriptVersionId: "ver",
      extractedText: "word ".repeat(CANONICAL),
      sentChars: CANONICAL * 5,
      storedWordCount: CANONICAL,
    });
    const prompt = buildReviewPrompt(LITERARY_AGENT, null, { statistics: stats });
    assert.match(prompt, new RegExp(OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(
      prompt,
      /Begin with the required canonical manuscript-length sentence\. After that sentence, start with Executive Recommendation/,
    );
    assert.doesNotMatch(prompt, /begin at Executive Recommendation/);
    assert.doesNotMatch(prompt, /exactly .* words by StoryDNA's analytical counter/);
    assert.doesNotMatch(prompt, /EXACT CANONICAL COUNT FROM MANUSCRIPT STATISTICS/);

    const block = authoritativeStatisticsBlock(stats);
    assert.match(block, new RegExp(OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(block, /exactly .* words by StoryDNA's analytical counter/);

    const contract = commercialMemoOutputContract(CANONICAL);
    assert.match(contract, new RegExp(`"${OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.doesNotMatch(contract, /EXACT CANONICAL COUNT FROM MANUSCRIPT STATISTICS/);
  });
});

describe("ineligible mixed and duplicate failures", () => {
  it("does not treat duplicate exact sentences as a missing-opener-only defect", () => {
    const memo = `${OPENING}\n\n${OPENING}\n\n${CLEAN_BODY}`;
    const first = validateMemoBeforeRubric({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(first.ok, false);
    assert.equal(isMissingCanonicalOpenerOnlyFailure(first, memo, CANONICAL), false);
    const resolved = resolvePreRepairMemoValidation({
      memoContent: memo,
      canonicalWordCount: CANONICAL,
    });
    assert.equal(resolved.modelRepairRequired, true);
    assert.equal(resolved.diagnostics.deterministicOpenerAttempted, false);
  });
});
