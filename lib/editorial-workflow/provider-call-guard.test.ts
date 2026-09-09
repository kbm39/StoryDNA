import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkflowCancelledError } from "./types.ts";
import {
  assertProviderCallAllowed,
  assertPublishAllowed,
  invokeIfNotCancelled,
} from "./provider-call-guard.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("cancellation before provider call", () => {
  it("throws before invoke when cancellation is already requested", async () => {
    let invoked = false;
    await assert.rejects(
      () =>
        invokeIfNotCancelled(async () => true, async () => {
          invoked = true;
          return "ran";
        }),
      (err: unknown) => err instanceof WorkflowCancelledError,
    );
    assert.equal(invoked, false);
  });

  it("invokes the provider when cancellation is not requested", async () => {
    const result = await invokeIfNotCancelled(async () => false, async () => "ok");
    assert.equal(result, "ok");
  });
});

describe("retry cancellation guard", () => {
  it("re-checks cancellation before each provider attempt", async () => {
    let cancelled = false;
    let attempts = 0;
    const shouldCancel = async () => cancelled;

    await invokeIfNotCancelled(shouldCancel, async () => {
      attempts += 1;
      cancelled = true;
      return "first";
    });

    await assert.rejects(
      () =>
        invokeIfNotCancelled(shouldCancel, async () => {
          attempts += 1;
          return "second";
        }),
      (err: unknown) => err instanceof WorkflowCancelledError,
    );
    assert.equal(attempts, 1);
  });
});

describe("no publish after cancellation", () => {
  it("does not run publish when cancellation is requested", async () => {
    let published = false;
    const publish = async () => {
      published = true;
    };
    await assert.rejects(
      async () => {
        await assertPublishAllowed(async () => true);
        await publish();
      },
      (err: unknown) => err instanceof WorkflowCancelledError,
    );
    assert.equal(published, false);
  });

  it("assertProviderCallAllowed is a hard fail-closed check", async () => {
    await assert.rejects(
      () => assertProviderCallAllowed(async () => true),
      (err: unknown) => err instanceof WorkflowCancelledError,
    );
  });
});

describe("pipeline source contracts for cancel-before-provider", () => {
  const generation = readFileSync(
    join(ROOT, "lib/editorial-generation/run-fresh-editorial-generation.ts"),
    "utf8",
  );
  const anthropic = readFileSync(join(ROOT, "lib/ai/anthropic.ts"), "utf8");
  const assessor = readFileSync(join(ROOT, "lib/contrary-evidence/ai-semantic-assessor.ts"), "utf8");
  const gate = readFileSync(join(ROOT, "lib/contrary-evidence/gate.ts"), "utf8");

  it("passes onBeforeProviderCall into every Literary Agent provider function", () => {
    assert.match(generation, /generateAgentReview\([\s\S]*onBeforeProviderCall: beforeProvider/);
    assert.match(generation, /repairCommercialMemoValidation\(\{[\s\S]*onBeforeProviderCall: beforeProvider/);
    assert.match(generation, /generateAgentRubric\(\{[\s\S]*onBeforeProviderCall: beforeProvider/);
    assert.match(generation, /generateRevisionCandidates\([\s\S]*onBeforeProviderCall: beforeProvider/);
    assert.match(generation, /assertPublishAllowed\(hooks\?\.shouldCancel\)/);
  });

  it("Literary Agent Anthropic helpers await the guard immediately before the SDK call", () => {
    assert.match(anthropic, /await callHooks\?\.onBeforeProviderCall\?\.\(\);\s*\n\s*const stream = client\.messages\.stream/);
    assert.match(anthropic, /await args\.onBeforeProviderCall\?\.\(\);\s*\n\s*const response = await client\.messages\.create/);
    assert.match(anthropic, /await args\.onBeforeProviderCall\?\.\(\);\s*\n\s*const stream = client\.messages\.stream/);
  });

  it("contrary-evidence re-checks cancellation before each assessor call and before the SDK request", () => {
    assert.match(gate, /await input\.onBeforeSemanticAssess\?\.\(\);/);
    assert.match(assessor, /await callHooks\?\.onBeforeProviderCall\?\.\(\);\s*\n\s*const response = await client\.messages\.create/);
    assert.match(assessor, /WorkflowCancelledError/);
  });

  it("executor skips cancelled workflows before any provider retry", () => {
    const src = readFileSync(
      join(ROOT, "lib/editorial-workflow/start-literary-agent-workflow.ts"),
      "utf8",
    );
    assert.match(src, /workflow\.status === "cancelled" \|\| workflow\.cancelled_at/);
    assert.match(src, /shouldCancel: async \(\) => isCancellationRequested\(workflowId\)/);
  });
});
