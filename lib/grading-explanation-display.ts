/**
 * Build explainable grading display from persisted review data only — no AI generation.
 */
import type { CommercialRubricPayload, RubricCategoryScore } from "./commercial-fiction-rubric.ts";
import {
  ACQUISITION_MAX_TOTAL,
  CRAFT_MAX_TOTAL,
  OVERALL_MAX_TOTAL,
} from "./commercial-fiction-rubric.ts";
import { letterGradeFromScore } from "./grade-calculation.ts";
import type { Review, ReviewConcernAssessment } from "./types.ts";

export interface NormalizationAdjustmentsDisplay {
  raw_model_score: number | null;
  normalized_application_score: number | null;
  duplicate_deductions_removed: number;
  duplicate_points_removed: number;
  repeated_evidence_removed: number;
  valid_deductions_retained: number;
  mechanically_recoverable_points: number;
  evidence_ceiling_reductions: number;
  unsupported_deductions_removed: number;
  root_issue_cap_reductions: number;
}

export interface RetainedDeductionDisplay {
  root_issue: string;
  category_key: string;
  category_name: string;
  points_deducted: number;
  criticism: string;
  current_evidence: string[];
  contrary_evidence: string[];
  why_remains: string;
  improvement_action: string;
  recoverable_points: number | null;
  confidence: string;
}

export interface GradingExplanationDisplay {
  craft_score: number;
  craft_max: number;
  acquisition_score: number;
  acquisition_max: number;
  total_score: number;
  total_max: number;
  recommendation: string | null;
  descriptive_band: string;
  letter_grade_secondary: string | null;
  strongest_categories: Array<{ name: string; earned: number; max: number }>;
  weakest_categories: Array<{ name: string; earned: number; max: number; deduction: number }>;
  retained_deductions: RetainedDeductionDisplay[];
  comparison_mode: "SAME_VERSION_REASSESSMENT" | "REVISION_COMPARISON" | "NONE";
  adjustments: NormalizationAdjustmentsDisplay | null;
  has_grading_explanation: boolean;
}

const METHODOLOGY_DISCLAIMER =
  "StoryDNA's numerical and descriptive ratings are proprietary assessment tools informed by established professional editorial-assessment categories. There is no universal publishing-industry letter-grade standard for manuscripts.";

const NORMALIZATION_AUTHORITY_NOTE =
  "The application-calculated normalized score is authoritative. The raw model score is retained only for transparency.";

export { METHODOLOGY_DISCLAIMER, NORMALIZATION_AUTHORITY_NOTE };

export function extractMemoRecommendation(memoContent: string): string | null {
  if (/\*\*REVISE\s*&\s*RESUBMIT\*\*/i.test(memoContent)) return "REVISE & RESUBMIT";
  if (/\*\*PASS\*\*/i.test(memoContent)) return "PASS";
  if (/\*\*REQUEST\*\*/i.test(memoContent)) return "REQUEST";
  return null;
}

export function formatRecommendationLabel(recommendation: string | null): string {
  if (!recommendation) return "Not stated";
  if (recommendation === "REVISE & RESUBMIT") return "Revise & Resubmit";
  return recommendation.charAt(0) + recommendation.slice(1).toLowerCase();
}

/** Descriptive band for primary score display (not letter grade). */
export function descriptiveBandForScore(score: number, recommendation: string | null): string {
  if (recommendation === "REVISE & RESUBMIT" && score >= 73 && score < 80) {
    return "Promising, meaningful revision recommended";
  }
  if (recommendation === "REQUEST") return "Strong commercial potential; submission-ready with polish";
  if (recommendation === "PASS") return "Does not meet acquisition threshold at this time";
  if (score >= 90) return "Exceptional; near submission-ready";
  if (score >= 83) return "Strong; focused revision may elevate to submission-ready";
  if (score >= 77) return "Promising; targeted revision recommended";
  if (score >= 73) return "Promising, meaningful revision recommended";
  if (score >= 60) return "Uneven; substantial revision required";
  return "Early-stage; major development required";
}

export function inferComparisonMode(review: Review): GradingExplanationDisplay["comparison_mode"] {
  const meta = review.grading_metadata as Record<string, unknown> | null | undefined;
  const priorVersion = meta?.prior_manuscript_version_id as string | null | undefined;
  const currentVersion = review.manuscript_version_id ?? (meta?.manuscript_version_id as string | null);
  if (priorVersion && currentVersion && priorVersion === currentVersion) {
    return "SAME_VERSION_REASSESSMENT";
  }
  if (meta?.prior_review_id || meta?.contrary_evidence_gate) {
    return "REVISION_COMPARISON";
  }
  if (review.contrary_evidence_gate_status === "skipped" || !review.contrary_evidence_gate_status) {
    return "NONE";
  }
  return "REVISION_COMPARISON";
}

function evidenceStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const loc = "location" in item && item.location ? `[${item.location}] ` : "";
        return `${loc}${String((item as { text: string }).text)}`;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s));
}

function parseAdjustments(review: Review): NormalizationAdjustmentsDisplay | null {
  const meta = review.grading_metadata as Record<string, unknown> | null | undefined;
  const gate = meta?.contrary_evidence_gate as Record<string, unknown> | null | undefined;
  const adj = gate?.normalization_adjustments as Record<string, unknown> | null | undefined;
  if (!adj) return null;

  let duplicatePoints = 0;
  const lines = adj.lines;
  if (Array.isArray(lines)) {
    for (const line of lines) {
      if (typeof line === "string" && line.toLowerCase().includes("duplicate deductions removed")) {
        const m = line.match(/\(([0-9.]+)\s*pts\)/);
        if (m) duplicatePoints = Number(m[1]);
      }
    }
  }

  return {
    raw_model_score:
      typeof gate?.raw_model_score === "number"
        ? gate.raw_model_score
        : typeof adj.raw_score === "number"
          ? adj.raw_score
          : null,
    normalized_application_score:
      typeof gate?.normalized_application_score === "number"
        ? gate.normalized_application_score
        : typeof adj.normalized_score === "number"
          ? adj.normalized_score
          : review.manuscript_score ?? null,
    duplicate_deductions_removed: Number(adj.duplicate_removed ?? 0),
    duplicate_points_removed: duplicatePoints,
    repeated_evidence_removed: Number(adj.repeated_evidence_removed ?? 0),
    valid_deductions_retained: Number(adj.valid_deductions_retained_points ?? 0),
    mechanically_recoverable_points: Number(adj.mechanically_recoverable_points ?? 0),
    evidence_ceiling_reductions: Number(adj.evidence_ceiling_reductions ?? 0),
    unsupported_deductions_removed: Number(adj.unsupported_removed ?? 0),
    root_issue_cap_reductions: Number(adj.root_issue_caps_applied ?? 0),
  };
}

function allCategories(rubric: CommercialRubricPayload): RubricCategoryScore[] {
  return [...(rubric.craft_categories ?? []), ...(rubric.acquisition_categories ?? [])];
}

function buildRetainedDeductions(
  rubric: CommercialRubricPayload,
  assessments: ReviewConcernAssessment[],
): RetainedDeductionDisplay[] {
  const byCategory = new Map<string, ReviewConcernAssessment[]>();
  for (const a of assessments) {
    if (a.remaining_deduction <= 0 && a.status !== "SUPPORTED") continue;
    const key = a.rubric_category ?? "";
    const list = byCategory.get(key) ?? [];
    list.push(a);
    byCategory.set(key, list);
  }

  const rows: RetainedDeductionDisplay[] = [];

  for (const cat of allCategories(rubric)) {
    if (cat.deduction <= 0 && cat.deductions.length === 0) continue;

    const catAssessments = byCategory.get(cat.category_key) ?? [];
    const supported = catAssessments.filter((a) => a.remaining_deduction > 0);

    if (cat.deductions.length === 0 && cat.deduction > 0) continue;

    cat.deductions.forEach((label, idx) => {
      const matched =
        supported.find((a) => a.prior_criticism.includes(label.slice(0, 40))) ??
        supported[idx] ??
        catAssessments[idx];

      const pointsPer =
        supported.length === cat.deductions.length && supported[idx]
          ? supported[idx].remaining_deduction
          : cat.deductions.length === 1
            ? cat.deduction
            : round2(cat.deduction / cat.deductions.length);

      const examples = cat.examples.map((e) =>
        e.location ? `[${e.location}] ${e.text}` : e.text,
      );

      rows.push({
        root_issue: matched?.root_issue ?? label,
        category_key: cat.category_key,
        category_name: cat.category_name,
        points_deducted: pointsPer,
        criticism: label,
        current_evidence: matched
          ? evidenceStrings(matched.current_supporting_evidence)
          : examples.slice(0, 2),
        contrary_evidence: matched ? evidenceStrings(matched.current_contrary_evidence) : [],
        why_remains: matched?.explanation ?? cat.deduction_reasons[idx] ?? label,
        improvement_action: cat.revision_to_recover ?? "See category revision path.",
        recoverable_points: cat.maximum_points - cat.points_earned > 0 ? round2(cat.maximum_points - cat.points_earned) : null,
        confidence: matched?.confidence ?? cat.confidence,
      });
    });
  }

  return rows.sort((a, b) => b.points_deducted - a.points_deducted);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildGradingExplanationDisplay(args: {
  review: Review;
  memoContent: string;
  assessments?: ReviewConcernAssessment[];
}): GradingExplanationDisplay | null {
  const { review, memoContent } = args;
  if (review.manuscript_score == null || !review.rubric_breakdown) return null;

  const rubric = review.rubric_breakdown as CommercialRubricPayload;
  const categories = allCategories(rubric);
  const recommendation = extractMemoRecommendation(memoContent);
  const total = review.manuscript_score;
  const craft = review.craft_score ?? 0;
  const acquisition = review.acquisition_readiness_score ?? 0;

  const ranked = [...categories].sort((a, b) => b.points_earned / b.maximum_points - a.points_earned / a.maximum_points);
  const strongest = ranked.slice(0, 3).map((c) => ({
    name: c.category_name,
    earned: c.points_earned,
    max: c.maximum_points,
  }));
  const weakest = [...categories]
    .filter((c) => c.deduction > 0)
    .sort((a, b) => b.deduction - a.deduction)
    .slice(0, 3)
    .map((c) => ({
      name: c.category_name,
      earned: c.points_earned,
      max: c.maximum_points,
      deduction: c.deduction,
    }));

  return {
    craft_score: craft,
    craft_max: CRAFT_MAX_TOTAL,
    acquisition_score: acquisition,
    acquisition_max: ACQUISITION_MAX_TOTAL,
    total_score: total,
    total_max: OVERALL_MAX_TOTAL,
    recommendation,
    descriptive_band: descriptiveBandForScore(total, recommendation),
    letter_grade_secondary: review.manuscript_letter_grade ?? letterGradeFromScore(total),
    strongest_categories: strongest,
    weakest_categories: weakest,
    retained_deductions: buildRetainedDeductions(rubric, args.assessments ?? []),
    comparison_mode: inferComparisonMode(review),
    adjustments: parseAdjustments(review),
    has_grading_explanation: true,
  };
}
