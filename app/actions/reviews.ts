"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import {
  generateCommercialReview,
  generateScreenReview as generateScreenOpenAI,
} from "@/lib/ai/openai";
import {
  generateCraftReview,
  generateScreenReview as generateScreenClaude,
} from "@/lib/ai/anthropic";
import type { Perspective, Provider } from "@/lib/types";
import type { ReviewResult } from "@/lib/ai/shared";

export interface GenerateReviewsResult {
  ok: boolean;
  errors?: string[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI (commercial)",
  anthropic: "Claude (craft)",
};

const PERSPECTIVE_OF: Record<Provider, Perspective> = {
  openai: "commercial",
  anthropic: "craft",
};

async function saveReview(
  manuscriptId: string,
  provider: Provider,
  perspective: Perspective,
  result: ReviewResult,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  // Replace any prior review from this provider + perspective for this manuscript.
  await supabase
    .from("reviews")
    .delete()
    .eq("manuscript_id", manuscriptId)
    .eq("provider", provider)
    .eq("perspective", perspective);
  const { error } = await supabase.from("reviews").insert({
    manuscript_id: manuscriptId,
    provider,
    perspective,
    model: result.model,
    content: result.content,
    metadata: { truncated: result.truncated, chars_sent: result.charsSent },
  });
  if (error) throw new Error(error.message);
}

/**
 * Generate (or regenerate) the chosen editorial reviews for a manuscript.
 * Pass only the providers you want to (re)run — each is saved independently,
 * so regenerating one never discards the other.
 */
export async function generateReviews(
  manuscriptId: string,
  providers: Provider[],
): Promise<GenerateReviewsResult> {
  if (!manuscriptId) return { ok: false, errors: ["Missing manuscript id."] };
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["This manuscript has no extracted text to review."] };
  }

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const res =
          provider === "openai"
            ? await generateCommercialReview(text)
            : await generateCraftReview(text);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return { provider, res: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const errors: string[] = [];
  for (const r of results) {
    if (r.error || !r.res) {
      errors.push(`${PROVIDER_LABEL[r.provider]} failed: ${r.error}`);
      continue;
    }
    try {
      await saveReview(manuscriptId, r.provider, PERSPECTIVE_OF[r.provider], r.res);
    } catch (e) {
      errors.push(`Saving ${PROVIDER_LABEL[r.provider]} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

/** Generate (or regenerate) the producer's-read (TV/film) review from the chosen provider(s). */
export async function generateScreenReviews(
  manuscriptId: string,
  providers: Provider[],
): Promise<GenerateReviewsResult> {
  if (!manuscriptId) return { ok: false, errors: ["Missing manuscript id."] };
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["This manuscript has no extracted text to review."] };
  }

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const res =
          provider === "openai"
            ? await generateScreenOpenAI(text)
            : await generateScreenClaude(text);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return { provider, res: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const errors: string[] = [];
  for (const r of results) {
    if (r.error || !r.res) {
      errors.push(`${PROVIDER_LABEL[r.provider]} failed: ${r.error}`);
      continue;
    }
    try {
      await saveReview(manuscriptId, r.provider, "screen", r.res);
    } catch (e) {
      errors.push(`Saving ${PROVIDER_LABEL[r.provider]} failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}
