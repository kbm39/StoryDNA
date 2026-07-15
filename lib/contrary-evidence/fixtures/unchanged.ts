import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const PROBLEM_QUOTE =
  "The dialogue throughout remains flat and functional without subtext or surprise.";

export const unchangedCriticismFixture = {
  genre: GENRES.literary,
  priorText: `Scene 8\n\n${PROBLEM_QUOTE}`,
  currentText: `Scene 8\n\n${PROBLEM_QUOTE}\n\nNo revision was attempted.`,
  priorReview: {
    review_id: "review-unchanged-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "dialogue_scene_execution",
      "Dialogue and scene execution",
      "Dialogue throughout remains flat and functional without subtext",
      [PROBLEM_QUOTE],
      2,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [],
  } satisfies PriorReviewBundle,
  expectedStatus: "UNCHANGED" as const,
};
