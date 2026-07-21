import type { RealtimeClientOptions } from "@supabase/realtime-js";
import WS from "ws";

export type SupabaseRuntimeContext = {
  nodeVersion?: string | null;
  hasNativeWebSocket?: boolean;
};

/**
 * Supabase Realtime requires a WebSocket constructor at client construction time,
 * even when the admin client only performs REST/RPC writes (Trigger worker path).
 * Node.js versions before 22 do not expose native WebSocket — pass `ws` explicitly.
 */
export function nodeMajorVersion(nodeVersion = process.versions?.node): number | null {
  if (!nodeVersion) return null;
  return parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10);
}

/** True when Supabase Realtime needs an explicit `ws` transport constructor. */
export function needsWsTransport(context: SupabaseRuntimeContext = {}): boolean {
  const major = nodeMajorVersion(context.nodeVersion ?? process.versions?.node);
  const hasNativeWebSocket =
    context.hasNativeWebSocket ?? typeof globalThis.WebSocket !== "undefined";
  if (major !== null && major < 22) return true;
  return !hasNativeWebSocket;
}

export function resolveSupabaseClientOptions(
  context: SupabaseRuntimeContext = {},
): {
  auth: { persistSession: false; autoRefreshToken: false };
  realtime?: RealtimeClientOptions;
} {
  const auth = { persistSession: false, autoRefreshToken: false } as const;
  if (!needsWsTransport(context)) {
    return { auth };
  }
  return {
    auth,
    realtime: {
      transport: WS as unknown as NonNullable<RealtimeClientOptions["transport"]>,
    },
  };
}
