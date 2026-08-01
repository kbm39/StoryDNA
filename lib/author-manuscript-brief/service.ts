import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { MANUSCRIPT_BRIEF_CONTRACT_VERSION } from "./contract.ts";
import { emitManuscriptBriefEvent } from "./observability.ts";
import type {
  ManuscriptBriefDraftInput,
  ManuscriptBriefRecord,
} from "./types.ts";
import {
  normalizeMarketPosition,
  validateManuscriptBriefDraft,
  validateManuscriptBriefSubmit,
} from "./validation.ts";

type DbRow = {
  id: string;
  book_id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  contract_version: string;
  elevator_pitch: string;
  author_motivation: string;
  desired_reader_experience: string | null;
  market_position: string;
  comparison_titles: string | null;
  success_definition: string | null;
  status: string;
  created_by: string;
  submitted_at: string | null;
  supersedes_brief_id: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): ManuscriptBriefRecord {
  return Object.freeze({
    brief_id: row.id,
    book_id: row.book_id,
    manuscript_id: row.manuscript_id,
    manuscript_version_id: row.manuscript_version_id,
    contract_version: MANUSCRIPT_BRIEF_CONTRACT_VERSION,
    elevator_pitch: row.elevator_pitch,
    author_motivation: row.author_motivation,
    desired_reader_experience: row.desired_reader_experience,
    market_position: row.market_position,
    comparison_titles: row.comparison_titles,
    success_definition: row.success_definition,
    status: row.status as ManuscriptBriefRecord["status"],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at,
    supersedes_brief_id: row.supersedes_brief_id,
    superseded_at: row.superseded_at,
  });
}

async function tableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("author_manuscript_briefs").select("id").limit(1);
  if (!error) return true;
  const message = error.message.toLowerCase();
  return !message.includes("does not exist") && !message.includes("could not find");
}

function draftFields(input: ManuscriptBriefDraftInput) {
  return {
    book_id: input.book_id,
    manuscript_id: input.manuscript_id,
    manuscript_version_id: input.manuscript_version_id,
    contract_version: MANUSCRIPT_BRIEF_CONTRACT_VERSION,
    elevator_pitch: input.elevator_pitch?.trim() ?? "",
    author_motivation: input.author_motivation?.trim() ?? "",
    desired_reader_experience: input.desired_reader_experience?.trim() || null,
    market_position: normalizeMarketPosition(input.market_position),
    comparison_titles: input.comparison_titles?.trim() || null,
    success_definition: input.success_definition?.trim() || null,
    created_by: input.created_by,
    supersedes_brief_id: input.supersedes_brief_id ?? null,
  };
}

export async function createManuscriptBriefDraft(
  input: ManuscriptBriefDraftInput,
): Promise<{ ok: true; record: ManuscriptBriefRecord } | { ok: false; error: string }> {
  const validation = validateManuscriptBriefDraft(input);
  if (!validation.ok) {
    return { ok: false, error: validation.errors.map((e) => e.message).join("; ") };
  }
  if (!(await tableExists())) {
    return { ok: false, error: "Manuscript brief persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: existingDraft } = await supabase
    .from("author_manuscript_briefs")
    .select("id")
    .eq("manuscript_id", input.manuscript_id)
    .eq("manuscript_version_id", input.manuscript_version_id)
    .eq("created_by", input.created_by)
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft) {
    return updateManuscriptBriefDraft({
      briefId: existingDraft.id as string,
      manuscriptId: input.manuscript_id,
      manuscriptVersionId: input.manuscript_version_id,
      createdBy: input.created_by,
      ...input,
    });
  }

  const { data, error } = await supabase
    .from("author_manuscript_briefs")
    .insert({ ...draftFields(input), status: "draft" })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create draft brief" };
  }

  const record = mapRow(data as DbRow);
  emitManuscriptBriefEvent({
    event: "manuscript_brief_draft_created",
    brief_id: record.brief_id,
    manuscript_id: record.manuscript_id,
    manuscript_version_id: record.manuscript_version_id,
    status: record.status,
  });
  return { ok: true, record };
}

export async function updateManuscriptBriefDraft(input: {
  briefId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
  elevator_pitch?: string;
  author_motivation?: string;
  desired_reader_experience?: string | null;
  market_position?: string;
  comparison_titles?: string | null;
  success_definition?: string | null;
}): Promise<{ ok: true; record: ManuscriptBriefRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Manuscript brief persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("id", input.briefId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "draft")
    .single();

  if (!row) return { ok: false, error: "Draft brief not found" };
  const current = mapRow(row as DbRow);
  if (current.created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation" };
  }
  if (current.manuscript_version_id !== input.manuscriptVersionId) {
    return { ok: false, error: "Manuscript version mismatch" };
  }

  const updates = {
    elevator_pitch: input.elevator_pitch?.trim() ?? current.elevator_pitch,
    author_motivation: input.author_motivation?.trim() ?? current.author_motivation,
    desired_reader_experience:
      input.desired_reader_experience !== undefined
        ? input.desired_reader_experience?.trim() || null
        : current.desired_reader_experience,
    market_position:
      input.market_position !== undefined
        ? normalizeMarketPosition(input.market_position)
        : current.market_position,
    comparison_titles:
      input.comparison_titles !== undefined
        ? input.comparison_titles?.trim() || null
        : current.comparison_titles,
    success_definition:
      input.success_definition !== undefined
        ? input.success_definition?.trim() || null
        : current.success_definition,
  };

  const { data, error } = await supabase
    .from("author_manuscript_briefs")
    .update(updates)
    .eq("id", input.briefId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save draft" };
  }

  const record = mapRow(data as DbRow);
  emitManuscriptBriefEvent({
    event: "manuscript_brief_draft_saved",
    brief_id: record.brief_id,
    manuscript_id: record.manuscript_id,
    manuscript_version_id: record.manuscript_version_id,
    status: record.status,
  });
  return { ok: true, record };
}

export async function getCurrentManuscriptBrief(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<ManuscriptBriefRecord | null> {
  if (!(await tableExists())) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("created_by", input.createdBy)
    .eq("status", "draft")
    .maybeSingle();
  return data ? mapRow(data as DbRow) : null;
}

export async function getSubmittedManuscriptBrief(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
}): Promise<ManuscriptBriefRecord | null> {
  if (!(await tableExists())) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("status", "submitted")
    .maybeSingle();
  return data ? mapRow(data as DbRow) : null;
}

export async function listManuscriptBriefHistory(
  manuscriptId: string,
): Promise<readonly ManuscriptBriefRecord[]> {
  if (!(await tableExists())) return [];
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => mapRow(row as DbRow));
}

export async function submitManuscriptBrief(input: {
  briefId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<{ ok: true; record: ManuscriptBriefRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Manuscript brief persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: draft } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("id", input.briefId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "draft")
    .single();

  if (!draft) return { ok: false, error: "Draft brief not found" };
  const record = mapRow(draft as DbRow);
  if (record.created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation" };
  }
  if (record.manuscript_version_id !== input.manuscriptVersionId) {
    return { ok: false, error: "Manuscript version mismatch" };
  }

  const submitValidation = validateManuscriptBriefSubmit({
    elevator_pitch: record.elevator_pitch,
    author_motivation: record.author_motivation,
    desired_reader_experience: record.desired_reader_experience,
    market_position: record.market_position,
    comparison_titles: record.comparison_titles,
    success_definition: record.success_definition,
  });
  if (!submitValidation.ok) {
    return { ok: false, error: submitValidation.errors.map((e) => e.message).join("; ") };
  }

  const { data: existingSubmitted } = await supabase
    .from("author_manuscript_briefs")
    .select("id")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .eq("status", "submitted")
    .maybeSingle();

  if (existingSubmitted) {
    return {
      ok: false,
      error: "A submitted brief already exists for this version. Supersede it first.",
    };
  }

  const now = new Date().toISOString();
  const { data: submitted, error } = await supabase
    .from("author_manuscript_briefs")
    .update({ status: "submitted", submitted_at: now })
    .eq("id", input.briefId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error || !submitted) {
    return { ok: false, error: error?.message ?? "Failed to submit brief" };
  }

  const submittedRecord = mapRow(submitted as DbRow);
  emitManuscriptBriefEvent({
    event: "manuscript_brief_submitted",
    brief_id: submittedRecord.brief_id,
    manuscript_id: submittedRecord.manuscript_id,
    manuscript_version_id: submittedRecord.manuscript_version_id,
    status: submittedRecord.status,
  });
  return { ok: true, record: submittedRecord };
}

export async function supersedeSubmittedBrief(input: {
  submittedBriefId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  createdBy: string;
}): Promise<{ ok: true; draft: ManuscriptBriefRecord } | { ok: false; error: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Manuscript brief persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: submitted } = await supabase
    .from("author_manuscript_briefs")
    .select("*")
    .eq("id", input.submittedBriefId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "submitted")
    .single();

  if (!submitted) return { ok: false, error: "Submitted brief not found" };
  const prior = mapRow(submitted as DbRow);
  if (prior.created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation" };
  }

  const now = new Date().toISOString();
  const draftResult = await createManuscriptBriefDraft({
    book_id: prior.book_id,
    manuscript_id: prior.manuscript_id,
    manuscript_version_id: input.manuscriptVersionId,
    elevator_pitch: prior.elevator_pitch,
    author_motivation: prior.author_motivation,
    desired_reader_experience: prior.desired_reader_experience,
    comparison_titles: prior.comparison_titles,
    market_position: prior.market_position,
    success_definition: prior.success_definition,
    created_by: input.createdBy,
    supersedes_brief_id: prior.brief_id,
  });

  if (!draftResult.ok) return draftResult;

  await supabase
    .from("author_manuscript_briefs")
    .update({ status: "superseded", superseded_at: now })
    .eq("id", input.submittedBriefId)
    .eq("status", "submitted");

  emitManuscriptBriefEvent({
    event: "manuscript_brief_superseded",
    brief_id: prior.brief_id,
    manuscript_id: prior.manuscript_id,
    manuscript_version_id: prior.manuscript_version_id,
    status: "superseded",
  });

  return { ok: true, draft: draftResult.record };
}

export async function cancelManuscriptBriefDraft(input: {
  briefId: string;
  manuscriptId: string;
  createdBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await tableExists())) {
    return { ok: false, error: "Manuscript brief persistence is not available (migration not applied)" };
  }

  const supabase = getSupabaseAdmin();
  const { data: draft } = await supabase
    .from("author_manuscript_briefs")
    .select("created_by")
    .eq("id", input.briefId)
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "draft")
    .single();

  if (!draft) return { ok: false, error: "Draft brief not found" };
  if ((draft as DbRow).created_by !== input.createdBy) {
    return { ok: false, error: "Author ownership violation" };
  }

  const { error } = await supabase
    .from("author_manuscript_briefs")
    .update({ status: "cancelled" })
    .eq("id", input.briefId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  emitManuscriptBriefEvent({
    event: "manuscript_brief_cancelled",
    brief_id: input.briefId,
    manuscript_id: input.manuscriptId,
    status: "cancelled",
  });
  return { ok: true };
}

export {
  validateManuscriptBriefDraft,
  validateManuscriptBriefSubmit,
  briefIsManuscriptEvidence,
} from "./validation.ts";
