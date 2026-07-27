/**
 * Revision Board contract — maps existing editorial_issues + revision_candidates
 * to Kevin Track action items.
 *
 * SCHEMA GAP ANALYSIS (K1 — no migrations):
 *
 * Existing tables cover most fields via join:
 * - editorial_issues: issue text, area, severity, review_id, resolution_status
 * - revision_candidates: original, revised, locator, reason, confidence, status
 * - author_edit_responses: disposition, author_note, author_modified_text
 *
 * Gaps requiring future columns or JSON metadata:
 * - why_it_matters (partial: consequence_if_unchanged on candidate)
 * - canon_impact (not stored)
 * - research_needed (not stored)
 * - assigned_expert (not stored; owning_reviewer on issue is closest)
 * - rewrite_kind enum (infer from candidate.type)
 * - unified action-item status spanning issue + candidate + author response
 *
 * K1 uses derived mapping only — no DB changes.
 */

import type { AuthorEditResponse, EditorialIssue, RevisionCandidate } from "@/lib/types.ts";
import type {
  StudioActionItem,
  StudioActionItemStatus,
  StudioRevisionBoardSummary,
  StudioRewriteKind,
} from "./types.ts";

function mapRewriteKind(type: RevisionCandidate["type"]): StudioRewriteKind {
  switch (type) {
    case "line_edit":
      return "sentence_replacement";
    case "paragraph_rewrite":
      return "paragraph_replacement";
    case "insertion":
      return "insertion";
    case "deletion":
      return "deletion";
    case "structural":
      return "restructuring_recommendation";
    default:
      return "author_decision_required";
  }
}

function mapActionStatus(
  candidate: RevisionCandidate,
  issue: EditorialIssue | undefined,
  response: AuthorEditResponse | undefined,
): StudioActionItemStatus {
  if (response?.disposition === "accepted") return "accepted";
  if (response?.disposition === "rejected") return "rejected";
  if (response?.disposition === "modified") return "rewrite_proposed";
  if (response?.disposition === "skipped") return "deferred";
  if (issue?.resolution_status === "resolved") return "resolved";
  if (candidate.status === "proposed") return "rewrite_proposed";
  if (candidate.status === "verified") return "reviewing";
  return "open";
}

function mapAuthorDecision(response: AuthorEditResponse | undefined): string | null {
  if (!response) return null;
  return response.disposition;
}

export function buildStudioActionItems(input: {
  readonly issues: readonly EditorialIssue[];
  readonly candidates: readonly RevisionCandidate[];
  readonly responses: readonly AuthorEditResponse[];
}): readonly StudioActionItem[] {
  const issueById = new Map(input.issues.map((i) => [i.id, i]));
  const responseByCandidate = new Map(input.responses.map((r) => [r.candidate_id, r]));

  return input.candidates.map((candidate) => {
    const issue = candidate.issue_id ? issueById.get(candidate.issue_id) : undefined;
    const response = responseByCandidate.get(candidate.id);
    const status = mapActionStatus(candidate, issue, response);

    return Object.freeze({
      id: candidate.id,
      issueId: candidate.issue_id,
      sourceExpert: issue?.owning_reviewer ?? "Literary Agent",
      reviewId: issue?.review_id ?? null,
      manuscriptVersionId: candidate.manuscript_version_id ?? null,
      chapterOrLocation: candidate.locator,
      quotedEvidence: candidate.original,
      issueTitle: issue?.text ?? candidate.reason ?? "Editorial concern",
      explanation: candidate.reason ?? issue?.text ?? "",
      severity: issue?.severity ?? candidate.story_risk ?? null,
      confidence: candidate.confidence,
      category: issue?.area ?? null,
      whyItMatters: candidate.consequence_if_unchanged ?? issue?.success_criterion ?? null,
      suggestedRewrite: candidate.revised,
      rewriteRationale: candidate.confidence_reason ?? candidate.reason ?? null,
      rewriteKind: mapRewriteKind(candidate.type),
      canonImpact: null,
      researchNeeded: false,
      assignedExpert: issue?.owning_reviewer ?? null,
      status,
      authorDecision: mapAuthorDecision(response),
      authorNotes: response?.author_note ?? null,
      acceptedText: response?.author_modified_text ?? null,
      rejectedReason: response?.disposition === "rejected" ? response.author_note : null,
      createdAt: candidate.created_at,
      updatedAt: response?.updated_at ?? candidate.created_at,
    });
  });
}

export function summarizeRevisionBoard(
  items: readonly StudioActionItem[],
): StudioRevisionBoardSummary {
  let open = 0;
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  for (const item of items) {
    if (item.status === "accepted") accepted += 1;
    else if (item.status === "rejected") rejected += 1;
    else if (item.status === "rewrite_proposed" || item.status === "reviewing") pending += 1;
    else if (item.authorDecision) pending += 1;
    else open += 1;
  }
  return Object.freeze({ total: items.length, open, accepted, rejected, pending });
}
