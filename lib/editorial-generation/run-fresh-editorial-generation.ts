/**
 * Shared Literary Agent editorial generation orchestration.
 * Used by UI server actions and CLI — single production path.
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getManuscriptReviewContext } from "@/lib/reviews";
import { getStoryDna } from "@/lib/storydna";
import {
  generateRevisionCandidates,
  generateAgentReview,
  generateAgentRubric,
  repairCommercialMemoValidation,
} from "@/lib/ai/anthropic";
import { LITERARY_AGENT, type ParsedIssue } from "@/lib/ai/review-engine";
import type { AuthorIntent } from "@/lib/types";
import { buildReviewStatistics } from "@/lib/review-statistics";
import { buildCanonicalReviewInput } from "@/lib/canonical-review-input";
import {
  buildMemoTruncationDiagnostics,
  buildMemoRepairFailureDiagnostics,
  persistReviewFailureDiagnostics,
  reviewFailureDiagnosticsEnabled,
  writeMemoTruncationDiagnosticArtifact,
  type CommercialReviewFailureDiagnostics,
} from "@/lib/commercial-review-diagnostics";
import { normalizeCommercialMemoStatistics } from "@/lib/commercial-review-repair";
import { buildReviewGradingRecord } from "@/lib/commercial-review-pipeline";
import {
  assessRubricGenerationResult,
  combineMemoAndRubric,
  evaluateCallAGeneration,
  MEMO_TRUNCATION_ERROR,
  RUBRIC_PARSE_FAILURE_USER_MESSAGE,
  shouldRepairRubricJson,
  shouldRetryRubricGeneration,
  validateCombinedCommercialReview,
  validateMemoBeforeRubric,
} from "@/lib/commercial-review-generation";
import { validateCommercialRubric } from "@/lib/rubric-validation";
import { locatePassage } from "@/lib/manuscript-context";
import type { RevisionType } from "@/lib/types";
import {
  buildContraryEvidenceGatePromptBlock,
  buildGenreProfile,
  buildBlockedRunDiagnostics,
  writeBlockedRunDiagnosticArtifact,
  defaultSemanticAssessor,
  loadPriorReviewForGate,
  runContraryEvidenceGate,
  validatePostScoringRubric,
  type ConcernAssessment,
  type GateRunResult,
} from "@/lib/contrary-evidence";
import { CONTRARY_EVIDENCE_GATE_VERSION } from "@/lib/contrary-evidence/constants.ts";
import type {
  EditorialWorkflowHooks,
  InternalPhase,
} from "@/lib/editorial-workflow/types";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types";

export const EDITORIAL_GENERATION_ENTRY = "lib/editorial-generation/run-fresh-editorial-generation.ts";

async function workflowPhase(hooks: EditorialWorkflowHooks | undefined, phase: InternalPhase) {
  await hooks?.onPhase?.(phase);
}

async function workflowGuard(hooks: EditorialWorkflowHooks | undefined) {
  if (hooks?.shouldCancel && (await hooks.shouldCancel())) {
    throw new WorkflowCancelledError();
  }
  await hooks?.assertVersionPin?.();
}

export interface FreshEditorialGenerationResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
  oldReviewId?: string | null;
  newReviewId?: string;
  issueCount?: number;
  candidateCount?: number;
  diagnostics?: CommercialReviewFailureDiagnostics;
  diagnosticsStorageKey?: string | null;
}

const COMMENT_TYPES = new Set<RevisionType>(["reorder", "move", "combine", "split", "comment_only"]);

function intentFromDna(
  dna: Awaited<ReturnType<typeof getStoryDna>>,
): AuthorIntent | null {
  if (!dna?.data?.summary) return null;
  const d = dna.data;
  const emo = d.emotional_promise.final ?? d.emotional_promise.proposed;
  return {
    confirmed: dna.alignment_status === "aligned",
    summary: d.summary.final ?? d.summary.proposed,
    about: d.about.final ?? d.about.proposed,
    themes: d.themes.final ?? d.themes.proposed.map((t) => t.name),
    emotionalPromise: `Beginning: ${emo.beginning}; Middle: ${emo.middle}; Ending: ${emo.ending}; After: ${emo.after_finishing}`,
  };
}

function verifyOriginal(original: string, manuscriptText: string): boolean {
  if (!original.trim() || original.trim().length < 8) return false;
  return locatePassage(manuscriptText, original) !== null;
}

function buildReplacementPayload(
  issues: ParsedIssue[],
  manuscriptText: string,
): { issues: Record<string, unknown>[] } {
  return {
    issues: issues.map((issue) => ({
      text: issue.text,
      area: issue.area || null,
      severity: issue.severity,
      source_section: issue.source_section || null,
      success_criterion: issue.success_criterion || null,
      candidates: issue.candidates.map((c) => {
        const type = c.type as RevisionType;
        return {
          type,
          original: c.original,
          revised: c.revised,
          reason: c.reason || null,
          locator: c.locator || null,
          verified: COMMENT_TYPES.has(type) ? true : verifyOriginal(c.original, manuscriptText),
        };
      }),
    })),
  };
}

export interface GatePipelineState {
  gateRequired: boolean;
  gateRan: boolean;
  gateStatus: "skipped" | "completed" | "required_not_run" | "failed";
  priorReviewId: string | null;
  priorVersionId: string | null;
  priorScore: number | null;
  gateResult: GateRunResult | null;
  assessments: ConcernAssessment[];
}

/** @internal Exported for tests */
export function buildGatePublishMetadata(
  gate: GatePipelineState,
  postScoring: ReturnType<typeof validatePostScoringRubric>,
): Record<string, unknown> {
  return {
    contrary_evidence_gate_status: gate.gateStatus,
    contrary_evidence_gate_version: CONTRARY_EVIDENCE_GATE_VERSION,
    scoring_gate_valid: gate.gateRequired ? postScoring.scoringGateValid : true,
    duplicate_deduction_count: postScoring.duplicateDeductionCount,
    restored_points_total: postScoring.restoredPointsTotal,
    blocked_stale_deduction_count: postScoring.blockedStaleDeductionCount,
    prior_review_id: gate.priorReviewId,
    prior_manuscript_version_id: gate.priorVersionId,
    prior_manuscript_score: gate.priorScore,
    gate_assessment_count: gate.assessments.length,
  };
}

/**
 * Fresh versioned editorial run: Literary Agent review + atomic issue/candidate replacement.
 * AI generation runs first; DB changes only after all gates pass via publish_commercial_review_generation.
 */
export async function runFreshEditorialGeneration(
  manuscriptId: string,
  hooks?: EditorialWorkflowHooks,
): Promise<FreshEditorialGenerationResult> {
  if (!manuscriptId) return { ok: false, error: "Missing manuscript id." };

  await workflowPhase(hooks, "validating");

  const ctx = await getManuscriptReviewContext(manuscriptId);
  if (!ctx?.extractedText.trim()) {
    return { ok: false, error: "This manuscript has no extracted text." };
  }
  const text = ctx.extractedText;

  const supabase = getSupabaseAdmin();

  const { count: authorResponseCount } = await supabase
    .from("author_edit_responses")
    .select("id", { count: "exact", head: true })
    .eq("manuscript_id", manuscriptId);

  if ((authorResponseCount ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot regenerate: ${authorResponseCount} author response${
        authorResponseCount === 1 ? " has" : "s have"
      } already been recorded in Suggested Edits.`,
    };
  }

  const { data: oldActive } = await supabase
    .from("reviews")
    .select("id")
    .eq("manuscript_id", manuscriptId)
    .eq("perspective", "commercial")
    .eq("lifecycle_status", "active")
    .maybeSingle();

  const intent = intentFromDna(await getStoryDna(manuscriptId));
  const genre = buildGenreProfile(intent);

  const priorLoad = await loadPriorReviewForGate(
    supabase,
    manuscriptId,
    ctx.manuscriptVersionId,
  );

  const gateState: GatePipelineState = {
    gateRequired: priorLoad.gateRequired,
    gateRan: false,
    gateStatus: priorLoad.gateRequired ? "required_not_run" : "skipped",
    priorReviewId: priorLoad.priorReviewId,
    priorVersionId: priorLoad.priorVersionId,
    priorScore: priorLoad.priorManuscriptScore,
    gateResult: null,
    assessments: [],
  };

  const canonicalResult = buildCanonicalReviewInput({
    manuscriptVersionId: ctx.manuscriptVersionId,
    extractedText: text,
    storedWordCount: ctx.wordCount,
    contentHash: ctx.contentHash,
  });

  await workflowPhase(hooks, "preparing");
  await workflowGuard(hooks);

  if (!canonicalResult.ok) {
    return {
      ok: false,
      error: canonicalResult.error,
      diagnostics: reviewFailureDiagnosticsEnabled()
        ? {
            manuscriptId,
            manuscriptVersionId: ctx.manuscriptVersionId,
            canonicalWordCount: canonicalResult.recomputedWordCount,
            storedWordCount: ctx.wordCount,
            recomputedWordCount: canonicalResult.recomputedWordCount,
            originalReviewText: "",
            repairAttempted: false,
            originalPass: {
              pass: "original",
              ok: false,
              error: canonicalResult.error,
              wordCountErrors: [canonicalResult.error],
              wordCountContradictions: [],
              proseGradeConflicts: [],
              rubricValidationErrors: [],
            },
            capturedAt: new Date().toISOString(),
            failureKind: "UNSUPPORTED_LENGTH_CLAIM",
            failurePhase: "memo",
          }
        : undefined,
    };
  }

  const canonicalInput = canonicalResult.input;
  const recomputedWordCount = canonicalInput.recomputedWordCount;
  const statistics = buildReviewStatistics({
    manuscriptId: ctx.manuscriptId,
    manuscriptVersionId: ctx.manuscriptVersionId,
    extractedText: text,
    sentChars: text.length,
    storedWordCount: canonicalInput.storedWordCount,
    characterCount: ctx.characterCount,
    canonicalInput,
  });

  let reviewResult;
  try {
    await workflowPhase(hooks, "memo_generation");
    await workflowGuard(hooks);
    reviewResult = await generateAgentReview(text, intent, statistics);
  } catch (e) {
    if (e instanceof WorkflowCancelledError) throw e;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const callAGate = evaluateCallAGeneration({
    generationMeta: reviewResult.generationMeta,
  });

  if (!callAGate.proceedToMemoValidation) {
    const diagnostics = reviewFailureDiagnosticsEnabled()
      ? buildMemoTruncationDiagnostics({
          manuscriptId,
          manuscriptVersionId: ctx.manuscriptVersionId,
          statistics,
          storedWordCount: ctx.wordCount,
          recomputedWordCount,
          memoContent: reviewResult.content,
          memoGenerationMeta: reviewResult.generationMeta!,
        })
      : undefined;
    if (diagnostics) {
      writeMemoTruncationDiagnosticArtifact(diagnostics, "hold-fast-memo-truncation-latest.json");
    }
    return {
      ok: false,
      error: callAGate.error ?? MEMO_TRUNCATION_ERROR,
      diagnostics,
    };
  }

  let memoContent = reviewResult.content;
  let memoRepairAttempted = false;
  const originalMemoContent = memoContent;

  let memoValidation = validateMemoBeforeRubric({
    memoContent,
    canonicalWordCount: statistics.canonical_word_count,
  });

  if (!memoValidation.ok && memoValidation.repairable && !memoRepairAttempted) {
    memoRepairAttempted = true;
    let repairedMemoContent: string | undefined;
    let normalizedMemoContent: string | undefined;
    let normalizationError: string | undefined;

    try {
      await workflowPhase(hooks, "memo_repair");
      await workflowGuard(hooks);
      const repaired = await repairCommercialMemoValidation({
        memoContent,
        canonicalWordCount: statistics.canonical_word_count,
        wordCountContradictions: memoValidation.wordCountContradictions,
        wordCountErrors: memoValidation.wordCountErrors,
        proseGradeConflict: memoValidation.proseGradeConflict,
      });
      repairedMemoContent = repaired.content;

      const normalized = normalizeCommercialMemoStatistics({
        memoContent: repaired.content,
        canonicalWordCount: statistics.canonical_word_count,
      });
      normalizedMemoContent = normalized.content;
      memoContent = normalized.content;
      if (!normalized.ok) {
        normalizationError = normalized.error;
      }
    } catch (e) {
      if (e instanceof WorkflowCancelledError) throw e;
      return {
        ok: false,
        error: `Memo repair failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    memoValidation = validateMemoBeforeRubric({
      memoContent,
      canonicalWordCount: statistics.canonical_word_count,
      repairAttempted: true,
    });

    if (!memoValidation.ok) {
      const failureError = memoValidation.error ?? "Memo validation failed.";
      const diagnostics = buildMemoRepairFailureDiagnostics({
        manuscriptId,
        manuscriptVersionId: ctx.manuscriptVersionId,
        statistics,
        storedWordCount: ctx.wordCount,
        recomputedWordCount,
        originalMemoContent,
        repairedMemoContent,
        normalizedMemoContent,
        memoRepairAttempted: true,
        failureError,
        memoGenerationMeta: reviewResult.generationMeta ?? null,
        wordCountContradictions: memoValidation.wordCountContradictions,
        wordCountErrors: memoValidation.wordCountErrors,
        workflowId: hooks?.workflowId,
        triggerRunId: hooks?.triggerRunId,
        normalizationError,
      });
      const persisted = persistReviewFailureDiagnostics({ diagnostics });
      return {
        ok: false,
        error: failureError,
        diagnostics,
        diagnosticsStorageKey: persisted.storageKey,
      };
    }

    memoContent = normalizedMemoContent ?? repairedMemoContent ?? memoContent;
  }

  if (!memoValidation.ok) {
    return {
      ok: false,
      error: memoValidation.error ?? "Memo validation failed.",
    };
  }

  // ── Phase 2A: Contrary-Evidence Gate (pre-scoring) ─────────────────────
  let gatePromptBlock = "";
  if (priorLoad.gateRequired && priorLoad.bundle && priorLoad.priorText) {
    try {
      await workflowPhase(hooks, "contrary_evidence");
      await workflowGuard(hooks);
      const gateResult = await runContraryEvidenceGate({
        priorReview: priorLoad.bundle,
        priorText: priorLoad.priorText,
        currentText: text,
        genre,
        semanticAssessor: defaultSemanticAssessor(),
        comparison_mode: priorLoad.comparison_mode,
        prior_version_id: priorLoad.priorVersionId,
        current_version_id: priorLoad.currentVersionId,
        prior_content_hash: priorLoad.priorContentHash,
        current_content_hash: priorLoad.currentContentHash,
      });
      gateState.gateRan = true;
      gateState.gateStatus = "completed";
      gateState.gateResult = gateResult;
      gateState.assessments = gateResult.assessments;

      if (!gateResult.scoring_gate.valid) {
        gateState.gateStatus = "failed";
        return {
          ok: false,
          error: `Contrary-evidence gate blocked scoring: ${gateResult.scoring_gate.errors.join(" ")}`,
        };
      }

      gatePromptBlock = buildContraryEvidenceGatePromptBlock(gateResult.assessments).block;
    } catch (e) {
      if (e instanceof WorkflowCancelledError) throw e;
      gateState.gateStatus = "failed";
      return {
        ok: false,
        error: `Contrary-evidence gate failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  let rubricResult;
  try {
    await workflowPhase(hooks, "rubric_generation");
    await workflowGuard(hooks);
    rubricResult = await generateAgentRubric({
      text,
      intent,
      statistics,
      memoContent,
      contraryEvidenceGateBlock: gatePromptBlock || undefined,
    });
  } catch (e) {
    if (e instanceof WorkflowCancelledError) throw e;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const firstRubricRaw = rubricResult.content;
  let rubricRetryAttempted = false;
  let rubricAssessment = assessRubricGenerationResult({
    rawContent: rubricResult.content,
    generationMeta: rubricResult.generationMeta ?? {
      finishReason: null,
      inputTokens: null,
      outputTokens: null,
      maxTokens: 0,
      outputTruncated: false,
    },
    statistics,
    statisticsValid: true,
  });

  if (shouldRetryRubricGeneration(rubricAssessment) && !rubricRetryAttempted) {
    rubricRetryAttempted = true;
    try {
      await workflowGuard(hooks);
      rubricResult = await generateAgentRubric({
        text,
        intent,
        statistics,
        memoContent,
        contraryEvidenceGateBlock: gatePromptBlock || undefined,
        retryAfterTruncation: rubricAssessment.failureKind === "RUBRIC_GENERATION_TRUNCATED",
        repairContext: shouldRepairRubricJson(rubricAssessment)
          ? {
              parseError:
                rubricAssessment.parsed.parseError ??
                rubricAssessment.rubricGrading.validationErrors[0] ??
                "Invalid rubric JSON.",
              malformedRaw: firstRubricRaw ?? rubricResult.content,
            }
          : undefined,
      });
    } catch (e) {
      if (e instanceof WorkflowCancelledError) throw e;
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    rubricAssessment = assessRubricGenerationResult({
      rawContent: rubricResult.content,
      generationMeta: rubricResult.generationMeta ?? {
        finishReason: null,
        inputTokens: null,
        outputTokens: null,
        maxTokens: 0,
        outputTruncated: false,
      },
      statistics,
      statisticsValid: true,
    });
  }

  await workflowPhase(hooks, "rubric_validation");
  await workflowGuard(hooks);

  if (rubricAssessment.failureKind || !rubricAssessment.parsed.payload) {
    return {
      ok: false,
      error: RUBRIC_PARSE_FAILURE_USER_MESSAGE,
    };
  }

  // ── Phase 2E: Normalize + post-scoring validation ───────────────────────
  const gatePromptCharCount = gatePromptBlock.length;
  const postScoring = validatePostScoringRubric({
    payload: rubricAssessment.parsed.payload,
    preGateAssessments: gateState.assessments,
    preScoringGate: gateState.gateResult?.scoring_gate ?? {
      valid: true,
      errors: [],
      assessments: [],
      adjusted_deductions: [],
      total_points_restored: 0,
    },
    gateRequired: gateState.gateRequired,
    gateRan: gateState.gateRan,
    priorReviewId: gateState.priorReviewId,
    comparison_mode: gateState.gateResult?.comparison_mode ?? priorLoad.comparison_mode,
    canonicalWordCount: statistics.canonical_word_count,
    fullTextSupplied: statistics.full_text_supplied,
    memoContent,
  });

  if (!postScoring.valid) {
    const diagPath = writeBlockedRunDiagnosticArtifact(
      buildBlockedRunDiagnostics({
        manuscriptId,
        manuscriptVersionId: ctx.manuscriptVersionId,
        memoContent,
        memoValidationOk: true,
        canonicalWordCount: statistics.canonical_word_count,
        memoGenerationMeta: reviewResult.generationMeta ?? null,
        gateResult: gateState.gateResult,
        gatePromptChars: gatePromptCharCount,
        rubricPayload: rubricAssessment.parsed.payload,
        rubricRawContent: rubricResult.content,
        rubricGenerationMeta: rubricResult.generationMeta ?? null,
        rubricRetryAttempted,
        normalization: postScoring.normalization,
        validationErrors: postScoring.errors,
      }),
      "hold-fast-blocked-run-latest.json",
    );
    return {
      ok: false,
      error: `Post-scoring validation failed: ${postScoring.errors.slice(0, 5).join(" ")}${postScoring.errors.length > 5 ? ` … (+${postScoring.errors.length - 5} more)` : ""}`,
      diagnostics: diagPath
        ? {
            manuscriptId,
            manuscriptVersionId: ctx.manuscriptVersionId,
            canonicalWordCount: statistics.canonical_word_count,
            storedWordCount: ctx.wordCount,
            recomputedWordCount,
            originalReviewText: memoContent,
            repairAttempted: memoRepairAttempted,
            originalPass: {
              pass: "original",
              ok: false,
              error: postScoring.errors[0],
              wordCountErrors: [],
              wordCountContradictions: [],
              proseGradeConflicts: [],
              rubricValidationErrors: postScoring.errors,
            },
            capturedAt: new Date().toISOString(),
            failurePhase: "rubric",
            pipeline: "two_call_v1",
            memoContent,
            memoGenerationMeta: reviewResult.generationMeta ?? null,
            rubricRawContent: rubricResult.content,
            rubricGenerationMeta: rubricResult.generationMeta ?? null,
            rubricRetryAttempted,
            memoRepairAttempted,
          }
        : undefined,
    };
  }

  const adjustedPayload = postScoring.adjustedPayload;
  const adjustedGrading = validateCommercialRubric({
    payload: adjustedPayload,
    parseError: null,
    categoryKeyErrors: [],
    canonicalWordCount: statistics.canonical_word_count,
    fullTextSupplied: statistics.full_text_supplied,
    statisticsValid: true,
  });

  if (!adjustedGrading.valid) {
    return {
      ok: false,
      error: `Adjusted rubric validation failed: ${adjustedGrading.validationErrors.join(" ")}`,
    };
  }

  let validation = validateCombinedCommercialReview({
    memoContent,
    rubricPayload: adjustedPayload,
    statistics,
    reviewMeta: reviewResult.reviewMeta ?? null,
    memoRepairAttempted,
  });

  if (!validation.ok && validation.repairable && validation.repairKind === "prose_grade") {
    memoRepairAttempted = true;
    try {
      await workflowPhase(hooks, "memo_repair");
      await workflowGuard(hooks);
      const repaired = await repairCommercialMemoValidation({
        memoContent,
        canonicalWordCount: statistics.canonical_word_count,
        proseGradeConflict: validation.proseGradeConflict,
        calculatedLetterGrade: adjustedGrading.letterGrade,
        manuscriptScore: adjustedGrading.manuscriptScore,
      });
      memoContent = repaired.content;
    } catch (e) {
      if (e instanceof WorkflowCancelledError) throw e;
      return { ok: false, error: `Prose grade repair failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    validation = validateCombinedCommercialReview({
      memoContent,
      rubricPayload: adjustedPayload,
      statistics,
      reviewMeta: reviewResult.reviewMeta ?? null,
      memoRepairAttempted: true,
    });
  }

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error ?? "Review validation failed.",
    };
  }

  const validated = validation.result!;

  let issues: ParsedIssue[];
  let warnings: string[];
  try {
    await workflowPhase(hooks, "revision_candidates");
    await workflowGuard(hooks);
    ({ issues, warnings } = await generateRevisionCandidates(
      LITERARY_AGENT,
      validated.memoContent,
      text,
      intent,
      statistics,
    ));
  } catch (e) {
    if (e instanceof WorkflowCancelledError) throw e;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  if (issues.length === 0) {
    return {
      ok: false,
      error:
        warnings.length > 0
          ? `No usable revision candidates were produced. ${warnings.join(" ")}`
          : "No revision candidates were produced from the review.",
      warnings,
    };
  }

  const payload = buildReplacementPayload(issues, text);
  const gateMeta = buildGatePublishMetadata(gateState, postScoring);

  const gradingRecord = buildReviewGradingRecord(validated, {
    ...gateMeta,
    adjustedGrading,
    raw_model_score: postScoring.rawModelScore,
    normalized_application_score: postScoring.manuscriptScore,
    normalization_adjustments: postScoring.normalization.adjustmentsSummary,
    concernAssessments: gateState.assessments.map((a) => ({
      concern_id: a.concern_id,
      root_issue: a.root_issue,
      rubric_category: a.rubric_category,
      prior_criticism: a.prior_criticism,
      prior_evidence: a.prior_evidence,
      current_supporting_evidence: a.current_supporting_evidence,
      current_contrary_evidence: a.current_contrary_evidence,
      revision_change: a.revision_that_addresses_it,
      original_basis_still_present: a.original_basis_still_present,
      status: a.status,
      confidence: a.confidence,
      prior_deduction: a.prior_deduction,
      points_restored: a.points_restored,
      remaining_deduction: a.remaining_deduction,
      narrowed_current_finding: a.narrowed_current_finding,
      explanation: a.explanation,
      source_type: "rubric_deduction",
    })),
    prior_review_id: gateState.priorReviewId,
    prior_manuscript_version_id: gateState.priorVersionId,
    manuscript_version_id: ctx.manuscriptVersionId,
  });

  // Override scores with post-deduplication values
  gradingRecord.manuscript_score = adjustedGrading.manuscriptScore;
  gradingRecord.manuscript_letter_grade = adjustedGrading.letterGrade;
  gradingRecord.craft_score = adjustedGrading.craftScore;
  gradingRecord.acquisition_readiness_score = adjustedGrading.acquisitionScore;
  gradingRecord.rubric_breakdown = adjustedPayload;

  await workflowPhase(hooks, "publishing");
  await workflowGuard(hooks);

  const { data, error } = await supabase.rpc("publish_commercial_review_generation", {
    p_manuscript_id: manuscriptId,
    p_provider: "openai",
    p_model: reviewResult.model,
    p_content: combineMemoAndRubric(validated.memoContent, adjustedPayload),
    p_metadata: {
      truncated: reviewResult.truncated,
      chars_sent: reviewResult.charsSent,
      review_meta: reviewResult.reviewMeta ?? null,
      review_statistics: statistics,
      generation: {
        pipeline: "two_call_v1",
        canonical_input: canonicalInput,
        memo_generation: reviewResult.generationMeta ?? null,
        rubric_generation: rubricResult.generationMeta ?? null,
        rubric_retry_attempted: rubricRetryAttempted,
        memo_repair_attempted: memoRepairAttempted,
        contrary_evidence_gate: gateMeta,
      },
    },
    p_payload: payload,
    p_grading: gradingRecord,
  });

  if (error) {
    const msg = error.message ?? "Publish failed.";
    if (msg.includes("AUTHOR_RESPONSES_PRESENT")) {
      return {
        ok: false,
        error:
          "Cannot regenerate: author responses were recorded while generation was in progress. No changes were saved.",
      };
    }
    return { ok: false, error: msg, warnings };
  }

  const result = data as {
    review_id?: string;
    issue_count?: number;
    candidate_count?: number;
  } | null;

  return {
    ok: true,
    warnings,
    oldReviewId: oldActive?.id ?? null,
    newReviewId: result?.review_id,
    issueCount: result?.issue_count ?? 0,
    candidateCount: result?.candidate_count ?? 0,
  };
}
