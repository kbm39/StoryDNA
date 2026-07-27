import "server-only";
import { getEditorialIssues, getRevisionCandidates } from "@/lib/agent-revisions.ts";
import { listReviews } from "@/lib/reviews.ts";
import { getAuthorEditResponses } from "@/lib/suggested-edits.ts";
import { buildStudioActionItems, summarizeRevisionBoard } from "./revision-board.ts";
import type { StudioExportOption } from "./types.ts";

export async function getStudioRevisionBoard(bookId: string) {
  const [issues, candidates, { responses }] = await Promise.all([
    getEditorialIssues(bookId),
    getRevisionCandidates(bookId),
    getAuthorEditResponses(bookId),
  ]);
  const items = buildStudioActionItems({ issues, candidates, responses });
  return Object.freeze({
    items,
    summary: summarizeRevisionBoard(items),
  });
}

export async function listStudioExportOptions(bookId: string): Promise<readonly StudioExportOption[]> {
  const [reviews, issues, candidates, { responses }] = await Promise.all([
    listReviews(bookId),
    getEditorialIssues(bookId),
    getRevisionCandidates(bookId),
    getAuthorEditResponses(bookId),
  ]);

  const hasReviews = reviews.length > 0;
  const hasIssues = issues.length > 0;
  const hasCandidates = candidates.length > 0;
  const hasAccepted = responses.some((r) => r.disposition === "accepted");

  return Object.freeze([
    Object.freeze({
      key: "expert_report",
      label: "Expert Report",
      description: "Download the authoritative literary agent review document.",
      ready: hasReviews,
      href: hasReviews ? `/manuscripts/${bookId}/export-reviews` : null,
      comingLater: false,
    }),
    Object.freeze({
      key: "open_action_items",
      label: "Open Action Items",
      description: "Export the editorial issues checklist.",
      ready: hasIssues,
      href: hasIssues ? `/manuscripts/${bookId}/export-issues` : null,
      comingLater: false,
    }),
    Object.freeze({
      key: "accepted_rewrites",
      label: "Accepted Rewrites",
      description: "Accepted author decisions with proposed final text.",
      ready: hasAccepted,
      href: hasAccepted ? `/manuscripts/${bookId}/revisions/download` : null,
      comingLater: false,
    }),
    Object.freeze({
      key: "revision_decision_log",
      label: "Revision Decision Log",
      description: "Complete author accept/reject/modify history.",
      ready: responses.length > 0,
      href: responses.length > 0 ? `/suggested-edits` : null,
      comingLater: false,
    }),
    Object.freeze({
      key: "revised_manuscript",
      label: "Revised Manuscript",
      description: "Apply accepted rewrites to produce a new manuscript version.",
      ready: false,
      href: null,
      comingLater: true,
    }),
    Object.freeze({
      key: "word_track_changes",
      label: "Word Track Changes",
      description: "Export DOCX with Word track-changes markup.",
      ready: false,
      href: null,
      comingLater: true,
    }),
  ]);
}
