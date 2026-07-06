import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MarketabilityReport } from "@/lib/types";

/** The current marketability report for a manuscript (one per manuscript), or null. */
export async function getMarketabilityReport(
  manuscriptId: string,
): Promise<MarketabilityReport | null> {
  // Resilient: returns null if the table doesn't exist yet (migration not run).
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("marketability_reports")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as MarketabilityReport) ?? null;
  } catch {
    return null;
  }
}

/**
 * Marketability text to feed downstream outputs (query letters, pitch deck,
 * marketing copy) as trusted positioning material: the AI summary if present,
 * else a slice of the raw report; null when there's no report.
 */
export async function getMarketabilityContext(manuscriptId: string): Promise<string | null> {
  const report = await getMarketabilityReport(manuscriptId);
  if (!report) return null;
  return report.summary || (report.raw_text ? report.raw_text.slice(0, 12_000) : null);
}
