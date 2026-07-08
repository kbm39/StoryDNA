import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ManuscriptIntake, AuthorProfile } from "@/lib/types";

/** The intake record for a manuscript, or null (also null if migration not run). */
export async function getManuscriptIntake(
  manuscriptId: string,
): Promise<ManuscriptIntake | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("manuscript_intake")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .maybeSingle();
    if (error) return null;
    return (data as ManuscriptIntake) ?? null;
  } catch {
    return null;
  }
}

/** The single-user author profile (remembered feedback style / optimization). */
export async function getAuthorProfile(): Promise<AuthorProfile | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("author_profile")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) return null;
    return (data as AuthorProfile) ?? null;
  } catch {
    return null;
  }
}
