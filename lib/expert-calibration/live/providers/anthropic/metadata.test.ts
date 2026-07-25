import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION } from "@/experts/military-expert/output-schema.ts";
import {
  ANTHROPIC_SDK_DEFAULT_API_VERSION,
  buildAnthropicProviderMetadata,
  extractAnthropicApiVersionFromResponse,
  normalizeAnthropicApiVersion,
  resolveAnthropicApiVersion,
} from "./metadata.ts";

describe("Anthropic provider metadata", () => {
  describe("normalizeAnthropicApiVersion", () => {
    it("1 preserves exact API version when supplied", () => {
      assert.equal(normalizeAnthropicApiVersion("2024-11-15"), "2024-11-15");
    });

    it("2 missing API version becomes unknown", () => {
      assert.equal(normalizeAnthropicApiVersion(undefined), "unknown");
    });

    it("3 null API version becomes unknown", () => {
      assert.equal(normalizeAnthropicApiVersion(null), "unknown");
    });

    it("4 empty API version becomes unknown", () => {
      assert.equal(normalizeAnthropicApiVersion("   "), "unknown");
    });

    it("5 trims surrounding whitespace", () => {
      assert.equal(normalizeAnthropicApiVersion("  2023-06-01  "), "2023-06-01");
    });
  });

  describe("resolveAnthropicApiVersion", () => {
    it("6 preserves exposed API version", () => {
      assert.equal(resolveAnthropicApiVersion("2024-11-15"), "2024-11-15");
    });

    it("7 uses SDK default when exposed version missing", () => {
      assert.equal(resolveAnthropicApiVersion(undefined), ANTHROPIC_SDK_DEFAULT_API_VERSION);
    });

    it("8 uses SDK default when exposed version empty", () => {
      assert.equal(resolveAnthropicApiVersion("  "), ANTHROPIC_SDK_DEFAULT_API_VERSION);
    });
  });

  describe("extractAnthropicApiVersionFromResponse", () => {
    it("9 reads anthropic_version from response object", () => {
      assert.equal(
        extractAnthropicApiVersionFromResponse({ anthropic_version: "2024-11-15" }),
        "2024-11-15",
      );
    });

    it("10 reads anthropic-version response header when present", () => {
      assert.equal(
        extractAnthropicApiVersionFromResponse({
          response: {
            headers: {
              get: (name: string) => (name === "anthropic-version" ? "2024-11-15" : null),
            },
          },
        }),
        "2024-11-15",
      );
    });
  });

  describe("buildAnthropicProviderMetadata", () => {
    it("11 final metadata api_version is never null or empty", () => {
      const metadata = buildAnthropicProviderMetadata({
        modelId: "claude-3-5-haiku-20241022",
        sdkVersion: "0.104.2",
        apiVersion: null as unknown as string,
      });
      assert.equal(metadata.api_version, "unknown");
      assert.ok(metadata.api_version.length > 0);
    });

    it("12 sdk_version remains separately recorded", () => {
      const metadata = buildAnthropicProviderMetadata({
        modelId: "claude-3-5-haiku-20241022",
        sdkVersion: "0.104.2",
        apiVersion: ANTHROPIC_SDK_DEFAULT_API_VERSION,
      });
      assert.equal(metadata.sdk_version, "0.104.2");
      assert.notEqual(metadata.sdk_version, metadata.api_version);
    });

    it("13 response_schema_version remains separately recorded", () => {
      const metadata = buildAnthropicProviderMetadata({
        modelId: "claude-3-5-haiku-20241022",
        sdkVersion: "0.104.2",
        apiVersion: ANTHROPIC_SDK_DEFAULT_API_VERSION,
      });
      assert.equal(metadata.response_schema_version, MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION);
      assert.notEqual(metadata.response_schema_version, metadata.api_version);
      assert.notEqual(metadata.response_schema_version, metadata.sdk_version);
    });

    it("14 provider metadata uses snake_case fields", () => {
      const metadata = buildAnthropicProviderMetadata({
        modelId: "claude-3-5-haiku-20241022",
        sdkVersion: "0.104.2",
        apiVersion: ANTHROPIC_SDK_DEFAULT_API_VERSION,
      });
      assert.equal(metadata.provider, "anthropic");
      assert.equal(metadata.model_id, "claude-3-5-haiku-20241022");
      assert.ok("api_version" in metadata);
      assert.ok("sdk_version" in metadata);
      assert.ok("response_schema_version" in metadata);
    });
  });
});
