import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DryRunCanonWriteForbiddenError,
  DryRunProviderForbiddenError,
  forbidDryRunCanonWrite,
  forbidDryRunProviderCall,
  getLiveProviderInvocationCount,
  noteLiveProviderInvocation,
  providerCredentialsPresent,
  resetLiveProviderInvocationCountForTests,
} from "./dry-run-guard.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("dry-run provider fence", () => {
  it("throws when a live provider adapter is invoked in dry_run", () => {
    assert.throws(() => noteLiveProviderInvocation("dry_run"), DryRunProviderForbiddenError);
    assert.throws(() => forbidDryRunProviderCall("dry_run", "Anthropic"), DryRunProviderForbiddenError);
    assert.throws(() => forbidDryRunProviderCall("dry_run", "OpenAI"), DryRunProviderForbiddenError);
    assert.throws(() => forbidDryRunCanonWrite("dry_run", "accept canon"), DryRunCanonWriteForbiddenError);
  });

  it("counts live invocations only when mode is live", () => {
    resetLiveProviderInvocationCountForTests();
    noteLiveProviderInvocation("live");
    assert.equal(getLiveProviderInvocationCount(), 1);
    resetLiveProviderInvocationCountForTests();
    assert.equal(getLiveProviderInvocationCount(), 0);
  });

  it("execute-expert sources never import Anthropic or OpenAI", () => {
    const files = [
      "lib/execute-expert/execute.ts",
      "lib/execute-expert/cost.ts",
      "lib/execute-expert/dry-run-guard.ts",
      "lib/execute-expert/types.ts",
      "experts/archivist/execute-adapter.ts",
      "experts/archivist/dry-run-scenarios.ts",
    ];
    const joined = files.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
    assert.doesNotMatch(joined, /@\/lib\/ai\/anthropic/);
    assert.doesNotMatch(joined, /@\/lib\/ai\/openai/);
    assert.doesNotMatch(joined, /from "openai"/);
    assert.doesNotMatch(joined, /from "@anthropic-ai\/sdk"/);
  });

  it("credentials in the environment do not disable the dry-run fence", () => {
    const previousAnthropic = process.env.ANTHROPIC_API_KEY;
    const previousOpenAI = process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
    process.env.OPENAI_API_KEY = "sk-test-not-used";
    try {
      const present = providerCredentialsPresent();
      assert.equal(present.anthropic, true);
      assert.equal(present.openai, true);
      assert.throws(() => noteLiveProviderInvocation("dry_run"), DryRunProviderForbiddenError);
    } finally {
      if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousAnthropic;
      if (previousOpenAI === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAI;
    }
  });
});
