import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptMeta, getManuscriptText } from "@/lib/reviews";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions";
import { extractPassageContext } from "@/lib/manuscript-context";
import {
  authorDispositionOrPending,
  type SuggestedEditStatus,
} from "@/lib/author-response-status";
import type { AuthorEditResponse, EditorialIssue, RevisionCandidate } from "@/lib/types";

export type { SuggestedEditStatus } from "@/lib/author-response-status";

export interface SuggestedEditView {
  id: string;
  manuscriptId: string;
  issueId: string | null;
  type: string;
  original: string;
  revised: string;
  locator: string | null;
  reason: string | null;
  owningReviewer: string;
  issueArea: string | null;
  issueSeverity: string | null;
  issueText: string | null;
  contextBefore: string | null;
  contextAfter: string | null;
  contextAvailable: boolean;
  disposition: SuggestedEditStatus;
  authorModifiedText: string | null;
  authorNote: string | null;
  respondedAt: string | null;
  updatedAt: string | null;
}

export interface SuggestedEditsPayload {
  manuscript: { id: string; title: string };
  edits: SuggestedEditView[];
  migrationRequired?: boolean;
}

function issueMap(issues: EditorialIssue[]): Map<string, EditorialIssue> {
  return new Map(issues.map((i) => [i.id, i]));
}

export async function getAuthorEditResponses(
  manuscriptId: string,
): Promise<{ responses: AuthorEditResponse[]; migrationRequired: boolean }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("author_edit_responses")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .order("responded_at", { ascending: true });
    if (error) {
      if (error.message.includes("author_edit_responses")) {
        return { responses: [], migrationRequired: true };
      }
      return { responses: [], migrationRequired: false };
    }
    return { responses: (data ?? []) as AuthorEditResponse[], migrationRequired: false };
  } catch {
    return { responses: [], migrationRequired: false };
  }
}

export async function getSuggestedEditsForManuscript(
  manuscriptId: string,
): Promise<SuggestedEditsPayload | null> {
  const meta = await getManuscriptMeta(manuscriptId);
  if (!meta) return null;

  const [text, issues, candidates, { responses, migrationRequired }] = await Promise.all([
    getManuscriptText(manuscriptId),
    getEditorialIssues(manuscriptId),
    getRevisionCandidates(manuscriptId),
    getAuthorEditResponses(manuscriptId),
  ]);

  const byIssue = issueMap(issues);
  const responseByCandidate = new Map(responses.map((r) => [r.candidate_id, r]));
  const manuscriptBody = text ?? "";

  const edits: SuggestedEditView[] = candidates
    .filter((c) => c.original.trim().length > 0)
    .map((c) => toSuggestedEditView(c, byIssue.get(c.issue_id ?? ""), responseByCandidate.get(c.id), manuscriptBody));

  return {
    manuscript: { id: meta.id, title: meta.title },
    edits,
    migrationRequired,
  };
}

function toSuggestedEditView(
  c: RevisionCandidate,
  issue: EditorialIssue | undefined,
  response: AuthorEditResponse | undefined,
  manuscriptText: string,
): SuggestedEditView {
  const ctx = manuscriptText
    ? extractPassageContext(manuscriptText, c.original)
    : { found: false, contextBefore: null, contextAfter: null };

  return {
    id: c.id,
    manuscriptId: c.manuscript_id,
    issueId: c.issue_id,
    type: c.type,
    original: c.original,
    revised: c.revised,
    locator: c.locator,
    reason: c.reason,
    owningReviewer: issue?.owning_reviewer ?? "Editorial Review",
    issueArea: issue?.area ?? null,
    issueSeverity: issue?.severity ?? null,
    issueText: issue?.text ?? null,
    contextBefore: ctx.found ? ctx.contextBefore : null,
    contextAfter: ctx.found ? ctx.contextAfter : null,
    contextAvailable: ctx.found,
    disposition: authorDispositionOrPending(response),
    authorModifiedText: response?.author_modified_text ?? null,
    authorNote: response?.author_note ?? null,
    respondedAt: response?.responded_at ?? null,
    updatedAt: response?.updated_at ?? null,
  };
}

export interface ManuscriptEditSummary {
  id: string;
  title: string;
  editCount: number;
  pendingCount: number;
}

/** Manuscripts that have at least one revision candidate for the picker. */
export async function listManuscriptsWithSuggestedEdits(): Promise<ManuscriptEditSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data: candidates, error } = await supabase
    .from("revision_candidates")
    .select("manuscript_id");
  if (error || !candidates?.length) return [];

  const counts = new Map<string, number>();
  for (const row of candidates) {
    counts.set(row.manuscript_id, (counts.get(row.manuscript_id) ?? 0) + 1);
  }

  const ids = [...counts.keys()];
  const { data: manuscripts } = await supabase
    .from("manuscripts")
    .select("id, title")
    .in("id", ids)
    .order("created_at", { ascending: false });

  const allResponses = await getAuthorEditResponsesForIds(ids);

  return (manuscripts ?? []).map((m) => {
    const editCount = counts.get(m.id) ?? 0;
    const responded = allResponses.filter((r: AuthorEditResponse) => r.manuscript_id === m.id).length;
    return {
      id: m.id,
      title: m.title,
      editCount,
      pendingCount: Math.max(0, editCount - responded),
    };
  });
}

async function getAuthorEditResponsesForIds(
  manuscriptIds: string[],
): Promise<AuthorEditResponse[]> {
  if (manuscriptIds.length === 0) return [];
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("author_edit_responses")
      .select("*")
      .in("manuscript_id", manuscriptIds);
    if (error) return [];
    return (data ?? []) as AuthorEditResponse[];
  } catch {
    return [];
  }
}
