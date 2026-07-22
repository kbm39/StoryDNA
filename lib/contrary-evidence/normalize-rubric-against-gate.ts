/**
 * Application-authoritative rubric normalization against pre-scoring gate assessments.
 * Raw Call B output is advisory; normalized output is what may be published.
 */
import type { CommercialRubricPayload, RubricCategoryScore } from "../commercial-fiction-rubric.ts";
import { letterGradeFromScore } from "../grade-calculation.ts";
import { validateCommercialRubric } from "../rubric-validation.ts";
import {
  DEFAULT_ROOT_ISSUE_CATEGORY_CAP,
  DEFAULT_ROOT_ISSUE_DEDUCTION_CAP,
} from "./constants.ts";
import {
  analyzeDuplicateDeductions,
  applyDuplicateDeductionRemovals,
  extractRubricDeductionEntries,
  type DuplicateDeductionAnalysis,
  type DuplicateDeductionOptions,
  type RubricDeductionEntry,
} from "./duplicate-deductions.ts";
import {
  matchDeductionToAssessment,
  indexAssessments,
} from "./match-deduction-to-gate.ts";
import { normalizeRootIssueKey, rootIssueLabel } from "./normalize-root-issue.ts";
import {
  acquisitionReadinessCap,
  detectMajorRevisionBurden,
  validateRecommendationConsistency,
  type RecommendationConsistencyResult,
} from "./recommendation-consistency.ts";
import {
  ACQUISITION_CATEGORY_KEYS,
  assessPositiveEvidenceCeiling,
  computeNormalizedCategoryScore,
  type CategoryScoreAudit,
} from "./positive-evidence-ceiling.ts";
import type { ComparisonMode, ConcernAssessment, UnifiedAssessmentStatus } from "./types.ts";
import { isBroadCriticism } from "./scoring-gate.ts";
import {
  buildDeterministicNarrowedDeduction,
  shouldDeterministicallyNarrowDeduction,
} from "./narrow-broad-deduction.ts";

const INVALID_DEDUCTION_DISPOSITIONS: Set<DeductionDisposition> = new Set([
  "REMOVED_UNSUPPORTED",
  "REMOVED_DUPLICATE",
  "REMOVED_RESOLVED",
  "REMOVED_STALE",
  "REMOVED_NOT_ASSESSABLE",
]);

export type DeductionDisposition =
  | "RETAINED"
  | "REDUCED_TO_GATE_MAX"
  | "REMOVED_UNSUPPORTED"
  | "REMOVED_DUPLICATE"
  | "REMOVED_RESOLVED"
  | "REMOVED_STALE"
  | "REMOVED_NOT_ASSESSABLE"
  | "NARROWED_AND_REDUCED"
  | "RETAINED_AS_NEW_CONCERN"
  | "UNMATCHED_BLOCKED";

export interface DeductionNormalizationRecord {
  category_key: string;
  deduction_index: number;
  concern_id: string | null;
  original_points: number;
  normalized_points: number;
  points_removed: number;
  gate_status: UnifiedAssessmentStatus | "NEW" | null;
  disposition: DeductionDisposition;
  reason: string;
  root_issue_key: string;
  match_method: string;
}

export interface RootIssueCapAdjustment {
  root_issue_key: string;
  label: string;
  duplicate_points_removed: number;
  categories_removed: string[];
  justification: string | null;
}

export interface NormalizationAdjustmentsSummary {
  section_title: "Adjustments made by StoryDNA validation";
  unsupported_removed: number;
  duplicate_removed: number;
  not_assessable_removed: number;
  reduced_to_gate_max: number;
  resolved_removed: number;
  stale_removed: number;
  narrowed_and_reduced: number;
  root_issue_caps_applied: number;
  repeated_evidence_removed: number;
  raw_score: number;
  normalized_score: number;
  mechanically_recoverable_points: number;
  evidence_ceiling_reductions: number;
  valid_deductions_retained_points: number;
  lines: string[];
}

export interface NormalizeRubricInput {
  rawPayload: CommercialRubricPayload;
  gateAssessments: ConcernAssessment[];
  comparison_mode?: ComparisonMode;
  duplicatePolicy?: DuplicateDeductionOptions;
  canonicalWordCount: number;
  fullTextSupplied: boolean;
  /** Call A memo — used for acquisition safeguard and recommendation consistency. */
  memoContent?: string;
}

export interface NormalizeRubricResult {
  valid: boolean;
  errors: string[];
  rawPayload: CommercialRubricPayload;
  normalizedPayload: CommercialRubricPayload;
  rawModelScore: number;
  normalizedApplicationScore: number;
  craftScore: number;
  acquisitionScore: number;
  letterGrade: string;
  dispositions: DeductionNormalizationRecord[];
  adjustmentsSummary: NormalizationAdjustmentsSummary;
  rootIssueCapAdjustments: RootIssueCapAdjustment[];
  duplicateAnalysis: DuplicateDeductionAnalysis;
  categoryAudits: CategoryScoreAudit[];
  recommendationConsistency: RecommendationConsistencyResult;
}

interface MutableDeduction {
  entry: RubricDeductionEntry;
  record: DeductionNormalizationRecord;
  rank_score: number;
}

export function normalizeRubricAgainstGate(input: NormalizeRubricInput): NormalizeRubricResult {
  const mode =
    input.comparison_mode ?? input.gateAssessments[0]?.comparison_mode ?? "REVISION_COMPARISON";
  const assessmentById = indexAssessments(input.gateAssessments);
  const rawModelScore = sumPayloadScore(input.rawPayload);
  const errors: string[] = [];
  const dispositions: DeductionNormalizationRecord[] = [];

  const entries = extractRubricDeductionEntries(input.rawPayload);
  const mutable: MutableDeduction[] = [];

  for (const entry of entries) {
    const match = matchDeductionToAssessment(entry, input.gateAssessments, assessmentById);
    const { normalized, disposition, reason, gateStatus } = resolveNormalizedPoints(
      entry,
      match.assessment,
      mode,
      input.rawPayload,
    );

    const record: DeductionNormalizationRecord = {
      category_key: entry.category_key,
      deduction_index: entry.deduction_index,
      concern_id: match.concern_id,
      original_points: entry.deduction_points,
      normalized_points: normalized,
      points_removed: Math.max(0, round2(entry.deduction_points - normalized)),
      gate_status: gateStatus,
      disposition,
      reason,
      root_issue_key: entry.root_issue_key,
      match_method: match.match_method,
    };

    if (disposition === "UNMATCHED_BLOCKED" && entry.deduction_points > 0.01) {
      errors.push(
        `${entry.category_key}[${entry.deduction_index}]: unmatched deduction ${entry.deduction_points.toFixed(2)} pts blocks publication.`,
      );
    }

    dispositions.push(record);
    mutable.push({
      entry,
      record,
      rank_score: computeRankScore(entry, match.assessment),
    });
  }

  const { capAdjustments, capErrors } = applyRootIssueCaps(mutable, input.duplicatePolicy);
  errors.push(...capErrors);
  applyRepeatedEvidenceCap(mutable);
  applyDeterministicBroadDeductionNarrowing(mutable, input.rawPayload, input.gateAssessments, errors);

  const normalizedPayload = rebuildPayloadFromMutable(input.rawPayload, mutable);

  let duplicateAnalysis = analyzeDuplicateDeductions(normalizedPayload, input.duplicatePolicy);
  if (duplicateAnalysis.points_to_remove.length > 0) {
    const afterCap = applyDuplicateDeductionRemovals(normalizedPayload, duplicateAnalysis);
    duplicateAnalysis = analyzeDuplicateDeductions(afterCap, input.duplicatePolicy);
    Object.assign(normalizedPayload, afterCap);
  }

  const rawCategoryScores = snapshotCategoryScores(input.rawPayload);
  const majorRevision = detectMajorRevisionBurden(input.memoContent ?? "", input.rawPayload);

  const { categoryAudits, acquisitionCapApplied } = applyPositiveEvidenceScores({
    rawPayload: input.rawPayload,
    normalizedPayload,
    rawCategoryScores,
    dispositions,
    majorRevisionRecommended: majorRevision,
    memoContent: input.memoContent,
  });

  if (acquisitionCapApplied.capped) {
    errors.push(acquisitionCapApplied.reason ?? "Acquisition readiness capped due to major revision.");
  }

  const rubricVal = validateCommercialRubric({
    payload: normalizedPayload,
    parseError: null,
    categoryKeyErrors: [],
    canonicalWordCount: input.canonicalWordCount,
    fullTextSupplied: input.fullTextSupplied,
    statisticsValid: true,
  });

  if (!rubricVal.valid) {
    errors.push(...rubricVal.validationErrors);
  }

  const recommendationConsistency = validateRecommendationConsistency({
    memoContent: input.memoContent,
    normalizedScore: rubricVal.manuscriptScore,
    letterGrade: rubricVal.letterGrade || letterGradeFromScore(rubricVal.manuscriptScore),
    acquisitionScore: rubricVal.acquisitionScore,
    acquisitionMax: normalizedPayload.acquisition_categories.reduce((s, c) => s + c.maximum_points, 0),
    payload: normalizedPayload,
  });

  if (!recommendationConsistency.recommendation_consistent) {
    errors.push(...recommendationConsistency.errors);
  }
  if (recommendationConsistency.blocks_publication) {
    errors.push("Publication withheld: score/recommendation contradiction.");
  }

  for (const d of dispositions) {
    if (d.normalized_points <= 0) continue;
    const cat = findCategory(normalizedPayload, d.category_key);
    if (!cat) continue;
    if ((cat.examples ?? []).length < 2 && !cat.insufficient_evidence) {
      errors.push(`${d.category_key}: retained deduction lacks two supporting examples.`);
    }
    if (!(cat.revision_to_recover ?? "").trim()) {
      errors.push(`${d.category_key}: retained deduction missing improvement path.`);
    }
  }

  const finalDup = analyzeDuplicateDeductions(normalizedPayload, input.duplicatePolicy);
  if (finalDup.violations.length > 0) {
    errors.push(...finalDup.violations);
  }

  const adjustmentsSummary = buildAdjustmentsSummary(
    dispositions,
    capAdjustments,
    categoryAudits,
    rawModelScore,
    rubricVal.manuscriptScore,
  );

  return {
    valid: errors.length === 0 && rubricVal.valid && !recommendationConsistency.blocks_publication,
    errors,
    rawPayload: input.rawPayload,
    normalizedPayload,
    rawModelScore,
    normalizedApplicationScore: rubricVal.manuscriptScore,
    craftScore: rubricVal.craftScore,
    acquisitionScore: rubricVal.acquisitionScore,
    letterGrade: rubricVal.letterGrade || letterGradeFromScore(rubricVal.manuscriptScore),
    dispositions,
    adjustmentsSummary,
    rootIssueCapAdjustments: capAdjustments,
    duplicateAnalysis: finalDup,
    categoryAudits,
    recommendationConsistency,
  };
}

function resolveNormalizedPoints(
  entry: RubricDeductionEntry,
  assessment: ConcernAssessment | null,
  mode: ComparisonMode,
  payload: CommercialRubricPayload,
): {
  normalized: number;
  disposition: DeductionDisposition;
  reason: string;
  gateStatus: UnifiedAssessmentStatus | "NEW" | null;
} {
  const original = entry.deduction_points;
  if (original <= 0.01) {
    return { normalized: 0, disposition: "RETAINED", reason: "Zero deduction.", gateStatus: null };
  }

  if (!assessment) {
    if (qualifiesAsNewConcern(entry, payload)) {
      return {
        normalized: original,
        disposition: "RETAINED_AS_NEW_CONCERN",
        reason: "Independent new concern with current evidence and distinct root issue.",
        gateStatus: "NEW",
      };
    }
    return {
      normalized: 0,
      disposition: "UNMATCHED_BLOCKED",
      reason: "No gate match and does not qualify as new concern.",
      gateStatus: null,
    };
  }

  const maxAllowed = gateMaxDeduction(assessment);
  const status = assessment.status;

  if (mode === "SAME_VERSION_REASSESSMENT") {
    switch (status) {
      case "UNSUPPORTED":
        return {
          normalized: 0,
          disposition: "REMOVED_UNSUPPORTED",
          reason: "Gate: unsupported in same version.",
          gateStatus: status,
        };
      case "DUPLICATED":
        return {
          normalized: 0,
          disposition: "REMOVED_DUPLICATE",
          reason: "Gate: duplicate root issue.",
          gateStatus: status,
        };
      case "NOT_ASSESSABLE":
        if (qualifiesAsNewConcern(entry, payload, assessment)) {
          return {
            normalized: original,
            disposition: "RETAINED_AS_NEW_CONCERN",
            reason: "Distinct new concern with current evidence.",
            gateStatus: status,
          };
        }
        return {
          normalized: 0,
          disposition: "REMOVED_NOT_ASSESSABLE",
          reason: "Gate: not assessable carry-forward.",
          gateStatus: status,
        };
      case "OVERBROAD": {
        const capped = Math.min(original, maxAllowed);
        return {
          normalized: capped,
          disposition: capped < original ? "NARROWED_AND_REDUCED" : "RETAINED",
          reason: assessment.narrowed_current_finding
            ? `Overbroad — narrowed: ${assessment.narrowed_current_finding.slice(0, 80)}`
            : "Overbroad criticism capped.",
          gateStatus: status,
        };
      }
      case "SUPPORTED": {
        const capped = Math.min(original, maxAllowed);
        return {
          normalized: capped,
          disposition: capped < original - 0.01 ? "REDUCED_TO_GATE_MAX" : "RETAINED",
          reason: `Supported — max ${maxAllowed.toFixed(2)} pts.`,
          gateStatus: status,
        };
      }
      default:
        break;
    }
  } else {
    switch (status) {
      case "RESOLVED":
        return { normalized: 0, disposition: "REMOVED_RESOLVED", reason: "Gate: resolved.", gateStatus: status };
      case "STALE_CRITIQUE":
        return { normalized: 0, disposition: "REMOVED_STALE", reason: "Gate: stale critique.", gateStatus: status };
      case "NOT_ASSESSABLE":
        if (qualifiesAsNewConcern(entry, payload, assessment)) {
          return {
            normalized: original,
            disposition: "RETAINED_AS_NEW_CONCERN",
            reason: "New concern with independent evidence.",
            gateStatus: status,
          };
        }
        return {
          normalized: 0,
          disposition: "REMOVED_NOT_ASSESSABLE",
          reason: "No carry-forward without new evidence.",
          gateStatus: status,
        };
      case "SUBSTANTIALLY_IMPROVED":
      case "PARTIALLY_IMPROVED":
      case "UNCHANGED":
      case "WORSENED": {
        const capped = Math.min(original, maxAllowed);
        const disp =
          status === "PARTIALLY_IMPROVED" && capped < original
            ? "NARROWED_AND_REDUCED"
            : capped < original - 0.01
              ? "REDUCED_TO_GATE_MAX"
              : "RETAINED";
        return {
          normalized: capped,
          disposition: disp,
          reason: `${status} — max ${maxAllowed.toFixed(2)} pts.`,
          gateStatus: status,
        };
      }
      default:
        break;
    }
  }

  const capped = Math.min(original, maxAllowed);
  return {
    normalized: capped,
    disposition: capped < original - 0.01 ? "REDUCED_TO_GATE_MAX" : "RETAINED",
    reason: "Default gate clamp.",
    gateStatus: status,
  };
}

function gateMaxDeduction(assessment: ConcernAssessment): number {
  return Math.max(0, assessment.remaining_deduction);
}

function qualifiesAsNewConcern(
  entry: RubricDeductionEntry,
  payload: CommercialRubricPayload,
  matchedAssessment?: ConcernAssessment,
): boolean {
  const cat = findCategory(payload, entry.category_key);
  if (!cat) return false;
  if ((cat.examples ?? []).length < 2 && !cat.insufficient_evidence) return false;
  if (!(cat.revision_to_recover ?? "").trim()) return false;

  const entryRoot = entry.root_issue_key;
  if (matchedAssessment) {
    const priorRoot = normalizeRootIssueKey(matchedAssessment.root_issue);
    if (priorRoot === entryRoot && matchedAssessment.status === "NOT_ASSESSABLE") {
      return false;
    }
    if (priorRoot !== entryRoot) return true;
    return false;
  }

  return entryRoot !== "unknown" && entry.example_texts.length >= 2;
}

function applyRootIssueCaps(
  mutable: MutableDeduction[],
  policy?: DuplicateDeductionOptions,
): { capAdjustments: RootIssueCapAdjustment[]; capErrors: string[] } {
  const rootCap = policy?.rootIssueCap ?? DEFAULT_ROOT_ISSUE_DEDUCTION_CAP;
  const categoryCap = policy?.categoryCap ?? DEFAULT_ROOT_ISSUE_CATEGORY_CAP;
  const capAdjustments: RootIssueCapAdjustment[] = [];
  const capErrors: string[] = [];

  const byRoot = new Map<string, MutableDeduction[]>();
  for (const m of mutable) {
    if (m.record.normalized_points <= 0) continue;
    const key = m.entry.root_issue_key;
    if (key === "unknown") continue;
    const list = byRoot.get(key) ?? [];
    list.push(m);
    byRoot.set(key, list);
  }

  for (const [rootKey, group] of byRoot) {
    if (group.length <= 1) continue;

    const categories = new Set(group.map((g) => g.entry.category_key));
    let total = group.reduce((s, g) => s + g.record.normalized_points, 0);
    const removedCategories: string[] = [];
    let pointsRemoved = 0;

    const sorted = [...group].sort((a, b) => b.rank_score - a.rank_score);

    if (categories.size > categoryCap) {
      const keptCategories = new Set<string>();
      for (const m of sorted) {
        if (keptCategories.size < categoryCap) {
          keptCategories.add(m.entry.category_key);
        } else if (!keptCategories.has(m.entry.category_key)) {
          pointsRemoved += m.record.normalized_points;
          m.record.normalized_points = 0;
          m.record.points_removed = m.record.original_points;
          m.record.disposition = "REMOVED_DUPLICATE";
          m.record.reason = `Root-issue category cap (${categoryCap}).`;
          removedCategories.push(m.entry.category_key);
        }
      }
    }

    total = group.reduce((s, g) => s + g.record.normalized_points, 0);
    if (total > rootCap + 0.01) {
      let excess = total - rootCap;
      for (let i = sorted.length - 1; i >= 0 && excess > 0.01; i--) {
        const m = sorted[i];
        if (m.record.normalized_points <= 0) continue;
        const remove = Math.min(excess, m.record.normalized_points);
        m.record.normalized_points = round2(m.record.normalized_points - remove);
        m.record.points_removed = round2(m.record.original_points - m.record.normalized_points);
        if (m.record.normalized_points <= 0.01) {
          m.record.normalized_points = 0;
          m.record.disposition = "REMOVED_DUPLICATE";
          m.record.reason = `Root-issue total cap (${rootCap} pts).`;
        } else {
          m.record.disposition = "REDUCED_TO_GATE_MAX";
          m.record.reason = `Root-issue cap reduced to ${rootCap} total.`;
        }
        pointsRemoved += remove;
        excess -= remove;
      }
    }

    if (pointsRemoved > 0) {
      capAdjustments.push({
        root_issue_key: rootKey,
        label: rootIssueLabel(rootKey),
        duplicate_points_removed: round2(pointsRemoved),
        categories_removed: removedCategories,
        justification: null,
      });
    }
  }

  return { capAdjustments, capErrors };
}

function applyRepeatedEvidenceCap(mutable: MutableDeduction[]): void {
  const quoteUsage = new Map<string, MutableDeduction[]>();
  for (const m of mutable) {
    if (m.record.normalized_points <= 0) continue;
    for (const q of m.entry.example_texts) {
      const key = q.slice(0, 80).toLowerCase();
      if (key.length < 20) continue;
      const list = quoteUsage.get(key) ?? [];
      list.push(m);
      quoteUsage.set(key, list);
    }
  }

  for (const [, group] of quoteUsage) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => b.rank_score - a.rank_score);
    for (let i = 1; i < sorted.length; i++) {
      const m = sorted[i];
      if (m.record.normalized_points <= 0) continue;
      m.record.points_removed = m.record.original_points;
      m.record.normalized_points = 0;
      m.record.disposition = "REMOVED_DUPLICATE";
      m.record.reason = "Repeated evidence quotation cannot support multiple full deductions.";
    }
  }
}

function rebuildPayloadFromMutable(
  raw: CommercialRubricPayload,
  mutable: MutableDeduction[],
): CommercialRubricPayload {
  const clone: CommercialRubricPayload = JSON.parse(JSON.stringify(raw));
  const byCatIndex = new Map<string, Map<number, number>>();

  for (const m of mutable) {
    const catMap = byCatIndex.get(m.entry.category_key) ?? new Map();
    catMap.set(m.entry.deduction_index, m.record.normalized_points);
    byCatIndex.set(m.entry.category_key, catMap);
  }

  for (const cat of allCategories(clone)) {
    const indexMap = byCatIndex.get(cat.category_key);
    if (!indexMap) continue;

    const labels = cat.deductions ?? [];
    const newLabels: string[] = [];
    const newReasons: string[] = [];
    let totalDeduction = 0;

    labels.forEach((label, idx) => {
      const pts = indexMap.get(idx) ?? 0;
      if (pts > 0.01) {
        const item = mutable.find(
          (m) => m.entry.category_key === cat.category_key && m.entry.deduction_index === idx,
        );
        newLabels.push(item?.entry.deduction_label ?? label);
        newReasons.push(item?.entry.deduction_reason ?? cat.deduction_reasons?.[idx] ?? label);
        totalDeduction += pts;
      }
    });

    cat.deductions = newLabels;
    cat.deduction_reasons = newReasons;
    cat.deduction = round2(totalDeduction);
    // points_earned set by applyPositiveEvidenceScores — not max - deduction
  }

  return clone;
}

function snapshotCategoryScores(payload: CommercialRubricPayload): Map<string, number> {
  const map = new Map<string, number>();
  for (const cat of allCategories(payload)) {
    map.set(cat.category_key, cat.points_earned);
  }
  return map;
}

function applyPositiveEvidenceScores(args: {
  rawPayload: CommercialRubricPayload;
  normalizedPayload: CommercialRubricPayload;
  rawCategoryScores: Map<string, number>;
  dispositions: DeductionNormalizationRecord[];
  majorRevisionRecommended: boolean;
  memoContent?: string;
}): {
  categoryAudits: CategoryScoreAudit[];
  acquisitionCapApplied: { capped: boolean; reason: string | null };
} {
  const categoryAudits: CategoryScoreAudit[] = [];

  for (const cat of allCategories(args.normalizedPayload)) {
    const rawCat = findCategory(args.rawPayload, cat.category_key)!;
    const rawAwarded = args.rawCategoryScores.get(cat.category_key) ?? rawCat.points_earned;
    const rawDeductions = rawCat.deduction;

    const catDispositions = args.dispositions.filter((d) => d.category_key === cat.category_key);
    const validRetained = round2(
      catDispositions.reduce((s, d) => s + d.normalized_points, 0),
    );
    const invalidRemoved = round2(
      catDispositions
        .filter((d) => INVALID_DEDUCTION_DISPOSITIONS.has(d.disposition))
        .reduce((s, d) => s + d.points_removed, 0),
    );

    const isAcquisition = ACQUISITION_CATEGORY_KEYS.has(cat.category_key);
    const assessment = assessPositiveEvidenceCeiling(rawCat, {
      memoContent: args.memoContent,
      isAcquisition,
      majorRevisionRecommended: args.majorRevisionRecommended,
    });

    const { normalized_awarded, recoverable_from_invalid, ceiling_reduction, increased_without_evidence } =
      computeNormalizedCategoryScore({
        cat,
        raw_awarded: rawAwarded,
        valid_deductions_retained: validRetained,
        invalid_deductions_removed: invalidRemoved,
        ceiling_points: assessment.ceiling_points,
      });

    cat.points_earned = normalized_awarded;
    cat.deduction = validRetained;
    cat.weighted_contribution = normalized_awarded;

    categoryAudits.push({
      category_key: cat.category_key,
      category_name: cat.category_name,
      maximum_points: cat.maximum_points,
      raw_awarded_points: rawAwarded,
      raw_deductions: rawDeductions,
      invalid_deductions_removed: invalidRemoved,
      valid_deductions_retained: validRetained,
      positive_evidence_strength: assessment.strength,
      positive_evidence_ceiling: assessment.ceiling_points,
      recoverable_points_from_invalid: recoverable_from_invalid,
      ceiling_reduction_applied: ceiling_reduction,
      normalized_awarded_points: normalized_awarded,
      increased_without_positive_evidence: increased_without_evidence,
      positive_evidence_summary: assessment.supporting_strengths.join("; ") || assessment.reason,
      ceiling_reason: assessment.reason,
    });
  }

  // Acquisition total safeguard
  const acquisitionMax = args.normalizedPayload.acquisition_categories.reduce(
    (s, c) => s + c.maximum_points,
    0,
  );
  const acquisitionScore = args.normalizedPayload.acquisition_categories.reduce(
    (s, c) => s + c.points_earned,
    0,
  );

  const cap = acquisitionReadinessCap({
    acquisitionScore,
    acquisitionMax,
    majorRevisionRecommended: args.majorRevisionRecommended,
    memoContent: args.memoContent,
  });

  if (cap.capped) {
    const scale = cap.cappedScore / acquisitionScore;
    for (const cat of args.normalizedPayload.acquisition_categories) {
      cat.points_earned = round2(cat.points_earned * scale);
      cat.deduction = round2(Math.max(0, cat.maximum_points - cat.points_earned));
      cat.weighted_contribution = cat.points_earned;
    }
    for (const audit of categoryAudits) {
      if (ACQUISITION_CATEGORY_KEYS.has(audit.category_key)) {
        const cat = findCategory(args.normalizedPayload, audit.category_key)!;
        audit.normalized_awarded_points = cat.points_earned;
        audit.ceiling_reason += " Acquisition cap applied due to major revision burden.";
      }
    }
  }

  return { categoryAudits, acquisitionCapApplied: { capped: cap.capped, reason: cap.reason } };
}

function computeRankScore(entry: RubricDeductionEntry, assessment: ConcernAssessment | null): number {
  let score = entry.example_texts.length * 10;
  if (assessment) {
    score += assessment.confidence === "high" ? 30 : assessment.confidence === "medium" ? 15 : 5;
    score += assessment.current_supporting_evidence.length * 8;
    if (assessment.rubric_category === entry.category_key) score += 20;
  }
  score += entry.deduction_points;
  return score;
}

function buildAdjustmentsSummary(
  dispositions: DeductionNormalizationRecord[],
  capAdjustments: RootIssueCapAdjustment[],
  categoryAudits: CategoryScoreAudit[],
  rawScore: number,
  normalizedScore: number,
): NormalizationAdjustmentsSummary {
  const count = (disp: DeductionDisposition) =>
    dispositions.filter((d) => d.disposition === disp).length;
  const points = (disp: DeductionDisposition) =>
    dispositions.filter((d) => d.disposition === disp).reduce((s, d) => s + d.points_removed, 0);

  const rootCapPts = capAdjustments.reduce((s, c) => s + c.duplicate_points_removed, 0);
  const recoverable = categoryAudits.reduce((s, a) => s + a.recoverable_points_from_invalid, 0);
  const ceilingReductions = categoryAudits.reduce((s, a) => s + a.ceiling_reduction_applied, 0);
  const validRetained = categoryAudits.reduce((s, a) => s + a.valid_deductions_retained, 0);

  const lines = [
    `Unsupported deductions removed: ${count("REMOVED_UNSUPPORTED")} (${points("REMOVED_UNSUPPORTED").toFixed(2)} pts)`,
    `Duplicate deductions removed: ${count("REMOVED_DUPLICATE")} (${points("REMOVED_DUPLICATE").toFixed(2)} pts)`,
    `Not-assessable carry-forwards removed: ${count("REMOVED_NOT_ASSESSABLE")} (${points("REMOVED_NOT_ASSESSABLE").toFixed(2)} pts)`,
    `Resolved deductions removed: ${count("REMOVED_RESOLVED")} (${points("REMOVED_RESOLVED").toFixed(2)} pts)`,
    `Stale critiques removed: ${count("REMOVED_STALE")} (${points("REMOVED_STALE").toFixed(2)} pts)`,
    `Deductions reduced to gate maximum: ${count("REDUCED_TO_GATE_MAX")} (${points("REDUCED_TO_GATE_MAX").toFixed(2)} pts)`,
    `Overbroad deductions narrowed: ${count("NARROWED_AND_REDUCED")} (${points("NARROWED_AND_REDUCED").toFixed(2)} pts)`,
    `Root-issue caps applied: ${capAdjustments.length} (${rootCapPts.toFixed(2)} pts)`,
    `Mechanically recoverable points (invalid deductions): ${recoverable.toFixed(2)} pts`,
    `Evidence-ceiling reductions: ${ceilingReductions.toFixed(2)} pts`,
    `Valid deductions retained: ${validRetained.toFixed(2)} pts`,
    `Raw model score: ${rawScore.toFixed(2)}`,
    `Normalized application score: ${normalizedScore.toFixed(2)}`,
  ];

  return {
    section_title: "Adjustments made by StoryDNA validation",
    unsupported_removed: count("REMOVED_UNSUPPORTED"),
    duplicate_removed: count("REMOVED_DUPLICATE"),
    not_assessable_removed: count("REMOVED_NOT_ASSESSABLE"),
    reduced_to_gate_max: count("REDUCED_TO_GATE_MAX"),
    resolved_removed: count("REMOVED_RESOLVED"),
    stale_removed: count("REMOVED_STALE"),
    narrowed_and_reduced: count("NARROWED_AND_REDUCED"),
    root_issue_caps_applied: capAdjustments.length,
    repeated_evidence_removed: dispositions.filter((d) =>
      d.reason.includes("Repeated evidence"),
    ).length,
    raw_score: rawScore,
    normalized_score: normalizedScore,
    mechanically_recoverable_points: round2(recoverable),
    evidence_ceiling_reductions: round2(ceilingReductions),
    valid_deductions_retained_points: round2(validRetained),
    lines,
  };
}

function applyDeterministicBroadDeductionNarrowing(
  mutable: MutableDeduction[],
  rawPayload: CommercialRubricPayload,
  gateAssessments: ConcernAssessment[],
  errors: string[],
): void {
  const assessmentById = indexAssessments(gateAssessments);

  for (const item of mutable) {
    if (
      !shouldDeterministicallyNarrowDeduction(
        item.entry.deduction_reason,
        item.record.disposition,
        item.record.normalized_points,
      )
    ) {
      continue;
    }

    const category = findCategory(rawPayload, item.entry.category_key);
    if (!category) {
      errors.push(
        `${item.entry.category_key}: broad deduction cannot be narrowed safely — category missing.`,
      );
      continue;
    }

    const match = matchDeductionToAssessment(item.entry, gateAssessments, assessmentById);
    const narrowed = buildDeterministicNarrowedDeduction({
      entry: item.entry,
      category,
      assessment: match.assessment,
    });

    if (!narrowed || isBroadCriticism(narrowed)) {
      errors.push(`${item.entry.category_key}: broad deduction cannot be narrowed safely.`);
      continue;
    }

    item.entry.deduction_reason = narrowed;
    item.record.disposition = "NARROWED_AND_REDUCED";
    item.record.reason = `Deterministic narrow rewrite from category evidence: ${narrowed.slice(0, 80)}`;
  }
}

function findCategory(payload: CommercialRubricPayload, key: string): RubricCategoryScore | undefined {
  return allCategories(payload).find((c) => c.category_key === key);
}

function allCategories(payload: CommercialRubricPayload): RubricCategoryScore[] {
  return [...payload.craft_categories, ...payload.acquisition_categories];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** @internal test helper — avoid importing stacked-audit in production if circular */
export function sumPayloadScore(payload: CommercialRubricPayload): number {
  return allCategories(payload).reduce((s, c) => s + c.points_earned, 0);
}
