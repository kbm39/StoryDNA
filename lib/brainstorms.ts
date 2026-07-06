import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Brainstorm } from "@/lib/types";

/** Brainstorms for a manuscript, newest first. */
export async function listBrainstorms(manuscriptId: string): Promise<Brainstorm[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("brainstorms")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Brainstorm[];
}

/** Group brainstorms into rounds by prompt, newest round first. */
export function groupByPrompt(items: Brainstorm[]): { prompt: string; items: Brainstorm[] }[] {
  const order: string[] = [];
  const map = new Map<string, Brainstorm[]>();
  for (const b of items) {
    if (!map.has(b.prompt)) {
      map.set(b.prompt, []);
      order.push(b.prompt);
    }
    map.get(b.prompt)!.push(b);
  }
  // openai left, anthropic right within each round
  return order.map((prompt) => ({
    prompt,
    items: map.get(prompt)!.sort((a, b) => (a.provider < b.provider ? -1 : 1)),
  }));
}
