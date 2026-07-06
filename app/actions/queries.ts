"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agentfinder";
import { getManuscriptMeta, getManuscriptText } from "@/lib/reviews";
import { getMarketabilityContext } from "@/lib/marketability";
import { generateQueryLetter as queryOpenAI } from "@/lib/ai/openai";
import { generateQueryLetter as queryClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface QueryLetterResult {
  ok: boolean;
  error?: string;
}

export async function generateQueryLetter(
  manuscriptId: string,
  agentId: string,
  provider: Provider,
): Promise<QueryLetterResult> {
  if (!manuscriptId || !agentId) return { ok: false, error: "Pick a manuscript and an agent." };

  let agent;
  try {
    agent = await getAgent(agentId);
  } catch (e) {
    return { ok: false, error: `Couldn't load the agent: ${e instanceof Error ? e.message : e}` };
  }
  if (!agent) return { ok: false, error: "Agent not found in PKagentfinder." };

  const meta = await getManuscriptMeta(manuscriptId);
  if (!meta) return { ok: false, error: "Manuscript not found." };

  // The query letter must be grounded ONLY in the actual manuscript — no
  // invented facts. So the source of truth is the full manuscript text. Each
  // provider handles sizing: Claude (1M context) reads it whole; OpenAI covers
  // the WHOLE book via section-by-section map-reduce. No review or excerpt
  // fallback, so the model never has to invent the parts it can't see.
  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, error: "This manuscript has no extracted text to ground the letter in." };
  }
  const source = text;

  // Marketability report (if any): trusted positioning + comps + key issues.
  const marketability = await getMarketabilityContext(manuscriptId);

  let result;
  try {
    const fn = provider === "openai" ? queryOpenAI : queryClaude;
    result = await fn(agent, {
      title: meta.title,
      wordCount: meta.word_count,
      source,
      marketability,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("query_letters").insert({
    manuscript_id: manuscriptId,
    agent_id: agent.id,
    agent_name: agent.name,
    agency: agent.agency,
    provider,
    model: result.model,
    content: result.content,
  });
  if (error) return { ok: false, error: `Saving the query letter failed: ${error.message}` };

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function deleteQueryLetter(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("query_letters").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
