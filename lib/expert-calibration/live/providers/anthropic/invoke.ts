import Anthropic from "@anthropic-ai/sdk";
import { VERSION as ANTHROPIC_SDK_VERSION } from "@anthropic-ai/sdk/version";
import type { MilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-contract.ts";
import type { MilitaryExpertRawGenerationResponse } from "@/experts/military-expert/generation-types.ts";
import type {
  LiveCalibrationProviderInvokeInput,
  LiveCalibrationProviderInvokeResult,
  LiveCalibrationProviderInvoker,
  LiveCalibrationProviderMetadata,
} from "../../contracts.ts";
import { sanitizeLiveCalibrationMessage } from "../../errors.ts";
import {
  buildAnthropicProviderMetadata,
  extractAnthropicApiVersionFromResponse,
  resolveAnthropicApiVersion,
} from "./metadata.ts";
import { getModelLifecycleRecord } from "../../model-lifecycle.ts";
import { validateAnthropicTextContent, type AnthropicContentBlock } from "./response-shape.ts";

export interface AnthropicMessagesCreateClient {
  messages: {
    create: (
      body: unknown,
      options?: { signal?: AbortSignal; timeout?: number },
    ) => Promise<unknown>;
  };
}

function buildInvokeProviderMetadata(
  modelId: string,
  sdkVersion: string,
  response?: unknown,
): LiveCalibrationProviderMetadata {
  const lifecycle = getModelLifecycleRecord(modelId);
  const exposedApiVersion = response === undefined
    ? null
    : extractAnthropicApiVersionFromResponse(response);
  return buildAnthropicProviderMetadata({
    modelId,
    sdkVersion,
    apiVersion: resolveAnthropicApiVersion(exposedApiVersion),
    pricingProfileId: lifecycle?.pricingProfileId ?? "unknown",
    modelLifecycleStatus: lifecycle?.status ?? "retired",
    modelLifecycleVerifiedDate: lifecycle?.verifiedDate ?? "unknown",
    modelLifecycleSource: lifecycle?.sourceLabel ?? "unknown",
    recommendedReplacement: lifecycle?.recommendedReplacement ?? null,
  });
}

export function createAnthropicProviderInvokerFromClient(
  client: AnthropicMessagesCreateClient,
  sdkVersion: string = ANTHROPIC_SDK_VERSION,
): LiveCalibrationProviderInvoker {
  return async (
    input: LiveCalibrationProviderInvokeInput,
  ): Promise<LiveCalibrationProviderInvokeResult> => {
    const startedAt = Date.now();
    const request = input.request as MilitaryExpertGenerationRequest;

    try {
      const response = await client.messages.create(
        {
          model: input.modelId,
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.reviewPrompt }],
        },
        {
          signal: input.signal,
          timeout: input.timeoutMs,
        },
      );

      const providerMetadata = buildInvokeProviderMetadata(input.modelId, sdkVersion, response);
      const responseRecord = response as {
        content?: unknown;
        stop_reason?: string | null;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
      };

      const shape = validateAnthropicTextContent(
        (responseRecord.content ?? []) as readonly AnthropicContentBlock[],
      );
      if (!shape.ok) {
        return {
          ok: false,
          providerError: {
            code: shape.code,
            message: sanitizeLiveCalibrationMessage(shape.message),
          },
          providerMetadata,
          durationMs: Date.now() - startedAt,
        };
      }

      const finishStatus =
        responseRecord.stop_reason === "max_tokens"
          ? ("truncated" as const)
          : responseRecord.stop_reason === "end_turn"
            ? ("complete" as const)
            : ("complete" as const);

      const rawResponse: MilitaryExpertRawGenerationResponse = Object.freeze({
        correlationId: input.correlationId,
        responseText: shape.text,
        finishStatus,
        inputTokens: responseRecord.usage?.input_tokens,
        outputTokens: responseRecord.usage?.output_tokens,
        modelIdentifier: responseRecord.model,
        capturedAt: new Date().toISOString(),
        provenance: Object.freeze({ source: "external_caller" as const }),
      });

      return {
        ok: true,
        rawResponse,
        providerMetadata,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message = sanitizeLiveCalibrationMessage(
        error instanceof Error ? error.message : "Provider invocation failed",
      );
      const code =
        error instanceof Anthropic.APIError
          ? String(error.status ?? "provider_error")
          : "provider_error";

      return {
        ok: false,
        providerError: { code, message },
        providerMetadata: buildInvokeProviderMetadata(input.modelId, sdkVersion),
        durationMs: Date.now() - startedAt,
      };
    }
  };
}

export function createAnthropicProviderInvoker(apiKey: string): LiveCalibrationProviderInvoker {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return createAnthropicProviderInvokerFromClient(
    client as unknown as AnthropicMessagesCreateClient,
  );
}
