import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types";
import {
  PROVIDER_EXECUTION_HEARTBEAT_INTERVAL_MS,
  ProviderExecutionAbortedError,
  TRIGGER_EXECUTION_STALL_TIMEOUT_MS,
  runWithProviderExecutionKeepAlive,
} from "./provider-execution.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hangUntilAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
    };
    if (signal.aborted) fail();
    else signal.addEventListener("abort", fail, { once: true });
  });
}

describe("provider execution keep-alive", () => {
  it("keeps yielding heartbeats below Trigger's 5-minute stall window", () => {
    assert.equal(TRIGGER_EXECUTION_STALL_TIMEOUT_MS, 300_000);
    assert.equal(PROVIDER_EXECUTION_HEARTBEAT_INTERVAL_MS, 15_000);
    assert.ok(
      PROVIDER_EXECUTION_HEARTBEAT_INTERVAL_MS * 4 < TRIGGER_EXECUTION_STALL_TIMEOUT_MS,
      "heartbeat interval must stay comfortably below the 5-minute stall detector",
    );
  });

  it("emits heartbeats for a provider wait longer than a short call", async () => {
    const beats: number[] = [];
    const result = await runWithProviderExecutionKeepAlive(
      async () => {
        await delay(100);
        return "ok";
      },
      {
        heartbeatIntervalMs: 20,
        onExecutionHeartbeat: async () => {
          beats.push(Date.now());
        },
      },
    );
    assert.equal(result, "ok");
    assert.ok(beats.length >= 3, `expected multiple heartbeats, got ${beats.length}`);
  });

  it("continues normally after several heartbeat intervals", async () => {
    let ticks = 0;
    const result = await runWithProviderExecutionKeepAlive(
      async ({ signal }) => {
        await delay(55);
        assert.equal(signal.aborted, false);
        return 42;
      },
      {
        heartbeatIntervalMs: 15,
        onExecutionHeartbeat: async () => {
          ticks += 1;
        },
      },
    );
    assert.equal(result, 42);
    assert.ok(ticks >= 3);
  });

  it("aborts in-flight provider work when workflow cancellation is requested", async () => {
    let sawAbort = false;
    let ticks = 0;
    await assert.rejects(
      () =>
        runWithProviderExecutionKeepAlive(
          async ({ signal }) => {
            try {
              await hangUntilAbort(signal);
            } catch (e) {
              sawAbort = true;
              throw e;
            }
          },
          {
            heartbeatIntervalMs: 15,
            shouldCancel: async () => {
              ticks += 1;
              return ticks >= 2;
            },
          },
        ),
      (err: unknown) => err instanceof WorkflowCancelledError,
    );
    assert.equal(sawAbort, true);
  });

  it("treats host AbortSignal as infrastructure abort, not author cancel", async () => {
    const host = new AbortController();
    const pending = runWithProviderExecutionKeepAlive(
      ({ signal }) => hangUntilAbort(signal),
      { abortSignal: host.signal, heartbeatIntervalMs: 50 },
    );
    await delay(10);
    host.abort();
    await assert.rejects(
      pending,
      (err: unknown) => err instanceof ProviderExecutionAbortedError,
    );
  });
});
