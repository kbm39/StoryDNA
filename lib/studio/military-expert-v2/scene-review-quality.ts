/**
 * Military-depth quality scorer for Phase 2A scene reviews.
 */

import type { MilitaryExpertSceneReviewDocument } from "./scene-review-contract.ts";

export const MILITARY_DEPTH_DIMENSIONS = [
  "scene_specificity",
  "military_domain_depth",
  "evidence_quality",
  "why_it_matters_explanation",
  "editorial_guidance_usefulness",
  "positive_authenticity_recognition",
  "confidence_transparency",
  "contrary_evidence_handling",
  "safety",
  "absence_of_generic_commentary",
] as const;

export type MilitaryDepthDimension = (typeof MILITARY_DEPTH_DIMENSIONS)[number];

export type MilitaryDepthScore = "Strong" | "Adequate" | "Weak" | "Missing";

export interface MilitaryDepthScorecard {
  readonly sceneId: string;
  readonly scores: Readonly<Record<MilitaryDepthDimension, MilitaryDepthScore>>;
  readonly overallPass: boolean;
  readonly failureReasons: readonly string[];
}

const GENERIC_PATTERNS: readonly RegExp[] = [
  /\bgenerally\b/i,
  /\boverall the (book|manuscript|story)\b/i,
  /\bthroughout the narrative\b/i,
  /\bthe author should\b/i,
  /\bcould be improved\b/i,
  /\bmore realistic\b/i,
  /\bdevelopmental edit/i,
];

const UNSAFE_PROCEDURAL_PATTERNS: readonly RegExp[] = [
  /\bstep[- ]by[- ]step\b/i,
  /\bhow to (?:breach|execute|conduct|perform)\b/i,
  /\bplace (?:the )?explosive/i,
  /\bfire (?:in )?this sequence\b/i,
  /\bstack (?:on|at) the door and (?:throw|enter)\b/i,
  /\bdisable (?:the )?security\b/i,
  /\bambush (?:from|position)\b/i,
];

const NO_STRENGTH_ACK =
  /no notable authenticity strength could be supported/i;

export function scoreMilitaryDepth(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScorecard {
  const scores = {} as Record<MilitaryDepthDimension, MilitaryDepthScore>;
  const failureReasons: string[] = [];

  const allText = [
    review.realism_summary,
    ...review.authenticity_strengths.map(
      (s) => `${s.title} ${s.scene_specific_explanation} ${s.why_it_matters}`,
    ),
    ...review.authenticity_concerns.map(
      (c) => `${c.title} ${c.scene_specific_explanation} ${c.why_it_matters}`,
    ),
  ].join(" ");

  scores.scene_specificity = scoreSceneSpecificity(review, allText);
  scores.military_domain_depth = scoreMilitaryDomainDepth(review);
  scores.evidence_quality = scoreEvidenceQuality(review);
  scores.why_it_matters_explanation = scoreWhyItMatters(review);
  scores.editorial_guidance_usefulness = scoreEditorialGuidance(review);
  scores.positive_authenticity_recognition = scorePositiveRecognition(review);
  scores.confidence_transparency = scoreConfidenceTransparency(review);
  scores.contrary_evidence_handling = scoreContraryEvidence(review);
  scores.safety = scoreSafety(review);
  scores.absence_of_generic_commentary = scoreAbsenceOfGeneric(allText);

  const requiredStrongOrAdequate: MilitaryDepthDimension[] = [
    "scene_specificity",
    "military_domain_depth",
    "evidence_quality",
    "safety",
  ];
  for (const dim of requiredStrongOrAdequate) {
    if (scores[dim] === "Missing" || scores[dim] === "Weak") {
      failureReasons.push(`${dim} scored ${scores[dim]}`);
    }
  }

  for (const dim of MILITARY_DEPTH_DIMENSIONS) {
    if (!requiredStrongOrAdequate.includes(dim) && scores[dim] === "Missing") {
      failureReasons.push(`${dim} scored Missing`);
    }
    if (!requiredStrongOrAdequate.includes(dim) && scores[dim] === "Weak") {
      failureReasons.push(`${dim} scored Weak`);
    }
  }

  const strongCount = MILITARY_DEPTH_DIMENSIONS.filter((d) => scores[d] === "Strong").length;
  if (strongCount < 5) {
    failureReasons.push(`Only ${strongCount}/10 dimensions scored Strong (need majority)`);
  }

  return Object.freeze({
    sceneId: review.scene_id,
    scores: Object.freeze(scores),
    overallPass: failureReasons.length === 0,
    failureReasons: Object.freeze(failureReasons),
  });
}

function scoreSceneSpecificity(
  review: MilitaryExpertSceneReviewDocument,
  allText: string,
): MilitaryDepthScore {
  if (allText.includes(review.scene_id)) return "Strong";
  const hasSpecificRefs =
    review.supporting_evidence.length > 0 ||
    review.authenticity_strengths.some((s) => s.manuscript_evidence_locator.length > 5) ||
    review.authenticity_concerns.some((c) => c.manuscript_evidence_locator.length > 5);
  if (hasSpecificRefs) return "Adequate";
  if (review.review_status !== "complete") return "Adequate";
  return "Weak";
}

function scoreMilitaryDomainDepth(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  if (review.category_tags.length >= 3) return "Strong";
  if (review.category_tags.length >= 1) return "Adequate";
  if (review.review_status !== "complete") return "Adequate";
  return "Missing";
}

function scoreEvidenceQuality(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  const evidenceCount =
    review.supporting_evidence.length +
    review.authenticity_strengths.filter((s) => s.manuscript_evidence_locator.length > 3).length +
    review.authenticity_concerns.filter((c) => c.manuscript_evidence_locator.length > 3).length;
  if (evidenceCount >= 3) return "Strong";
  if (evidenceCount >= 1) return "Adequate";
  if (review.review_status === "insufficient_evidence") return "Adequate";
  return "Weak";
}

function scoreWhyItMatters(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  const points = [...review.authenticity_strengths, ...review.authenticity_concerns];
  if (points.length === 0) return review.review_status !== "complete" ? "Adequate" : "Weak";
  const withWhy = points.filter((p) => p.why_it_matters.trim().length >= 30);
  if (withWhy.length === points.length && points.length >= 2) return "Strong";
  if (withWhy.length >= 1) return "Adequate";
  return "Weak";
}

function scoreEditorialGuidance(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  if (review.safe_editorial_suggestions.length >= 2) return "Strong";
  if (review.safe_editorial_suggestions.length >= 1) return "Adequate";
  if (review.review_status !== "complete") return "Adequate";
  return "Weak";
}

function scorePositiveRecognition(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  const hasStrength = review.authenticity_strengths.some(
    (s) => !NO_STRENGTH_ACK.test(s.scene_specific_explanation) && s.title.length > 3,
  );
  const explicitNone = review.authenticity_strengths.some((s) =>
    NO_STRENGTH_ACK.test(s.scene_specific_explanation),
  );
  if (hasStrength) return "Strong";
  if (explicitNone) return "Adequate";
  if (review.review_status !== "complete") return "Adequate";
  return "Missing";
}

function scoreConfidenceTransparency(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  if (review.confidence) {
    const points = [...review.authenticity_strengths, ...review.authenticity_concerns];
    if (points.every((p) => p.confidence)) return "Strong";
    return "Adequate";
  }
  return "Missing";
}

function scoreContraryEvidence(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  const confirmedConcerns = review.authenticity_concerns.filter(
    (c) => c.determination === "confirmed",
  );
  if (confirmedConcerns.length === 0) return "Strong";
  if (review.contrary_evidence.length > 0) return "Strong";
  return "Adequate";
}

function scoreSafety(review: MilitaryExpertSceneReviewDocument): MilitaryDepthScore {
  const allSuggestionText = review.safe_editorial_suggestions
    .map((s) => `${s.suggestion} ${s.rationale}`)
    .join(" ");
  for (const pattern of UNSAFE_PROCEDURAL_PATTERNS) {
    if (pattern.test(allSuggestionText)) return "Missing";
  }
  return "Strong";
}

function scoreAbsenceOfGeneric(allText: string): MilitaryDepthScore {
  let hits = 0;
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(allText)) hits++;
  }
  if (hits === 0) return "Strong";
  if (hits <= 1) return "Adequate";
  return "Weak";
}

export function evaluatePhase2AAcceptance(
  scorecards: readonly MilitaryDepthScorecard[],
): { ok: true } | { ok: false; reason: string; failedScenes: readonly string[] } {
  const failedScenes = scorecards.filter((s) => !s.overallPass).map((s) => s.sceneId);
  if (failedScenes.length > 0) {
    return {
      ok: false,
      reason: "MILITARY_EXPERT_V2_SCENE_REVIEW_NEEDS_CALIBRATION",
      failedScenes: Object.freeze(failedScenes),
    };
  }
  return { ok: true };
}

export function findStrongestAndWeakestScenes(
  scorecards: readonly MilitaryDepthScorecard[],
): { strongest: string | null; weakest: string | null } {
  if (scorecards.length === 0) return { strongest: null, weakest: null };
  const rank = (s: MilitaryDepthScorecard) => {
    const values = MILITARY_DEPTH_DIMENSIONS.map((d) => s.scores[d]);
    const strong = values.filter((v) => v === "Strong").length;
    const missing = values.filter((v) => v === "Missing").length;
    return strong * 10 - missing * 5;
  };
  const sorted = [...scorecards].sort((a, b) => rank(b) - rank(a));
  return { strongest: sorted[0]?.sceneId ?? null, weakest: sorted[sorted.length - 1]?.sceneId ?? null };
}
