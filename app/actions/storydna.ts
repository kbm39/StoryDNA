"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { discoverStoryDNA as discoverClaude } from "@/lib/ai/anthropic";
import { discoverStoryDNA as discoverOpenAI } from "@/lib/ai/openai";
import { deriveStoryDna } from "@/lib/storydna-derive";
import { getStoryDna } from "@/lib/storydna";
import type {
  AlignmentResponse,
  EmotionalPromise,
  InterviewAnswer,
  Provider,
  StoryDnaData,
} from "@/lib/types";

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

  // Verify evidence against the manuscript and derive real confidence scores.
  // Claude reads the whole novel ("full"); the OpenAI fallback works from notes.
  data = deriveStoryDna(data, text, preferClaude ? "full" : "notes");

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
      // A fresh discovery re-proposes the interpretation → alignment pending again.
      alignment_status: "pending",
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

// --- Author Alignment --------------------------------------------------------

export type AlignKey = "summary" | "themes" | "about" | "emotional_promise";

export interface AlignPayload {
  finalText?: string;
  finalThemes?: string[];
  finalEmotional?: EmotionalPromise;
  note?: string;
}

export interface AlignResult {
  ok: boolean;
  error?: string;
  alignmentStatus?: "pending" | "aligned";
}

const INTERPRETIVE_KEYS: AlignKey[] = ["summary", "themes", "about", "emotional_promise"];

/** Record the author's intent response (confirm / refine / augment / realign) for
 *  one interpretive conclusion, and recompute whether the whole read is aligned. */
export async function alignConclusion(
  manuscriptId: string,
  key: AlignKey,
  response: AlignmentResponse,
  payload: AlignPayload = {},
): Promise<AlignResult> {
  const dna = await getStoryDna(manuscriptId);
  if (!dna) return { ok: false, error: "No StoryDNA analysis found." };

  const data = dna.data;
  const now = new Date().toISOString();
  const note = payload.note?.trim() || null;

  if (key === "themes") {
    data.themes.response = response;
    data.themes.final = payload.finalThemes ?? data.themes.final;
    data.themes.note = note;
    data.themes.updated_at = now;
  } else if (key === "emotional_promise") {
    data.emotional_promise.response = response;
    data.emotional_promise.final = payload.finalEmotional ?? data.emotional_promise.final;
    data.emotional_promise.note = note;
    data.emotional_promise.updated_at = now;
  } else {
    const field = data[key]; // summary | about (AlignedText)
    field.response = response;
    field.final = payload.finalText ?? field.final;
    field.note = note;
    field.updated_at = now;
  }

  const aligned = INTERPRETIVE_KEYS.every((k) => data[k].response !== null);
  const alignmentStatus: "pending" | "aligned" = aligned ? "aligned" : "pending";

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("story_dna")
    .update({ data, alignment_status: alignmentStatus, updated_at: now })
    .eq("manuscript_id", manuscriptId);
  if (error) return { ok: false, error: `Saving your alignment failed: ${error.message}` };

  revalidatePath(`/storydna/${manuscriptId}`);
  return { ok: true, alignmentStatus };
}

/** Store the author's overall "Did StoryDNA understand your story?" answer. */
export async function saveUnderstandingFeedback(
  manuscriptId: string,
  feedback: "yes" | "mostly" | "no",
  note?: string,
): Promise<SaveAnswerResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("story_dna")
    .update({
      understanding_feedback: feedback,
      understanding_feedback_note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("manuscript_id", manuscriptId);
  if (error) return { ok: false, error: `Saving your feedback failed: ${error.message}` };

  revalidatePath(`/storydna/${manuscriptId}`);
  return { ok: true };
}
