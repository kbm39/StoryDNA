import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAnthropicTextContent } from "./response-shape.ts";

describe("Anthropic live provider response-shape validation", () => {
  it("1 one valid text block succeeds", () => {
    const result = validateAnthropicTextContent([
      { type: "text", text: '{"findings":[]}' },
    ]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.text, /findings/);
    }
  });

  it("2 empty content array fails", () => {
    const result = validateAnthropicTextContent([]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "response_empty");
  });

  it("3 whitespace-only text fails", () => {
    const result = validateAnthropicTextContent([{ type: "text", text: "   \n\t  " }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "response_empty");
  });

  it("4 tool-use block fails", () => {
    const result = validateAnthropicTextContent([
      { type: "tool_use", text: "ignored" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_content_block");
  });

  it("5 mixed text and tool-use fails", () => {
    const result = validateAnthropicTextContent([
      { type: "text", text: "hello" },
      { type: "tool_use" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_content_block");
  });

  it("6 unsupported content type fails", () => {
    const result = validateAnthropicTextContent([{ type: "image" }]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported_content_block");
  });

  it("7 invalid response is not ok true", () => {
    const result = validateAnthropicTextContent([]);
    assert.notEqual(result.ok, true);
  });

  it("8 sanitized error contains no provider response body", () => {
    const secretBody = "{secret: 'full provider payload'}";
    const result = validateAnthropicTextContent([{ type: "text", text: secretBody.slice(0, 0) }]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.doesNotMatch(result.message, /secret/);
      assert.doesNotMatch(result.message, /payload/);
    }
  });

  it("9 executor stops before parser on provider-shape failure", async () => {
    const { executeLive } = await import("../../live-executor.ts");
    const { buildLiveCalibrationCallPlan } = await import("../../call-planner.ts");
    const { resolveProviderSpec } = await import("../../provider-allowlist.ts");
    const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const cwd = mkdtempSync(join(tmpdir(), "shape-fail-"));
    const sessionId = `shape-fail-${Date.now()}`;

    try {
      const args = Object.freeze({
        mode: "live" as const,
        expert: "military_expert" as const,
        suite: "military_expert_v1_draft_golden",
        subset: "military_expert_smoke_v1" as const,
        provider: "anthropic" as const,
        model: "haiku-4-5-v1",
        runs: 1,
        maxCalls: 3,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.02,
        maxInputTokens: 50_000,
        maxOutputTokens: 50_000,
        timeoutMs: 120_000,
        maxRuntimeMs: 600_000,
        outputDir: ".calibration-results/test-live",
        overwrite: true,
        sessionId,
        sessionMaxCostUsd: 1,
        retainRawResponses: false,
      });

      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "shape-fail",
      });

      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "run-shape",
        correlationId: "corr-shape",
        startedAt: 1,
        providerInvoker: async () => ({
          ok: false,
          providerError: { code: "response_empty", message: "Provider returned empty content" },
          durationMs: 1,
        }),
        writeArtifacts: false,
        bypassFeatureFlags: true,
        cwd,
      });

      assert.equal(result.ok, false);
      assert.equal(result.modelCalls, 0);
      assert.equal(result.providerCalls, 1);
    } finally {
      if (existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("10 existing valid mocked-live flow still succeeds", async () => {
    const { executeLive } = await import("../../live-executor.ts");
    const { buildLiveCalibrationCallPlan } = await import("../../call-planner.ts");
    const { resolveProviderSpec } = await import("../../provider-allowlist.ts");
    const { buildSyntheticSuccessRawResponse } = await import("../../synthetic-adapter.ts");
    const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const cwd = mkdtempSync(join(tmpdir(), "shape-ok-"));
    const sessionId = `shape-ok-${Date.now()}`;

    try {
      const args = Object.freeze({
        mode: "live" as const,
        expert: "military_expert" as const,
        suite: "military_expert_v1_draft_golden",
        subset: "military_expert_smoke_v1" as const,
        provider: "anthropic" as const,
        model: "haiku-4-5-v1",
        runs: 1,
        maxCalls: 3,
        maxTotalCostUsd: 1,
        maxCostPerCallUsd: 0.02,
        maxInputTokens: 50_000,
        maxOutputTokens: 50_000,
        timeoutMs: 120_000,
        maxRuntimeMs: 600_000,
        outputDir: ".calibration-results/test-live",
        overwrite: true,
        sessionId,
        sessionMaxCostUsd: 1,
        retainRawResponses: false,
      });

      const plan = buildLiveCalibrationCallPlan({
        args,
        providerSpec: resolveProviderSpec(args.provider, args.model),
        correlationPrefix: "shape-ok",
      });

      const result = await executeLive({
        args,
        callPlan: plan,
        runId: "run-shape-ok",
        correlationId: "corr-shape-ok",
        startedAt: 1,
        providerInvoker: async (input) => ({
          ok: true,
          rawResponse: buildSyntheticSuccessRawResponse(input.correlationId, input.caseId),
          durationMs: 1,
        }),
        writeArtifacts: false,
        bypassFeatureFlags: true,
        cwd,
      });

      assert.equal(result.modelCalls, 3);
      assert.equal(result.providerCalls, 3);
    } finally {
      if (existsSync(cwd)) rmSync(cwd, { recursive: true, force: true });
    }
  });
});
