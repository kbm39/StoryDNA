import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashExpertDefinition, verifyExpertDefinitionHash } from "./definition-hash.ts";
import { validateExpertDefinition } from "./schema.ts";
import type {
  ExpertCategory,
  ExpertDefinitionV1,
  ExpertEntityStatus,
  ExpertRow,
  ExpertScope,
  ExpertVersionEventType,
  ExpertVersionRow,
} from "./types.ts";
import { assertPlatformExpertWriteAllowed, type PlatformWriteContext } from "./platform-guard.ts";

export type { ExpertRow, ExpertVersionRow };

function expertFromDb(raw: Record<string, unknown>): ExpertRow {
  return raw as unknown as ExpertRow;
}

function versionFromDb(raw: Record<string, unknown>): ExpertVersionRow {
  return raw as unknown as ExpertVersionRow;
}

export async function recordExpertVersionEvent(args: {
  expertVersionId: string;
  eventType: ExpertVersionEventType;
  details?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("expert_version_events").insert({
    expert_version_id: args.expertVersionId,
    event_type: args.eventType,
    details: args.details ?? {},
    created_by: args.createdBy ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createExpertIdentity(args: {
  expertKey: string;
  scope: ExpertScope;
  displayName: string;
  category: ExpertCategory;
  department?: string | null;
  title?: string | null;
  description?: string | null;
  manuscriptId?: string | null;
  seriesId?: string | null;
  status?: ExpertEntityStatus;
  writeContext: PlatformWriteContext;
}): Promise<ExpertRow> {
  assertPlatformExpertWriteAllowed({ scope: args.scope, context: args.writeContext });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("experts")
    .insert({
      expert_key: args.expertKey,
      scope: args.scope,
      display_name: args.displayName,
      category: args.category,
      department: args.department ?? null,
      title: args.title ?? null,
      description: args.description ?? null,
      manuscript_id: args.manuscriptId ?? null,
      series_id: args.seriesId ?? null,
      status: args.status ?? "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return expertFromDb(data);
}

export async function getExpertByKey(args: {
  expertKey: string;
  scope: ExpertScope;
  manuscriptId?: string | null;
}): Promise<ExpertRow | null> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("experts")
    .select("*")
    .eq("expert_key", args.expertKey)
    .eq("scope", args.scope);
  if (args.scope === "project" && args.manuscriptId) {
    query = query.eq("manuscript_id", args.manuscriptId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? expertFromDb(data) : null;
}

export async function getExpertById(expertId: string): Promise<ExpertRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("experts").select("*").eq("id", expertId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? expertFromDb(data) : null;
}

export async function createDraftExpertVersion(args: {
  expertId: string;
  definition: ExpertDefinitionV1;
  createdBy?: string;
  supersedesVersionId?: string | null;
  writeContext: PlatformWriteContext;
}): Promise<ExpertVersionRow> {
  const expert = await getExpertById(args.expertId);
  if (!expert) throw new Error("EXPERT_NOT_FOUND");
  assertPlatformExpertWriteAllowed({ scope: expert.scope, context: args.writeContext });

  const validated = validateExpertDefinition(args.definition);
  if (!validated.ok) throw new Error(validated.errors.join("; "));

  const def = validated.definition;
  const definitionHash = hashExpertDefinition(def);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .insert({
      expert_id: args.expertId,
      version: def.versioning.version,
      lifecycle_status: "draft",
      schema_version: def.schema_version,
      definition: def,
      definition_hash: definitionHash,
      mission: def.purpose.mission,
      purpose: def.purpose.intended_use.join("; "),
      professional_standards_summary: def.professional_standards.principles.slice(0, 3).join("; "),
      supersedes_version_id: args.supersedesVersionId ?? null,
      change_summary: def.versioning.change_summary ?? null,
      created_by: args.createdBy ?? "system",
    })
    .select("*")
    .single();
  if (error) throw error;

  const row = versionFromDb(data);
  await recordExpertVersionEvent({
    expertVersionId: row.id,
    eventType: "created",
    details: { version: row.version, definition_hash: definitionHash },
    createdBy: args.createdBy ?? "system",
  });
  return row;
}

export async function getExpertVersion(versionId: string): Promise<ExpertVersionRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = versionFromDb(data);
  if (!verifyExpertDefinitionHash(row.definition, row.definition_hash)) {
    throw new Error("DEFINITION_HASH_MISMATCH");
  }
  return row;
}

export async function getActiveExpertVersion(expertId: string): Promise<ExpertVersionRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .select("*")
    .eq("expert_id", expertId)
    .eq("lifecycle_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? versionFromDb(data) : null;
}

export async function listExperts(): Promise<ExpertRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("experts").select("*").order("expert_key");
  if (error) throw new Error(error.message);
  return (data ?? []).map(expertFromDb);
}

export async function listExpertVersions(expertId: string): Promise<ExpertVersionRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .select("*")
    .eq("expert_id", expertId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(versionFromDb);
}

export async function activateExpertVersion(args: {
  versionId: string;
  createdBy?: string;
  writeContext: PlatformWriteContext;
}): Promise<ExpertVersionRow> {
  const version = await getExpertVersion(args.versionId);
  if (!version) throw new Error("VERSION_NOT_FOUND");
  const expert = await getExpertById(version.expert_id);
  if (!expert) throw new Error("EXPERT_NOT_FOUND");
  assertPlatformExpertWriteAllowed({ scope: expert.scope, context: args.writeContext });

  if (version.lifecycle_status !== "draft") {
    throw new Error(`NOT_DRAFT:${version.lifecycle_status}`);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("activate_expert_version", {
    p_version_id: args.versionId,
    p_created_by: args.createdBy ?? "system",
  });
  if (error) throw new Error(error.message);

  const activated = await getExpertVersion(args.versionId);
  if (!activated) throw new Error("ACTIVATION_FAILED");
  return activated;
}

export async function deprecateExpertVersion(args: {
  versionId: string;
  createdBy?: string;
  writeContext: PlatformWriteContext;
}): Promise<ExpertVersionRow> {
  const version = await getExpertVersion(args.versionId);
  if (!version) throw new Error("VERSION_NOT_FOUND");
  const expert = await getExpertById(version.expert_id);
  if (!expert) throw new Error("EXPERT_NOT_FOUND");
  assertPlatformExpertWriteAllowed({ scope: expert.scope, context: args.writeContext });

  if (version.lifecycle_status !== "active") {
    throw new Error(`NOT_ACTIVE:${version.lifecycle_status}`);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .update({ lifecycle_status: "deprecated", updated_at: new Date().toISOString() })
    .eq("id", args.versionId)
    .select("*")
    .single();
  if (error) throw error;

  await recordExpertVersionEvent({
    expertVersionId: args.versionId,
    eventType: "deprecated",
    createdBy: args.createdBy ?? "system",
  });
  return versionFromDb(data);
}

export async function archiveExpertVersion(args: {
  versionId: string;
  createdBy?: string;
  writeContext: PlatformWriteContext;
}): Promise<ExpertVersionRow> {
  const version = await getExpertVersion(args.versionId);
  if (!version) throw new Error("VERSION_NOT_FOUND");
  const expert = await getExpertById(version.expert_id);
  if (!expert) throw new Error("EXPERT_NOT_FOUND");
  assertPlatformExpertWriteAllowed({ scope: expert.scope, context: args.writeContext });

  if (!["draft", "deprecated"].includes(version.lifecycle_status)) {
    throw new Error(`CANNOT_ARCHIVE:${version.lifecycle_status}`);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("expert_versions")
    .update({ lifecycle_status: "archived", updated_at: new Date().toISOString() })
    .eq("id", args.versionId)
    .select("*")
    .single();
  if (error) throw error;

  await recordExpertVersionEvent({
    expertVersionId: args.versionId,
    eventType: "archived",
    createdBy: args.createdBy ?? "system",
  });
  return versionFromDb(data);
}

export async function createSupersedingDraft(args: {
  activeVersionId: string;
  newDefinition: ExpertDefinitionV1;
  createdBy?: string;
  writeContext: PlatformWriteContext;
}): Promise<ExpertVersionRow> {
  const active = await getExpertVersion(args.activeVersionId);
  if (!active) throw new Error("VERSION_NOT_FOUND");
  if (active.lifecycle_status !== "active") {
    throw new Error("SUPERSEDE_REQUIRES_ACTIVE");
  }
  return createDraftExpertVersion({
    expertId: active.expert_id,
    definition: args.newDefinition,
    createdBy: args.createdBy,
    supersedesVersionId: active.id,
    writeContext: args.writeContext,
  });
}

export { verifyExpertDefinitionHash };
