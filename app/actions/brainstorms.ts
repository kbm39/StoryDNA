"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { brainstormScene as brainstormOpenAI } from "@/lib/ai/openai";
import { brainstormScene as brainstormClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface BrainstormResult {
  ok: boolean;
  errors?: string[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

/** Brainstorm a stuck scene with the chosen provider(s), optionally grounded in the book. */
export async function brainstorm(
  manuscriptId: string,
  prompt: string,
  providers: Provider[],
  useManuscript: boolean,
): Promise<BrainstormResult> {
  const scene = prompt.trim();
  if (!manuscriptId) return { ok: false, errors: ["Missing manuscript id."] };
  if (!scene) return { ok: false, errors: ["Describe the scene or sticking point first."] };
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const context = useManuscript ? await getManuscriptText(manuscriptId) : null;

  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const fn = provider === "openai" ? brainstormOpenAI : brainstormClaude;
        const res = await fn(scene, context);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return { provider, res: null, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const errors: string[] = [];
  const rows = results
    .filter((r) => {
      if (r.error) errors.push(`${PROVIDER_LABEL[r.provider]} failed: ${r.error}`);
      return r.res !== null;
    })
    .map((r) => ({
      manuscript_id: manuscriptId,
      prompt: scene,
      provider: r.provider,
      model: r.res!.model,
      content: r.res!.content,
      selected: false,
    }));

  if (rows.length > 0) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("brainstorms").insert(rows);
    if (error) errors.push(`Saving ideas failed: ${error.message}`);
  }

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

export async function toggleBrainstormSelected(
  id: string,
  manuscriptId: string,
  selected: boolean,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("brainstorms").update({ selected }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}

export async function deleteBrainstorm(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("brainstorms").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
