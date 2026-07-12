import type { AuthorEditDisposition, AuthorEditResponse } from "@/lib/types";

/**
 * Author-response status mapping for Editorial Review / Suggested Edits.
 *
 * SOURCE OF TRUTH (author workflow):
 *   `author_edit_responses.disposition` — the author's recorded decision.
 *   Suggested Edits reads and writes only this table for author responses.
 *
 * EDITORIAL LIFECYCLE (separate workflow):
 *   `revision_candidates.status` — proposed / accepted / rejected / deferred / …
 *   Updated by revision generation and the manuscript-page CandidateStatusControl
 *   (export prep). It is NOT updated by submitAuthorResponse, to avoid drift
 *   between the author-review flow and the manuscript-page toggle flow.
 *
 * UI vs database:
 *   UI `pending`  — no author_edit_responses row yet.
 *   DB `proposed` — revision_candidates default lifecycle state (unrelated label).
 */
export type SuggestedEditStatus = AuthorEditDisposition | "pending";

export function authorDispositionOrPending(
  response: AuthorEditResponse | undefined,
): SuggestedEditStatus {
  return response?.disposition ?? "pending";
}

/** Build a suggested-edits URL preserving manuscript, filter, and optional candidate. */
export function suggestedEditsHref(
  manuscriptId: string,
  status: SuggestedEditStatus | "all" = "all",
  candidateId?: string | null,
): string {
  const params = new URLSearchParams({ manuscript: manuscriptId });
  if (status !== "all") params.set("status", status);
  if (candidateId) params.set("candidate", candidateId);
  return `/suggested-edits?${params.toString()}`;
}

/** Next pending suggestion after `currentId` in manuscript order (wraps). */
export function nextPendingCandidateId(
  edits: { id: string; disposition: SuggestedEditStatus }[],
  currentId: string,
): string | null {
  const idx = edits.findIndex((e) => e.id === currentId);
  if (idx < 0) return edits.find((e) => e.disposition === "pending")?.id ?? null;
  for (let i = idx + 1; i < edits.length; i++) {
    if (edits[i].disposition === "pending") return edits[i].id;
  }
  for (let i = 0; i < idx; i++) {
    if (edits[i].disposition === "pending") return edits[i].id;
  }
  return null;
}
