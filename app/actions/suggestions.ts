"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptText } from "@/lib/reviews";
import { suggestFix as suggestOpenAI } from "@/lib/ai/openai";
import { suggestFix as suggestClaude } from "@/lib/ai/anthropic";
import type { Provider } from "@/lib/types";

export interface RequestSuggestionsResult {
  ok: boolean;
  errors?: string[];
}

const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

/** Request fix suggestions for one issue from the chosen provider(s). */
export async function requestSuggestions(
  issueId: string,
  manuscriptId: string,
  providers: Provider[],
): Promise<RequestSuggestionsResult> {
  if (providers.length === 0) return { ok: false, errors: ["Pick at least one model."] };

  const supabase = getSupabaseAdmin();
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select("id, title, description")
    .eq("id", issueId)
    .maybeSingle();
  if (issueError) return { ok: false, errors: [issueError.message] };
  if (!issue) return { ok: false, errors: ["Issue not found."] };

  const text = await getManuscriptText(manuscriptId);
  if (!text || !text.trim()) {
    return { ok: false, errors: ["Manuscript has no text to work from."] };
  }

  // Wrap each provider so one failing never rejects the batch.
  const results = await Promise.all(
    providers.map(async (provider) => {
      try {
        const fn = provider === "openai" ? suggestOpenAI : suggestClaude;
        const res = await fn(issue.title, issue.description, text);
        return { provider, res, error: null as string | null };
      } catch (e) {
        return {
          provider,
          res: null,
          error: e instanceof Error ? e.message : String(e),
        };
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
      issue_id: issueId,
      provider: r.provider,
      model: r.res!.model,
      content: r.res!.content,
      applied: false,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("suggestions").insert(rows);
    if (error) errors.push(`Saving suggestions failed: ${error.message}`);
  }

  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
}

export async function deleteSuggestion(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
