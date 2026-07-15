import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const PASSIVE_QUOTE =
  "She waited for others to decide her fate and rarely initiated action on her own behalf.";

export const literaryAgencyFixture = {
  genre: GENRES.literary,
  priorText: `Scene 4\n\n${PASSIVE_QUOTE}`,
  currentText: `Scene 4\n\nShe chose confrontation, initiated the divorce, and drove the scene through her own decision.`,
  priorReview: {
    review_id: "review-literary-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "character_development_relationships",
      "Character development and relationships",
      "Protagonist lacks agency and remains passive in key scenes",
      [PASSIVE_QUOTE],
      3,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [
      {
        id: "rc-literary-1",
        issue_id: null,
        original: PASSIVE_QUOTE,
        revised: "She chose confrontation, initiated the divorce, and drove the scene.",
        reason: "Strengthen protagonist agency",
        locator: "Scene 4",
      },
    ],
  } satisfies PriorReviewBundle,
  expectedStatus: "SUBSTANTIALLY_IMPROVED" as const,
};
