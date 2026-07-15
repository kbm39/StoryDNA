import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const PRIOR_QUOTE =
  "The silver locket appeared only after the killer was named, giving readers no fair chance.";

export const mysteryFairnessFixture = {
  genre: GENRES.mystery,
  priorText: `Act II\n\n${PRIOR_QUOTE}`,
  currentText: `Act II\n\nThe silver locket was planted in chapter two, foreshadowed twice before the reveal.\n\nA residual clue in chapter nine still feels slightly abrupt.`,
  priorReview: {
    review_id: "review-mystery-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "plot_architecture_causality",
      "Plot architecture and causality",
      "Clue placement lacks fairness; reader cannot solve mystery",
      [PRIOR_QUOTE],
      4,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [
      {
        id: "rc-mystery-1",
        issue_id: null,
        original: PRIOR_QUOTE,
        revised: "The silver locket was planted in chapter two, foreshadowed twice before the reveal.",
        reason: "Improve clue fairness with foreshadowing",
        locator: "Act II",
      },
    ],
  } satisfies PriorReviewBundle,
  expectedStatus: "PARTIALLY_IMPROVED" as const,
};
