/**
 * Shared authoritative review resolution, display model, and export safety gates.
 * Consumed by the live UI and Literary Agent DOCX export — no AI generation.
 */
import {
  buildGradingExplanationDisplay,
  formatRecommendationLabel,
  METHODOLOGY_DISCLAIMER,
  NORMALIZATION_AUTHORITY_NOTE,
  type GradingExplanationDisplay,
} from "./grading-explanation-display.ts";
import { validateMemoProhibitedGrades } from "./prose-grade-validation.ts";
import { memoContentForDisplay } from "./review-display.ts";
import type { Review, ReviewConcernAssessment } from "./types.ts";
import {
  buildReviewProvenance,
  hasFalseCurrentLengthThousandsLanguage,
  resolveCanonicalWordCount,
  type ReviewProvenance,
} from "./review-provenance.ts";
import { validateWordCountClaims } from "./word-count-validation.ts";

export type ReviewerType = "commercial" | "craft" | "screen";

export const EXPORT_BLOCKED_MESSAGE =
  "Export blocked: review content does not match the authoritative validated assessment.";

export const PRE_ENFORCEMENT_EXPORT_BLOCKED =
  "Export blocked: review was generated before canonical word-count enforcement.";

export const CONTRADICTS_CANONICAL_EXPORT_BLOCKED =
  "Export blocked: review prose contradicts verified canonical manuscript statistics.";

export { SUPERSEDED_REVIEW_DISCLAIMER as HISTORICAL_REVIEW_DISCLAIMER } from "./review-provenance.ts";

/** @deprecated Use provenance.historical_disclaimer */
export const HISTORICAL_REVIEW_LABEL = "Historical review — superseded";

const REVIEW_TYPE_LABEL: Record<ReviewerType, string> = {
  commercial: "Literary-agent review",
  craft: "Developmental edit",
  screen: "Producer's read",
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
};

export interface ContraryEvidenceSummary {
  gate_status: string | null;
  assessment_count: number;
  retained_concern_count: number;
}

export interface AuthoritativeReviewDisplay {
  review_id: string;
  manuscript_id: string;
  manuscript_title: string;
  review_type_label: string;
  provider_label: string;
  generated_at: string;
  is_historical: boolean;
  historical_label: string | null;
  lifecycle_status: string;
  memo_content: string;
  canonical_word_count: number;
  scoring_gate_valid: boolean;
  concern_assessment_count: number;
  grading: GradingExplanationDisplay;
  assessment_mode_label: string | null;
  methodology_disclaimer: string;
  normalization_authority_note: string;
  contrary_evidence_summary: ContraryEvidenceSummary;
  provenance: ReviewProvenance;
}

export type ResolveAuthoritativeReviewResult =
  | {
      ok: true;
      review: Review;
      isHistorical: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export interface ExportValidationOptions {
  requireActive?: boolean;
  expectedReviewId?: string;
  expectedCanonicalWordCount?: number;
  expectedNormalizedScore?: number;
}

export interface ExportValidationResult {
  ok: boolean;
  errors: string[];
}

/** Round-thousand current-length claims that must not appear when canonical differs. */
export const FALSE_CURRENT_LENGTH_THOUSANDS = [130_000, 150_000, 180_000, 200_000] as const;

export function assessmentModeLabel(
  mode: GradingExplanationDisplay["comparison_mode"],
): string | null {
  if (mode === "SAME_VERSION_REASSESSMENT") return "Same-version reassessment";
  if (mode === "REVISION_COMPARISON") return "Revision comparison";
  return null;
}

export { resolveCanonicalWordCount, hasFalseCurrentLengthThousandsLanguage };

/** Remove model-authored grade lines and calculated-grade footers from memo prose. */
export function sanitizeMemoForAuthoritativeExport(memo: string): string {
  let text = memoContentForDisplay(memo);
  text = text.replace(
    /\n\*\*Commercial acquisition grade \(calculated\):[^*]+\*\*\s*/gi,
    "\n",
  );
  text = text.replace(/\*\*Grade:\s*[A-F][+-]?\*\*/gi, "");
  text = text.replace(/^\s*Grade:\s*[A-F][+-]?\s*$/gim, "");
  text = text.replace(/^\s*(?:Overall|Final)\s+grade\s*[:\s—–-]+\s*[A-F][+-]?\s*$/gim, "");
  return text.trim();
}

function formatGeneratedDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildContraryEvidenceSummary(
  review: Review,
  assessments: ReviewConcernAssessment[],
): ContraryEvidenceSummary {
  const retained = assessments.filter(
    (a) => a.remaining_deduction > 0 || a.status === "SUPPORTED",
  ).length;
  return {
    gate_status: review.contrary_evidence_gate_status ?? null,
    assessment_count: assessments.length,
    retained_concern_count: retained,
  };
}

/**
 * Pure resolution from an in-memory review list — never silently falls back to older reviews.
 */
export function resolveAuthoritativeReviewFromList(args: {
  manuscriptId: string;
  currentVersionId: string | null;
  reviews: Review[];
  reviewerType: ReviewerType;
  explicitReviewId?: string | null;
}): ResolveAuthoritativeReviewResult {
  const { manuscriptId, currentVersionId, reviews, reviewerType, explicitReviewId } = args;
  const matching = reviews.filter((r) => r.manuscript_id === manuscriptId);

  if (explicitReviewId) {
    const review = matching.find((r) => r.id === explicitReviewId);
    if (!review) {
      return { ok: false, error: `Review ${explicitReviewId} not found for manuscript.` };
    }
    if (review.perspective !== reviewerType) {
      return {
        ok: false,
        error: `Review ${explicitReviewId} is not a ${reviewerType} review.`,
      };
    }
    const status = review.lifecycle_status ?? "active";
    const isHistorical = status === "superseded";
    return { ok: true, review, isHistorical };
  }

  const active = matching.filter(
    (r) =>
      r.perspective === reviewerType && (r.lifecycle_status ?? "active") === "active",
  );

  if (active.length === 0) {
    return {
      ok: false,
      error: `No active ${reviewerType} review found for manuscript ${manuscriptId}.`,
    };
  }
  if (active.length > 1) {
    return {
      ok: false,
      error: `Multiple active ${reviewerType} reviews found for manuscript ${manuscriptId}; cannot resolve authoritatively.`,
    };
  }

  const review = active[0]!;
  if (currentVersionId && review.manuscript_version_id !== currentVersionId) {
    return {
      ok: false,
      error:
        "Active review does not match the current manuscript version; export requires an explicit historical review_id.",
    };
  }

  return { ok: true, review, isHistorical: false };
}

/** Build the shared display model consumed by UI panels and DOCX export. */
export function buildAuthoritativeReviewDisplay(args: {
  review: Review;
  manuscriptTitle: string;
  assessments?: ReviewConcernAssessment[];
  fallbackWordCount?: number | null;
  isHistorical?: boolean;
  currentVersionId?: string | null;
  authoritativeReviewId?: string | null;
}): AuthoritativeReviewDisplay | null {
  const {
    review,
    manuscriptTitle,
    assessments = [],
    fallbackWordCount,
    isHistorical,
    currentVersionId,
    authoritativeReviewId,
  } = args;
  const rawMemo = memoContentForDisplay(review.content);
  const grading = buildGradingExplanationDisplay({
    review,
    memoContent: rawMemo,
    assessments,
  });
  if (!grading) return null;

  const canonicalWordCount = resolveCanonicalWordCount(review, fallbackWordCount);
  const memoContent = sanitizeMemoForAuthoritativeExport(review.content);
  const lifecycle = review.lifecycle_status ?? "active";
  const historical =
    isHistorical ?? lifecycle === "superseded";

  const provenance = buildReviewProvenance({
    review,
    currentVersionId,
    fallbackWordCount,
    isHistoricalView: historical,
    authoritativeReviewId,
  });

  return {
    review_id: review.id,
    manuscript_id: review.manuscript_id,
    manuscript_title: manuscriptTitle,
    review_type_label: REVIEW_TYPE_LABEL[review.perspective as ReviewerType] ?? review.perspective,
    provider_label: PROVIDER_LABEL[review.provider] ?? review.provider,
    generated_at: formatGeneratedDate(review.created_at),
    is_historical: historical,
    historical_label: historical ? provenance.historical_disclaimer : null,
    lifecycle_status: lifecycle,
    memo_content: memoContent,
    canonical_word_count: canonicalWordCount,
    scoring_gate_valid: review.scoring_gate_valid === true,
    concern_assessment_count: assessments.length,
    grading,
    assessment_mode_label: assessmentModeLabel(grading.comparison_mode),
    methodology_disclaimer: METHODOLOGY_DISCLAIMER,
    normalization_authority_note: NORMALIZATION_AUTHORITY_NOTE,
    contrary_evidence_summary: buildContraryEvidenceSummary(review, assessments),
    provenance,
  };
}

function scoresApproximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

/** Verify export safety gates before generating DOCX. */
export function validateAuthoritativeExport(
  display: AuthoritativeReviewDisplay,
  options: ExportValidationOptions = {},
): ExportValidationResult {
  const errors: string[] = [];
  const { requireActive = !display.is_historical } = options;

  if (options.expectedReviewId && display.review_id !== options.expectedReviewId) {
    errors.push(`Expected review ${options.expectedReviewId}, resolved ${display.review_id}.`);
  }
  if (requireActive && display.lifecycle_status !== "active") {
    errors.push(`Review lifecycle_status is ${display.lifecycle_status}, not active.`);
  }

  if (requireActive) {
    if (display.provenance.staleness.pre_enforcement) {
      errors.push(PRE_ENFORCEMENT_EXPORT_BLOCKED);
    }
    if (display.provenance.staleness.contradicts_canonical_statistics) {
      errors.push(CONTRADICTS_CANONICAL_EXPORT_BLOCKED);
    }
  }

  if (requireActive && !display.scoring_gate_valid) {
    errors.push("scoring_gate_valid is not true.");
  }
  if (!display.grading.has_grading_explanation) {
    errors.push("Grading explanation sections are missing.");
  }
  if (!display.grading.adjustments && display.grading.comparison_mode !== "NONE") {
    errors.push("Adjustments made by StoryDNA validation section is missing.");
  }
  if (display.canonical_word_count <= 0) {
    errors.push("Canonical word count is missing.");
  }
  if (options.expectedCanonicalWordCount != null) {
    if (display.canonical_word_count !== options.expectedCanonicalWordCount) {
      errors.push(
        `Canonical word count ${display.canonical_word_count} does not match expected ${options.expectedCanonicalWordCount}.`,
      );
    }
  }
  if (options.expectedNormalizedScore != null) {
    if (!scoresApproximatelyEqual(display.grading.total_score, options.expectedNormalizedScore)) {
      errors.push(
        `Normalized score ${display.grading.total_score} does not match expected ${options.expectedNormalizedScore}.`,
      );
    }
  }
  if (
    display.grading.adjustments?.normalized_application_score != null &&
    !scoresApproximatelyEqual(
      display.grading.adjustments.normalized_application_score,
      display.grading.total_score,
    )
  ) {
    errors.push("Normalized application score does not match authoritative total_score.");
  }

  if (requireActive) {
    const wordVal = validateWordCountClaims(display.memo_content, display.canonical_word_count);
    if (!wordVal.valid) {
      errors.push(...wordVal.errors);
      for (const c of wordVal.contradictions) {
        if (c.reason) errors.push(c.reason);
      }
    }
    if (hasFalseCurrentLengthThousandsLanguage(display.memo_content, display.canonical_word_count)) {
      errors.push("Unsupported 130k / 150k / 180k / 200k current-length language detected.");
    }
  }

  const gradeVal = validateMemoProhibitedGrades(display.memo_content);
  if (!gradeVal.valid) {
    errors.push("Model-authored letter grade line detected in memo prose.");
  }

  if (!display.assessment_mode_label && display.grading.comparison_mode === "NONE") {
    // acceptable when gate skipped
  } else if (
    display.grading.comparison_mode !== "NONE" &&
    !display.assessment_mode_label
  ) {
    errors.push("Assessment mode label is missing.");
  }

  if (!display.methodology_disclaimer) {
    errors.push("Methodology disclaimer is missing.");
  }

  const recommendationLabel = formatRecommendationLabel(display.grading.recommendation);
  if (recommendationLabel === "Not stated") {
    errors.push("Recommendation is missing from validated review content.");
  }

  return { ok: errors.length === 0, errors };
}
