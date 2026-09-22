/**
 * Generic Execute Expert contract — provider-independent.
 *
 * Literary Agent keeps its specialized path. This layer is the reusable
 * foundation for Archivist and later specialists. Live execution is not wired.
 */

import type { ProviderCallHooks } from "@/lib/ai/provider-call-hooks.ts";
import type { CanonStore } from "@/lib/canon/types.ts";

export const EXECUTE_EXPERT_MODES = ["dry_run", "live"] as const;
export type ExecuteExpertMode = (typeof EXECUTE_EXPERT_MODES)[number];

export const GENERIC_EXPERT_KEYS = [
  "archivist",
  "military_expert",
  "developmental_editor",
  "proofreader",
  "line_editor",
  "police_expert",
  "organized_crime_expert",
] as const;
export type GenericExpertKey = (typeof GENERIC_EXPERT_KEYS)[number];

export const ARCHIVIST_WORKFLOW_TYPE = "archivist_continuity_review" as const;

export const ARCHIVIST_WORKFLOW_PHASES = [
  "queued",
  "validating",
  "preparing",
  "extract_observations",
  "within_book_check",
  "series_canon_check",
  "conflict_review",
  "publishing",
  "completed",
] as const;
export type ArchivistWorkflowPhase = (typeof ARCHIVIST_WORKFLOW_PHASES)[number];

export type ExpertWorkflowPhase = ArchivistWorkflowPhase | (string & {});

export interface PriorAuthoritativeManuscriptVersion {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
}

export interface SeriesExecutionContext {
  series_id?: string | null;
  series_order?: number | null;
  prior_authoritative_manuscript_versions?: readonly PriorAuthoritativeManuscriptVersion[];
}

export interface ExecuteExpertRequest {
  expert_key: string;
  expert_version_id: string;
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  mode: ExecuteExpertMode;
  series_id?: string | null;
  series_order?: number | null;
  prior_authoritative_manuscript_versions?: readonly PriorAuthoritativeManuscriptVersion[];
  /** Archivist dry-run fixture selector. Ignored for other experts. */
  dry_run_scenario?: string;
}

export interface PinnedManuscriptIdentity {
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
}

export interface ActiveExpertWorkflow {
  workflow_id: string;
  expert_key: string;
  manuscript_id: string;
  manuscript_version_id: string;
  status: string;
}

/**
 * Generic execution options. Literary Agent may keep LiteraryAgentExecutionOptions;
 * future specialists should use this shape.
 */
export interface ExpertExecutionOptions {
  workflowId?: string;
  expertKey: string;
  expertVersion?: string;
  expertVersionId?: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  contentHash: string;
  abortSignal?: AbortSignal;
  providerCallHooks?: ProviderCallHooks;
  onExecutionHeartbeat?: () => Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  executionMode: ExecuteExpertMode;
  canonicalContext?: CanonStore;
  seriesContext?: SeriesExecutionContext;
  pinned?: PinnedManuscriptIdentity;
  findActiveWorkflow?: (args: {
    expert_key: string;
    manuscript_id: string;
    manuscript_version_id: string;
  }) => Promise<ActiveExpertWorkflow | null> | ActiveExpertWorkflow | null;
  onPhase?: (phase: ExpertWorkflowPhase) => Promise<void> | void;
  /** Test/host keep-alive interval; omitted in production dry-run. */
  heartbeatIntervalMs?: number;
}

export type ExecuteExpertStatus = "completed" | "failed" | "cancelled";

export type ExecuteExpertErrorCode =
  | "invalid_request"
  | "live_execution_not_wired"
  | "archivist_live_disabled"
  | "expert_adapter_not_wired"
  | "version_pin_mismatch"
  | "duplicate_active_workflow"
  | "dry_run_provider_forbidden"
  | "cancelled"
  | "aborted"
  | "validation_failed"
  | "parse_failed"
  | "structured_output_invalid"
  | "canon_write_forbidden";

export interface ExecuteExpertProvenance {
  provider: "none" | "anthropic" | "openai";
  model: "none" | string;
}

export interface ExpertCanonWriteAudit {
  accepted_facts: number;
  accepted_bible_revisions: number;
  persisted: false;
}

export interface ExecuteExpertCostSummary {
  expert_key: string;
  execution_mode: ExecuteExpertMode;
  provider: ExecuteExpertProvenance["provider"];
  model: ExecuteExpertProvenance["model"];
  call_count: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cache_creation_tokens: number;
  total_cost_usd: number;
  runtime_ms: number;
  token_counts: "exact" | "partial" | "missing";
  cost_status: "exact" | "partial" | "missing";
}

export interface ArchivistFindingReadModel {
  id: string;
  issue_type: string;
  classification: string;
  severity: string;
  confidence: string;
  explanation: string;
  suggested_resolution: string;
  current_evidence: unknown[];
  conflicting_evidence: unknown[];
}

export interface ArchivistDryRunReadModel {
  expert_display_name: "Archivist";
  expert_key: "archivist";
  execution_mode: "dry_run";
  status: ExecuteExpertStatus;
  cost_usd: 0;
  cost_status: "exact";
  findings: ArchivistFindingReadModel[];
  canon_candidates: unknown[];
  entity_ambiguities: unknown[];
  validation_ok: boolean;
}

export interface ExecuteExpertResult {
  ok: boolean;
  execution_mode: ExecuteExpertMode;
  expert_key: string;
  expert_version: string;
  expert_version_id: string;
  workflow_id: string;
  workflow_type: string;
  workflow_definition_version: string;
  phases: readonly string[];
  manuscript_id: string;
  manuscript_version_id: string;
  content_hash: string;
  series_id: string | null;
  series_order: number | null;
  prior_authoritative_manuscript_versions: readonly PriorAuthoritativeManuscriptVersion[];
  status: ExecuteExpertStatus;
  published: false;
  findings: unknown[];
  candidate_canon_delta: unknown[];
  entity_ambiguities: unknown[];
  validation: { ok: boolean; errors: string[] };
  provenance: ExecuteExpertProvenance;
  cost: ExecuteExpertCostSummary;
  runtime_ms: number;
  canon_writes: ExpertCanonWriteAudit;
  read_model: ArchivistDryRunReadModel | null;
  error_code?: ExecuteExpertErrorCode;
  diagnostics?: string[];
}

export interface ExpertAdapterDryRunOutput {
  expert_version: string;
  workflow_type: string;
  workflow_definition_version: string;
  findings: unknown[];
  candidate_canon_delta: unknown[];
  entity_ambiguities: unknown[];
  validation: { ok: boolean; errors: string[] };
  read_model: ArchivistDryRunReadModel;
}

export interface ExpertExecuteAdapter {
  expert_key: string;
  supports_dry_run: true;
  supports_live: false;
  phases: readonly string[];
  runDryRun(args: {
    request: ExecuteExpertRequest;
    options: ExpertExecutionOptions;
  }): Promise<ExpertAdapterDryRunOutput>;
}
