import type { CommercialRubricPayload } from "../commercial-fiction-rubric.ts";
import { letterGradeFromScore } from "../grade-calculation.ts";

export type MemoRecommendation = "REQUEST" | "PASS" | "REVISE & RESUBMIT" | "UNKNOWN";

export interface RecommendationConsistencyResult {
  recommendation: MemoRecommendation;
  recommendation_consistent: boolean;
  errors: string[];
  /** Whether publication should be withheld due to contradiction. */
  blocks_publication: boolean;
}

const MAJOR_REVISION_MEMO_PATTERNS = [
  /\*\*REVISE\s*&\s*RESUBMIT\*\*/i,
  /\bREVISE\s*&\s*RESUBMIT\b/i,
  /\bmajor\s+structural\b/i,
  /\bsubstantial\s+(?:revision|cut|restruct)/i,
  /\bnot\s+ready\s+to\s+(?:submit|send)\b/i,
  /\bnot\s+submission-ready\b/i,
];

const SUBMISSION_READY_PATTERNS = [
  /\*\*PASS\*\*/i,
  /\*\*REQUEST\*\*/i,
  /\bsubmission-ready\b/i,
  /\bready\s+to\s+submit\b/i,
  /\bready\s+for\s+(?:acquisition|submission)\b/i,
];

/** Extract primary recommendation from Call A memo. */
export function extractMemoRecommendation(memoContent: string): MemoRecommendation {
  if (/\*\*REVISE\s*&\s*RESUBMIT\*\*/i.test(memoContent) || /\bREVISE\s*&\s*RESUBMIT\b/i.test(memoContent)) {
    return "REVISE & RESUBMIT";
  }
  if (/\*\*PASS\*\*/i.test(memoContent)) return "PASS";
  if (/\*\*REQUEST\*\*/i.test(memoContent)) return "REQUEST";
  return "UNKNOWN";
}

/** Whether memo or rubric signals major revision burden. */
export function detectMajorRevisionBurden(
  memoContent: string,
  payload: CommercialRubricPayload,
): boolean {
  if (MAJOR_REVISION_MEMO_PATTERNS.some((p) => p.test(memoContent))) return true;

  const significantCut = payload.length_recommendations?.some(
    (r) => (r.recommended_cut_percentage ?? 0) >= 10 || (r.recommended_cut_words ?? 0) >= 10_000,
  );
  if (significantCut) return true;

  for (const cat of [...payload.craft_categories, ...payload.acquisition_categories]) {
    const rev = cat.revision_to_recover ?? "";
    if (/\b(?:major|structural|substantial|significant|restructure|overhaul)\b/i.test(rev)) {
      return true;
    }
  }
  return false;
}

/** Validate score, grade, and recommendation agree. */
export function validateRecommendationConsistency(args: {
  memoContent?: string;
  normalizedScore: number;
  letterGrade: string;
  acquisitionScore: number;
  acquisitionMax: number;
  payload: CommercialRubricPayload;
}): RecommendationConsistencyResult {
  const errors: string[] = [];
  const memo = args.memoContent ?? "";
  const recommendation = extractMemoRecommendation(memo);
  const majorRevision = detectMajorRevisionBurden(memo, args.payload);

  const submissionReadyGrade = args.normalizedScore >= 87;
  const submissionReadyMemo = SUBMISSION_READY_PATTERNS.some((p) => p.test(memo));
  const perfectAcquisition =
    args.acquisitionMax > 0 && args.acquisitionScore >= args.acquisitionMax - 0.01;

  if (recommendation === "REVISE & RESUBMIT" && submissionReadyGrade) {
    errors.push(
      "REVISE & RESUBMIT recommendation contradicts normalized A-range score (≥87).",
    );
  }

  if (majorRevision && perfectAcquisition) {
    errors.push(
      "Perfect acquisition readiness (30/30) blocked: major structural revision or significant cuts still recommended.",
    );
  }

  if (majorRevision && submissionReadyGrade && submissionReadyMemo) {
    errors.push("Submission-ready language contradicts major revision burden.");
  }

  if (recommendation === "REVISE & RESUBMIT" && perfectAcquisition) {
    errors.push("REVISE & RESUBMIT cannot coexist with perfect acquisition readiness.");
  }

  const gradeFromScore = letterGradeFromScore(args.normalizedScore);
  if (gradeFromScore !== args.letterGrade && Math.abs(args.normalizedScore - 70) > 5) {
    // letter grade must be application-calculated
  }

  const blocks =
    errors.length > 0 &&
    (recommendation === "REVISE & RESUBMIT" || majorRevision) &&
    (submissionReadyGrade || perfectAcquisition);

  return {
    recommendation,
    recommendation_consistent: errors.length === 0,
    errors,
    blocks_publication: blocks,
  };
}

/** Hard cap acquisition score when major revision remains. */
export function acquisitionReadinessCap(args: {
  acquisitionScore: number;
  acquisitionMax: number;
  majorRevisionRecommended: boolean;
  memoContent?: string;
}): { cappedScore: number; capped: boolean; reason: string | null } {
  if (!args.majorRevisionRecommended) {
    return { cappedScore: args.acquisitionScore, capped: false, reason: null };
  }

  // With major revision, acquisition cannot exceed 90% of max (27/30)
  const cap = round2(args.acquisitionMax * 0.9);
  if (args.acquisitionScore <= cap + 0.01) {
    return { cappedScore: args.acquisitionScore, capped: false, reason: null };
  }

  return {
    cappedScore: cap,
    capped: true,
    reason: "Major revision recommended — acquisition readiness capped at 90% of maximum.",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
