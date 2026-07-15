import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const WEAK_PACING =
  "The middle sags and tension dissipates before the climax can build.";

export const worsenedCriticismFixture = {
  genre: GENRES.mystery,
  priorText: `Act II\n\n${WEAK_PACING}`,
  currentText: `Act II\n\n${WEAK_PACING}\n\nTension dissipates again in a second slow chapter and pacing sags further before the climax.`,
  priorReview: {
    review_id: "review-worsened-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "pacing_narrative_tension",
      "Pacing and narrative tension",
      "Middle pacing sags and tension dissipates",
      [WEAK_PACING],
      3,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [],
  } satisfies PriorReviewBundle,
  expectedStatus: "WORSENED" as const,
};
