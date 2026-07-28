/** Deterministic Studio output caps — keep Military Expert JSON within token budget. */
export const MILITARY_EXPERT_STUDIO_OUTPUT_LIMITS = Object.freeze({
  maxFindings: 10,
  maxEvidenceItemsPerFinding: 2,
  maxContraryEvidenceItemsPerFinding: 1,
  maxStrengths: 6,
  maxSummaryWords: 120,
  maxObservationWords: 80,
  maxRecommendationWords: 60,
});

export function militaryExpertStudioOutputBudgetBlock(): string {
  const limits = MILITARY_EXPERT_STUDIO_OUTPUT_LIMITS;
  return [
    "STUDIO OUTPUT BUDGET — hard limits for this run:",
    `- findings: at most ${limits.maxFindings} total; prioritize the most material issues only.`,
    `- manuscript_evidence: at most ${limits.maxEvidenceItemsPerFinding} object(s) per finding.`,
    `- contrary_evidence: at most ${limits.maxContraryEvidenceItemsPerFinding} object(s) per finding.`,
    `- strengths: at most ${limits.maxStrengths} concise items.`,
    `- summary: at most ${limits.maxSummaryWords} words.`,
    `- observation / recommendation fields: keep each under ${limits.maxObservationWords} / ${limits.maxRecommendationWords} words.`,
    "- Omit lower-priority findings rather than exceeding these limits.",
    "- Finish the JSON object completely within the output budget.",
  ].join("\n");
}
