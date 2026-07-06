"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { discoverStoryDNA as discoverClaude } from "@/lib/ai/anthropic";
import { discoverStoryDNA as discoverOpenAI } from "@/lib/ai/openai";
import type { InterviewAnswer, Provider, StoryDnaData } from "@/lib/types";

export interface DiscoveryResult {
  ok: boolean;
  data?: StoryDnaData;
  error?: string;
}

export interface SaveAnswerResult {
  ok: boolean;
  error?: string;
}

/**
 * Run StoryDNA discovery for a manuscript and persist it. Prefers Claude (it
 * reads the whole novel in one context, which matters for protagonist ID);
 * falls back to OpenAI. Idempotent-ish: re-running replaces the stored DNA.
 */
export async function runStoryDnaDiscovery(manuscriptId: string): Promise<DiscoveryResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, error: "This manuscript has no extracted text to analyze." };
  }

  const preferClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  let data: StoryDnaData;
  let model: string;
  let provider: Provider;
  try {
    if (preferClaude) {
      ({ data, model } = await discoverClaude(text));
      provider = "anthropic";
    } else {
      ({ data, model } = await discoverOpenAI(text));
      provider = "openai";
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("story_dna").upsert(
    {
      manuscript_id: manuscriptId,
      provider,
      model,
      status: "ready",
      chapters_count: data.chapters_count,
      protagonist_name: data.protagonist.name,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manuscript_id" },
  );
  if (error) return { ok: false, error: `Saving StoryDNA failed: ${error.message}` };

  revalidatePath(`/storydna/${manuscriptId}`);
  return { ok: true, data };
}

/** Store an interview answer in StoryDNA's persistent memory. */
export async function saveInterviewAnswer(
  manuscriptId: string,
  input: {
    characterName: string | null;
    questionKey: string;
    question: string;
    answer: InterviewAnswer;
  },
): Promise<SaveAnswerResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  if (!input.questionKey || !input.question) return { ok: false, error: "Malformed question." };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("story_dna_interview").upsert(
    {
      manuscript_id: manuscriptId,
      character_name: input.characterName,
      question_key: input.questionKey,
      question: input.question,
      answer: input.answer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manuscript_id,question_key" },
  );
  if (error) return { ok: false, error: `Saving your answer failed: ${error.message}` };

  revalidatePath(`/storydna/${manuscriptId}`);
  return { ok: true };
}
