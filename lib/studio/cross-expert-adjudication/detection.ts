import { topicOverlapRatio } from "./text-normalize.ts";
import type {
  CrossExpertContradiction,
  CrossExpertDuplicate,
  CrossExpertNormalizedFinding,
} from "./types.ts";

const KNOWN_CONTRADICTIONS: readonly {
  readonly id: string;
  readonly topic: string;
  readonly laPattern: RegExp;
  readonly mePattern: RegExp;
  readonly laPosition: string;
  readonly mePosition: string;
}[] = [
  {
    id: "pamela-foreshadowing",
    topic: "Pamela/Mira conspiracy foreshadowing",
    laPattern: /pamela.*(dread|effective|seed|lands|conspir|mira)/i,
    mePattern: /pamela.*(dual.?agent|foreshadow|insufficient)/i,
    laPosition: "Pamela/Mira conspiracy is fairly and effectively seeded.",
    mePosition: "Pamela's dual-agent status is insufficiently foreshadowed.",
  },
];

export function detectDirectContradictions(args: {
  readonly literaryAgentFindings: readonly CrossExpertNormalizedFinding[];
  readonly militaryExpertFindings: readonly CrossExpertNormalizedFinding[];
  readonly literaryAgentReviewContent: string;
}): readonly CrossExpertContradiction[] {
  const contradictions: CrossExpertContradiction[] = [];

  for (const known of KNOWN_CONTRADICTIONS) {
    const laSupported =
      known.laPattern.test(args.literaryAgentReviewContent) ||
      args.literaryAgentFindings.some((finding) => known.laPattern.test(`${finding.title} ${finding.summary}`));
    const meFinding = args.militaryExpertFindings.find((finding) =>
      known.mePattern.test(`${finding.title} ${finding.summary}`),
    );
    if (laSupported && meFinding) {
      contradictions.push(
        Object.freeze({
          id: known.id,
          literaryAgentPosition: known.laPosition,
          militaryExpertPosition: known.mePosition,
          topic: known.topic,
          betterSupportedExpert: "manuscript_neutral",
          rationale: "Experts disagree; manuscript evidence adjudication required.",
          relatedFindingKeys: [meFinding.findingKey],
        }),
      );
    }
  }

  for (const laFinding of args.literaryAgentFindings) {
    for (const meFinding of args.militaryExpertFindings) {
      const overlap = topicOverlapRatio(laFinding.topicTokens, meFinding.topicTokens);
      if (overlap < 0.35) continue;
      const polarityConflict =
        /insufficient|lacks|weak|underdeveloped|compressed|unexplained/i.test(
          `${meFinding.title} ${meFinding.summary}`,
        ) &&
        /effective|strong|well|fairly|lands|works|seeded|compelling/i.test(
          `${laFinding.title} ${laFinding.summary} ${args.literaryAgentReviewContent}`,
        );
      if (!polarityConflict) continue;
      contradictions.push(
        Object.freeze({
          id: `overlap-${laFinding.findingKey}-${meFinding.findingKey}`,
          literaryAgentPosition: laFinding.summary,
          militaryExpertPosition: meFinding.summary,
          topic: laFinding.title,
          betterSupportedExpert: "manuscript_neutral",
          rationale: "Topic overlap with opposing polarity between experts.",
          relatedFindingKeys: [laFinding.findingKey, meFinding.findingKey],
        }),
      );
    }
  }

  return Object.freeze(contradictions);
}

export function detectDuplicateFindings(
  findings: readonly CrossExpertNormalizedFinding[],
): readonly CrossExpertDuplicate[] {
  const duplicates: CrossExpertDuplicate[] = [];
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = findings[i]!;
      const b = findings[j]!;
      const overlap = topicOverlapRatio(a.topicTokens, b.topicTokens);
      if (overlap < 0.55) continue;
      duplicates.push(
        Object.freeze({
          id: `dup-${a.findingKey}-${b.findingKey}`,
          findingKeys: Object.freeze([a.findingKey, b.findingKey]),
          topic: a.title,
          rationale: `High topic overlap (${Math.round(overlap * 100)}%) between ${a.source} and ${b.source}.`,
        }),
      );
    }
  }
  return Object.freeze(duplicates);
}

export function buildExpertOverlapMatrix(args: {
  readonly literaryAgentFindings: readonly CrossExpertNormalizedFinding[];
  readonly militaryExpertFindings: readonly CrossExpertNormalizedFinding[];
}): readonly Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const la of args.literaryAgentFindings) {
    for (const me of args.militaryExpertFindings) {
      const overlap = topicOverlapRatio(la.topicTokens, me.topicTokens);
      if (overlap < 0.25) continue;
      rows.push({
        literaryAgentFindingKey: la.findingKey,
        militaryExpertFindingKey: me.findingKey,
        topicOverlap: Math.round(overlap * 100) / 100,
        literaryAgentTitle: la.title,
        militaryExpertTitle: me.title,
      });
    }
  }
  return Object.freeze(rows);
}
