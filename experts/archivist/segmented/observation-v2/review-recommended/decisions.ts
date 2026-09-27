import {
  ARCHIVIST_NEEDS_FIX_FUTURE_PATH,
  ARCHIVIST_REVIEW_AUTHOR_ACTIONS,
  ENGINE_ELIGIBILITY_PRESERVED,
  type ArchivistReviewAuthorAction,
  type ArchivistReviewDecision,
  type ArchivistReviewDecisionStore,
  type ArchivistReviewState,
  type ArchivistReviewStatusCounts,
  type Phase1ReviewReason,
} from "./types.ts";

export function createMemoryReviewDecisionStore(
  initial: readonly ArchivistReviewDecision[] = [],
): ArchivistReviewDecisionStore {
  const rows = new Map<string, ArchivistReviewDecision>();
  for (const row of initial) rows.set(row.passage_key, row);
  return {
    get(passageKey) {
      return rows.get(passageKey) ?? null;
    },
    list() {
      return [...rows.values()];
    },
    put(decision) {
      if (decision.accepted_canon !== false) {
        throw new Error("review decision cannot write accepted canon");
      }
      if (decision.series_bible !== false) {
        throw new Error("review decision cannot write Series Bible");
      }
      rows.set(decision.passage_key, decision);
      return decision;
    },
  };
}

export function recordPassageReviewDecision(args: {
  store: ArchivistReviewDecisionStore;
  passageKey: string;
  clusterFingerprint: string;
  evidenceIdentity: string;
  action: ArchivistReviewAuthorAction;
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId?: string | null;
  authorIdentity?: string;
  authorComment?: string | null;
  engineReason?: Phase1ReviewReason;
  now?: string;
}): ArchivistReviewDecision {
  if (!(ARCHIVIST_REVIEW_AUTHOR_ACTIONS as readonly string[]).includes(args.action)) {
    throw new Error("unsupported review action");
  }
  const decision: ArchivistReviewDecision = {
    passage_key: args.passageKey,
    cluster_fingerprint: args.clusterFingerprint,
    evidence_identity: args.evidenceIdentity,
    review_state: args.action,
    manuscript_id: args.manuscriptId,
    manuscript_version_id: args.manuscriptVersionId,
    source_workflow_id: args.sourceWorkflowId ?? null,
    author_identity: args.authorIdentity?.trim() || "author",
    author_comment: args.authorComment?.trim() || null,
    decided_at: args.now ?? new Date().toISOString(),
    engine_eligibility: ENGINE_ELIGIBILITY_PRESERVED,
    engine_reason: args.engineReason ?? "unspecified_laterality",
    future_consumption: ARCHIVIST_NEEDS_FIX_FUTURE_PATH.work_item_kind,
    accepted_canon: false,
    series_bible: false,
  };
  return args.store.put(decision);
}

export function countReviewStates(states: readonly ArchivistReviewState[]): ArchivistReviewStatusCounts {
  return {
    pending: states.filter((state) => state === "pending").length,
    needs_fix: states.filter((state) => state === "needs_fix").length,
    not_an_issue: states.filter((state) => state === "not_an_issue").length,
  };
}

export function summarizeClusterReviewStatus(states: readonly ArchivistReviewState[]): string {
  const counts = countReviewStates(states);
  const total = states.length;
  if (total === 0) return "No passages";
  if (counts.not_an_issue === total) return `${total} reviewed · no fixes needed`;
  if (counts.pending === total) return `${total} awaiting review`;
  const parts: string[] = [];
  if (counts.needs_fix) {
    parts.push(counts.needs_fix === 1 ? "1 needs attention" : `${counts.needs_fix} need attention`);
  }
  if (counts.not_an_issue) {
    parts.push(counts.not_an_issue === 1 ? "1 not an issue" : `${counts.not_an_issue} not an issue`);
  }
  if (counts.pending) {
    parts.push(counts.pending === 1 ? "1 awaiting review" : `${counts.pending} awaiting review`);
  }
  return parts.join(" · ");
}

export function assertDecisionDoesNotWriteCanon(decision: ArchivistReviewDecision): void {
  if (decision.accepted_canon !== false) {
    throw new Error("review decision cannot write accepted canon");
  }
  if (decision.series_bible !== false) {
    throw new Error("review decision cannot write Series Bible");
  }
}
