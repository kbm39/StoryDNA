import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Manuscript } from "@/lib/types";

/** List manuscripts, newest first. Omits the heavy extracted_text column. */
export async function listManuscripts(): Promise<Manuscript[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("manuscripts")
    .select(
      "id, title, original_filename, storage_path, file_size, word_count, status, archived, series_id, series_order, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  // extracted_text isn't selected here; cast through unknown for the list view.
  return (data ?? []).map((row) => ({ ...row, extracted_text: null })) as Manuscript[];
}
