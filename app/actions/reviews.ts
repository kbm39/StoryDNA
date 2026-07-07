"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { getStoryDna } from "@/lib/storydna";
import { generateScreenReview as generateScreenOpenAI } from "@/lib/ai/openai";
import {
  generateCraftReview,
  generateAgentReview,
  generateScreenReview as generateScreenClaude,
} from "@/lib/ai/anthropic";
import type { AuthorIntent, Perspective, Provider, StoryDna } from "@/lib/types";
import type { ReviewResult } from "@/lib/ai/shared";

/** Build a review's author-intent context from the manuscript's StoryDNA (if any). */
function intentFromDna(dna: StoryDna | null): AuthorIntent | null {
  if (!dna?.data?.summary) return null;
  const d = dna.data;
  const emo = d.emotional_promise.final ?? d.emotional_promise.proposed;
  return {
    confirmed: dna.alignment_status === "aligned",
    summary: d.summary.final ?? d.summary.proposed,
    about: d.about.final ?? d.about.proposed,
    themes: d.themes.final ?? d.themes.proposed.map((t) => t.name),
    emotionalPromise: `Beginning: ${emo.beginning}; Middle: ${emo.middle}; Ending: ${emo.ending}; After: ${emo.after_finishing}`,
  };
}

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
    metadata: {
      truncated: result.truncated,
      chars_sent: result.charsSent,
      review_meta: result.reviewMeta ?? null,
    },
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

  // The Literary Agent Review (commercial) reads the whole manuscript and is
  // grounded in the confirmed StoryDNA author intent when available.
  const intent = intentFromDna(await getStoryDna(manuscriptId));

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const res =
          provider === "openai"
            ? await generateAgentReview(text, intent)
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
