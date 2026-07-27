/**
 * Studio author decision contract — maps UI dispositions to author_edit_responses.
 *
 * Database dispositions: accepted | rejected | modified | skipped
 * One mutable row per candidate (unique candidate_id). No append-only history in K2.
 */

import type { AuthorEditDisposition, AuthorEditResponse } from "@/lib/types.ts";

export type StudioAuthorDisposition =
  | "pending"
  | "accepted"
  | "accepted_modified"
  | "rejected"
  | "deferred";

export const STUDIO_DECISION_LABELS: Record<StudioAuthorDisposition, string> = {
  pending: "Not Reviewed",
  accepted: "Accepted",
  accepted_modified: "Accepted With Changes",
  rejected: "Rejected",
  deferred: "Saved for Later",
};

export type StudioRevisionFilter =
  | "all"
  | "not_reviewed"
  | "accepted"
  | "accepted_modified"
  | "rejected"
  | "deferred";

export function mapDbDispositionToStudio(
  disposition: AuthorEditDisposition | undefined | null,
): StudioAuthorDisposition {
  switch (disposition) {
    case "accepted":
      return "accepted";
    case "modified":
      return "accepted_modified";
    case "rejected":
      return "rejected";
    case "skipped":
      return "deferred";
    default:
      return "pending";
  }
}

export function mapStudioDispositionToDb(
  disposition: Exclude<StudioAuthorDisposition, "pending">,
): AuthorEditDisposition {
  switch (disposition) {
    case "accepted":
      return "accepted";
    case "accepted_modified":
      return "modified";
    case "rejected":
      return "rejected";
    case "deferred":
      return "skipped";
  }
}

export function studioDecisionLabel(response: AuthorEditResponse | undefined): string {
  return STUDIO_DECISION_LABELS[mapDbDispositionToStudio(response?.disposition)];
}

export function countAcceptedRevisions(responses: readonly AuthorEditResponse[]): number {
  return responses.filter(
    (r) => r.disposition === "accepted" || r.disposition === "modified",
  ).length;
}

export function isSameAuthorResponse(input: {
  readonly existing: AuthorEditResponse;
  readonly disposition: AuthorEditDisposition;
  readonly authorModifiedText: string | null;
  readonly authorNote: string | null;
}): boolean {
  const existingText = input.existing.author_modified_text?.trim() ?? null;
  const newText = input.authorModifiedText?.trim() ?? null;
  const existingNote = input.existing.author_note?.trim() ?? null;
  const newNote = input.authorNote?.trim() ?? null;
  return (
    input.existing.disposition === input.disposition &&
    existingText === newText &&
    existingNote === newNote
  );
}

export function matchesRevisionFilter(
  disposition: StudioAuthorDisposition,
  filter: StudioRevisionFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "not_reviewed") return disposition === "pending";
  if (filter === "accepted") return disposition === "accepted";
  if (filter === "accepted_modified") return disposition === "accepted_modified";
  if (filter === "rejected") return disposition === "rejected";
  if (filter === "deferred") return disposition === "deferred";
  return true;
}

export const MANUSCRIPT_NOT_MODIFIED_MESSAGE =
  "Decision saved. The manuscript has not been changed." as const;
