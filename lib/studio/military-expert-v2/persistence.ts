import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  MilitaryExpertSceneInventoryDocument,
  MilitaryExpertSceneInventoryEntry,
  MilitaryExpertSceneSelectionEntry,
  MilitaryExpertSelectionSnapshot,
} from "./contracts.ts";
import {
  parseMilitaryExpertSceneInventoryDocument,
  parseMilitaryExpertSelectionSnapshot,
} from "./contracts.ts";
import { buildInitialSelections } from "./selection-policy.ts";
import { estimateSceneReviewCost } from "./estimator.ts";

export interface PersistedInventoryRow {
  readonly inventoryId: string;
  readonly manuscriptId: string;
  readonly manuscriptVersionId: string;
  readonly workflowId: string | null;
  readonly inventoryStatus: string;
  readonly mode: "author" | "certification";
  readonly sceneCount: number;
  readonly majorSceneCount: number;
  readonly contentHash: string;
  readonly generatedAt: string;
}

function entryToDb(entry: MilitaryExpertSceneInventoryEntry): Record<string, unknown> {
  return {
    inventory_id: entry.inventory_id,
    scene_id: entry.scene_id,
    scene_index: entry.scene_index,
    locator: entry.locator,
    two_sentence_description: entry.two_sentence_description,
    scene_types: [...entry.scene_types],
    action_categories: [...entry.action_categories],
    participants: [...entry.participants],
    priority_tier: entry.priority_tier,
    discovery_confidence: entry.discovery_confidence,
    discovery_source: entry.discovery_source,
    default_selected: entry.default_selected,
    selection_warning_codes: [...entry.selection_warning_codes],
    source_hash: entry.source_hash,
  };
}

function selectionToDb(sel: MilitaryExpertSceneSelectionEntry): Record<string, unknown> {
  return {
    inventory_id: sel.inventory_id,
    scene_id: sel.scene_id,
    is_selected: sel.is_selected,
    selection_source: sel.selection_source,
    selected_at: sel.selected_at,
    warning_acknowledged: sel.warning_acknowledged,
    estimated_input_tokens: sel.estimated_input_tokens,
    estimated_output_tokens: sel.estimated_output_tokens,
    estimated_cost_usd: sel.estimated_cost_usd,
    estimated_runtime_seconds: sel.estimated_runtime_seconds,
  };
}

function rowToEntry(
  row: Record<string, unknown>,
  manuscriptId: string,
  manuscriptVersionId: string,
): MilitaryExpertSceneInventoryEntry {
  return Object.freeze({
    inventory_id: String(row.inventory_id),
    scene_id: String(row.scene_id),
    manuscript_id: manuscriptId,
    manuscript_version_id: manuscriptVersionId,
    scene_index: Number(row.scene_index),
    locator: row.locator as MilitaryExpertSceneInventoryEntry["locator"],
    two_sentence_description: String(row.two_sentence_description),
    scene_types: Object.freeze(row.scene_types as MilitaryExpertSceneInventoryEntry["scene_types"]),
    action_categories: Object.freeze(
      row.action_categories as MilitaryExpertSceneInventoryEntry["action_categories"],
    ),
    participants: Object.freeze((row.participants as string[]) ?? []),
    priority_tier: row.priority_tier as MilitaryExpertSceneInventoryEntry["priority_tier"],
    discovery_confidence: Number(row.discovery_confidence),
    discovery_source: row.discovery_source as MilitaryExpertSceneInventoryEntry["discovery_source"],
    default_selected: Boolean(row.default_selected),
    selection_warning_codes: Object.freeze(
      (row.selection_warning_codes as MilitaryExpertSceneInventoryEntry["selection_warning_codes"]) ??
        [],
    ),
    source_hash: String(row.source_hash),
  });
}

export async function persistMilitaryExpertInventory(args: {
  document: MilitaryExpertSceneInventoryDocument;
  contentHash: string;
  inventoryStatus?: "draft" | "ready_for_selection";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  const doc = args.document;
  const status = args.inventoryStatus ?? doc.inventory_status;

  const { error: invError } = await supabase.from("studio_military_expert_scene_inventories").upsert(
    {
      inventory_id: doc.inventory_id,
      manuscript_id: doc.manuscript_id,
      manuscript_version_id: doc.manuscript_version_id,
      workflow_id: doc.workflow_id,
      contract_version: doc.contract_version,
      generated_at: doc.generated_at,
      mode: doc.mode,
      scene_count: doc.scene_count,
      major_scene_count: doc.major_scene_count,
      inventory_status: status,
      content_hash: args.contentHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "inventory_id" },
  );
  if (invError) return { ok: false, error: invError.message };

  const entries = doc.scenes.map(entryToDb);
  const { error: delError } = await supabase
    .from("studio_military_expert_scene_inventory_entries")
    .delete()
    .eq("inventory_id", doc.inventory_id);
  if (delError) return { ok: false, error: delError.message };

  if (entries.length > 0) {
    const { error: entryError } = await supabase
      .from("studio_military_expert_scene_inventory_entries")
      .insert(entries);
    if (entryError) return { ok: false, error: entryError.message };
  }

  return { ok: true };
}

export async function initializeInventorySelections(
  document: MilitaryExpertSceneInventoryDocument,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  const selections = buildInitialSelections(document.scenes, document.mode, (scene) => {
    const est = estimateSceneReviewCost(scene);
    return {
      inputTokens: est.inputTokens,
      outputTokens: est.outputTokens,
      costUsd: est.costUsd,
      runtimeSeconds: est.runtimeSeconds,
    };
  });

  const { error: delError } = await supabase
    .from("studio_military_expert_scene_selections")
    .delete()
    .eq("inventory_id", document.inventory_id);
  if (delError) return { ok: false, error: delError.message };

  if (selections.length > 0) {
    const { error } = await supabase
      .from("studio_military_expert_scene_selections")
      .insert(selections.map(selectionToDb));
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function loadInventoryById(
  inventoryId: string,
): Promise<MilitaryExpertSceneInventoryDocument | null> {
  const supabase = getSupabaseAdmin();
  const { data: inv, error: invError } = await supabase
    .from("studio_military_expert_scene_inventories")
    .select("*")
    .eq("inventory_id", inventoryId)
    .maybeSingle();
  if (invError) throw new Error(invError.message);
  if (!inv) return null;

  const { data: entries, error: entryError } = await supabase
    .from("studio_military_expert_scene_inventory_entries")
    .select("*")
    .eq("inventory_id", inventoryId)
    .order("scene_index", { ascending: true });
  if (entryError) throw new Error(entryError.message);

  const scenes = (entries ?? []).map((row) =>
    rowToEntry(row, String(inv.manuscript_id), String(inv.manuscript_version_id)),
  );

  return parseMilitaryExpertSceneInventoryDocument({
    contract_version: inv.contract_version,
    inventory_id: inv.inventory_id,
    manuscript_id: inv.manuscript_id,
    manuscript_version_id: inv.manuscript_version_id,
    workflow_id: inv.workflow_id,
    generated_at: inv.generated_at,
    mode: inv.mode,
    scene_count: inv.scene_count,
    major_scene_count: inv.major_scene_count,
    inventory_status: inv.inventory_status,
    scenes,
  });
}

export async function loadInventorySelections(
  inventoryId: string,
): Promise<MilitaryExpertSceneSelectionEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_scene_selections")
    .select("*")
    .eq("inventory_id", inventoryId)
    .order("scene_id");
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    Object.freeze({
      inventory_id: String(row.inventory_id),
      scene_id: String(row.scene_id),
      is_selected: Boolean(row.is_selected),
      selection_source: row.selection_source as MilitaryExpertSceneSelectionEntry["selection_source"],
      selected_at: row.selected_at ? String(row.selected_at) : null,
      warning_acknowledged: Boolean(row.warning_acknowledged),
      estimated_input_tokens: Number(row.estimated_input_tokens),
      estimated_output_tokens: Number(row.estimated_output_tokens),
      estimated_cost_usd: Number(row.estimated_cost_usd),
      estimated_runtime_seconds: Number(row.estimated_runtime_seconds),
    }),
  );
}

export async function updateInventorySelections(
  inventoryId: string,
  selections: readonly MilitaryExpertSceneSelectionEntry[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  for (const sel of selections) {
    const { error } = await supabase
      .from("studio_military_expert_scene_selections")
      .update({
        is_selected: sel.is_selected,
        selection_source: sel.selection_source,
        selected_at: sel.selected_at,
        warning_acknowledged: sel.warning_acknowledged,
        estimated_input_tokens: sel.estimated_input_tokens,
        estimated_output_tokens: sel.estimated_output_tokens,
        estimated_cost_usd: sel.estimated_cost_usd,
        estimated_runtime_seconds: sel.estimated_runtime_seconds,
        updated_at: new Date().toISOString(),
      })
      .eq("inventory_id", inventoryId)
      .eq("scene_id", sel.scene_id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function getConfirmedSnapshot(
  inventoryId: string,
): Promise<MilitaryExpertSelectionSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_selection_snapshots")
    .select("snapshot_payload")
    .eq("inventory_id", inventoryId)
    .eq("immutable", true)
    .not("confirmed_at", "is", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.snapshot_payload) return null;
  return parseMilitaryExpertSelectionSnapshot(data.snapshot_payload);
}

export async function persistConfirmedSnapshot(
  snapshot: MilitaryExpertSelectionSnapshot,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getConfirmedSnapshot(snapshot.inventory_id);
  if (existing?.immutable) {
    return { ok: false, error: "A confirmed snapshot already exists for this inventory." };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_military_expert_selection_snapshots").insert({
    selection_snapshot_id: snapshot.selection_snapshot_id,
    inventory_id: snapshot.inventory_id,
    manuscript_id: snapshot.manuscript_id,
    manuscript_version_id: snapshot.manuscript_version_id,
    mode: snapshot.mode,
    confirmed_at: snapshot.confirmed_at,
    confirmed_by: snapshot.confirmed_by,
    immutable: true,
    snapshot_payload: snapshot,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markInventoryReadyForSelection(
  inventoryId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_military_expert_scene_inventories")
    .update({ inventory_status: "ready_for_selection", updated_at: new Date().toISOString() })
    .eq("inventory_id", inventoryId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function findLatestReadyInventoryForManuscript(
  manuscriptId: string,
): Promise<PersistedInventoryRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_military_expert_scene_inventories")
    .select("*")
    .eq("manuscript_id", manuscriptId)
    .eq("inventory_status", "ready_for_selection")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return Object.freeze({
    inventoryId: String(data.inventory_id),
    manuscriptId: String(data.manuscript_id),
    manuscriptVersionId: String(data.manuscript_version_id),
    workflowId: data.workflow_id ? String(data.workflow_id) : null,
    inventoryStatus: String(data.inventory_status),
    mode: data.mode as "author" | "certification",
    sceneCount: Number(data.scene_count),
    majorSceneCount: Number(data.major_scene_count),
    contentHash: String(data.content_hash),
    generatedAt: String(data.generated_at),
  });
}

export function newInventoryId(): string {
  return `inv_${randomUUID()}`;
}

export function newSelectionSnapshotId(): string {
  return `snap_${randomUUID()}`;
}
