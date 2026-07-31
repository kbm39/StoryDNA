import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { AUTHOR_INTENT_CONTRACT_VERSION } from "./contract.ts";
import type {
  AuthorIntentDraftInput,
  AuthorIntentRecord,
  ResolvedAuthorIntent,
} from "./types.ts";
import { validateAuthorIntentDraft } from "./validation.ts";

type DbRow = {
  id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  contract_version: string;
  intent_type: string;
  custom_objective_text: string | null;
  author_success_definition: string;
  requested_experts: string[];
  declined_experts: string[];
  priority_domains: string[];
  budget_preference: string | null;
  time_preference: string | null;
  status: string;
  created_by: string;
  superseded_by_id: string | null;
  supersedes_intent_id: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): AuthorIntentRecord {
  return Object.freeze({
    id: row.id,
    manuscript_id: row.manuscript_id,
    manuscript_version_id: row.manuscript_version_id,
    contract_version: AUTHOR_INTENT_CONTRACT_VERSION,
    intent_type: row.intent_type as AuthorIntentRecord["intent_type"],
    custom_objective_text: row.custom_objective_text,
    author_success_definition: row.author_success_definition,
    requested_experts: Object.freeze([...row.requested_experts]),
    declined_experts: Object.freeze([...row.declined_experts]),
    priority_domains: Object.freeze([...row.priority_domains]) as AuthorIntentRecord["priority_domains"],
    budget_preference: row.budget_preference,
    time_preference: row.time_preference,
    status: row.status as AuthorIntentRecord["status"],
    created_by: row.created_by,
    superseded_by_id: row.superseded_by_id,
    supersedes_intent_id: row.supersedes_intent_id,
    activated_at: row.activated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function tableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("author_intent_records").select("id").limit(1);
  if (!error) return true;
  const message = error.message.toLowerCase();
  return !message.includes("does not exist") && !message.includes("could not find");
}

export async function createAuthorIntentDraft(
  input: AuthorIntentDraftInput,
): Promise<{ ok: true; record: AuthorIntentRecord } | { ok: false; error: string }> {
  const validation = validateAuthorIntentDraft(input);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.map((e) => e.message).join("; ") };
  }

  if (!(await tableExists())) {
    return { ok: false, error: "Author Intent persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("author_intent_records")
    .insert({
      manuscript_id: input.manuscript_id,
      manuscript_version_id: input.manuscript_version_id,
      contract_version: AUTHOR_INTENT_CONTRACT_VERSION,
      intent_type: input.intent_type,
      custom_objective_text: input.custom_objective_text ?? null,
      author_success_definition: input.author_success_definition,
      requested_experts: [...(input.requested_experts ?? [])],
      declined_experts: [...(input.declined_experts ?? [])],
      priority_domains: [...(input.priority_domains ?? [])],
      budget_preference: input.budget_preference ?? null,
      time_preference: input.time_preference ?? null,
      status: "draft",
      created_by: input.created_by,
      supersedes_intent_id: input.supersedes_intent_id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create draft intent" };
  }

  return { ok: true, record: mapRow(data as DbRow) };
}

export async function activateAuthorIntent(input: {
  intentId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<{ ok: true; record: AuthorIntentRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Author Intent persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();

  const { data: draft, error: fetchError } = await supabase
    .from("author_intent_records")
    .select("*")
    .eq("id", input.intentId)
    .eq("manuscript_id", input.manuscriptId)
    .single();

  if (fetchError || !draft) {
    return { ok: false, error: "Intent record not found" };
  }

  const record = mapRow(draft as DbRow);
  if (record.status !== "draft") {
    return { ok: false, error: `Cannot activate intent with status: ${record.status}` };
  }

  if (record.manuscript_version_id !== input.manuscriptVersionId) {
    return { ok: false, error: "Manuscript version mismatch" };
  }

  if (record.created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation — only the creator may activate" };
  }

  const validation = validateAuthorIntentDraft({
    manuscript_id: record.manuscript_id,
    manuscript_version_id: record.manuscript_version_id,
    intent_type: record.intent_type,
    custom_objective_text: record.custom_objective_text,
    author_success_definition: record.author_success_definition,
    requested_experts: record.requested_experts,
    declined_experts: record.declined_experts,
    priority_domains: record.priority_domains,
    created_by: record.created_by,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.errors.map((e) => e.message).join("; ") };
  }

  const { data: existingActive } = await supabase
    .from("author_intent_records")
    .select("id")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("status", "active")
    .maybeSingle();

  if (existingActive) {
    return {
      ok: false,
      error: "An active intent already exists for this manuscript version. Supersede it first.",
    };
  }

  const now = new Date().toISOString();
  const { data: activated, error: activateError } = await supabase
    .from("author_intent_records")
    .update({ status: "active", activated_at: now })
    .eq("id", input.intentId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (activateError || !activated) {
    return { ok: false, error: activateError?.message ?? "Failed to activate intent" };
  }

  return { ok: true, record: mapRow(activated as DbRow) };
}

export async function getActiveAuthorIntent(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
}): Promise<AuthorIntentRecord | null> {
  if (!(await tableExists())) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("author_intent_records")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("status", "active")
    .maybeSingle();

  return data ? mapRow(data as DbRow) : null;
}

export async function listAuthorIntentHistory(
  manuscriptId: string,
): Promise<readonly AuthorIntentRecord[]> {
  if (!(await tableExists())) return [];

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("author_intent_records")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => mapRow(row as DbRow));
}

export async function supersedeAuthorIntent(input: {
  currentIntentId: string;
  newDraft: AuthorIntentDraftInput;
}): Promise<{ ok: true; record: AuthorIntentRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Author Intent persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: current } = await supabase
    .from("author_intent_records")
    .select("*")
    .eq("id", input.currentIntentId)
    .eq("status", "active")
    .single();

  if (!current) {
    return { ok: false, error: "No active intent to supersede" };
  }

  const currentRecord = mapRow(current as DbRow);
  if (currentRecord.created_by !== input.newDraft.created_by) {
    return { ok: false, error: "Author ownership violation — only the creator may supersede" };
  }

  const draftResult = await createAuthorIntentDraft({
    ...input.newDraft,
    supersedes_intent_id: input.currentIntentId,
  });
  if (!draftResult.ok) return draftResult;

  const activateResult = await activateAuthorIntent({
    intentId: draftResult.record.id,
    manuscriptId: input.newDraft.manuscript_id,
    manuscriptVersionId: input.newDraft.manuscript_version_id,
    createdBy: input.newDraft.created_by,
  });
  if (!activateResult.ok) return activateResult;

  await supabase
    .from("author_intent_records")
    .update({
      status: "superseded",
      superseded_by_id: activateResult.record.id,
    })
    .eq("id", input.currentIntentId)
    .eq("status", "active");

  return activateResult;
}

export async function cancelAuthorIntentDraft(input: {
  intentId: string;
  manuscriptId: string;
  createdBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Author Intent persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: draft } = await supabase
    .from("author_intent_records")
    .select("*")
    .eq("id", input.intentId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "draft")
    .single();

  if (!draft) {
    return { ok: false, error: "Draft intent not found" };
  }

  if ((draft as DbRow).created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation" };
  }

  const { error } = await supabase
    .from("author_intent_records")
    .update({ status: "cancelled" })
    .eq("id", input.intentId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveAuthorIntentForPlanning(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
}): Promise<ResolvedAuthorIntent | null> {
  const record = await getActiveAuthorIntent(input);
  if (!record) return null;

  const validation = validateAuthorIntentDraft({
    manuscript_id: record.manuscript_id,
    manuscript_version_id: record.manuscript_version_id,
    intent_type: record.intent_type,
    custom_objective_text: record.custom_objective_text,
    author_success_definition: record.author_success_definition,
    requested_experts: record.requested_experts,
    declined_experts: record.declined_experts,
    priority_domains: record.priority_domains,
    created_by: record.created_by,
  });

  return Object.freeze({
    record,
    isValidForPlanning: validation.ok && record.status === "active",
  });
}

export { validateAuthorIntentDraft };
