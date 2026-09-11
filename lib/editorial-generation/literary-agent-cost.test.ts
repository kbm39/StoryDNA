import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateLiteraryAgentCost,
  createLiteraryAgentCostLedger,
  estimateCallCostUsd,
  ratesForModel,
  usageFromAnthropicMessage,
  type LiteraryAgentProviderCall,
} from "./literary-agent-cost.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function call(
  overrides: Partial<LiteraryAgentProviderCall> & Pick<LiteraryAgentProviderCall, "role">,
): LiteraryAgentProviderCall {
  const model = overrides.model ?? "claude-opus-4-8";
  const inputTokens = overrides.inputTokens === undefined ? 1000 : overrides.inputTokens;
  const outputTokens = overrides.outputTokens === undefined ? 100 : overrides.outputTokens;
  const cachedTokens = overrides.cachedTokens === undefined ? 0 : overrides.cachedTokens;
  const cacheCreationTokens =
    overrides.cacheCreationTokens === undefined ? 0 : overrides.cacheCreationTokens;
  const usage = { inputTokens, outputTokens, cachedTokens, cacheCreationTokens };
  return {
    provider: "anthropic",
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
    cacheCreationTokens,
    costUsd: overrides.costUsd === undefined ? estimateCallCostUsd(model, usage) : overrides.costUsd,
    costKind: overrides.costKind ?? (overrides.costUsd === null ? "unknown" : "estimated"),
    durationMs: overrides.durationMs ?? 10,
    role: overrides.role,
  };
}

describe("literary-agent-cost aggregation", () => {
  it("sums input, output, cached tokens and estimated USD across calls", () => {
    const record = aggregateLiteraryAgentCost(
      [
        call({ role: "memo_generation", inputTokens: 20_000, outputTokens: 4_000, cachedTokens: 2_000 }),
        call({ role: "rubric_generation", inputTokens: 8_000, outputTokens: 2_000 }),
      ],
      12_000,
    );
    assert.equal(record.provider, "anthropic");
    assert.equal(record.model, "claude-opus-4-8");
    assert.equal(record.inputTokens, 28_000);
    assert.equal(record.outputTokens, 6_000);
    assert.equal(record.cachedTokens, 2_000);
    assert.equal(record.tokenCounts, "exact");
    assert.equal(record.costUsdKind, "estimated");
    assert.equal(record.runtimeMs, 12_000);
    assert.ok(record.totalRunCostUsd != null);
    assert.equal(record.perCallCostUsd.length, 2);
  });

  it("includes repair-call tokens in the cost record", () => {
    const record = aggregateLiteraryAgentCost(
      [
        call({ role: "memo_generation", inputTokens: 10_000, outputTokens: 2_000 }),
        call({ role: "memo_repair", inputTokens: 3_000, outputTokens: 1_500, cachedTokens: 200 }),
      ],
      5_000,
    );
    assert.equal(record.repairCallTokens.callCount, 1);
    assert.equal(record.repairCallTokens.inputTokens, 3_000);
    assert.equal(record.repairCallTokens.outputTokens, 1_500);
    assert.equal(record.repairCallTokens.cachedTokens, 200);
    assert.ok(record.repairCallTokens.costUsd > 0);
    assert.equal(record.inputTokens, 13_000);
  });

  it("includes contrary-evidence tokens in the cost record", () => {
    const record = aggregateLiteraryAgentCost(
      [
        call({ role: "memo_generation", inputTokens: 5_000, outputTokens: 1_000 }),
        call({
          role: "contrary_evidence",
          model: "claude-sonnet-4-20250514",
          inputTokens: 800,
          outputTokens: 200,
        }),
        call({
          role: "contrary_evidence",
          model: "claude-sonnet-4-20250514",
          inputTokens: 700,
          outputTokens: 150,
        }),
      ],
      8_000,
    );
    assert.equal(record.contraryEvidenceCallTokens.callCount, 2);
    assert.equal(record.contraryEvidenceCallTokens.inputTokens, 1_500);
    assert.equal(record.contraryEvidenceCallTokens.outputTokens, 350);
    assert.ok(record.contraryEvidenceCallTokens.costUsd > 0);
  });

  it("includes revision-candidate tokens in the cost record", () => {
    const ledger = createLiteraryAgentCostLedger();
    ledger.record({
      role: "revision_candidates",
      model: "claude-opus-4-8",
      usage: { inputTokens: 12_000, outputTokens: 6_000, cachedTokens: 0, cacheCreationTokens: 0 },
      durationMs: 40_000,
    });
    const record = ledger.finalize(40_000);
    assert.equal(record.revisionCandidateCallTokens.inputTokens, 12_000);
    assert.equal(record.revisionCandidateCallTokens.outputTokens, 6_000);
    assert.equal(record.revisionCandidateCallTokens.callCount, 1);
  });

  it("marks USD as estimated from published Anthropic Opus 4.8 rates", () => {
    const rates = ratesForModel("claude-opus-4-8");
    assert.equal(rates.input, 5);
    assert.equal(rates.output, 25);
    const usd = estimateCallCostUsd("claude-opus-4-8", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedTokens: 0,
      cacheCreationTokens: 0,
    });
    assert.equal(usd, 30);
  });

  it("reads cached token fields from Anthropic usage", () => {
    const usage = usageFromAnthropicMessage({
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 50,
      cache_creation_input_tokens: 10,
    });
    assert.deepEqual(usage, {
      inputTokens: 100,
      outputTokens: 20,
      cachedTokens: 50,
      cacheCreationTokens: 10,
    });
  });

  it("marks aborted in-flight calls as unknown/partial, never $0 exact", () => {
    const ledger = createLiteraryAgentCostLedger();
    ledger.record({
      role: "memo_generation",
      model: "claude-opus-4-8",
      usage: {
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        cacheCreationTokens: null,
      },
      durationMs: 294_700,
    });
    const record = ledger.finalize(300_388);
    assert.equal(record.tokenCounts, "missing");
    assert.equal(record.costUsdKind, "unknown");
    assert.equal(record.totalRunCostUsd, null);
    assert.equal(record.calls[0]?.costKind, "unknown");
    assert.equal(record.calls[0]?.costUsd, null);
  });

  it("marks tokenCounts partial when a call is missing usage", () => {
    const record = aggregateLiteraryAgentCost(
      [
        call({ role: "memo_generation" }),
        call({
          role: "rubric_generation",
          inputTokens: null,
          outputTokens: null,
          cachedTokens: null,
          cacheCreationTokens: null,
          costUsd: null,
          costKind: "unknown",
        }),
      ],
      1,
    );
    assert.equal(record.tokenCounts, "partial");
    assert.equal(record.costUsdKind, "unknown");
    assert.equal(record.totalRunCostUsd, null);
  });
});

describe("literary-agent cost wiring in generation pipeline", () => {
  const src = readFileSync(join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"), "utf8");

  it("persists cost_accounting and anthropic provider on publish", () => {
    assert.match(src, /p_provider: "anthropic"/);
    assert.match(src, /cost_accounting: costAccounting/);
    assert.doesNotMatch(src, /p_provider: "openai"/);
  });

  it("persists first-pass memo validation diagnostics on publish", () => {
    assert.match(src, /memo_validation: memoValidationDiagnostics/);
    assert.match(src, /resolvePreRepairMemoValidation/);
  });

  it("records repair, contrary-evidence, rubric retry, and revision-candidate calls", () => {
    assert.match(src, /role: "memo_repair"/);
    assert.match(src, /role: "contrary_evidence"/);
    assert.match(src, /role: "rubric_retry"/);
    assert.match(src, /completeRevisionCandidatesStage/);
    assert.match(src, /repairRevisionCandidatesJson/);
  });
});
