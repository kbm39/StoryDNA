import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import type { AuthorIntentRecord } from "@/lib/author-intent/types.ts";
import { resolveAuthorIntentForPlanning } from "@/lib/author-intent/service.ts";
import {
  EIC_PLAN_CONTRACT_VERSION,
  type EicEditorialPlanRecord,
  type EicEditorialPlanV1,
  type EicPlanGateResult,
} from "./contract.ts";
import { evaluateEicPlanGate } from "./gate.ts";
import { buildDeterministicEicPlan } from "./recommendations.ts";

type DbPlanRow = {
  id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  author_intent_id: string;
  contract_version: string;
  plan: EicEditorialPlanV1;
  status: string;
  created_by: string;
  superseded_by_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapPlanRow(row: DbPlanRow): EicEditorialPlanRecord {
  return Object.freeze({
    id: row.id,
    manuscript_id: row.manuscript_id,
    manuscript_version_id: row.manuscript_version_id,
    author_intent_id: row.author_intent_id,
    contract_version: EIC_PLAN_CONTRACT_VERSION,
    plan: row.plan,
    status: row.status as EicEditorialPlanRecord["status"],
    created_by: row.created_by,
    superseded_by_id: row.superseded_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function plansTableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("eic_editorial_plans").select("id").limit(1);
  if (!error) return true;
  const message = error.message.toLowerCase();
  return !message.includes("does not exist") && !message.includes("could not find");
}

export async function getActiveEicPlan(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
}): Promise<EicEditorialPlanRecord | null> {
  if (!(await plansTableExists())) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("eic_editorial_plans")
    .select("*")
    .eq("manuscript_id", input.manuscriptId)
    .eq("manuscript_version_id", input.manuscriptVersionId)
    .in("status", ["draft", "awaiting_author_confirmation", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapPlanRow(data as DbPlanRow) : null;
}

export async function createEicPlanFromIntent(input: {
  intent: AuthorIntentRecord;
  createdBy: string;
  seriesContext?: string | null;
  publicationContext?: string | null;
}): Promise<{ ok: true; record: EicEditorialPlanRecord } | { ok: false; error: string }> {
  if (!(await plansTableExists())) {
    return { ok: false, error: "EIC plan persistence is not available (migration not applied)" };
  }

  const plan = buildDeterministicEicPlan({
    intent: input.intent,
    seriesContext: input.seriesContext,
    publicationContext: input.publicationContext,
  });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("eic_editorial_plans")
    .insert({
      manuscript_id: input.intent.manuscript_id,
      manuscript_version_id: input.intent.manuscript_version_id,
      author_intent_id: input.intent.id,
      contract_version: EIC_PLAN_CONTRACT_VERSION,
      plan,
      status: "awaiting_author_confirmation",
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create EIC plan" };
  }

  return { ok: true, record: mapPlanRow(data as DbPlanRow) };
}

export async function evaluatePlanGateForLaunch(input: {
  manuscriptId: string;
  manuscriptVersionId: string;
  expertKeyToLaunch?: string;
  gateEnabled?: boolean;
}): Promise<EicPlanGateResult> {
  const resolved = await resolveAuthorIntentForPlanning({
    manuscriptId: input.manuscriptId,
    manuscriptVersionId: input.manuscriptVersionId,
  });

  const activeIntent = resolved?.isValidForPlanning ? resolved.record : null;
  const existingPlan = await getActiveEicPlan({
    manuscriptId: input.manuscriptId,
    manuscriptVersionId: input.manuscriptVersionId,
  });

  return evaluateEicPlanGate({
    gateEnabled: input.gateEnabled,
    manuscriptId: input.manuscriptId,
    manuscriptVersionId: input.manuscriptVersionId,
    activeIntent,
    existingActivePlan: existingPlan,
    expertKeyToLaunch: input.expertKeyToLaunch,
  });
}

export async function previewEicPlan(input: {
  intent: AuthorIntentRecord;
  seriesContext?: string | null;
  publicationContext?: string | null;
}): Promise<EicEditorialPlanV1> {
  return buildDeterministicEicPlan(input);
}

export { buildDeterministicEicPlan, evaluateEicPlanGate };
