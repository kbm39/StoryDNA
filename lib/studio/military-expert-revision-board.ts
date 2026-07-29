/**
 * Revision Board routing for Military Expert findings — investigation vs revision candidates.
 */

import type { MilitaryExpertFinding, MilitaryExpertReview } from "@/experts/military-expert/contracts.ts";

export type MilitaryExpertBoardCandidateKind = "revision_candidate" | "investigation_candidate";

export interface MilitaryExpertBoardCandidate {
  readonly findingId: string;
  readonly findingIndex: number;
  readonly kind: MilitaryExpertBoardCandidateKind;
  readonly title: string;
  readonly taskLanguage: string;
  readonly sourceExpert: "Military Expert";
}

export function buildMilitaryExpertBoardCandidates(
  review: MilitaryExpertReview,
): readonly MilitaryExpertBoardCandidate[] {
  return review.findings.flatMap((finding, index) => {
    const candidate = toBoardCandidate(finding, index);
    return candidate ? [candidate] : [];
  });
}

function toBoardCandidate(
  finding: MilitaryExpertFinding,
  index: number,
): MilitaryExpertBoardCandidate | null {
  if (finding.finding_status === "author_review_required") {
    return Object.freeze({
      findingId: finding.finding_id,
      findingIndex: index,
      kind: "investigation_candidate",
      title: finding.title,
      taskLanguage:
        "Review the cited evidence and decide whether a manuscript change is needed before revising.",
      sourceExpert: "Military Expert",
    });
  }

  if (finding.realism_status === "accurate" || finding.realism_status === "insufficient_evidence") {
    return null;
  }

  return Object.freeze({
    findingId: finding.finding_id,
    findingIndex: index,
    kind: "revision_candidate",
    title: finding.title,
    taskLanguage: finding.recommendation,
    sourceExpert: "Military Expert",
  });
}

export function partitionMilitaryExpertBoardCandidates(
  candidates: readonly MilitaryExpertBoardCandidate[],
): {
  revisionCandidates: readonly MilitaryExpertBoardCandidate[];
  investigationCandidates: readonly MilitaryExpertBoardCandidate[];
} {
  const revisionCandidates = candidates.filter((item) => item.kind === "revision_candidate");
  const investigationCandidates = candidates.filter((item) => item.kind === "investigation_candidate");
  return { revisionCandidates, investigationCandidates };
}
