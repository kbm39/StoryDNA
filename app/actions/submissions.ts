"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getAgent } from "@/lib/agentfinder";
import type { SubmissionStatus } from "@/lib/types";

export interface SubmissionActionResult {
  ok: boolean;
  error?: string;
}

/** Add a submission row for a manuscript, pulling agent details from PKagentfinder. */
export async function addSubmission(
  manuscriptId: string,
  agentId: string,
  queriedOn: string | null,
): Promise<SubmissionActionResult> {
  if (!manuscriptId || !agentId) return { ok: false, error: "Pick an agent." };
  let agent;
  try {
    agent = await getAgent(agentId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!agent) return { ok: false, error: "Agent not found in PKagentfinder." };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("agent_submissions").insert({
    manuscript_id: manuscriptId,
    agent_id: agent.id,
    agent_name: agent.name,
    agency: agent.agency,
    status: "querying",
    queried_on: queriedOn || null,
  });
  if (error) return { ok: false, error: `Couldn't add the submission: ${error.message}` };
  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function updateSubmission(
  id: string,
  manuscriptId: string,
  fields: {
    status?: SubmissionStatus;
    queried_on?: string | null;
    responded_on?: string | null;
    notes?: string | null;
  },
): Promise<SubmissionActionResult> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("agent_submissions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/manuscripts/${manuscriptId}`);
  return { ok: true };
}

export async function deleteSubmission(id: string, manuscriptId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("agent_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/manuscripts/${manuscriptId}`);
}
