/**
 * Literary Agent deterministic replay harness (P2-24).
 *
 * Replays downstream deterministic processing from captured certified model outputs.
 * No model calls, publishing, database writes, or production workflow invocation.
 */

import { buildCanonicalReviewInput, type CanonicalReviewInput } from "@/lib/canonical-review-input.ts";
import { parseRevisionCandidates } from "@/lib/ai/review-engine.ts";
import type { ParsedIssue } from "@/lib/ai/review-engine.ts";
import {
  assessRubricGenerationResult,
  combineMemoAndRubric,
  evaluateCallAGeneration,
  shouldRetryRubricGeneration,
  validateCombinedCommercialReview,
  validateMemoBeforeRubric,
} from "@/lib/commercial-review-generation.ts";
import { buildReviewGradingRecord } from "@/lib/commercial-review-pipeline.ts";
import { GRADING_FORMULA_VERSION } from "@/lib/commercial-fiction-rubric.ts";
import { normalizeCommercialMemoStatistics } from "@/lib/commercial-review-repair.ts";
import { validatePostScoringRubric } from "@/lib/contrary-evidence/post-scoring-validation.ts";
import { buildReplacementPayload } from "@/lib/editorial-generation/replacement-payload.ts";
import { buildReviewStatistics, type ReviewStatistics } from "@/lib/review-statistics.ts";
import { validateCommercialRubric } from "@/lib/rubric-validation.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";
import {
  compareCanonicalOutputs,
  hashCanonicalOutput,
  type CanonicalOutputMismatch,
  type CompareCanonicalOutputsResponse,
} from "./canonical-output.ts";
import {
  EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME,
  readExpertLiteraryAgentReplayEnabled,
} from "./feature-flags.ts";
import {
  LITERARY_AGENT_REPLAY_DEFINITION_HASH,
  LITERARY_AGENT_REPLAY_EXPERT_KEY,
  validateLiteraryAgentReplayArtifactBundle,
  type LiteraryAgentExpectedCertifiedResult,
  type LiteraryAgentReplayArtifactBundle,
} from "./replay-artifact-contract.ts";
import {
  orderedLiteraryAgentReplayStages,
  type LiteraryAgentReplayStageId,
} from "./replay-stage-registry.ts";
import { runExpertReview, type RunExpertReviewDependencies } from "./run-expert-review.ts";

export {
  EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME,
  readExpertLiteraryAgentReplayEnabled,
  LITERARY_AGENT_REPLAY_DEFINITION_HASH,
  LITERARY_AGENT_REPLAY_EXPERT_KEY,
};

export type LiteraryAgentReplayParityStatus =
  | "replay_match"
  | "replay_mismatch"
  | "replay_disabled"
  | "invalid_artifact_bundle"
  | "version_mismatch"
  | "definition_hash_mismatch"
  | "unsupported_artifact_schema"
  | "required_artifact_missing"
  | "deterministic_stage_failed"
  | "prohibited_stage_required"
  | "canonicalization_failed"
  | "aborted"
  | "timeout"
  | "unexpected_replay_failure";

export type LiteraryAgentReplayFailureReason = LiteraryAgentReplayParityStatus;

export interface LiteraryAgentReplayInput {
  artifactBundle: unknown;
  correlationId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface LiteraryAgentReplayStageResult {
  stageId: LiteraryAgentReplayStageId;
  ok: boolean;
  durationMs: number;
  message?: string;
  outputHash?: string;
}

export interface LiteraryAgentReplayResultBase {
  correlationId: string;
  replayId: string;
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  artifactSchemaVersion: string;
  sourceType: string;
  executionPlanned: boolean;
  replayExecutionOccurred: boolean;
  productionExecutionOccurred: false;
  modelCalls: 0;
  writes: 0;
  filesWritten: 0;
  stagesAttempted: readonly LiteraryAgentReplayStageId[];
  stagesCompleted: readonly LiteraryAgentReplayStageId[];
  stageResults: readonly LiteraryAgentReplayStageResult[];
  certifiedOutputHash?: string;
  replayOutputHash?: string;
  mismatchDiagnostics: readonly CanonicalOutputMismatch[];
  durationMs: number;
  failureReason?: LiteraryAgentReplayFailureReason;
}

export interface LiteraryAgentReplaySuccess extends LiteraryAgentReplayResultBase {
  ok: true;
  parityStatus: "replay_match" | "replay_mismatch";
}

export interface LiteraryAgentReplayFailure extends LiteraryAgentReplayResultBase {
  ok: false;
  parityStatus: Exclude<LiteraryAgentReplayParityStatus, "replay_match" | "replay_mismatch">;
  message: string;
}

export type LiteraryAgentReplayResult = LiteraryAgentReplaySuccess | LiteraryAgentReplayFailure;

export interface LiteraryAgentReplaySideEffectGuards {
  onModelCall?: () => void;
  onRepairCall?: () => void;
  onTriggerCall?: () => void;
  onSupabaseCall?: () => void;
  onPublishCall?: () => void;
  onReviewWrite?: () => void;
  onFileWrite?: () => void;
  onProductionWorkflowCall?: () => void;
}

export interface LiteraryAgentReplayDependencies {
  featureFlagReader?: () => boolean;
  bypassFeatureFlag?: boolean;
  runExpertReviewFn?: typeof runExpertReview;
  runExpertReviewDependencies?: RunExpertReviewDependencies;
  guards?: LiteraryAgentReplaySideEffectGuards;
  now?: () => number;
  /** Test hook: inject delay before a stage to trigger timeout. */
  beforeStage?: (stageId: LiteraryAgentReplayStageId) => void | Promise<void>;
  /** Test hook: override final canonical comparison. */
  compareProjectionsFn?: (
    replayProjection: LiteraryAgentExpectedCertifiedResult,
    expectedProjection: LiteraryAgentExpectedCertifiedResult,
  ) => CompareCanonicalOutputsResponse;
}

interface ReplayPipelineState {
  bundle: LiteraryAgentReplayArtifactBundle;
  canonicalInput: CanonicalReviewInput;
  statistics: ReviewStatistics;
  memoContent: string;
  rubricAssessment: ReturnType<typeof assessRubricGenerationResult>;
  postScoring: ReturnType<typeof validatePostScoringRubric>;
  adjustedGrading: ReturnType<typeof validateCommercialRubric>;
  validatedReview: NonNullable<
    ReturnType<typeof validateCombinedCommercialReview>["result"]
  >;
  replacementPayload: ReturnType<typeof buildReplacementPayload>;
  gradingRecord: Record<string, unknown>;
  combinedContent: string;
}

function buildReplayId(correlationId: string): string {
  return `${correlationId}:literary-agent-replay`;
}

function assertSideEffectGuards(guards: LiteraryAgentReplaySideEffectGuards | undefined): void {
  guards?.onModelCall?.();
  guards?.onTriggerCall?.();
  guards?.onSupabaseCall?.();
  guards?.onPublishCall?.();
  guards?.onReviewWrite?.();
  guards?.onFileWrite?.();
  guards?.onProductionWorkflowCall?.();
}

function failureResult(
  partial: Partial<LiteraryAgentReplayResultBase> & {
    correlationId: string;
    parityStatus: LiteraryAgentReplayFailure["parityStatus"];
    message: string;
    durationMs: number;
  },
): LiteraryAgentReplayFailure {
  return {
    ok: false,
    expertKey: partial.expertKey ?? LITERARY_AGENT_REPLAY_EXPERT_KEY,
    expertVersion: partial.expertVersion ?? LITERARY_AGENT_EXPERT_VERSION,
    definitionHash: partial.definitionHash ?? LITERARY_AGENT_REPLAY_DEFINITION_HASH,
    artifactSchemaVersion: partial.artifactSchemaVersion ?? "unknown",
    sourceType: partial.sourceType ?? "unknown",
    replayId: partial.replayId ?? buildReplayId(partial.correlationId),
    executionPlanned: partial.executionPlanned ?? false,
    replayExecutionOccurred: partial.replayExecutionOccurred ?? false,
    productionExecutionOccurred: false,
    modelCalls: 0,
    writes: 0,
    filesWritten: 0,
    stagesAttempted: partial.stagesAttempted ?? [],
    stagesCompleted: partial.stagesCompleted ?? [],
    stageResults: partial.stageResults ?? [],
    mismatchDiagnostics: partial.mismatchDiagnostics ?? [],
    failureReason: partial.parityStatus,
    ...partial,
  };
}

/** Explicit projection for certified-result comparison — only listed fields are compared. */
export function projectCertifiedReplayComparison(
  state: ReplayPipelineState,
): LiteraryAgentExpectedCertifiedResult {
  const candidateCount = state.replacementPayload.issues.reduce((sum, issue) => {
    const candidates = (issue as { candidates?: unknown[] }).candidates;
    return sum + (Array.isArray(candidates) ? candidates.length : 0);
  }, 0);

  return {
    manuscript_score: state.gradingRecord.manuscript_score as number,
    manuscript_letter_grade: (state.gradingRecord.manuscript_letter_grade as string | null) ?? null,
    craft_score: state.gradingRecord.craft_score as number,
    acquisition_readiness_score: state.gradingRecord.acquisition_readiness_score as number,
    issue_count: state.replacementPayload.issues.length,
    candidate_count: candidateCount,
    canonical_word_count: state.statistics.canonical_word_count,
    grading_formula_version: GRADING_FORMULA_VERSION,
  };
}

function mapArtifactValidationFailure(
  correlationId: string,
  startedAt: number,
  now: () => number,
  validation: Extract<ReturnType<typeof validateLiteraryAgentReplayArtifactBundle>, { ok: false }>,
): LiteraryAgentReplayFailure {
  const statusMap: Record<string, LiteraryAgentReplayFailure["parityStatus"]> = {
    invalid_artifact_bundle: "invalid_artifact_bundle",
    version_mismatch: "version_mismatch",
    definition_hash_mismatch: "definition_hash_mismatch",
    unsupported_artifact_schema: "unsupported_artifact_schema",
    required_artifact_missing: "required_artifact_missing",
  };
  return failureResult({
    correlationId,
    parityStatus: statusMap[validation.code] ?? "invalid_artifact_bundle",
    message: validation.message,
    durationMs: Math.max(0, now() - startedAt),
    failureReason: statusMap[validation.code] ?? "invalid_artifact_bundle",
  });
}

function checkAbort(
  correlationId: string,
  replayId: string,
  signal: AbortSignal | undefined,
  startedAt: number,
  now: () => number,
): LiteraryAgentReplayFailure | null {
  if (signal?.aborted) {
    return failureResult({
      correlationId,
      replayId,
      parityStatus: "aborted",
      message: "Replay aborted before execution",
      durationMs: Math.max(0, now() - startedAt),
      failureReason: "aborted",
    });
  }
  return null;
}

function wouldRequireMemoRepair(
  outcome: ReturnType<typeof validateMemoBeforeRubric>,
): boolean {
  return !outcome.ok && Boolean(outcome.repairable);
}

function wouldRequireCombinedRepair(
  outcome: ReturnType<typeof validateCombinedCommercialReview>,
): boolean {
  return !outcome.ok && Boolean(outcome.repairable);
}

async function executeReplayPipeline(
  bundle: LiteraryAgentReplayArtifactBundle,
  deps: LiteraryAgentReplayDependencies,
  correlationId: string,
  replayId: string,
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
  startedAt: number,
  now: () => number,
): Promise<
  | { ok: true; state: ReplayPipelineState; stageResults: LiteraryAgentReplayStageResult[]; stagesCompleted: LiteraryAgentReplayStageId[] }
  | { ok: false; failure: LiteraryAgentReplayFailure; stageResults: LiteraryAgentReplayStageResult[]; stagesCompleted: LiteraryAgentReplayStageId[]; stagesAttempted: LiteraryAgentReplayStageId[] }
> {
  const stageResults: LiteraryAgentReplayStageResult[] = [];
  const stagesCompleted: LiteraryAgentReplayStageId[] = [];
  const stagesAttempted: LiteraryAgentReplayStageId[] = [];
  const meta = bundle.capturedValidationMetadata;
  const manuscriptMeta = bundle.manuscriptMetadata;
  const extractedText = meta.extractedText;
  const passageText =
    manuscriptMeta.passageVerificationText ??
    extractedText;

  let canonicalInput: CanonicalReviewInput | undefined;
  let statistics: ReviewStatistics | undefined;
  let memoContent = bundle.capturedMemoOutput.rawContent;
  let rubricAssessment: ReturnType<typeof assessRubricGenerationResult> | undefined;
  let postScoring: ReturnType<typeof validatePostScoringRubric> | undefined;
  let adjustedGrading: ReturnType<typeof validateCommercialRubric> | undefined;
  let validatedReview: ReplayPipelineState["validatedReview"] | undefined;
  let replacementPayload: ReturnType<typeof buildReplacementPayload> | undefined;
  let gradingRecord: Record<string, unknown> | undefined;
  let combinedContent: string | undefined;

  for (const stage of orderedLiteraryAgentReplayStages()) {
    if (stage.stageId === "canonical_result_comparison") continue;

    const stageStarted = now();
    stagesAttempted.push(stage.stageId);

    if (signal?.aborted) {
      return {
        ok: false,
        failure: failureResult({
          correlationId,
          replayId,
          parityStatus: "aborted",
          message: "Replay aborted during stage execution",
          durationMs: Math.max(0, now() - startedAt),
          stagesAttempted,
          stagesCompleted,
          stageResults,
          replayExecutionOccurred: true,
          executionPlanned: true,
          failureReason: "aborted",
        }),
        stageResults,
        stagesCompleted,
        stagesAttempted,
      };
    }

    if (typeof timeoutMs === "number" && now() - startedAt > timeoutMs) {
      return {
        ok: false,
        failure: failureResult({
          correlationId,
          replayId,
          parityStatus: "timeout",
          message: "Replay timed out",
          durationMs: Math.max(0, now() - startedAt),
          stagesAttempted,
          stagesCompleted,
          stageResults,
          replayExecutionOccurred: true,
          executionPlanned: true,
          failureReason: "timeout",
        }),
        stageResults,
        stagesCompleted,
        stagesAttempted,
      };
    }

    await deps.beforeStage?.(stage.stageId);

    try {
      switch (stage.stageId) {
        case "canonical_manuscript_metadata_verification": {
          const canonicalResult = buildCanonicalReviewInput({
            manuscriptVersionId: bundle.manuscriptVersionId,
            extractedText,
            storedWordCount: meta.storedWordCount,
            contentHash: meta.contentHash,
          });
          if (!canonicalResult.ok) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: canonicalResult.error,
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: `Stage ${stage.stageId} failed: ${canonicalResult.error}`,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          canonicalInput = canonicalResult.input;
          statistics = buildReviewStatistics({
            manuscriptId: manuscriptMeta.manuscriptId,
            manuscriptVersionId: bundle.manuscriptVersionId,
            extractedText,
            sentChars: manuscriptMeta.sentChars ?? extractedText.length,
            storedWordCount: meta.storedWordCount,
            characterCount: manuscriptMeta.characterCount,
            canonicalInput,
          });
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({ canonicalInput, statistics }),
          });
          break;
        }
        case "memo_truncation_gate": {
          const gate = evaluateCallAGeneration({
            generationMeta: bundle.capturedMemoOutput.generationMeta,
          });
          if (!gate.proceedToMemoValidation) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: gate.error ?? "Memo truncation gate blocked replay",
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: gate.error ?? "Memo truncation gate blocked replay",
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput(gate),
          });
          break;
        }
        case "pre_rubric_validation": {
          const memoValidation = validateMemoBeforeRubric({
            memoContent,
            canonicalWordCount: statistics!.canonical_word_count,
          });
          if (wouldRequireMemoRepair(memoValidation)) {
            deps.guards?.onRepairCall?.();
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: "Memo validation would require model repair in production",
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "prohibited-repair",
                parityStatus: "prohibited_stage_required",
                message: `Stage ${stage.stageId} would invoke repairCommercialMemoValidation in production`,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "prohibited_stage_required",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          if (!memoValidation.ok) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: memoValidation.error,
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: memoValidation.error ?? "Memo validation failed",
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({ ok: true }),
          });
          break;
        }
        case "rubric_parse": {
          rubricAssessment = assessRubricGenerationResult({
            rawContent: bundle.capturedRubricOutput.rawContent,
            generationMeta: bundle.capturedRubricOutput.generationMeta,
            statistics: statistics!,
            statisticsValid: true,
          });
          if (shouldRetryRubricGeneration(rubricAssessment)) {
            deps.guards?.onRepairCall?.();
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: "Rubric assessment would require rubric retry in production",
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "prohibited-retry",
                parityStatus: "prohibited_stage_required",
                message: `Stage ${stage.stageId} would invoke rubric retry in production (${rubricAssessment.failureKind})`,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "prohibited_stage_required",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          if (!rubricAssessment.parsed.payload) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: rubricAssessment.parsed.parseError ?? "Rubric parse failed",
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: rubricAssessment.parsed.parseError ?? "Rubric parse failed",
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({
              failureKind: rubricAssessment.failureKind,
              valid: rubricAssessment.rubricGrading.valid,
            }),
          });
          break;
        }
        case "post_scoring_validation": {
          postScoring = validatePostScoringRubric({
            payload: rubricAssessment!.parsed.payload!,
            preGateAssessments: [...(meta.preGateAssessments ?? [])],
            preScoringGate: meta.preScoringGate ?? {
              valid: true,
              errors: [],
              assessments: [],
              adjusted_deductions: [],
              total_points_restored: 0,
            },
            gateRequired: meta.gateRequired ?? false,
            gateRan: meta.gateRan ?? false,
            priorReviewId: meta.priorReviewId ?? null,
            comparison_mode: meta.comparison_mode,
            canonicalWordCount: statistics!.canonical_word_count,
            fullTextSupplied: statistics!.full_text_supplied,
            memoContent,
            normalizationResult: meta.normalizationResult,
          });
          if (!postScoring.valid) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: postScoring.errors.slice(0, 3).join(" "),
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: `Post-scoring validation failed: ${postScoring.errors.slice(0, 3).join(" ")}`,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          adjustedGrading = validateCommercialRubric({
            payload: postScoring.adjustedPayload,
            parseError: null,
            categoryKeyErrors: [],
            canonicalWordCount: statistics!.canonical_word_count,
            fullTextSupplied: statistics!.full_text_supplied,
            statisticsValid: true,
          });
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({
              manuscriptScore: postScoring.manuscriptScore,
              letterGrade: postScoring.letterGrade,
            }),
          });
          break;
        }
        case "memo_statistics_normalization": {
          const normalized = normalizeCommercialMemoStatistics({
            memoContent,
            canonicalWordCount: statistics!.canonical_word_count,
          });
          if (!normalized.ok) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: normalized.error,
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: normalized.error,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          memoContent = normalized.content;
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({ changed: normalized.changed }),
          });
          break;
        }
        case "combined_review_validation": {
          const combinedValidation = validateCombinedCommercialReview({
            memoContent,
            rubricPayload: postScoring!.adjustedPayload,
            statistics: statistics!,
            reviewMeta: meta.reviewMeta ?? null,
          });
          if (wouldRequireCombinedRepair(combinedValidation)) {
            deps.guards?.onRepairCall?.();
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: "Combined validation would require model repair in production",
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "prohibited-combined-repair",
                parityStatus: "prohibited_stage_required",
                message: `Stage ${stage.stageId} would invoke repairCommercialMemoValidation in production`,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "prohibited_stage_required",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          if (!combinedValidation.ok || !combinedValidation.result) {
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message: combinedValidation.error,
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message: combinedValidation.error ?? "Combined review validation failed",
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          validatedReview = combinedValidation.result;
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({
              score: validatedReview.grading.manuscriptScore,
            }),
          });
          break;
        }
        case "revision_payload": {
          let parsedIssues: ParsedIssue[];
          try {
            ({ issues: parsedIssues } = parseRevisionCandidates(
              bundle.capturedRevisionCandidateOutput.rawContent,
            ));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            stageResults.push({
              stageId: stage.stageId,
              ok: false,
              durationMs: Math.max(0, now() - stageStarted),
              message,
            });
            return {
              ok: false,
              failure: failureResult({
                correlationId: "stage-failed",
                parityStatus: "deterministic_stage_failed",
                message,
                durationMs: Math.max(0, now() - startedAt),
                stagesAttempted,
                stagesCompleted,
                stageResults,
                replayExecutionOccurred: true,
                executionPlanned: true,
                failureReason: "deterministic_stage_failed",
              }),
              stageResults,
              stagesCompleted,
              stagesAttempted,
            };
          }
          replacementPayload = buildReplacementPayload(parsedIssues, passageText);
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput({ issueCount: replacementPayload.issues.length }),
          });
          break;
        }
        case "final_payload": {
          gradingRecord = buildReviewGradingRecord(validatedReview!, {
            adjustedGrading: adjustedGrading!,
            manuscript_version_id: bundle.manuscriptVersionId,
          });
          gradingRecord.manuscript_score = adjustedGrading!.manuscriptScore;
          gradingRecord.manuscript_letter_grade = adjustedGrading!.letterGrade;
          gradingRecord.craft_score = adjustedGrading!.craftScore;
          gradingRecord.acquisition_readiness_score = adjustedGrading!.acquisitionScore;
          gradingRecord.rubric_breakdown = postScoring!.adjustedPayload;
          combinedContent = combineMemoAndRubric(memoContent, postScoring!.adjustedPayload);
          stageResults.push({
            stageId: stage.stageId,
            ok: true,
            durationMs: Math.max(0, now() - stageStarted),
            outputHash: hashCanonicalOutput(projectCertifiedReplayComparison({
              bundle,
              canonicalInput: canonicalInput!,
              statistics: statistics!,
              memoContent,
              rubricAssessment: rubricAssessment!,
              postScoring: postScoring!,
              adjustedGrading: adjustedGrading!,
              validatedReview: validatedReview!,
              replacementPayload: replacementPayload!,
              gradingRecord,
              combinedContent,
            })),
          });
          break;
        }
        default:
          return {
            ok: false,
            failure: failureResult({
              correlationId: "unexpected",
              parityStatus: "unexpected_replay_failure",
              message: `Unregistered replay stage encountered: ${stage.stageId}`,
              durationMs: Math.max(0, now() - startedAt),
              stagesAttempted,
              stagesCompleted,
              stageResults,
              replayExecutionOccurred: true,
              executionPlanned: true,
              failureReason: "unexpected_replay_failure",
            }),
            stageResults,
            stagesCompleted,
            stagesAttempted,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stageResults.push({
        stageId: stage.stageId,
        ok: false,
        durationMs: Math.max(0, now() - stageStarted),
        message,
      });
      return {
        ok: false,
        failure: failureResult({
          correlationId: "unexpected",
          parityStatus: "unexpected_replay_failure",
          message,
          durationMs: Math.max(0, now() - startedAt),
          stagesAttempted,
          stagesCompleted,
          stageResults,
          replayExecutionOccurred: true,
          executionPlanned: true,
          failureReason: "unexpected_replay_failure",
        }),
        stageResults,
        stagesCompleted,
        stagesAttempted,
      };
    }

    stagesCompleted.push(stage.stageId);
  }

  return {
    ok: true,
    state: {
      bundle,
      canonicalInput: canonicalInput!,
      statistics: statistics!,
      memoContent,
      rubricAssessment: rubricAssessment!,
      postScoring: postScoring!,
      adjustedGrading: adjustedGrading!,
      validatedReview: validatedReview!,
      replacementPayload: replacementPayload!,
      gradingRecord: gradingRecord!,
      combinedContent: combinedContent!,
    },
    stageResults,
    stagesCompleted,
  };
}

/** Test helper: derive expected certified projection from a valid artifact bundle. */
export async function deriveReplayCertifiedProjection(
  bundle: LiteraryAgentReplayArtifactBundle,
): Promise<LiteraryAgentExpectedCertifiedResult | { ok: false; message: string }> {
  const pipeline = await executeReplayPipeline(
    bundle,
    {},
    "derive-projection",
    "derive-projection:literary-agent-replay",
    undefined,
    undefined,
    0,
    () => 0,
  );
  if (!pipeline.ok) {
    return { ok: false, message: pipeline.failure.message };
  }
  return projectCertifiedReplayComparison(pipeline.state);
}

/**
 * Run Literary Agent deterministic replay from a captured artifact bundle.
 *
 * Orchestrates plan-only runExpertReview and downstream deterministic stages
 * without production workflow side effects.
 */
export async function runLiteraryAgentReplay(
  input: LiteraryAgentReplayInput,
  dependencies: LiteraryAgentReplayDependencies = {},
): Promise<LiteraryAgentReplayResult> {
  const now = dependencies.now ?? (() => Date.now());
  const startedAt = now();
  const correlationId = input.correlationId;
  const replayId = buildReplayId(correlationId);
  const featureFlagReader =
    dependencies.featureFlagReader ?? readExpertLiteraryAgentReplayEnabled;

  assertSideEffectGuards(dependencies.guards);

  const preAbort = checkAbort(correlationId, replayId, input.signal, startedAt, now);
  if (preAbort) return preAbort;

  if (!dependencies.bypassFeatureFlag && !featureFlagReader()) {
    return failureResult({
      correlationId,
      replayId,
      parityStatus: "replay_disabled",
      message: `Literary Agent replay harness is disabled (${EXPERT_LITERARY_AGENT_REPLAY_FLAG_NAME} is off)`,
      durationMs: Math.max(0, now() - startedAt),
    });
  }

  const bundleSnapshot = structuredClone(input.artifactBundle);
  const validation = validateLiteraryAgentReplayArtifactBundle(input.artifactBundle);
  if (!validation.ok) {
    return mapArtifactValidationFailure(correlationId, startedAt, now, validation);
  }
  const bundle = validation.bundle;

  if (JSON.stringify(input.artifactBundle) !== JSON.stringify(bundleSnapshot)) {
    return failureResult({
      correlationId,
      replayId,
      parityStatus: "unexpected_replay_failure",
      message: "Artifact bundle was mutated during validation",
      durationMs: Math.max(0, now() - startedAt),
      artifactSchemaVersion: bundle.artifactSchemaVersion,
      sourceType: bundle.sourceType,
    });
  }

  const runExpertReviewFn = dependencies.runExpertReviewFn ?? runExpertReview;
  const planResult = await runExpertReviewFn(
    {
      manuscriptId: bundle.manuscriptMetadata.manuscriptId,
      manuscriptVersionId: bundle.manuscriptVersionId,
      executionMode: "plan_only",
      expertKey: bundle.expertKey,
      expertVersion: bundle.expertVersion,
      definitionHash: bundle.definitionHash,
      correlationId,
    },
    {
      bypassFeatureFlag: true,
      ...dependencies.runExpertReviewDependencies,
    },
  );

  if (!planResult.ok) {
    return failureResult({
      correlationId,
      replayId,
      parityStatus: "unexpected_replay_failure",
      message: planResult.message,
      durationMs: Math.max(0, now() - startedAt),
      executionPlanned: true,
      artifactSchemaVersion: bundle.artifactSchemaVersion,
      sourceType: bundle.sourceType,
    });
  }

  const pipeline = await executeReplayPipeline(
    bundle,
    dependencies,
    correlationId,
    replayId,
    input.signal,
    input.timeoutMs,
    startedAt,
    now,
  );

  if (!pipeline.ok) {
    return {
      ...pipeline.failure,
      correlationId,
      replayId,
      expertKey: bundle.expertKey,
      expertVersion: bundle.expertVersion,
      definitionHash: bundle.definitionHash,
      artifactSchemaVersion: bundle.artifactSchemaVersion,
      sourceType: bundle.sourceType,
    };
  }

  const replayProjection = projectCertifiedReplayComparison(pipeline.state);
  const expectedProjection = bundle.expectedCertifiedResult;
  const compareFn = dependencies.compareProjectionsFn ?? compareCanonicalOutputs;
  const comparison = compareFn(replayProjection, expectedProjection);

  const comparisonStageStarted = now();
  const comparisonStageResult: LiteraryAgentReplayStageResult = {
    stageId: "canonical_result_comparison",
    ok: false,
    durationMs: 0,
  };

  if (!comparison.ok) {
    comparisonStageResult.message = `Canonicalization failed on ${comparison.side} output at ${comparison.error.path}: ${comparison.error.code}`;
    return failureResult({
      correlationId,
      replayId,
      expertKey: bundle.expertKey,
      expertVersion: bundle.expertVersion,
      definitionHash: bundle.definitionHash,
      artifactSchemaVersion: bundle.artifactSchemaVersion,
      sourceType: bundle.sourceType,
      parityStatus: "canonicalization_failed",
      message: comparisonStageResult.message,
      durationMs: Math.max(0, now() - startedAt),
      executionPlanned: true,
      replayExecutionOccurred: true,
      stagesAttempted: [...pipeline.stageResults.map((s) => s.stageId), "canonical_result_comparison"],
      stagesCompleted: pipeline.stagesCompleted,
      stageResults: [
        ...pipeline.stageResults,
        {
          ...comparisonStageResult,
          durationMs: Math.max(0, now() - comparisonStageStarted),
        },
      ],
      failureReason: "canonicalization_failed",
    });
  }

  comparisonStageResult.ok = true;
  comparisonStageResult.durationMs = Math.max(0, now() - comparisonStageStarted);
  comparisonStageResult.outputHash = comparison.engineHash;

  return {
    ok: true,
    parityStatus: comparison.match ? "replay_match" : "replay_mismatch",
    correlationId,
    replayId,
    expertKey: bundle.expertKey,
    expertVersion: bundle.expertVersion,
    definitionHash: bundle.definitionHash,
    artifactSchemaVersion: bundle.artifactSchemaVersion,
    sourceType: bundle.sourceType,
    executionPlanned: true,
    replayExecutionOccurred: true,
    productionExecutionOccurred: false,
    modelCalls: 0,
    writes: 0,
    filesWritten: 0,
    stagesAttempted: [...pipeline.stageResults.map((s) => s.stageId), "canonical_result_comparison"],
    stagesCompleted: [...pipeline.stagesCompleted, "canonical_result_comparison"],
    stageResults: [...pipeline.stageResults, comparisonStageResult],
    certifiedOutputHash: comparison.directHash,
    replayOutputHash: comparison.engineHash,
    mismatchDiagnostics: comparison.mismatches,
    durationMs: Math.max(0, now() - startedAt),
  };
}
