"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface IntakeLoadFlags {
  canon: boolean;
  characters: boolean;
  timeline: boolean;
  story_memory: boolean;
  author_intent: boolean;
  editorial_decisions: boolean;
  reviewer_feedback: boolean;
}

export interface IntakeInput {
  relation: "standalone" | "existing_series" | "new_series";
  series_id: string | null;
  series_name: string;
  book_number: number | null;
  order_type: string | null;
  published_order: number | null;
  story_order: number | null;
  manuscript_type: string;
  manuscript_stage: string;
  load: IntakeLoadFlags;
  objectives: string[];
  optimization: string;
  feedback_style: string[];
  recommend_specialists: boolean;
  save_series_default: boolean;
}

export interface SaveIntakeResult {
  ok: boolean;
  error?: string;
}

/** Persist the Manuscript Intake interview, link/create the series, and remember
 *  author + series defaults. Marks the intake complete so Story Understanding can run. */
export async function saveManuscriptIntake(
  manuscriptId: string,
  input: IntakeInput,
): Promise<SaveIntakeResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Resolve series linkage.
  let seriesId: string | null = null;
  if (input.relation === "existing_series" && input.series_id) {
    seriesId = input.series_id;
  } else if (input.relation === "new_series" && input.series_name.trim()) {
    const { data, error } = await supabase
      .from("series")
      .insert({ title: input.series_name.trim() })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Creating the series failed: ${error.message}` };
    seriesId = data.id as string;
  }

  // Link the manuscript to the series (published order = its book number in the series).
  if (seriesId) {
    await supabase
      .from("manuscripts")
      .update({ series_id: seriesId, series_order: input.published_order ?? input.book_number })
      .eq("id", manuscriptId);
  }

  const { error: intakeErr } = await supabase.from("manuscript_intake").upsert(
    {
      manuscript_id: manuscriptId,
      relation: input.relation,
      series_id: seriesId,
      series_name: input.series_name.trim() || null,
      book_number: input.book_number,
      order_type: input.order_type,
      published_order: input.published_order,
      story_order: input.story_order,
      manuscript_type: input.manuscript_type,
      manuscript_stage: input.manuscript_stage,
      load_canon: input.load.canon,
      load_characters: input.load.characters,
      load_timeline: input.load.timeline,
      load_story_memory: input.load.story_memory,
      load_author_intent: input.load.author_intent,
      load_editorial_decisions: input.load.editorial_decisions,
      load_reviewer_feedback: input.load.reviewer_feedback,
      objectives: input.objectives,
      optimization: input.optimization,
      feedback_style: input.feedback_style,
      recommend_specialists: input.recommend_specialists,
      completed_at: now,
      updated_at: now,
    },
    { onConflict: "manuscript_id" },
  );
  if (intakeErr) return { ok: false, error: `Saving the intake failed: ${intakeErr.message}` };

  // Remember author-level preferences.
  await supabase.from("author_profile").upsert(
    {
      id: "default",
      feedback_style: input.feedback_style,
      optimization: input.optimization,
      updated_at: now,
    },
    { onConflict: "id" },
  );

  // Optionally save series-level defaults for future books.
  if (input.save_series_default && seriesId) {
    await supabase
      .from("series")
      .update({
        default_objectives: input.objectives,
        default_optimization: input.optimization,
        default_feedback_style: input.feedback_style,
        default_recommend_specialists: input.recommend_specialists,
      })
      .eq("id", seriesId);
  }

  revalidatePath(`/storydna/${manuscriptId}`);
  return { ok: true };
}
