/**
 * Resume, retry, reconciliation, publication, and success-criteria policy
 * for the future REVISED-11-2 paid pilot. Does not authorize a run.
 */

import type { ArchivistReview } from "../contracts.ts";
import { RECONCILIATION_MAX_BATCH_SIZE } from "./constants.ts";
import type { ContradictionPair } from "./types.ts";

export const PAID_PILOT_TRIGGER_MAX_ATTEMPTS = 2;
export const PAID_PILOT_TRIGGER_MAX_DURATION_SECONDS = 3600;
export const PAID_PILOT_REPRESENTATION_REPAIR_MAX = 1;

export const PAID_PILOT_RESUME_POLICY = {
  same_one_shot_authorization_permits_resume: true,
  consume_on: "first_workflow_start",
  bound_field: "bound_workflow_id",
  new_workflow_after_consume: "rejected",
  resume_requires: [
    "same authorization_id",
    "status consumed or explicitly_authorized bound to the same workflow",
    "compatible validated checkpoints",
    "identical source/plan pins",
  ],
  recommendation:
    "Consume the one-shot authorization when the workflow is first created and bind that workflow_id. Resume the same workflow without a new authorization. Reject any second workflow.",
} as const;

export const PAID_PILOT_RETRY_POLICY = {
  representation_repair: {
    max: PAID_PILOT_REPRESENTATION_REPAIR_MAX,
    per: "segment",
    kind: "malformed_output_only",
  },
  provider_network_retry: {
    trigger_max_attempts: PAID_PILOT_TRIGGER_MAX_ATTEMPTS,
    allowed_only_if: "no validated observation exists for that segment",
  },
  workflow_resume: {
    separate_from_trigger_retry: true,
    uses_selectSegmentsToRun: true,
  },
  idempotency: "unique (workflow_id, segment_id) checkpoint plus validated-observation reuse",
} as const;

const DETERMINISTIC_PAIR_KINDS = new Set([
  "injury_laterality",
  "appearance_unexplained",
  "knowledge_before_acquisition",
  "unique_object_possession",
]);

export function requiresModelReconciliation(pair: Pick<ContradictionPair, "kind">): boolean {
  return !DETERMINISTIC_PAIR_KINDS.has(pair.kind);
}

export function selectPairsNeedingModel(
  pairs: readonly Pick<ContradictionPair, "kind">[],
): readonly Pick<ContradictionPair, "kind">[] {
  return pairs.filter(requiresModelReconciliation);
}

export const PAID_PILOT_RECONCILIATION_POLICY = {
  prefer_deterministic_certified_rules: true,
  call_haiku_only_when_semantic_judgment_remains: true,
  max_batch_size: RECONCILIATION_MAX_BATCH_SIZE,
  resend_full_manuscript: false,
} as const;

export const PAID_PILOT_PERSISTENCE_ALLOWED = [
  "segmented_workflow",
  "checkpoints",
  "observations",
  "book_graph",
  "coverage_report",
  "candidate_archivist_review",
  "candidate_canon_proposals",
  "ambiguities",
  "cost_ledger",
] as const;

export const PAID_PILOT_PERSISTENCE_FORBIDDEN = [
  "accepted_canon",
  "accepted_series_bible_revision",
  "retcon",
  "supersession",
  "author_disposition",
] as const;

export const PAID_PILOT_SUCCESS_CRITERIA = {
  execution: [
    "correct REVISED-11-2 source pin",
    "exactly one workflow",
    "no duplicate paid calls",
    "no stall/orphan",
    "terminal state",
    "full cost-first ledger",
  ],
  coverage: [
    "30/30 units",
    "14/14 planned segments or regenerated plan with identical fingerprint",
    "109907/109907 unique words",
    "100% coverage",
    "0 unexplained gaps",
  ],
  quality: [
    "valid structured outputs",
    "evidence locators rehydrate",
    "no fabricated quotes",
    "long-range conflicts survive merge",
    "candidate canon inventory usable",
    "model vs final diagnostics available",
  ],
  safety: [
    "accepted canon writes=0",
    "Series Bible writes=0",
    "retcons/supersessions/dispositions=0",
    "no silent entity merge",
    "no authority elevation",
    "one-sided evidence cannot confirm",
  ],
  completion_alone_is_not_success: true,
} as const;

export const CANDIDATE_REVIEW_UI_FIELDS = [
  "finding",
  "model_classification",
  "final_classification",
  "confirmation_eligibility",
  "severity",
  "confidence",
  "current_evidence",
  "conflicting_evidence",
  "current_location",
  "conflicting_location",
  "temporal_analysis",
  "explanation",
  "suggested_resolution",
  "candidate_canon",
  "ambiguities",
] as const;

export const CANDIDATE_REVIEW_COMPANION_FIELDS = [
  "coverage_report (archivist_coverage_reports)",
  "provider/cost diagnostics (archivist_segmented_cost_ledger)",
] as const;

export function candidateReviewHasAuthorUiFields(review: ArchivistReview): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!review.findings) missing.push("finding");
  const first = review.findings[0];
  if (first) {
    if (!first.classification && !first.final_classification) missing.push("final_classification");
    if (!first.severity) missing.push("severity");
    if (!first.confidence) missing.push("confidence");
    if (!first.current_evidence?.length) missing.push("current_evidence");
    if (!first.conflicting_evidence) missing.push("conflicting_evidence");
    if (!first.current_location) missing.push("current_location");
    if (!first.temporal_analysis) missing.push("temporal_analysis");
    if (!first.explanation) missing.push("explanation");
    if (!first.suggested_resolution) missing.push("suggested_resolution");
  }
  if (!review.canon_delta) missing.push("candidate_canon");
  if (!review.entity_ambiguities) missing.push("ambiguities");
  return { ok: missing.length === 0, missing };
}
