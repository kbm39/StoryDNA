import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Browser Supabase client for Realtime read subscriptions only. */
export function getSupabaseBrowser() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Realtime requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(url && anonKey);
}
