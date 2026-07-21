import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  needsWsTransport,
  nodeMajorVersion,
  resolveSupabaseClientOptions,
} from "./client-options.ts";

describe("resolveSupabaseClientOptions", () => {
  let originalWebSocket: typeof globalThis.WebSocket | undefined;

  afterEach(() => {
    if (originalWebSocket === undefined) {
      delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    } else {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("uses native WebSocket on Node 22+ when available", () => {
    originalWebSocket = globalThis.WebSocket;
    const opts = resolveSupabaseClientOptions({
      nodeVersion: "22.4.0",
      hasNativeWebSocket: true,
    });
    assert.equal(needsWsTransport({ nodeVersion: "22.4.0", hasNativeWebSocket: true }), false);
    assert.equal(opts.realtime, undefined);
  });

  it("supplies ws transport on Node 21 without native WebSocket (Trigger worker)", () => {
    const opts = resolveSupabaseClientOptions({
      nodeVersion: "21.7.3",
      hasNativeWebSocket: false,
    });
    assert.equal(
      needsWsTransport({ nodeVersion: "21.7.3", hasNativeWebSocket: false }),
      true,
    );
    assert.ok(opts.realtime?.transport);
  });

  it("supplies ws transport on Node 22+ when native WebSocket is missing", () => {
    const opts = resolveSupabaseClientOptions({
      nodeVersion: "22.4.0",
      hasNativeWebSocket: false,
    });
    assert.equal(
      needsWsTransport({ nodeVersion: "22.4.0", hasNativeWebSocket: false }),
      true,
    );
    assert.ok(opts.realtime?.transport);
  });

  it("createClient succeeds on simulated Node 21 Trigger runtime", () => {
    const client = createClient(
      "https://example.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
      resolveSupabaseClientOptions({
        nodeVersion: "21.7.3",
        hasNativeWebSocket: false,
      }),
    );
    assert.ok(client);
    assert.equal(typeof client.from, "function");
  });

  it("nodeMajorVersion parses semver prefix", () => {
    assert.equal(nodeMajorVersion("v21.7.3"), 21);
  });
});
