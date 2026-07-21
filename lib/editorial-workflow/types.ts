/** Editorial Workflow Engine — shared types (Publishing Workflow product surface). */

export const WORKFLOW_TYPES = ["literary_agent_review"] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const WORKFLOW_STATUSES = [
  "queued",
  "preparing",
  "running",
  "waiting",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const ACTIVE_WORKFLOW_STATUSES: readonly WorkflowStatus[] = [
  "queued",
  "preparing",
  "running",
  "waiting",
  "paused",
];

export const WAITING_REASONS = [
  "dependency",
  "author_input",
  "expert_queue",
  "retry_backoff",
  "concurrency",
  "preflight_blocked",
] as const;
export type WaitingReason = (typeof WAITING_REASONS)[number];

export const INTERNAL_PHASES = [
  "validating",
  "preparing",
  "memo_generation",
  "memo_repair",
  "contrary_evidence",
  "rubric_generation",
  "rubric_validation",
  "revision_candidates",
  "publishing",
  "completed",
] as const;
export type InternalPhase = (typeof INTERNAL_PHASES)[number];

export const AUTHORITATIVE_RESULT_TYPES = ["commercial_review"] as const;
export type AuthoritativeResultType = (typeof AUTHORITATIVE_RESULT_TYPES)[number];

/** StoryDNA-owned workflow metadata stored in input_snapshot (no manuscript text). */
export interface WorkflowInputSnapshot {
  manuscriptTitle: string;
  wordCount: number | null;
  characterCount: number | null;
  /** StoryDNA operates the workflow at runtime — not Cursor or third-party IDE tools. */
  workflowOwner: "StoryDNA";
  workflowPurpose: WorkflowType;
  participatingExperts: string[];
  reviewerDefinitionId: string;
  /** Future: expert_version_id from Expert Registry (M2) — not wired in Phase 1. */
  /** Reserved for future Editorial Decision Log linkage. */
  editorialDecisionLogEnabled: boolean;
  /** Reserved: pause-for-author-guidance in later milestones. */
  authorGuidancePauseSupported: boolean;
  /** Reserved: Next Best Action surfaced on completion in later milestones. */
  nextBestActionOnCompletion: boolean;
}

export interface EditorialWorkflowRow {
  id: string;
  user_id: string | null;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  workflow_type: WorkflowType;
  workflow_definition_version: string;
  department: string | null;
  owner_type: string | null;
  owner_label: string | null;
  purpose: string | null;
  participating_experts: string[] | null;
  next_best_action: string | null;
  status: WorkflowStatus;
  waiting_reason: WaitingReason | null;
  current_phase: InternalPhase | null;
  progress_summary: string | null;
  trigger_run_id: string | null;
  idempotency_key: string;
  authoritative_result_id: string | null;
  authoritative_result_type: AuthoritativeResultType | null;
  result_summary: Record<string, unknown> | null;
  error_code: string | null;
  safe_error_message: string | null;
  diagnostics_storage_key: string | null;
  attempt_count: number;
  max_attempts: number;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  input_snapshot: WorkflowInputSnapshot;
  queued_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Optional hooks for Publishing Workflow observability — no pipeline behavior change. */
export interface EditorialWorkflowHooks {
  onPhase?: (phase: InternalPhase) => Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  assertVersionPin?: () => Promise<void>;
  workflowId?: string;
  triggerRunId?: string | null;
}

export class WorkflowCancelledError extends Error {
  constructor() {
    super("WORKFLOW_CANCELLED");
    this.name = "WorkflowCancelledError";
  }
}

export const LITERARY_AGENT_DEFINITION_VERSION = "literary_agent_review@v1";

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
