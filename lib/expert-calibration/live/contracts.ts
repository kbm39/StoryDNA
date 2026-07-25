/**
 * Live calibration contracts (PR 3B-1).
 * Readonly, JSON-safe, closed enums — never imported by production paths.
 */

import type { CalibrationReport, CalibrationSuiteResult } from "../contracts.ts";
import type {
  LIVE_CALIBRATION_ALLOWED_EXPERTS,
  LIVE_CALIBRATION_ALLOWED_MODES,
  LIVE_CALIBRATION_ALLOWED_PROVIDERS,
  LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION,
  LIVE_CALIBRATION_SCHEMA_VERSION,
} from "./constants.ts";

export type LiveCalibrationMode = (typeof LIVE_CALIBRATION_ALLOWED_MODES)[number];
export type LiveCalibrationExpertKey = (typeof LIVE_CALIBRATION_ALLOWED_EXPERTS)[number];
export type LiveCalibrationProvider = (typeof LIVE_CALIBRATION_ALLOWED_PROVIDERS)[number];

export type LiveCalibrationFailureCode =
  | "authorization_failure"
  | "allowlist_violation"
  | "cost_limit_exceeded"
  | "timeout_abort"
  | "scoring_failure"
  | "invalid_configuration"
  | "provider_error"
  | "missing_api_key"
  | "synthetic_scenario_unknown"
  | "result_store_rejected"
  | "budget_exhausted"
  | "correlation_mismatch"
  | "general_failure";

export type LiveCalibrationSubsetId =
  | "military_expert_smoke_v1"
  | "military_expert_core_v1"
  | "military_expert_safety_v1"
  | "military_expert_ambiguity_v1"
  | "military_expert_full_v1"
  | "military_expert_stability_v1";

export type SyntheticScenarioId =
  | "success"
  | "parser_failure"
  | "timeout"
  | "rate_limit"
  | "service_failure"
  | "unsafe_output"
  | "output_too_large"
  | "budget_exhausted"
  | "correlation_mismatch";

export interface LiveCalibrationCliArgs {
  readonly mode: LiveCalibrationMode;
  readonly expert: LiveCalibrationExpertKey;
  readonly suite: string;
  readonly subset: LiveCalibrationSubsetId;
  readonly provider: LiveCalibrationProvider;
  readonly model: string;
  readonly runs: number;
  readonly maxCalls: number;
  readonly maxTotalCostUsd: number;
  readonly maxCostPerCallUsd: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly maxRuntimeMs: number;
  readonly outputDir: string;
  readonly overwrite: boolean;
  readonly ackToken?: string;
  readonly syntheticScenario?: SyntheticScenarioId;
  readonly correlationId?: string;
  readonly sessionId?: string;
  readonly sessionMaxCostUsd: number;
  readonly retainRawResponses: boolean;
}

export interface LiveCalibrationProviderSpec {
  readonly provider: LiveCalibrationProvider;
  readonly modelId: string;
  readonly modelAlias: string;
  readonly pricingProfileId: string;
}

export interface LiveCalibrationSubsetDefinition {
  readonly subsetId: LiveCalibrationSubsetId;
  readonly title: string;
  readonly caseIds: readonly string[];
  readonly subsetHash: string;
  readonly purpose: string;
}

export interface LiveCalibrationPlannedCall {
  readonly caseId: string;
  readonly runIndex: number;
  readonly correlationId: string;
  readonly estimatedInputTokens: number;
  readonly estimatedOutputTokens: number;
  readonly estimatedCostUsd: number;
  readonly requestHash: string;
  readonly systemPromptHash: string;
  readonly reviewPromptHash: string;
}

export interface LiveCalibrationCallPlan {
  readonly subsetId: LiveCalibrationSubsetId;
  readonly subsetHash: string;
  readonly suiteId: string;
  readonly expertKey: LiveCalibrationExpertKey;
  readonly providerSpec: LiveCalibrationProviderSpec;
  readonly runs: number;
  readonly calls: readonly LiveCalibrationPlannedCall[];
  readonly totalEstimatedInputTokens: number;
  readonly totalEstimatedOutputTokens: number;
  readonly totalEstimatedCostUsd: number;
}

export interface LiveCalibrationBudgetSnapshot {
  readonly callsUsed: number;
  readonly callsRemaining: number;
  readonly totalCostMicroUsd: number;
  readonly totalCostUsd: number;
  readonly costRemainingMicroUsd: number;
  readonly costRemainingUsd: number;
  readonly inputTokensUsed: number;
  readonly outputTokensUsed: number;
  readonly budgetExhausted: boolean;
}

export interface LiveCalibrationProviderMetadata {
  readonly provider: LiveCalibrationProvider;
  readonly model_id: string;
  readonly sdk_version: string;
  readonly api_version: string;
  readonly response_schema_version: string;
}

export interface LiveCalibrationRunManifest {
  readonly schema_version: typeof LIVE_CALIBRATION_MANIFEST_SCHEMA_VERSION;
  readonly run_id: string;
  readonly correlation_id: string;
  readonly mode: LiveCalibrationMode;
  readonly expert_key: LiveCalibrationExpertKey;
  readonly suite_id: string;
  readonly subset_id: LiveCalibrationSubsetId;
  readonly subset_hash: string;
  readonly provider: LiveCalibrationProvider;
  readonly model_id: string;
  readonly pricing_profile_id: string;
  readonly runs: number;
  readonly planned_calls: number;
  readonly estimated_cost_usd: number;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly synthetic_scenario: SyntheticScenarioId | null;
  readonly flags_acknowledged: boolean;
  readonly provider_metadata?: LiveCalibrationProviderMetadata;
}

export interface LiveCalibrationSideEffectGuards {
  readonly modelCalls: 0;
  readonly providerCalls: 0;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

export interface LiveCalibrationBaseResult {
  readonly ok: boolean;
  readonly schema_version: typeof LIVE_CALIBRATION_SCHEMA_VERSION;
  readonly runId: string;
  readonly correlationId: string;
  readonly exitCode: number;
  readonly failureCode: LiveCalibrationFailureCode | null;
  readonly failureReason: string | null;
  readonly callPlan: LiveCalibrationCallPlan | null;
  readonly suiteResult: CalibrationSuiteResult | null;
  readonly report: CalibrationReport | null;
  readonly manifest: LiveCalibrationRunManifest | null;
  readonly filesWritten: number;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

export interface LiveCalibrationDryRunResult extends LiveCalibrationBaseResult {
  readonly mode: "dry-run";
  readonly modelCalls: 0;
  readonly providerCalls: 0;
}

export interface LiveCalibrationSyntheticResult extends LiveCalibrationBaseResult {
  readonly mode: "synthetic";
  readonly modelCalls: 0;
  readonly providerCalls: 0;
}

export interface LiveCalibrationLiveResult extends LiveCalibrationBaseResult {
  readonly mode: "live";
  readonly modelCalls: number;
  readonly providerCalls: number;
  readonly sessionId: string;
}

export type LiveCalibrationResult =
  | LiveCalibrationDryRunResult
  | LiveCalibrationSyntheticResult
  | LiveCalibrationLiveResult;

export type LiveCalibrationSessionReservationStatus =
  | "active"
  | "settled"
  | "failed"
  | "abandoned";

export interface LiveCalibrationSessionReservationRecord {
  readonly reservation_id: string;
  readonly session_id: string;
  readonly run_id: string;
  readonly case_id: string;
  readonly correlation_id: string;
  readonly reserved_micro_usd: number;
  readonly status: LiveCalibrationSessionReservationStatus;
  readonly created_at: string;
  readonly settled_at: string | null;
}

export interface LiveCalibrationSessionBudget {
  readonly schema_version: "expert_calibration_session@v2";
  readonly session_id: string;
  readonly max_cost_micro_usd: number;
  readonly spent_estimated_micro_usd: number;
  readonly spent_actual_micro_usd: number;
  readonly reserved_micro_usd: number;
  readonly version: number;
  readonly run_count: number;
  readonly reservations: Readonly<Record<string, LiveCalibrationSessionReservationRecord>>;
}

export type LiveCalibrationAuditEventType =
  | "live_run_started"
  | "live_run_completed"
  | "live_run_failed"
  | "provider_call_started"
  | "provider_call_completed"
  | "session_budget_reserved"
  | "session_budget_committed"
  | "session_reservation_created"
  | "session_reservation_rejected"
  | "session_reservation_settled"
  | "session_reservation_failed"
  | "authorization_denied";

export interface LiveCalibrationAuditEvent {
  readonly timestamp: string;
  readonly session_id: string;
  readonly run_id: string;
  readonly event_type: LiveCalibrationAuditEventType;
  readonly detail: Record<string, string | number | boolean | null>;
}

export interface LiveCalibrationProviderInvokeInput {
  readonly request: import("@/experts/military-expert/generation-contract.ts").MilitaryExpertGenerationRequest;
  readonly correlationId: string;
  readonly caseId: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface LiveCalibrationProviderInvokeResult {
  readonly ok: boolean;
  readonly rawResponse?: import("@/experts/military-expert/generation-types.ts").MilitaryExpertRawGenerationResponse;
  readonly providerError?: { readonly code: string; readonly message: string };
  readonly providerMetadata?: LiveCalibrationProviderMetadata;
  readonly durationMs: number;
}

export type LiveCalibrationProviderInvoker = (
  input: LiveCalibrationProviderInvokeInput,
) => Promise<LiveCalibrationProviderInvokeResult>;

export interface LiveCalibrationOrchestratorDependencies {
  readonly now?: () => number;
  readonly bypassFeatureFlags?: boolean;
  readonly syntheticScenario?: SyntheticScenarioId;
  readonly writeArtifacts?: boolean;
  readonly randomId?: () => string;
  readonly providerInvoker?: LiveCalibrationProviderInvoker;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface OperatorAuthorizationInput {
  readonly mode: LiveCalibrationMode;
  readonly ackToken?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly bypassFeatureFlags?: boolean;
}

export interface OperatorAuthorizationResult {
  readonly ok: boolean;
  readonly failureCode?: LiveCalibrationFailureCode;
  readonly message?: string;
}

export interface ResultStoreWriteInput {
  readonly outputDir: string;
  readonly runId: string;
  readonly filename: string;
  readonly content: string;
  readonly overwrite: boolean;
}

export interface AbortControllerLike {
  readonly signal: AbortSignal;
  abort(reason?: string): void;
}

export interface LiveCalibrationAbortDependencies {
  readonly createAbortController?: (timeoutMs: number) => AbortControllerLike;
}
