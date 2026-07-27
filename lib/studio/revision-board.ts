/**
 * Revision Board contract — maps existing editorial_issues + revision_candidates
 * to Kevin Track action items.
 */

import type { AuthorEditResponse, EditorialIssue, RevisionCandidate } from "@/lib/types.ts";
import {
  mapDbDispositionToStudio,
  STUDIO_DECISION_LABELS,
  type StudioAuthorDisposition,
} from "./decisions.ts";
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
  studioDisposition: StudioAuthorDisposition,
  candidate: RevisionCandidate,
  issue: EditorialIssue | undefined,
): StudioActionItemStatus {
  if (studioDisposition === "accepted" || studioDisposition === "accepted_modified") {
    return "accepted";
  }
  if (studioDisposition === "rejected") return "rejected";
  if (studioDisposition === "deferred") return "deferred";
  if (issue?.resolution_status === "resolved") return "resolved";
  if (candidate.status === "verified") return "reviewing";
  if (candidate.status === "proposed") return "rewrite_proposed";
  return "open";
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
    const studioDisposition = mapDbDispositionToStudio(response?.disposition);
    const status = mapActionStatus(studioDisposition, candidate, issue);

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
      studioDisposition,
      decisionLabel: STUDIO_DECISION_LABELS[studioDisposition],
      authorDecision: response?.disposition ?? null,
      authorNotes: response?.author_note ?? null,
      acceptedText:
        studioDisposition === "accepted_modified"
          ? response?.author_modified_text ?? null
          : studioDisposition === "accepted"
            ? candidate.revised
            : null,
      rejectedReason: studioDisposition === "rejected" ? response?.author_note : null,
      createdAt: candidate.created_at,
      updatedAt: response?.updated_at ?? candidate.created_at,
    });
  });
}

export function summarizeRevisionBoard(
  items: readonly StudioActionItem[],
): StudioRevisionBoardSummary {
  let notReviewed = 0;
  let accepted = 0;
  let acceptedModified = 0;
  let rejected = 0;
  let deferred = 0;

  for (const item of items) {
    switch (item.studioDisposition) {
      case "pending":
        notReviewed += 1;
        break;
      case "accepted":
        accepted += 1;
        break;
      case "accepted_modified":
        acceptedModified += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "deferred":
        deferred += 1;
        break;
    }
  }

  return Object.freeze({
    total: items.length,
    notReviewed,
    accepted,
    acceptedModified,
    rejected,
    deferred,
    acceptedRevisionCount: accepted + acceptedModified,
  });
}
