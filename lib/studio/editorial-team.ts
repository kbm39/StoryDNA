import "server-only";
import { getExpertCatalogEntry, type ExpertCatalogKey } from "@/lib/expert-catalog.ts";
import { getSupabaseAdmin } from "@/lib/supabase/server.ts";
import { listStudioExpertDeskEntries } from "./expert-desk.ts";
import { buildStudioExecutionPolicy } from "./execution-policy.ts";
import { classifyExpertExecution } from "./expert-classification.ts";
import type {
  StudioEditorialHealth,
  StudioEditorialTeamMember,
  StudioExpertRunStatus,
} from "./types.ts";

const DEFAULT_TEAM_KEYS = ["literary_agent"] as const;

function isKnownExpertKey(key: string): boolean {
  return listStudioExpertDeskEntries().some((e) => e.key === key);
}

async function tableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_editorial_team_members").select("manuscript_id").limit(1);
  if (!error) return true;
  const message = error.message.toLowerCase();
  return !message.includes("does not exist") && !message.includes("could not find");
}

export async function getEditorialTeamMembers(
  manuscriptId: string,
): Promise<readonly StudioEditorialTeamMember[]> {
  const deskByKey = new Map(listStudioExpertDeskEntries().map((e) => [e.key, e]));

  if (!(await tableExists())) {
    return DEFAULT_TEAM_KEYS.map((key) => buildMember(manuscriptId, key, null, deskByKey)).filter(Boolean) as StudioEditorialTeamMember[];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("studio_editorial_team_members")
    .select("expert_key, owner_notes, recruited_at")
    .eq("manuscript_id", manuscriptId)
    .order("recruited_at", { ascending: true });

  if (error || !data?.length) {
    return DEFAULT_TEAM_KEYS.map((key) => buildMember(manuscriptId, key, null, deskByKey)).filter(Boolean) as StudioEditorialTeamMember[];
  }

  return data
    .map((row) =>
      buildMember(
        manuscriptId,
        row.expert_key as string,
        {
          ownerNotes: (row.owner_notes as string | null) ?? null,
          recruitedAt: row.recruited_at as string,
        },
        deskByKey,
      ),
    )
    .filter(Boolean) as StudioEditorialTeamMember[];
}

function buildMember(
  manuscriptId: string,
  key: string,
  persisted: { ownerNotes: string | null; recruitedAt: string } | null,
  deskByKey: Map<string, ReturnType<typeof listStudioExpertDeskEntries>[number]>,
): StudioEditorialTeamMember | null {
  const desk = deskByKey.get(key);
  if (!desk) return null;
  const catalog =
    key === "literary_agent" ||
    key === "developmental_editor" ||
    key === "line_editor" ||
    key === "psychologist" ||
    key === "librarian" ||
    key === "military_expert"
      ? getExpertCatalogEntry(key as ExpertCatalogKey)
      : null;

  return Object.freeze({
    manuscriptId,
    expertKey: key,
    displayName: desk.displayName,
    purpose: desk.purpose,
    executionClass: classifyExpertExecution(key),
    policy: buildStudioExecutionPolicy({
      expertKey: key,
      entry: catalog,
      privateUseAcknowledged: true,
    }),
    tier: desk.tier,
    tierLabel: desk.tierLabel,
    certificationStatus: desk.certificationStatus,
    expectedRuntime: desk.expectedRuntime,
    estimatedCost: desk.estimatedCost,
    ownerNotes: persisted?.ownerNotes ?? null,
    recruitedAt: persisted?.recruitedAt ?? new Date(0).toISOString(),
    runStatus: "waiting" as StudioExpertRunStatus,
    lastReviewAt: null,
    latestReviewId: null,
  });
}

export async function recruitEditorialTeamMember(input: {
  readonly manuscriptId: string;
  readonly expertKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isKnownExpertKey(input.expertKey)) {
    return { ok: false, error: "Unknown expert." };
  }
  if (classifyExpertExecution(input.expertKey) === "PLACEHOLDER") {
    return { ok: false, error: "This expert is not yet available." };
  }

  if (!(await tableExists())) {
    return { ok: true };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("studio_editorial_team_members").upsert(
    {
      manuscript_id: input.manuscriptId,
      expert_key: input.expertKey,
    },
    { onConflict: "manuscript_id,expert_key" },
  );

  if (error) return { ok: false, error: "Unable to recruit expert." };
  return { ok: true };
}

export async function removeEditorialTeamMember(input: {
  readonly manuscriptId: string;
  readonly expertKey: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.expertKey === "literary_agent") {
    return { ok: false, error: "Literary Agent is the core editorial lead and cannot be removed." };
  }

  if (!(await tableExists())) {
    return { ok: true };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_editorial_team_members")
    .delete()
    .eq("manuscript_id", input.manuscriptId)
    .eq("expert_key", input.expertKey);

  if (error) return { ok: false, error: "Unable to remove expert." };
  return { ok: true };
}

export async function updateEditorialTeamMemberNotes(input: {
  readonly manuscriptId: string;
  readonly expertKey: string;
  readonly ownerNotes: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await tableExists())) {
    return { ok: true };
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("studio_editorial_team_members")
    .update({ owner_notes: input.ownerNotes.trim() || null })
    .eq("manuscript_id", input.manuscriptId)
    .eq("expert_key", input.expertKey);

  if (error) return { ok: false, error: "Unable to save notes." };
  return { ok: true };
}

export function computeEditorialHealth(input: {
  readonly issueCount: number;
  readonly resolvedCount: number;
  readonly acceptedCount: number;
  readonly deferredCount: number;
  readonly rejectedCount: number;
  readonly openCount: number;
}): StudioEditorialHealth {
  const decided = input.acceptedCount + input.rejectedCount + input.deferredCount;
  const overallProgress =
    input.issueCount > 0 ? Math.round((decided / input.issueCount) * 100) : 0;

  return Object.freeze({
    issues: input.issueCount,
    resolved: input.resolvedCount,
    accepted: input.acceptedCount,
    deferred: input.deferredCount,
    rejected: input.rejectedCount,
    open: input.openCount,
    overallProgress,
  });
}
