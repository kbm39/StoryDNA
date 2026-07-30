/**
 * Author-quality scorecard for Phase 2B synthesis reports.
 */

import type { MilitaryExpertV2SynthesisReport } from "./synthesis-report.ts";

export const SYNTHESIS_AUTHOR_QUALITY_DIMENSIONS = [
  "battle_and_firefight_coverage",
  "breach_and_room_entry_coverage",
  "tactical_movement_coverage",
  "command_and_communications_depth",
  "weapons_continuity",
  "aviation_authenticity",
  "casualty_realism",
  "military_culture",
  "scene_specificity",
  "why_it_matters_explanation",
  "positive_authenticity_recognition",
  "revision_usefulness",
  "scope_transparency",
  "confidence_transparency",
  "safety",
] as const;

export type SynthesisAuthorQualityDimension =
  (typeof SYNTHESIS_AUTHOR_QUALITY_DIMENSIONS)[number];

export type SynthesisAuthorQualityScore = "Strong" | "Adequate" | "Weak" | "Missing";

export interface SynthesisAuthorQualityScorecard {
  readonly scores: Readonly<Record<SynthesisAuthorQualityDimension, SynthesisAuthorQualityScore>>;
  readonly overallPass: boolean;
  readonly failureReasons: readonly string[];
  readonly strongCount: number;
  readonly adequateCount: number;
}

const REQUIRED_NO_MISSING: readonly SynthesisAuthorQualityDimension[] = [
  "scene_specificity",
  "scope_transparency",
  "safety",
];

function scoreFromKeywords(
  text: string,
  keywords: readonly string[],
): SynthesisAuthorQualityScore {
  const lower = text.toLowerCase();
  const hits = keywords.filter((k) => lower.includes(k)).length;
  if (hits >= 2) return "Strong";
  if (hits >= 1) return "Adequate";
  return "Weak";
}

export function evaluateSynthesisAuthorQuality(
  report: MilitaryExpertV2SynthesisReport,
): SynthesisAuthorQualityScorecard {
  const scores = {} as Record<SynthesisAuthorQualityDimension, SynthesisAuthorQualityScore>;
  const failureReasons: string[] = [];

  const allText = [
    report.overallAssessment,
    report.scopeBlock,
    ...report.recurringStrengths.map((s) => `${s.title} ${s.explanation}`),
    ...report.recurringConcerns.map((c) => `${c.title} ${c.explanation}`),
    ...report.topPriorityFindings.map((f) => `${f.title} ${f.plainEnglishExplanation}`),
    ...report.sceneAppendix.flatMap((s) => [
      s.realismSummary ?? "",
      ...s.strengths.map((p) => p.explanation),
      ...s.concerns.map((p) => p.explanation),
    ]),
  ].join(" ");

  scores.battle_and_firefight_coverage = scoreFromKeywords(allText, [
    "firefight",
    "battle",
    "contact",
  ]);
  scores.breach_and_room_entry_coverage = scoreFromKeywords(allText, [
    "breach",
    "room entry",
    "stack",
  ]);
  scores.tactical_movement_coverage = scoreFromKeywords(allText, [
    "movement",
    "cover",
    "maneuver",
  ]);
  scores.command_and_communications_depth = scoreFromKeywords(allText, [
    "command",
    "radio",
    "communications",
  ]);
  scores.weapons_continuity = scoreFromKeywords(allText, ["weapon", "reload", "fire"]);
  scores.aviation_authenticity = scoreFromKeywords(allText, ["aviation", "helicopter", "insertion"]);
  scores.casualty_realism = scoreFromKeywords(allText, ["casualty", "wound", "medevac"]);
  scores.military_culture = scoreFromKeywords(allText, ["chain of command", "culture", "unit"]);
  scores.scene_specificity =
    report.sceneAppendix.length >= report.selectedSceneCount ? "Strong" : "Missing";
  scores.why_it_matters_explanation =
    report.topPriorityFindings.every((f) => f.whyItMatters.trim().length > 20)
      ? "Strong"
      : "Adequate";
  scores.positive_authenticity_recognition =
    report.recurringStrengths.length > 0 ? "Strong" : "Missing";
  scores.revision_usefulness =
    report.topRevisionPriorities.length > 0 ? "Strong" : "Adequate";
  scores.scope_transparency = report.scopeBlock.includes("selected") ? "Strong" : "Missing";
  scores.confidence_transparency = report.confirmedFindings.length + report.authorReviewRequiredFindings.length > 0
    ? "Adequate"
    : "Weak";
  scores.safety = /\bstep[- ]by[- ]step\b/i.test(allText) ? "Missing" : "Strong";

  for (const dim of REQUIRED_NO_MISSING) {
    if (scores[dim] === "Missing") {
      failureReasons.push(`${dim} scored Missing.`);
    }
  }

  let strongCount = 0;
  let adequateCount = 0;
  for (const dim of SYNTHESIS_AUTHOR_QUALITY_DIMENSIONS) {
    if (scores[dim] === "Strong") strongCount++;
    if (scores[dim] === "Adequate") adequateCount++;
    if (scores[dim] === "Weak" || scores[dim] === "Missing") {
      if (!REQUIRED_NO_MISSING.includes(dim) && scores[dim] === "Missing") {
        failureReasons.push(`${dim} scored Missing.`);
      }
    }
  }

  const majorityStrong = strongCount > SYNTHESIS_AUTHOR_QUALITY_DIMENSIONS.length / 2;
  const allAtLeastAdequate = SYNTHESIS_AUTHOR_QUALITY_DIMENSIONS.every(
    (d) => scores[d] !== "Weak" && scores[d] !== "Missing",
  );

  const overallPass =
    failureReasons.length === 0 && allAtLeastAdequate && majorityStrong;

  return Object.freeze({
    scores: Object.freeze(scores),
    overallPass,
    failureReasons: Object.freeze(failureReasons),
    strongCount,
    adequateCount,
  });
}

export function findStrongestAndWeakestSynthesisFindings(
  report: MilitaryExpertV2SynthesisReport,
): {
  strongest: { findingId: string; title: string } | null;
  weakest: { findingId: string; title: string } | null;
} {
  const findings = report.topPriorityFindings;
  if (findings.length === 0) return { strongest: null, weakest: null };

  const ranked = [...findings].sort((a, b) => {
    const sigOrder = { critical: 0, important: 1, minor: 2, informational: 3 };
    return (
      (sigOrder[a.revisionSignificance as keyof typeof sigOrder] ?? 9) -
      (sigOrder[b.revisionSignificance as keyof typeof sigOrder] ?? 9)
    );
  });

  return {
    strongest: { findingId: ranked[0]!.findingId, title: ranked[0]!.title },
    weakest: {
      findingId: ranked[ranked.length - 1]!.findingId,
      title: ranked[ranked.length - 1]!.title,
    },
  };
}
