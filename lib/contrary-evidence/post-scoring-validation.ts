import type { CommercialRubricPayload } from "../commercial-fiction-rubric.ts";
import { letterGradeFromScore } from "../grade-calculation.ts";
import { validateCommercialRubric } from "../rubric-validation.ts";
import type {
  ComparisonMode,
  ConcernAssessment,
  ScoringGateResult,
} from "./types.ts";
import { isBroadCriticism } from "./scoring-gate.ts";
import { extractRubricDeductionEntries, type DuplicateDeductionAnalysis } from "./duplicate-deductions.ts";
import {
  normalizeRubricAgainstGate,
  type NormalizeRubricResult,
} from "./normalize-rubric-against-gate.ts";

export interface PostScoringValidationInput {
  payload: CommercialRubricPayload;
  preGateAssessments: ConcernAssessment[];
  preScoringGate: ScoringGateResult;
  gateRequired: boolean;
  gateRan: boolean;
  priorReviewId: string | null;
  canonicalWordCount: number;
  fullTextSupplied: boolean;
  comparison_mode?: ComparisonMode;
  /** Call A memo for acquisition safeguard and recommendation consistency. */
  memoContent?: string;
  /** When set, skip normalization (already applied). */
  normalizationResult?: NormalizeRubricResult;
}

export interface PostScoringValidationResult {
  valid: boolean;
  errors: string[];
  adjustedPayload: CommercialRubricPayload;
  normalization: NormalizeRubricResult;
  duplicateAnalysis: DuplicateDeductionAnalysis;
  manuscriptScore: number;
  craftScore: number;
  acquisitionScore: number;
  letterGrade: string;
  rawModelScore: number;
  restoredPointsTotal: number;
  pointsInvalidatedTotal: number;
  duplicatePointsRemovedTotal: number;
  overbreadthPointsRemovedTotal: number;
  resolvedDeductionsBlocked: number;
  staleCritiquesBlocked: number;
  unsupportedDeductionsBlocked: number;
  duplicateDeductionsRemoved: number;
  overbroadDeductionsNarrowed: number;
  blockedStaleDeductionCount: number;
  duplicateDeductionCount: number;
  scoringGateValid: boolean;
}

export function validatePostScoringRubric(input: PostScoringValidationInput): PostScoringValidationResult {
  const errors: string[] = [];
  const mode =
    input.comparison_mode ??
    input.preGateAssessments[0]?.comparison_mode ??
    "REVISION_COMPARISON";

  if (input.gateRequired && !input.gateRan) {
    errors.push("Contrary-evidence gate was required but did not run.");
  }

  if (input.gateRequired && !input.preScoringGate.valid) {
    errors.push(...input.preScoringGate.errors.map((e) => `Pre-scoring gate: ${e}`));
  }

  const normalization =
    input.normalizationResult ??
    normalizeRubricAgainstGate({
      rawPayload: input.payload,
      gateAssessments: input.preGateAssessments,
      comparison_mode: mode,
      canonicalWordCount: input.canonicalWordCount,
      fullTextSupplied: input.fullTextSupplied,
      memoContent: input.memoContent,
    });

  if (!normalization.valid) {
    errors.push(...normalization.errors);
  }

  const payload = normalization.normalizedPayload;
  const finalDuplicateAnalysis = normalization.duplicateAnalysis;

  const overbroadDeductionsNarrowed = normalization.adjustmentsSummary.narrowed_and_reduced;
  const rubricEntries = extractRubricDeductionEntries(payload);

  for (const entry of rubricEntries) {
    if (entry.deduction_points <= 0) continue;
    const cat = findCategory(payload, entry.category_key);
    if (!cat) continue;
    if (isBroadCriticism(entry.deduction_reason)) {
      const disp = normalization.dispositions.find(
        (d) => d.category_key === entry.category_key && d.deduction_index === entry.deduction_index,
      );
      if (disp?.disposition !== "NARROWED_AND_REDUCED" && disp?.disposition !== "RETAINED") {
        errors.push(`${entry.category_key}: broad deduction lacks narrowed finding.`);
      }
    }
  }

  const rubricVal = validateCommercialRubric({
    payload,
    parseError: null,
    categoryKeyErrors: [],
    canonicalWordCount: input.canonicalWordCount,
    fullTextSupplied: input.fullTextSupplied,
    statisticsValid: true,
  });

  if (!rubricVal.valid) {
    errors.push(...rubricVal.validationErrors);
  }

  const pointsInvalidatedTotal = input.preGateAssessments.reduce(
    (s, a) => s + a.points_invalidated,
    0,
  );
  const duplicatePointsRemovedTotal =
    normalization.dispositions.reduce((s, d) => s + d.points_removed, 0) +
    normalization.rootIssueCapAdjustments.reduce((s, c) => s + c.duplicate_points_removed, 0);

  const restoredPointsTotal =
    mode === "REVISION_COMPARISON" ? input.preScoringGate.total_points_restored : 0;

  return {
    valid: errors.length === 0 && rubricVal.valid && normalization.valid,
    errors,
    adjustedPayload: payload,
    normalization,
    duplicateAnalysis: finalDuplicateAnalysis,
    manuscriptScore: rubricVal.manuscriptScore,
    craftScore: rubricVal.craftScore,
    acquisitionScore: rubricVal.acquisitionScore,
    letterGrade: rubricVal.letterGrade || letterGradeFromScore(rubricVal.manuscriptScore),
    rawModelScore: normalization.rawModelScore,
    restoredPointsTotal,
    pointsInvalidatedTotal,
    duplicatePointsRemovedTotal,
    overbreadthPointsRemovedTotal: input.preGateAssessments.reduce(
      (s, a) => s + a.overbreadth_points_removed,
      0,
    ),
    resolvedDeductionsBlocked: normalization.adjustmentsSummary.resolved_removed,
    staleCritiquesBlocked: normalization.adjustmentsSummary.stale_removed,
    unsupportedDeductionsBlocked: normalization.adjustmentsSummary.unsupported_removed,
    duplicateDeductionsRemoved: normalization.adjustmentsSummary.duplicate_removed,
    overbroadDeductionsNarrowed,
    blockedStaleDeductionCount:
      normalization.adjustmentsSummary.resolved_removed +
      normalization.adjustmentsSummary.stale_removed,
    duplicateDeductionCount: finalDuplicateAnalysis.duplicate_deduction_count,
    scoringGateValid: errors.length === 0 && rubricVal.valid && normalization.valid,
  };
}

function findCategory(payload: CommercialRubricPayload, key: string) {
  return [...payload.craft_categories, ...payload.acquisition_categories].find(
    (c) => c.category_key === key,
  );
}

/** Map revision concern status to allowed max deduction multiplier for Call B contract text. */
export { gateStatusDeductionContract, sameVersionStatusDeductionContract } from "./post-scoring-contracts.ts";
