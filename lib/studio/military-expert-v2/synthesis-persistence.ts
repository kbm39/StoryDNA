/**
 * Phase 2B synthesis persistence — CRUD with idempotent upserts.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  hashMilitaryExpertV2SynthesisDocument,
  parseMilitaryExpertV2SynthesisDocument,
  type MilitaryExpertV2SynthesisDocument,
} from "./synthesis-contract.ts";
import type { SynthesisRepairAttempt } from "./synthesis-repair.ts";

export interface PersistedSynthesisRow {
  readonly synthesisId: string;
  readonly inventoryId: string;
  readonly selectionSnapshotId: string;
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly workflowId: string | null;
  readonly phase2aWorkflowId: string | null;
  readonly status: "queued" | "running" | "complete" | "failed";
  readonly parsedHash: string | null;
  readonly errorCode: string | null;
  readonly safeErrorMessage: string | null;
  readonly repairCount: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly document: MilitaryExpertV2SynthesisDocument | null;
}

export function newSynthesisRowId(snapshotId: string): string {
  const slug = snapshotId.replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  return `syn_${slug}_${randomUUID().slice(0, 8)}`;
}

function rowToPersisted(raw: Record<string, unknown>): PersistedSynthesisRow {
  const content = raw.synthesis_content;
  const doc =
    content && typeof content === "object"
      ? parseMilitaryExpertV2SynthesisDocument(content)
      : null;

  return Object.freeze({
    synthesisId: String(raw.synthesis_id),
    inventoryId: String(raw.inventory_id),
    selectionSnapshotId: String(raw.selection_snapshot_id),
    manuscriptId: String(raw.manuscript_id),
    manuscriptVersionId: String(raw.manuscript_version_id),
    workflowId: raw.workflow_id ? String(raw.workflow_id) : null,
    phase2aWorkflowId: raw.phase2a_workflow_id ? String(raw.phase2a_workflow_id) : null,
    status: raw.status as PersistedSynthesisRow["status"],
    parsedHash: raw.parsed_hash ? String(raw.parsed_hash) : null,
    errorCode: raw.error_code ? String(raw.error_code) : null,
    safeErrorMessage: raw.safe_error_message ? String(raw.safe_error_message) : null,
    repairCount: Number(raw.repair_count ?? 0),
    createdAt: String(raw.created_at),
    completedAt: raw.completed_at ? String(raw.completed_at) : null,
    document: doc,
  });
}

export async function loadSynthesisForSnapshot(
  selectionSnapshotId: string,
): Promise<PersistedSynthesisRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .select("*")
    .eq("selection_snapshot_id", selectionSnapshotId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPersisted(data) : null;
}

export async function getOrCreateSynthesisRow(args: {
  selectionSnapshotId: string;
  inventoryId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  workflowId: string;
  phase2aWorkflowId: string;
}): Promise<PersistedSynthesisRow> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .select("*")
    .eq("selection_snapshot_id", args.selectionSnapshotId)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return rowToPersisted(existing);

  const synthesisId = newSynthesisRowId(args.selectionSnapshotId);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .insert({
      synthesis_id: synthesisId,
      inventory_id: args.inventoryId,
      selection_snapshot_id: args.selectionSnapshotId,
      manuscript_id: args.manuscriptId,
      manuscript_version_id: args.manuscriptVersionId,
      workflow_id: args.workflowId,
      phase2a_workflow_id: args.phase2aWorkflowId,
      status: "queued",
      repair_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    const { data: raced } = await supabase
      .from("studio_military_expert_v2_syntheses")
      .select("*")
      .eq("selection_snapshot_id", args.selectionSnapshotId)
      .neq("status", "failed")
      .maybeSingle();
    if (raced) return rowToPersisted(raced);
    throw new Error(error.message);
  }

  return rowToPersisted(data);
}

export async function markSynthesisRunning(synthesisId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("synthesis_id", synthesisId)
    .in("status", ["queued", "failed"]);
  if (error) throw new Error(error.message);
}

export async function persistCompletedSynthesis(args: {
  document: MilitaryExpertV2SynthesisDocument;
  providerMetadata: Record<string, unknown>;
  costMetadata: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const hash = hashMilitaryExpertV2SynthesisDocument(args.document);
  const completedDoc = Object.freeze({ ...args.document, parsed_hash: hash });

  const { error } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .update({
      status: "complete",
      synthesis_content: completedDoc,
      provider_metadata: args.providerMetadata,
      cost_metadata: args.costMetadata,
      parsed_hash: hash,
      completed_at: completedDoc.completed_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("synthesis_id", completedDoc.synthesis_id);
  if (error) throw new Error(error.message);
}

export async function persistFailedSynthesis(args: {
  synthesisId: string;
  errorCode: string;
  safeErrorMessage: string;
  repairCount?: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_military_expert_v2_syntheses")
    .update({
      status: "failed",
      error_code: args.errorCode,
      safe_error_message: args.safeErrorMessage,
      repair_count: args.repairCount ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("synthesis_id", args.synthesisId);
  if (error) throw new Error(error.message);
}

export async function persistSynthesisRepairAttempt(args: {
  synthesisId: string;
  attempt: SynthesisRepairAttempt;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_military_expert_v2_synthesis_repairs").insert({
    synthesis_id: args.synthesisId,
    attempt_number: args.attempt.attemptNumber,
    repair_reason: args.attempt.repairReason,
    repair_cost_usd: args.attempt.repairCostUsd,
    repaired_fields: [...args.attempt.repairedFields],
    final_disposition: args.attempt.finalDisposition,
  });
  if (error) throw new Error(error.message);
}

export async function hasCompleteSynthesisForSnapshot(
  selectionSnapshotId: string,
): Promise<boolean> {
  const row = await loadSynthesisForSnapshot(selectionSnapshotId);
  return row !== null && row.document !== null;
}
