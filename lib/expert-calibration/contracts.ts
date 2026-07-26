/**
 * Shared Expert Calibration Framework contracts (PR 3A).
 * Expert-agnostic — no Military-specific fields.
 */

import type {
  EXPERT_CALIBRATION_CASE_SCHEMA_VERSION,
  EXPERT_CALIBRATION_REPORT_SCHEMA_VERSION,
  EXPERT_CALIBRATION_SUITE_SCHEMA_VERSION,
} from "./constants.ts";

export type CalibrationFailureCode =
  | "invalid_case"
  | "invalid_suite"
  | "duplicate_case_id"
  | "oversized_excerpt"
  | "invalid_enum"
  | "missing_rationale"
  | "contradictory_expectations"
  | "unapproved_provenance"
  | "credential_detected"
  | "suite_empty"
  | "replay_missing"
  | "adapter_failure"
  | "runner_rejected";

export type CalibrationCaseKind = "synthetic" | "approved" | "edge";
export type CalibrationCasePriority = "required" | "recommended" | "optional";
export type CalibrationDifficulty = "easy" | "medium" | "hard";
export type CalibrationAmbiguityLevel = "low" | "medium" | "high";
export type CalibrationSafetyClassification =
  | "editorial_only"
  | "unsafe_operational_trap"
  | "domain_boundary"
  | "dramatic_preservation";
export type CalibrationApprovalStatus = "approved" | "pending" | "rejected";
export type CalibrationProvenanceSource = "synthetic" | "approved_excerpt" | "regression";
export type CalibrationAdjudicationMode = "automatic" | "human_required" | "hybrid";
export type CalibrationMatchMode =
  | "exact"
  | "identifier"
  | "controlled_text"
  | "semantic"
  | "human_required";
export type CalibrationScoringProfile = "standard" | "true_negative" | "safety_editorial";
export type CalibrationRunMode = "test" | "replay";
export type CalibrationReadinessStatus = "ready" | "not_ready" | "insufficient_evidence";
export type CalibrationParseStatus =
  | "success"
  | "parse_failed"
  | "validation_failed"
  | "skipped"
  | "safety_failed";

export interface CalibrationManuscriptInput {
  readonly text: string;
  readonly scope: "scene" | "chapter_set" | "sample" | "full_manuscript";
  readonly word_count: number;
  readonly content_hash: string;
  readonly genre_context?: string | null;
  readonly country_period?: string | null;
}

export interface ExpectedFinding {
  readonly finding_key: string;
  readonly category: string;
  readonly realism_status?: string;
  readonly severity_min?: string;
  readonly confidence_min?: string;
  readonly title_pattern?: string;
  readonly must_include_evidence: boolean;
  readonly evidence_excerpt_pattern?: string;
  readonly recommendation_type?: string;
  readonly escalation_expert?: string | null;
  readonly match_mode: CalibrationMatchMode;
  readonly match_concepts?: readonly string[];
  readonly weight: number;
}

export interface ExpectedNonFinding {
  readonly non_finding_key: string;
  readonly category?: string;
  readonly forbidden_title_pattern?: string;
  readonly forbidden_realism_status?: readonly string[];
  readonly rationale: string;
  readonly weight: number;
}

export interface ExpectedUncertainty {
  readonly uncertainty_key: string;
  readonly category: string;
  readonly expected_status:
    | "insufficient_evidence"
    | "context_dependent"
    | "outside_expertise";
  readonly must_not_assert_confirmed_error: boolean;
  readonly rationale: string;
}

export interface ExpectedContraryEvidence {
  readonly finding_key: string;
  readonly required: boolean;
  readonly explicit_none_allowed: boolean;
  readonly rationale: string;
}

export interface ExpectedEscalation {
  readonly escalation_key: string;
  readonly category: string;
  readonly expected_expert: string;
  readonly required: boolean;
  readonly rationale: string;
}

export interface ProhibitedFinding {
  readonly prohibited_key: string;
  readonly category?: string;
  readonly title_pattern?: string;
  readonly realism_status?: string;
  readonly rationale: string;
}

export interface ExpertCalibrationCase {
  readonly case_id: string;
  readonly schema_version: typeof EXPERT_CALIBRATION_CASE_SCHEMA_VERSION;
  readonly expert_key: string;
  readonly expert_version: string;
  readonly definition_hash: string;
  readonly title: string;
  readonly domain: string;
  readonly domain_tags: readonly string[];
  readonly difficulty: CalibrationDifficulty;
  readonly ambiguity_level: CalibrationAmbiguityLevel;
  readonly case_kind: CalibrationCaseKind;
  readonly priority: CalibrationCasePriority;
  readonly manuscript: CalibrationManuscriptInput;
  readonly context?: string;
  readonly expected_findings: readonly ExpectedFinding[];
  readonly expected_non_findings: readonly ExpectedNonFinding[];
  readonly expected_uncertainties: readonly ExpectedUncertainty[];
  readonly expected_contrary_evidence: readonly ExpectedContraryEvidence[];
  readonly expected_escalations: readonly ExpectedEscalation[];
  readonly prohibited_findings: readonly ProhibitedFinding[];
  readonly adjudication: {
    readonly mode: CalibrationAdjudicationMode;
    readonly rationale: string;
  };
  readonly safety_classification: CalibrationSafetyClassification;
  readonly scoring_profile?: CalibrationScoringProfile;
  readonly provenance: {
    readonly author: string;
    readonly created_at: string;
    readonly source: CalibrationProvenanceSource;
    readonly approval_status: CalibrationApprovalStatus;
  };
  /** Bounded expert-specific metadata — JSON-safe primitives only. */
  readonly expert_metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ExpertCalibrationSuite {
  readonly suite_id: string;
  readonly schema_version: typeof EXPERT_CALIBRATION_SUITE_SCHEMA_VERSION;
  readonly expert_key: string;
  readonly expert_version: string;
  readonly definition_hash: string;
  readonly title: string;
  readonly thresholds_id: string;
  readonly cases: readonly ExpertCalibrationCase[];
}

export interface CalibrationRunConfiguration {
  readonly run_id: string;
  readonly correlation_id: string;
  readonly mode: CalibrationRunMode;
  readonly repeat_count: number;
  readonly baseline_sha?: string;
  readonly runtime_hash?: string;
  readonly system_prompt_hash?: string;
  readonly review_prompt_hash?: string;
  readonly bypass_feature_flag?: boolean;
}

export interface CalibrationInvocationRecord {
  readonly case_id: string;
  readonly run_index: number;
  readonly correlation_id: string;
  readonly duration_ms: number;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly request_hash: string | null;
  readonly raw_response_hash: string | null;
  readonly parsed_output_hash: string | null;
  readonly parse_status: CalibrationParseStatus;
  readonly repair_required: boolean;
}

export interface ScoredMatch {
  readonly key: string;
  readonly kind: "true_positive" | "false_positive" | "false_negative" | "prohibited" | "non_finding_violation";
  readonly category?: string;
  readonly score: number;
  readonly message: string;
}

export interface UncertaintyResult {
  readonly uncertainty_key: string;
  readonly matched: boolean;
  readonly message: string;
}

export interface HumanAdjudicationRecord {
  readonly case_id: string;
  readonly adjudicator: string;
  readonly decision: "confirm_auto" | "override_pass" | "override_fail";
  readonly notes: string;
  readonly adjudicated_at: string;
}

export interface CalibrationCaseResult {
  readonly case_id: string;
  readonly correlation_id: string;
  readonly ok: boolean;
  readonly run_index: number;
  readonly duration_ms: number;
  readonly model_calls: 0;
  readonly provider_calls: 0;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly request_hash: string | null;
  readonly raw_response_hash: string | null;
  readonly parsed_output_hash: string | null;
  readonly true_positives: readonly ScoredMatch[];
  readonly false_positives: readonly ScoredMatch[];
  readonly false_negatives: readonly ScoredMatch[];
  readonly prohibited_violations: readonly ScoredMatch[];
  readonly non_finding_violations: readonly ScoredMatch[];
  readonly uncertainty_results: readonly UncertaintyResult[];
  readonly case_score: number;
  readonly evidence_quality_score: number;
  readonly editorial_quality_score: number | null;
  readonly parse_status: CalibrationParseStatus;
  readonly repair_required: boolean;
  readonly safety_failure: boolean;
  readonly adjudication_required: boolean;
  readonly human_adjudication_pending: boolean;
  readonly failure_reason?: string;
  readonly production_execution_occurred: false;
}

export interface CalibrationMetrics {
  readonly cases_total: number;
  readonly cases_passed: number;
  readonly cases_failed: number;
  readonly cases_skipped: number;
  readonly cases_needing_human: number;
  readonly true_positives: number;
  readonly false_positives: number;
  readonly false_negatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly hallucination_rate: number;
  readonly unsupported_finding_rate: number;
  readonly missed_finding_rate: number;
  readonly attempted_runs: number;
  readonly completed_runs: number;
  readonly failed_runs: number;
  readonly parser_failures: number;
  readonly repair_required_runs: number;
  readonly parse_success_rate: number;
  readonly validation_success_rate: number;
}

export interface EvidenceMetrics {
  readonly mean_evidence_presence: number;
  readonly mean_evidence_support: number;
  readonly mean_contrary_evidence_compliance: number;
  readonly mean_uncertainty_compliance: number;
  readonly mean_confidence_justification: number;
}

export interface EditorialQualityMetrics {
  readonly mean_usefulness: number | null;
  readonly mean_specificity: number | null;
  readonly mean_practicality: number | null;
  readonly mean_dramatic_intent_preservation: number | null;
  readonly mean_escalation_quality: number | null;
  readonly mean_non_finding_discipline: number | null;
  readonly human_adjudicated: boolean;
  readonly pending_human_count: number;
}

export interface StabilityMetrics {
  readonly repeat_count: number;
  readonly sufficient_repetition: boolean;
  readonly hash_agreement_rate: number | null;
  readonly finding_set_jaccard_mean: number | null;
  readonly severity_stability: number | null;
  readonly confidence_stability: number | null;
  readonly recommendation_stability: number | null;
  readonly uncertainty_stability: number | null;
  readonly escalation_stability: number | null;
  readonly score_variance: number | null;
}

export interface CostMetrics {
  readonly total_input_tokens: number;
  readonly total_output_tokens: number;
  readonly total_tokens: number;
  readonly estimated_cost_usd: number;
  readonly cost_per_case_mean: number;
  readonly pricing_profile_id: string;
}

export interface LatencyMetrics {
  readonly total_duration_ms: number;
  readonly case_duration_p50_ms: number;
  readonly case_duration_p95_ms: number;
  readonly case_duration_max_ms: number;
}

export interface CertificationThresholdBlockers {
  readonly min_precision: number;
  readonly min_recall: number;
  readonly max_hallucination_rate: number;
  readonly max_unsupported_finding_rate: number;
  readonly min_evidence_compliance: number;
  readonly min_contrary_evidence_compliance: number;
  readonly min_uncertainty_compliance: number;
  readonly min_preservation_score: number;
  readonly max_parser_failure_rate: number;
  readonly max_repair_required_rate: number;
  readonly required_case_pass_rate: number;
  readonly max_critical_false_negatives: number;
  readonly min_stability: number | null;
  readonly max_cost_per_review_usd: number | null;
  readonly max_p95_latency_ms: number | null;
}

export interface CertificationThresholdWarnings {
  readonly recall_below_target: number | null;
  readonly stability_below_target: number | null;
  readonly cost_above_target: number | null;
  readonly latency_above_target_ms: number | null;
  readonly editorial_quality_below: number | null;
}

export interface CertificationThresholds {
  readonly threshold_id: string;
  readonly expert_key: string;
  readonly expert_version: string;
  readonly blockers: CertificationThresholdBlockers;
  readonly warnings: CertificationThresholdWarnings;
  readonly domain_overrides?: Readonly<
    Record<string, Partial<CertificationThresholdBlockers>>
  >;
}

export interface CertificationReadinessDecision {
  readonly status: CalibrationReadinessStatus;
  readonly ready: boolean;
  readonly blockers_failed: readonly string[];
  readonly warnings_raised: readonly string[];
  readonly human_adjudication_pending: number;
  readonly certified: false;
}

export interface CalibrationFailure {
  readonly code: CalibrationFailureCode;
  readonly message: string;
  readonly case_id?: string;
}

export interface CalibrationReport {
  readonly report_id: string;
  readonly schema_version: typeof EXPERT_CALIBRATION_REPORT_SCHEMA_VERSION;
  readonly suite_id: string;
  readonly run_id: string;
  readonly expert_key: string;
  readonly expert_version: string;
  readonly definition_hash: string;
  readonly mode: CalibrationRunMode;
  readonly executive_summary: string;
  readonly suite_result: CalibrationSuiteResult;
  readonly markdown: string;
  readonly audit_trail: Readonly<Record<string, string | number | boolean | null>>;
  readonly limitations: readonly string[];
}

export interface CalibrationSuiteResult {
  readonly suite_id: string;
  readonly run_id: string;
  readonly expert_key: string;
  readonly expert_version: string;
  readonly definition_hash: string;
  readonly mode: CalibrationRunMode;
  readonly case_results: readonly CalibrationCaseResult[];
  readonly metrics: CalibrationMetrics;
  readonly evidence_metrics: EvidenceMetrics;
  readonly editorial_metrics: EditorialQualityMetrics;
  readonly stability: StabilityMetrics | null;
  readonly cost: CostMetrics | null;
  readonly latency: LatencyMetrics;
  readonly certification: CertificationReadinessDecision;
  readonly duration_ms: number;
  readonly started_at: string;
  readonly completed_at: string;
  readonly model_calls: 0;
  readonly provider_calls: 0;
  readonly production_writes: 0;
  readonly files_written: number;
  readonly production_execution_occurred: false;
}

/** Projected finding for deterministic matching — adapter produces these. */
export interface CalibrationProjectedFinding {
  readonly finding_key: string;
  readonly category: string;
  readonly title: string;
  readonly realism_status: string;
  readonly severity: string;
  readonly confidence: string;
  readonly has_manuscript_evidence: boolean;
  readonly evidence_excerpts: readonly string[];
  readonly has_contrary_evidence: boolean;
  readonly contrary_evidence_explicit_none: boolean;
  readonly escalation_expert: string | null;
  readonly recommendation_type: string;
  readonly preservation_note_present: boolean;
  readonly operational_impact_present: boolean;
  readonly story_impact_present: boolean;
  readonly uncertainty_note_present: boolean;
  readonly safety_violation: boolean;
  readonly observation?: string;
  readonly combined_text?: string;
}

export interface CalibrationCategoryAssessmentContext {
  readonly category: string;
  readonly status: string;
  readonly strength_summary?: string;
  readonly concern_summary?: string;
}

export interface CalibrationScoringContext {
  readonly strengths?: readonly string[];
  readonly summary?: string;
  readonly conclusion?: string;
  readonly next_step?: string;
  readonly category_assessments?: readonly CalibrationCategoryAssessmentContext[];
}

export interface ExpectationMatchRecord {
  readonly expectation_id: string;
  readonly matched_finding_index: number | null;
  readonly matched_fields: readonly string[];
  readonly matched_concepts: readonly string[];
  readonly rejection_reasons: readonly string[];
  readonly match_confidence: number;
  readonly match_source:
    | "semantic_finding"
    | "identifier"
    | "true_negative_context"
    | "safety_editorial_context"
    | "unmatched";
}

export interface CalibrationReplayOutput {
  readonly case_id: string;
  readonly run_index: number;
  readonly review?: unknown;
  readonly parse_status?: CalibrationParseStatus;
  readonly repair_required?: boolean;
  readonly safety_failure?: boolean;
  readonly duration_ms?: number;
  readonly input_tokens?: number | null;
  readonly output_tokens?: number | null;
  readonly request_hash?: string | null;
  readonly raw_response_hash?: string | null;
  readonly parsed_output_hash?: string | null;
  readonly failure_reason?: string;
}

export interface ExpertCalibrationAdapter<TReview = unknown> {
  readonly expertKey: string;
  readonly expertVersion: string;
  readonly definitionHash: string;
  projectFindings(review: TReview): readonly CalibrationProjectedFinding[];
  projectScoringContext?(review: TReview): CalibrationScoringContext | undefined;
  validateOutput(review: unknown): { ok: boolean; errors: readonly string[] };
  isSafetyFailure(review: unknown): boolean;
}

export interface CalibrationSideEffectGuards {
  readonly onModelCall?: () => void;
  readonly onProviderCall?: () => void;
  readonly onProductionWrite?: () => void;
  readonly onFileWrite?: () => void;
}

export interface CalibrationRunnerDependencies<TReview = unknown> {
  readonly adapter: ExpertCalibrationAdapter<TReview>;
  readonly thresholds: CertificationThresholds;
  readonly bypassFeatureFlag?: boolean;
  readonly featureFlagReader?: () => boolean;
  readonly humanAdjudications?: readonly HumanAdjudicationRecord[];
  readonly sideEffectGuards?: CalibrationSideEffectGuards;
  readonly now?: () => number;
  readonly writeReportFile?: (path: string, content: string) => void;
}
