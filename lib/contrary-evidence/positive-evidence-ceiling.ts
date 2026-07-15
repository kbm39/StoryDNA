import type { RubricCategoryScore } from "../commercial-fiction-rubric.ts";

/** Positive evidence strength derived from rubric category content. */
export type PositiveEvidenceStrength =
  | "EXCEPTIONAL"
  | "STRONG"
  | "MIXED"
  | "WEAK"
  | "INSUFFICIENT";

/** Configurable ceiling as fraction of category maximum_points. */
export const POSITIVE_EVIDENCE_CEILING_FRACTION: Record<PositiveEvidenceStrength, number> = {
  EXCEPTIONAL: 1.0,
  STRONG: 0.9,
  MIXED: 0.8,
  WEAK: 0.7,
  INSUFFICIENT: 0.6,
};

/** Acquisition categories — stricter bar for perfect scores. */
export const ACQUISITION_CATEGORY_KEYS = new Set([
  "genre_fulfillment_reader_expectations",
  "commercial_differentiation",
  "market_positioning_audience_clarity",
  "length_format_suitability",
  "professional_polish_continuity",
  "series_adaptation_potential",
]);

const MAJOR_REVISION_PATTERNS = [
  /\bmajor\b/i,
  /\bstructural\b/i,
  /\bsubstantial\b/i,
  /\bsignificant\b/i,
  /\brestructure/i,
  /\breorganiz/i,
  /\bconsolidat/i,
  /\boverhaul/i,
  /\brevise\s+&\s+resubmit\b/i,
  /\bnot\s+ready\s+to\s+submit\b/i,
  /\bnot\s+submission-ready\b/i,
];

const GENERIC_STRENGTH = /^(strong|good|solid|well|compelling|effective)\b/i;

export interface PositiveEvidenceAssessment {
  strength: PositiveEvidenceStrength;
  /** Maximum points this category may earn given positive evidence. */
  ceiling_points: number;
  ceiling_fraction: number;
  supporting_strengths: string[];
  example_count: number;
  reason: string;
  /** Actions that could raise the ceiling. */
  ceiling_raise_actions: string[];
}

export interface CategoryScoreAudit {
  category_key: string;
  category_name: string;
  maximum_points: number;
  raw_awarded_points: number;
  raw_deductions: number;
  invalid_deductions_removed: number;
  valid_deductions_retained: number;
  positive_evidence_strength: PositiveEvidenceStrength;
  positive_evidence_ceiling: number;
  recoverable_points_from_invalid: number;
  ceiling_reduction_applied: number;
  normalized_awarded_points: number;
  increased_without_positive_evidence: boolean;
  positive_evidence_summary: string;
  ceiling_reason: string;
}

/** Assess positive-evidence strength and ceiling for one rubric category. */
export function assessPositiveEvidenceCeiling(
  cat: RubricCategoryScore,
  options?: {
    memoContent?: string;
    isAcquisition?: boolean;
    majorRevisionRecommended?: boolean;
  },
): PositiveEvidenceAssessment {
  const strengths = (cat.strengths ?? []).filter((s) => s.trim().length > 8);
  const examples = (cat.examples ?? []).filter((e) => e.text?.trim().length > 15);
  const nonGenericStrengths = strengths.filter((s) => !GENERIC_STRENGTH.test(s.trim()));
  const deductionRatio = cat.maximum_points > 0 ? cat.deduction / cat.maximum_points : 0;
  const revisionText = (cat.revision_to_recover ?? "").trim();
  const hasMajorRevisionLanguage = MAJOR_REVISION_PATTERNS.some((p) => p.test(revisionText));

  let strength: PositiveEvidenceStrength;

  if (cat.insufficient_evidence) {
    strength = "INSUFFICIENT";
  } else if (
    nonGenericStrengths.length >= 2 &&
    examples.length >= 2 &&
    cat.confidence === "high" &&
    deductionRatio <= 0.15 &&
    !hasMajorRevisionLanguage
  ) {
    strength = "EXCEPTIONAL";
  } else if (
    nonGenericStrengths.length >= 1 &&
    examples.length >= 2 &&
    deductionRatio <= 0.35 &&
    !hasMajorRevisionLanguage
  ) {
    strength = "STRONG";
  } else if (strengths.length >= 1 || examples.length >= 2) {
    strength = "MIXED";
  } else if (examples.length >= 1) {
    strength = "WEAK";
  } else {
    strength = "INSUFFICIENT";
  }

  // Downgrade acquisition or major-revision manuscripts
  if (options?.majorRevisionRecommended && strength === "EXCEPTIONAL") {
    strength = "STRONG";
  }
  if (options?.majorRevisionRecommended && strength === "STRONG") {
    strength = "MIXED";
  }
  if (options?.isAcquisition && options?.majorRevisionRecommended) {
    strength = downgrade(strength);
  }
  if (options?.isAcquisition && hasMajorRevisionLanguage) {
    strength = downgrade(strength);
  }

  let fraction = POSITIVE_EVIDENCE_CEILING_FRACTION[strength];
  if (options?.isAcquisition && fraction >= 1.0 && hasMajorRevisionLanguage) {
    fraction = POSITIVE_EVIDENCE_CEILING_FRACTION.STRONG;
    strength = "STRONG";
  }

  const ceiling_points = round2(cat.maximum_points * fraction);
  const raiseActions: string[] = [];
  if (examples.length < 2) raiseActions.push("Add two manuscript-specific supporting examples.");
  if (nonGenericStrengths.length < 2) raiseActions.push("Document specific strengths with cited passages.");
  if (hasMajorRevisionLanguage) raiseActions.push("Complete recommended structural revisions before claiming higher readiness.");
  if (deductionRatio > 0.35) raiseActions.push("Resolve remaining scored weaknesses in this category.");

  return {
    strength,
    ceiling_points,
    ceiling_fraction: fraction,
    supporting_strengths: nonGenericStrengths.slice(0, 3),
    example_count: examples.length,
    reason: buildCeilingReason(strength, fraction, nonGenericStrengths.length, examples.length, hasMajorRevisionLanguage),
    ceiling_raise_actions: raiseActions,
  };
}

function downgrade(s: PositiveEvidenceStrength): PositiveEvidenceStrength {
  switch (s) {
    case "EXCEPTIONAL":
      return "STRONG";
    case "STRONG":
      return "MIXED";
    case "MIXED":
      return "WEAK";
    default:
      return "INSUFFICIENT";
  }
}

function buildCeilingReason(
  strength: PositiveEvidenceStrength,
  fraction: number,
  strengthCount: number,
  exampleCount: number,
  majorRevision: boolean,
): string {
  const pct = Math.round(fraction * 100);
  if (majorRevision) {
    return `${strength} (${pct}% cap) — major revision language in improvement path limits readiness ceiling.`;
  }
  return `${strength} (${pct}% cap) — ${strengthCount} cited strength(s), ${exampleCount} example(s).`;
}

/** Compute normalized category score with recovery limits. */
export function computeNormalizedCategoryScore(args: {
  cat: RubricCategoryScore;
  raw_awarded: number;
  valid_deductions_retained: number;
  invalid_deductions_removed: number;
  ceiling_points: number;
}): {
  normalized_awarded: number;
  recoverable_from_invalid: number;
  ceiling_reduction: number;
  increased_without_evidence: boolean;
} {
  const { cat, raw_awarded, valid_deductions_retained, invalid_deductions_removed, ceiling_points } =
    args;

  const maxRecoverable = Math.max(0, round2(ceiling_points - raw_awarded));
  const recoverable = round2(Math.min(invalid_deductions_removed, maxRecoverable));

  const afterRecovery = round2(raw_awarded + recoverable);
  const fromValidOnly = round2(Math.max(0, cat.maximum_points - valid_deductions_retained));
  const candidate = round2(Math.min(afterRecovery, fromValidOnly, ceiling_points));

  const ceiling_reduction = round2(Math.max(0, fromValidOnly - candidate));
  const increased_without_evidence =
    candidate > raw_awarded + 0.01 && recoverable < invalid_deductions_removed - 0.01;

  return {
    normalized_awarded: candidate,
    recoverable_from_invalid: recoverable,
    ceiling_reduction,
    increased_without_evidence,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
