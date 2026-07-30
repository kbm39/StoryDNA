/**
 * Phase 2A scene review persistence — CRUD with idempotent upserts.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  hashMilitaryExpertSceneReviewDocument,
  parseMilitaryExpertSceneReviewDocument,
  type MilitaryExpertSceneReviewDocument,
  type MilitaryExpertSceneReviewStatus,
} from "./scene-review-contract.ts";
import type { SceneReviewRepairAttempt } from "./scene-review-repair.ts";

export interface PersistedSceneReviewRow {
  readonly sceneReviewId: string;
  readonly inventoryId: string;
  readonly selectionSnapshotId: string;
  readonly sceneId: string;
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly workflowId: string | null;
  readonly reviewStatus: MilitaryExpertSceneReviewStatus;
  readonly retryCount: number;
  readonly repairCount: number;
  readonly parsedReviewHash: string | null;
  readonly errorCode: string | null;
  readonly safeErrorMessage: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly document: MilitaryExpertSceneReviewDocument | null;
}

export function newSceneReviewRowId(sceneId: string): string {
  return `sr_${sceneId.replace(/[^A-Za-z0-9-]/g, "").toLowerCase()}_${randomUUID().slice(0, 8)}`;
}

export async function getOrCreateSceneReviewRow(args: {
  selectionSnapshotId: string;
  inventoryId: string;
  sceneId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  workflowId: string;
}): Promise<PersistedSceneReviewRow> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("studio_military_expert_scene_reviews")
    .select("*")
    .eq("selection_snapshot_id", args.selectionSnapshotId)
    .eq("scene_id", args.sceneId)
    .maybeSingle();

  if (existing) {
    return rowToPersisted(existing);
  }

  const sceneReviewId = newSceneReviewRowId(args.sceneId);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .insert({
      scene_review_id: sceneReviewId,
      inventory_id: args.inventoryId,
      selection_snapshot_id: args.selectionSnapshotId,
      scene_id: args.sceneId,
      manuscript_id: args.manuscriptId,
      manuscript_version_id: args.manuscriptVersionId,
      workflow_id: args.workflowId,
      review_status: "queued",
      retry_count: 0,
      repair_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    const { data: raced } = await supabase
      .from("studio_military_expert_scene_reviews")
      .select("*")
      .eq("selection_snapshot_id", args.selectionSnapshotId)
      .eq("scene_id", args.sceneId)
      .maybeSingle();
    if (raced) return rowToPersisted(raced);
    throw new Error(error.message);
  }

  return rowToPersisted(data);
}

export async function markSceneReviewRunning(sceneReviewId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .update({ review_status: "running", updated_at: new Date().toISOString() })
    .eq("scene_review_id", sceneReviewId)
    .in("review_status", ["queued", "failed"]);
  if (error) throw new Error(error.message);
}

export async function persistCompletedSceneReview(args: {
  document: MilitaryExpertSceneReviewDocument;
  providerMetadata: Record<string, unknown>;
  costMetadata: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  const doc = args.document;
  const hash = hashMilitaryExpertSceneReviewDocument(doc);
  const completedDoc = Object.freeze({ ...doc, parsed_review_hash: hash });

  const { error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .update({
      review_status: doc.review_status,
      review_content: completedDoc,
      provider_metadata: args.providerMetadata,
      cost_metadata: args.costMetadata,
      retry_count: doc.retry_count,
      repair_count: doc.repair_count,
      parsed_review_hash: hash,
      error_code: null,
      safe_error_message: null,
      completed_at: doc.completed_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("scene_review_id", doc.scene_review_id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function persistFailedSceneReview(args: {
  sceneReviewId: string;
  errorCode: string;
  safeErrorMessage: string;
  retryCount: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .update({
      review_status: "failed",
      error_code: args.errorCode,
      safe_error_message: args.safeErrorMessage,
      retry_count: args.retryCount,
      updated_at: new Date().toISOString(),
    })
    .eq("scene_review_id", args.sceneReviewId);
  if (error) throw new Error(error.message);
}

export async function persistSceneReviewRepairAttempt(args: {
  sceneReviewId: string;
  attempt: SceneReviewRepairAttempt;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_military_expert_scene_review_repairs").upsert(
    {
      scene_review_id: args.sceneReviewId,
      attempt_number: args.attempt.attemptNumber,
      repair_reason: args.attempt.repairReason,
      repair_cost_usd: args.attempt.repairCostUsd,
      repaired_fields: [...args.attempt.repairedFields],
      final_disposition: args.attempt.finalDisposition,
    },
    { onConflict: "scene_review_id,attempt_number" },
  );
  if (error) throw new Error(error.message);
}

export async function loadSceneReviewsForSnapshot(
  selectionSnapshotId: string,
): Promise<PersistedSceneReviewRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .select("*")
    .eq("selection_snapshot_id", selectionSnapshotId)
    .order("scene_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPersisted);
}

export async function loadSceneReviewById(
  sceneReviewId: string,
): Promise<PersistedSceneReviewRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_scene_reviews")
    .select("*")
    .eq("scene_review_id", sceneReviewId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToPersisted(data);
}

function rowToPersisted(row: Record<string, unknown>): PersistedSceneReviewRow {
  const doc = row.review_content
    ? parseMilitaryExpertSceneReviewDocument(row.review_content)
    : null;
  return Object.freeze({
    sceneReviewId: String(row.scene_review_id),
    inventoryId: String(row.inventory_id),
    selectionSnapshotId: String(row.selection_snapshot_id),
    sceneId: String(row.scene_id),
    manuscriptId: String(row.manuscript_id),
    manuscriptVersionId: String(row.manuscript_version_id),
    workflowId: row.workflow_id ? String(row.workflow_id) : null,
    reviewStatus: row.review_status as MilitaryExpertSceneReviewStatus,
    retryCount: Number(row.retry_count ?? 0),
    repairCount: Number(row.repair_count ?? 0),
    parsedReviewHash: row.parsed_review_hash ? String(row.parsed_review_hash) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    safeErrorMessage: row.safe_error_message ? String(row.safe_error_message) : null,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    document: doc,
  });
}

export function isTerminalSceneReviewStatus(status: MilitaryExpertSceneReviewStatus): boolean {
  return (
    status === "complete" ||
    status === "insufficient_evidence" ||
    status === "outside_expertise" ||
    status === "failed"
  );
}

export function isSuccessfulTerminalSceneReviewStatus(
  status: MilitaryExpertSceneReviewStatus,
): boolean {
  return (
    status === "complete" ||
    status === "insufficient_evidence" ||
    status === "outside_expertise"
  );
}
