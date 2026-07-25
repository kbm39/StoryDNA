import { MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION } from "@/experts/military-expert/output-schema.ts";
import type { LiveCalibrationProviderMetadata } from "../../contracts.ts";

/**
 * Default `anthropic-version` request header sent by the Anthropic TypeScript SDK client.
 * Deterministic without network access; not inferred from response bodies.
 */
export const ANTHROPIC_SDK_DEFAULT_API_VERSION = "2023-06-01" as const;

export function normalizeAnthropicApiVersion(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "unknown";
}

/**
 * Prefer an exposed provider API version; otherwise use the SDK default header version.
 */
export function resolveAnthropicApiVersion(exposedVersion?: string | null): string {
  if (typeof exposedVersion === "string") {
    const trimmed = exposedVersion.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return ANTHROPIC_SDK_DEFAULT_API_VERSION;
}

export function extractAnthropicApiVersionFromResponse(response: unknown): string | null {
  if (response === null || typeof response !== "object") {
    return null;
  }

  const record = response as Record<string, unknown>;
  const direct = record.anthropic_version ?? record.anthropicVersion ?? record.api_version;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  const rawResponse = record.response;
  if (rawResponse !== null && typeof rawResponse === "object") {
    const headers = (rawResponse as { headers?: { get?: (name: string) => string | null } }).headers;
    const headerValue = headers?.get?.("anthropic-version");
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      return headerValue.trim();
    }
  }

  return null;
}

export function buildAnthropicProviderMetadata(input: {
  readonly modelId: string;
  readonly sdkVersion: string;
  readonly apiVersion: string;
  readonly responseSchemaVersion?: string;
}): LiveCalibrationProviderMetadata {
  const sdkVersion = typeof input.sdkVersion === "string" ? input.sdkVersion.trim() : "";
  return Object.freeze({
    provider: "anthropic",
    model_id: input.modelId,
    sdk_version: sdkVersion.length > 0 ? sdkVersion : "unknown",
    api_version: normalizeAnthropicApiVersion(input.apiVersion),
    response_schema_version:
      input.responseSchemaVersion ?? MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION,
  });
}
