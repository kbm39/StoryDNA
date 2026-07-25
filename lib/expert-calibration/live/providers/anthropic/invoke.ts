import Anthropic from "@anthropic-ai/sdk";
import type { MilitaryExpertGenerationRequest } from "@/experts/military-expert/generation-contract.ts";
import type { MilitaryExpertRawGenerationResponse } from "@/experts/military-expert/generation-types.ts";
import type {
  LiveCalibrationProviderInvokeInput,
  LiveCalibrationProviderInvokeResult,
  LiveCalibrationProviderInvoker,
} from "../../contracts.ts";
import { sanitizeLiveCalibrationMessage } from "../../errors.ts";
import { validateAnthropicTextContent } from "./response-shape.ts";

export function createAnthropicProviderInvoker(apiKey: string): LiveCalibrationProviderInvoker {
  const client = new Anthropic({ apiKey, maxRetries: 0 });

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

      const shape = validateAnthropicTextContent(response.content);
      if (!shape.ok) {
        return {
          ok: false,
          providerError: {
            code: shape.code,
            message: sanitizeLiveCalibrationMessage(shape.message),
          },
          durationMs: Date.now() - startedAt,
        };
      }

      const finishStatus =
        response.stop_reason === "max_tokens"
          ? ("truncated" as const)
          : response.stop_reason === "end_turn"
            ? ("complete" as const)
            : ("complete" as const);

      const rawResponse: MilitaryExpertRawGenerationResponse = Object.freeze({
        correlationId: input.correlationId,
        responseText: shape.text,
        finishStatus,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        modelIdentifier: response.model,
        capturedAt: new Date().toISOString(),
        provenance: Object.freeze({ source: "external_caller" as const }),
      });

      return {
        ok: true,
        rawResponse,
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
        durationMs: Date.now() - startedAt,
      };
    }
  };
}
