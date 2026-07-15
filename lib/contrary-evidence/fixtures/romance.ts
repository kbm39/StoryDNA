import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const PRIOR_QUOTE =
  "She agreed too quickly, and the romantic tension collapsed before it could deepen.";

export const romanceImprovedFixture = {
  genre: GENRES.romance,
  priorText: `Chapter 3\n\n${PRIOR_QUOTE}\n\nThey parted without speaking.`,
  currentText: `Chapter 3\n\nShe refused the easy reconciliation, and the conflict between them strengthened through the chapter.\n\nThey argued until dawn, each stake clarified.`,
  priorReview: {
    review_id: "review-romance-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "character_development_relationships",
      "Character development and relationships",
      "Central romantic conflict feels underdeveloped and lacks sustained tension",
      [PRIOR_QUOTE],
      3,
    ),
    memo_content: "Strong voice overall.",
    editorial_issues: [],
    revision_candidates: [
      {
        id: "rc-romance-1",
        issue_id: null,
        original: PRIOR_QUOTE,
        revised: "She refused the easy reconciliation, and the conflict between them strengthened.",
        reason: "Deepen romantic conflict and sustain tension",
        locator: "Chapter 3",
      },
    ],
  } satisfies PriorReviewBundle,
  expectedStatus: "SUBSTANTIALLY_IMPROVED" as const,
};
