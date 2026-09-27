import {
  ARCHIVIST_REVIEW_RECOMMENDED_LABEL,
  type ArchivistReviewCandidate,
  type PresentedReviewRecommendedCard,
  type PresentedReviewRecommendedModel,
} from "./types.ts";

function passageHeading(index: number, total: number): string {
  if (total === 2) return index === 0 ? "Earlier" : "Later";
  return `Passage ${index + 1}`;
}

export function presentReviewRecommendedCard(
  candidate: ArchivistReviewCandidate,
): PresentedReviewRecommendedCard {
  const passages = candidate.evidence.map((side, index) => ({
    heading: passageHeading(index, candidate.evidence.length),
    locator: side.locator,
    excerpt: side.excerpt,
    passage_key: side.passage_key,
    evidence_identity: side.evidence_identity,
    review_state: side.review_state,
  }));
  return {
    fingerprint: candidate.fingerprint,
    title: `${candidate.entity_label} — ${candidate.topic_label} Injury`,
    noticed: `StoryDNA found two verified descriptions involving ${candidate.entity_label}'s ${candidate.topic_label.toLowerCase()} but cannot determine whether they describe the same injury or separate injuries.`,
    why_it_may_matter:
      "These may describe separate injuries, but the manuscript does not establish that clearly enough for StoryDNA to decide.",
    status_summary: candidate.status_summary,
    status_counts: candidate.status_counts,
    passages,
    analysis_details: {
      engine_eligibility: candidate.engine_eligibility,
      engine_reason: candidate.reason,
      pair_count: candidate.pair_count,
      entity_key: candidate.entity_key,
      topic_key: candidate.topic_key,
      fingerprint: candidate.fingerprint,
    },
  };
}

export function presentReviewRecommendedModel(args: {
  manuscriptId: string;
  manuscriptVersionId: string;
  sourceWorkflowId?: string | null;
  candidates: readonly ArchivistReviewCandidate[];
}): PresentedReviewRecommendedModel {
  return {
    manuscript_id: args.manuscriptId,
    manuscript_version_id: args.manuscriptVersionId,
    source_workflow_id: args.sourceWorkflowId ?? null,
    label: ARCHIVIST_REVIEW_RECOMMENDED_LABEL,
    cards: args.candidates.map(presentReviewRecommendedCard),
  };
}
