"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listReviews } from "@/lib/reviews";
import { listIssues } from "@/lib/issues";
import { extractIssuesFromReview as extractOpenAI } from "@/lib/ai/openai";
import { extractIssuesFromReview as extractClaude } from "@/lib/ai/anthropic";
import type { IssueStatus } from "@/lib/types";

export interface ExtractIssuesState {
  ok: boolean;
  message?: string;
  errors?: string[];
}

export interface AddIssueState {
  ok: boolean;
  error?: string;
}

function revalidate(manuscriptId: string) {
  revalidatePath(`/manuscripts/${manuscriptId}`);
}

/** Extract checklist issues from each existing review (deduped by title). */
export async function extractIssues(
  _prev: ExtractIssuesState,
  formData: FormData,
): Promise<ExtractIssuesState> {
  const manuscriptId = formData.get("manuscriptId") as string | null;
  if (!manuscriptId) return { ok: false, errors: ["Missing manuscript id."] };

  const reviews = await listReviews(manuscriptId);
  if (reviews.length === 0) {
    return { ok: false, errors: ["Generate reviews first — there's nothing to extract from."] };
  }

  const settled = await Promise.allSettled(
    reviews.map(async (review) => {
      const items =
        review.provider === "openai"
          ? await extractOpenAI(review.content)
          : await extractClaude(review.content);
      return { review, items };
    }),
  );

  const existing = await listIssues(manuscriptId);
  const seen = new Set(existing.map((i) => i.title.trim().toLowerCase()));

  const toInsert: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "rejected") {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    const { review, items } = result.value;
    for (const item of items) {
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        manuscript_id: manuscriptId,
        review_id: review.id,
        title: item.title,
        description: item.description || null,
        category: item.category || null,
        source_provider: review.provider,
        status: "outstanding",
      });
    }
  }

  if (toInsert.length > 0) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("issues").insert(toInsert);
    if (error) errors.push(`Saving issues failed: ${error.message}`);
  }

  revalidate(manuscriptId);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    message:
      toInsert.length > 0
        ? `Added ${toInsert.length} new issue${toInsert.length === 1 ? "" : "s"}.`
        : "No new issues — the reviews are already captured.",
  };
}

/** Add an issue by hand. */
export async function addIssue(
  _prev: AddIssueState,
  formData: FormData,
): Promise<AddIssueState> {
  const manuscriptId = formData.get("manuscriptId") as string | null;
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  if (!title) return { ok: false, error: "Give the issue a title." };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("issues").insert({
    manuscript_id: manuscriptId,
    title,
    description: description || null,
    category: "Other",
    status: "outstanding",
  });
  if (error) return { ok: false, error: error.message };

  revalidate(manuscriptId);
  return { ok: true };
}

/** Toggle a single issue's resolved/outstanding state. */
export async function setIssueStatus(
  issueId: string,
  manuscriptId: string,
  status: IssueStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("issues").update({ status }).eq("id", issueId);
  if (error) throw new Error(error.message);
  revalidate(manuscriptId);
}

export async function deleteIssue(issueId: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("issues").delete().eq("id", issueId);
  if (error) throw new Error(error.message);
  revalidate(manuscriptId);
}
