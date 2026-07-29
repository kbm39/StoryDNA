/**
 * Author-facing Military Expert display copy and action definitions.
 */

import type { MilitaryExpertFinding } from "@/experts/military-expert/contracts.ts";

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_HEADING = "AUTHOR REVIEW REQUIRED" as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_INTRO =
  "StoryDNA identified this concern and found manuscript evidence supporting it, but it could not complete its check for evidence that may weaken or contradict the concern." as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_DISCLAIMER =
  "This finding is provisional and should not be treated as confirmed until you review it or discuss it with the expert." as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_ACTIONS = [
  "Review Evidence",
  "Challenge Finding",
  "Discuss With Expert",
  "Accept Provisionally",
  "Dismiss",
  "Mark Resolved",
] as const;

export type MilitaryExpertAuthorReviewAction =
  (typeof MILITARY_EXPERT_AUTHOR_REVIEW_ACTIONS)[number];

export interface MilitaryExpertAuthorReviewRequiredItem {
  readonly findingId: string;
  readonly findingIndex: number;
  readonly heading: typeof MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_HEADING;
  readonly intro: typeof MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_INTRO;
  readonly disclaimer: typeof MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_DISCLAIMER;
  readonly title: string;
  readonly concern: string;
  readonly supportingEvidenceSummary: string;
  readonly unresolvedChecks: readonly string[];
  readonly provisionalStatus: "author_review_required";
  readonly recommendedAuthorAction: string;
  readonly actions: readonly MilitaryExpertAuthorReviewAction[];
}

export function buildAuthorReviewRequiredSection(
  findings: readonly MilitaryExpertFinding[],
  unresolvedMissingFieldsByIndex?: ReadonlyMap<number, readonly ("contrary_evidence" | "uncertainty_note")[]>,
): readonly MilitaryExpertAuthorReviewRequiredItem[] {
  return findings.flatMap((finding, index) => {
    if (finding.finding_status !== "author_review_required") return [];
    const missing = unresolvedMissingFieldsByIndex?.get(index) ?? inferMissingConfidenceFields(finding);
    return [
      Object.freeze({
        findingId: finding.finding_id,
        findingIndex: index,
        heading: MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_HEADING,
        intro: MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_INTRO,
        disclaimer: MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_DISCLAIMER,
        title: finding.title,
        concern: finding.observation,
        supportingEvidenceSummary: summarizeEvidence(finding),
        unresolvedChecks: missing.map(describeMissingField),
        provisionalStatus: "author_review_required" as const,
        recommendedAuthorAction: "Investigate before revising.",
        actions: MILITARY_EXPERT_AUTHOR_REVIEW_ACTIONS,
      }),
    ];
  });
}

function inferMissingConfidenceFields(
  finding: MilitaryExpertFinding,
): readonly ("contrary_evidence" | "uncertainty_note")[] {
  const missing: ("contrary_evidence" | "uncertainty_note")[] = [];
  if (finding.contrary_evidence === undefined) missing.push("contrary_evidence");
  if (!finding.uncertainty_note?.trim()) missing.push("uncertainty_note");
  return missing;
}

function describeMissingField(field: "contrary_evidence" | "uncertainty_note"): string {
  return field === "contrary_evidence"
    ? "contrary evidence not verified"
    : "uncertainty explanation not completed";
}

function summarizeEvidence(finding: MilitaryExpertFinding): string {
  const excerpts = (finding.manuscript_evidence ?? [])
    .map((item) => item.excerpt.trim())
    .filter(Boolean);
  if (excerpts.length === 0) return "Supporting evidence recorded.";
  if (excerpts.length === 1) return excerpts[0]!;
  return `${excerpts.length} supporting evidence excerpts recorded.`;
}
