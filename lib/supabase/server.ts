import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseClientOptions } from "./client-options.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True only when both required Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceRoleKey);
}

/**
 * Server-side Supabase client using the service-role key.
 * Single-user local app: this bypasses RLS by design. Never import this into
 * client components — `server-only` will error the build if you try.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, serviceRoleKey, resolveSupabaseClientOptions());
}

export const MANUSCRIPTS_BUCKET = "manuscripts";
