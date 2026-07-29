/**
 * Author-facing Military Expert display copy and action definitions.
 */

import type { MilitaryExpertFinding } from "@/experts/military-expert/contracts.ts";

export const MILITARY_EXPERT_CONCERNS_REQUIRING_ATTENTION_LABEL =
  "Concerns requiring attention" as const;

export const MILITARY_EXPERT_FULLY_VALIDATED_FINDINGS_HEADING =
  "Fully validated findings" as const;

export const MILITARY_EXPERT_NEED_YOUR_REVIEW_LABEL = "Need your review" as const;

export const MILITARY_EXPERT_COUNT_EXPLANATION =
  "The concerns count includes only findings that may affect your revision priorities. The findings list includes every check StoryDNA finished, including accurate depictions." as const;

export const MILITARY_EXPERT_AUTHOR_RESPONSE_UNAVAILABLE =
  "Review this finding and the cited evidence before making a revision. Author response tools are not yet available in this private test." as const;

export const MILITARY_EXPERT_REVISION_BOARD_UNAVAILABLE =
  "Revision Board integration for Military Expert findings is not yet available in this private test." as const;

export const MILITARY_EXPERT_FUTURE_AUTHOR_DIALOGUE_NOTE =
  "Coming in a future author-dialogue update" as const;

export const MILITARY_EXPERT_NO_EVIDENCE_EXCERPT_SUMMARY =
  "No manuscript excerpts are shown in this summary view." as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_HEADING = "AUTHOR REVIEW REQUIRED" as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_INTRO =
  "StoryDNA identified this concern and found manuscript evidence supporting it, but it could not complete its check for evidence that may weaken or contradict the concern." as const;

export const MILITARY_EXPERT_AUTHOR_REVIEW_REQUIRED_DISCLAIMER =
  "This finding is provisional and should not be treated as confirmed until you review it or discuss it with the expert." as const;

/** Reserved for a future author-dialogue release; none persist decisions today. */
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

export function buildMilitaryExpertCountExplanation(
  fullyValidatedCount: number,
  concernsRequiringAttentionCount: number,
): string | null {
  if (fullyValidatedCount === concernsRequiringAttentionCount) return null;
  return MILITARY_EXPERT_COUNT_EXPLANATION;
}

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
  readonly recommendedAuthorAction: typeof MILITARY_EXPERT_AUTHOR_RESPONSE_UNAVAILABLE;
  readonly authorResponseToolsAvailable: false;
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
        recommendedAuthorAction: MILITARY_EXPERT_AUTHOR_RESPONSE_UNAVAILABLE,
        authorResponseToolsAvailable: false as const,
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
  if (excerpts.length === 0) return MILITARY_EXPERT_NO_EVIDENCE_EXCERPT_SUMMARY;
  if (excerpts.length === 1) return excerpts[0]!;
  return `${excerpts.length} supporting evidence excerpts recorded.`;
}
