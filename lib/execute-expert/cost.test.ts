import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createExpertCostLedger } from "./cost.ts";
import { DryRunProviderForbiddenError } from "./dry-run-guard.ts";

describe("generic expert cost ledger", () => {
  it("dry_run finalizes as $0 exact with zero calls and tokens", () => {
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "dry_run" });
    const cost = ledger.finalize(12);
    assert.equal(cost.call_count, 0);
    assert.equal(cost.input_tokens, 0);
    assert.equal(cost.output_tokens, 0);
    assert.equal(cost.total_cost_usd, 0);
    assert.equal(cost.cost_status, "exact");
    assert.equal(cost.token_counts, "exact");
    assert.equal(cost.provider, "none");
    assert.equal(cost.model, "none");
    assert.equal(cost.execution_mode, "dry_run");
    assert.equal(cost.runtime_ms, 12);
  });

  it("forbids recording provider calls in dry_run", () => {
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "dry_run" });
    assert.throws(
      () =>
        ledger.record({
          role: "repair",
          provider: "anthropic",
          model: "claude",
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            cachedTokens: 0,
            cacheCreationTokens: 0,
          },
          durationMs: 1,
        }),
      DryRunProviderForbiddenError,
    );
  });

  it("accepts expert-specific roles on the live accounting foundation without calling a provider", () => {
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "live" });
    ledger.record({
      role: "within_book_check",
      provider: "anthropic",
      model: "none",
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        cachedTokens: 0,
        cacheCreationTokens: 0,
      },
      durationMs: 5,
      costUsd: 0.01,
    });
    const cost = ledger.finalize(5);
    assert.equal(cost.call_count, 1);
    assert.equal(cost.input_tokens, 100);
    assert.equal(cost.output_tokens, 20);
    assert.equal(cost.cost_status, "exact");
    assert.equal(ledger.calls[0]?.role, "within_book_check");
    assert.equal(ledger.calls[0]?.token_status, "exact");
  });

  it("keeps a live call after parse failure and marks missing token status", () => {
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "live" });
    ledger.record({
      role: "archivist_review",
      provider: "anthropic",
      model: "claude-opus-4-8",
      usage: {
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        cacheCreationTokens: null,
      },
      durationMs: 9,
      costUsd: null,
      status: "parse_failed",
    });
    const cost = ledger.finalize(9);
    assert.equal(cost.call_count, 1);
    assert.equal(cost.cost_status, "partial");
    assert.equal(cost.token_counts, "missing");
    assert.equal(ledger.calls[0]?.status, "parse_failed");
    assert.equal(ledger.calls[0]?.token_status, "missing");
    assert.equal(ledger.calls[0]?.costUsd, null);
  });
});
