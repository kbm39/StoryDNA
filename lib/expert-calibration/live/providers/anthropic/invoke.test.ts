import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION } from "@/experts/military-expert/output-schema.ts";
import { buildMilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-contract.ts";
import { ANTHROPIC_SDK_DEFAULT_API_VERSION } from "./metadata.ts";
import { ANTHROPIC_OPUS_48_MODEL_ID } from "../../model-lifecycle.ts";
import {
  createAnthropicProviderInvokerFromClient,
  type AnthropicMessagesCreateClient,
} from "./invoke.ts";

const MOCK_SDK_VERSION = "0.104.2-test";

class MockAnthropicAPIError extends Error {
  readonly status = 429;
}

function buildInvokeInput() {
  const request = buildMilitaryExpertGenerationRequest({
    correlationId: "invoke-test-corr",
    manuscriptVersionId: "cal-me-coc-001",
    reviewScope: "sample",
    manuscriptText: "Sample manuscript text for invoke testing.",
    canonicalWordCount: 6,
    manuscriptHash: "abc123",
    genreContext: null,
    countryPeriod: null,
  });
  return {
    request,
    correlationId: "invoke-test-corr",
    caseId: "me-coc-001",
    modelId: "claude-haiku-4-5-20251001",
    timeoutMs: 1_000,
  };
}

function createMockClient(
  createImpl: AnthropicMessagesCreateClient["messages"]["create"],
): AnthropicMessagesCreateClient {
  return {
    messages: {
      create: createImpl,
    },
  };
}

describe("Anthropic provider invoke metadata", () => {
  it("15 records SDK default API version when response does not expose one", async () => {
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async () => ({
        content: [{ type: "text", text: '{"findings":[]}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
        model: "claude-haiku-4-5-20251001",
      })),
      MOCK_SDK_VERSION,
    );
    const result = await invoker(buildInvokeInput());

    assert.equal(result.ok, true);
    assert.ok(result.providerMetadata);
    assert.equal(result.providerMetadata.api_version, ANTHROPIC_SDK_DEFAULT_API_VERSION);
    assert.notEqual(result.providerMetadata.api_version, "unknown");
  });

  it("16 preserves exact API version when mocked response exposes anthropic_version", async () => {
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async () => ({
        anthropic_version: "2024-11-15",
        content: [{ type: "text", text: '{"findings":[]}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
        model: "claude-haiku-4-5-20251001",
      })),
      MOCK_SDK_VERSION,
    );
    const result = await invoker(buildInvokeInput());

    assert.equal(result.ok, true);
    assert.equal(result.providerMetadata?.api_version, "2024-11-15");
  });

  it("17 records provider metadata on provider errors", async () => {
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async () => {
        throw new MockAnthropicAPIError("rate limited");
      }),
      MOCK_SDK_VERSION,
    );
    const result = await invoker(buildInvokeInput());

    assert.equal(result.ok, false);
    assert.equal(result.providerMetadata?.api_version, ANTHROPIC_SDK_DEFAULT_API_VERSION);
    assert.equal(result.providerMetadata?.sdk_version, MOCK_SDK_VERSION);
  });

  it("18 keeps response schema version separate from API and SDK versions", async () => {
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async () => ({
        content: [{ type: "text", text: '{"findings":[]}' }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 20 },
        model: "claude-haiku-4-5-20251001",
      })),
      MOCK_SDK_VERSION,
    );
    const result = await invoker(buildInvokeInput());

    assert.equal(result.providerMetadata?.response_schema_version, MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION);
    assert.equal(result.providerMetadata?.sdk_version, MOCK_SDK_VERSION);
    assert.equal(result.providerMetadata?.api_version, ANTHROPIC_SDK_DEFAULT_API_VERSION);
  });

  it("19 uses injected client without instantiating Anthropic SDK", async () => {
    let createCalls = 0;
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async () => {
        createCalls += 1;
        return {
          content: [{ type: "text", text: '{"findings":[]}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
          model: "claude-haiku-4-5-20251001",
        };
      }),
      MOCK_SDK_VERSION,
    );
    await invoker(buildInvokeInput());

    assert.equal(createCalls, 1);
  });
  it("20 omits temperature for opus 4.8 requests", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const invoker = createAnthropicProviderInvokerFromClient(
      createMockClient(async (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return {
          content: [{ type: "text", text: '{"findings":[]}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
          model: ANTHROPIC_OPUS_48_MODEL_ID,
        };
      }),
      MOCK_SDK_VERSION,
    );
    const input = { ...buildInvokeInput(), modelId: ANTHROPIC_OPUS_48_MODEL_ID };
    const result = await invoker(input);

    assert.equal(result.ok, true);
    assert.ok(capturedBody);
    assert.equal("temperature" in capturedBody!, false);
  });

});
