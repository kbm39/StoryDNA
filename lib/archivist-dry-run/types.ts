import type { ExecuteExpertErrorCode, ExecuteExpertStatus } from "@/lib/execute-expert/types.ts";

export const ARCHIVIST_DRY_RUN_SCENARIO_VALUES = [
  "confirmed_within_book",
  "explained_temporal_non_conflict",
  "author_verification_needed",
  "ambiguous_alias",
  "candidate_canon_delta",
  "clean_no_conflict",
] as const;

export type ArchivistDryRunScenario = (typeof ARCHIVIST_DRY_RUN_SCENARIO_VALUES)[number];

export const ARCHIVIST_DRAFT_EXPERT_VERSION_ID =
  "883407ad-4afe-4f3c-a69b-eaa3234fc9c6" as const;

export const DEFAULT_ARCHIVIST_DRY_RUN_SCENARIO =
  "confirmed_within_book" satisfies ArchivistDryRunScenario;

export const ARCHIVIST_DRY_RUN_BANNERS = [
  "ARCHIVIST DRY RUN",
  "$0 — NO AI PROVIDER CALLED",
  "FIXTURE-BASED RESULTS",
  "NO CANON CHANGES SAVED",
] as const;

export const ARCHIVIST_DRY_RUN_FUTURE_ACTIONS = [
  { key: "accept_correction", label: "Accept correction" },
  { key: "intentional_change", label: "Intentional change" },
  { key: "update_canon", label: "Update canon" },
  { key: "dismiss", label: "Dismiss" },
  { key: "comment", label: "Comment" },
] as const;

export const ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE = "Coming in live Archivist" as const;

export type ArchivistDryRunUiErrorCode =
  | ExecuteExpertErrorCode
  | "dry_run_ui_not_allowed"
  | "manuscript_not_found"
  | "version_not_found"
  | "version_mismatch"
  | "content_hash_missing"
  | "word_count_missing"
  | "unsupported_scenario"
  | "live_mode_forbidden"
  | "malformed_request";

export interface ArchivistDryRunPin {
  title: string;
  manuscript_id: string;
  manuscript_version_id: string;
  version_number: number | null;
  content_hash: string;
  analytical_word_count: number;
  execution_mode: "dry_run";
  series_id: string | null;
  series_order: number | null;
}

export type ArchivistDryRunSnapshot = ArchivistDryRunPin;

export interface PresentedEvidence {
  location: string;
  excerpt: string;
  source: string;
}

export interface PresentedFinding {
  id: string;
  issue_type_label: string;
  classification: string;
  classification_label: string;
  severity: string;
  confidence: string;
  current_location: string;
  current_evidence: PresentedEvidence[];
  conflicting_location: string;
  conflicting_source: string;
  conflicting_evidence: PresentedEvidence[];
  temporal_analysis: string;
  explanation: string;
  suggested_resolution: string;
  is_confirmed_contradiction: boolean;
}

export interface PresentedCanonCandidate {
  id: string;
  entity: string;
  entity_type: string;
  fact_type: string;
  proposed_value: string;
  temporal_scope: string;
  source_location: string;
  evidence: PresentedEvidence[];
  confidence: string;
  proposed_authority: string;
  status: "candidate";
}

export interface PresentedEntityAmbiguity {
  id: string;
  alias: string;
  candidate_entities: string[];
  context: string;
  confidence: string;
  recommended_author_verification: string;
  did_not_guess: true;
}

export interface ArchivistDryRunUiSuccess {
  ok: true;
  banners: typeof ARCHIVIST_DRY_RUN_BANNERS;
  pin: ArchivistDryRunPin;
  scenario: ArchivistDryRunScenario;
  summary: {
    execution_mode: "dry_run";
    status: ExecuteExpertStatus;
    runtime_ms: number;
    provider: "none";
    model: "none";
    cost_usd: 0;
    cost_status: "exact";
    published: false;
    call_count: 0;
    input_tokens: 0;
    output_tokens: 0;
  };
  findings: PresentedFinding[];
  candidates: PresentedCanonCandidate[];
  ambiguities: PresentedEntityAmbiguity[];
  future_actions: Array<{
    key: string;
    label: string;
    disabled: true;
    note: typeof ARCHIVIST_DRY_RUN_FUTURE_ACTION_NOTE;
  }>;
  canon_writes: {
    accepted_facts: 0;
    accepted_bible_revisions: 0;
    persisted: false;
  };
}

export interface ArchivistDryRunUiFailure {
  ok: false;
  error_code: ArchivistDryRunUiErrorCode;
  error_message: string;
  banners: typeof ARCHIVIST_DRY_RUN_BANNERS;
  pin?: ArchivistDryRunPin;
  scenario?: string;
}

export type ArchivistDryRunUiResult = ArchivistDryRunUiSuccess | ArchivistDryRunUiFailure;
