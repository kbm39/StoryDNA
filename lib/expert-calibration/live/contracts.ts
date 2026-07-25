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
  | "live_execution_not_implemented"
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
}

export interface LiveCalibrationSideEffectGuards {
  readonly modelCalls: 0;
  readonly providerCalls: 0;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

export interface LiveCalibrationResult {
  readonly ok: boolean;
  readonly schema_version: typeof LIVE_CALIBRATION_SCHEMA_VERSION;
  readonly mode: LiveCalibrationMode;
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
  readonly modelCalls: 0;
  readonly providerCalls: 0;
  readonly productionWrites: 0;
  readonly productionExecutionOccurred: false;
}

export interface LiveCalibrationOrchestratorDependencies {
  readonly now?: () => number;
  readonly bypassFeatureFlags?: boolean;
  readonly syntheticScenario?: SyntheticScenarioId;
  readonly writeArtifacts?: boolean;
  readonly randomId?: () => string;
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
