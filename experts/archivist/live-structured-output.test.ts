import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createExpertCostLedger } from "@/lib/execute-expert/cost.ts";
import {
  getLiveProviderInvocationCount,
  resetLiveProviderInvocationCountForTests,
} from "@/lib/execute-expert/dry-run-guard.ts";
import { FIXTURE_13_CLEAN_CONTROL } from "./fixtures.ts";
import { createMockArchivistLiveProvider } from "./live-provider.ts";
import {
  ARCHIVIST_LIVE_MAX_REPAIR_CALLS,
  completeArchivistStructuredOutput,
} from "./live-structured-output.ts";

describe("Archivist live structured-output handling", () => {
  it("captures usage before parse and fail-closes without a repair when disabled", async () => {
    resetLiveProviderInvocationCountForTests();
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "live" });
    const result = await completeArchivistStructuredOutput({
      provider: createMockArchivistLiveProvider({
        complete: async () => ({
          content: "<<<",
          usage: { inputTokens: 15, outputTokens: 6, cachedTokens: 0, cacheCreationTokens: 0 },
        }),
      }),
      system: "system",
      user: "user",
      ledger,
      allowRepair: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.usage_captured_before_parse, true);
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.calls[0]?.inputTokens, 15);
    assert.equal(ledger.calls[0]?.status, "parse_failed");
    assert.equal(getLiveProviderInvocationCount(), 1);
  });

  it("caps representation-only repair at one call", async () => {
    assert.equal(ARCHIVIST_LIVE_MAX_REPAIR_CALLS, 1);
    const ledger = createExpertCostLedger({ expertKey: "archivist", mode: "live" });
    let calls = 0;
    const result = await completeArchivistStructuredOutput({
      provider: createMockArchivistLiveProvider({
        complete: async ({ role }) => {
          calls += 1;
          if (role === "archivist_review_repair") {
            return { content: JSON.stringify(FIXTURE_13_CLEAN_CONTROL.review) };
          }
          return { content: "broken" };
        },
      }),
      system: "system",
      user: "user",
      ledger,
    });
    assert.equal(result.ok, true);
    assert.equal(calls, 2);
    assert.equal(result.repair_call_count, 1);
    assert.equal(ledger.calls.filter((call) => call.role === "archivist_review_repair").length, 1);
  });
});
