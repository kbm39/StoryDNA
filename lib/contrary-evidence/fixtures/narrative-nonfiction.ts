import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const UNSOURCED =
  "Historians agree the treaty collapsed overnight without citing any archive or interview.";

export const narrativeNonfictionFixture = {
  genre: GENRES.narrativeNonfiction,
  priorText: `Chapter 1\n\n${UNSOURCED}`,
  currentText: `Chapter 1\n\nAccording to the National Archive record 88-14, the treaty collapsed after three documented delays.\n\nSource: interview with Dr. Ellis, 2019.`,
  priorReview: {
    review_id: "review-nnf-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "professional_polish_continuity",
      "Professional polish and continuity",
      "Key claims lack sourcing and attribution",
      [UNSOURCED],
      2,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [
      {
        id: "rc-nnf-1",
        issue_id: null,
        original: UNSOURCED,
        revised: "According to the National Archive record 88-14, the treaty collapsed after three documented delays.",
        reason: "Add sourcing and attribution",
        locator: "Chapter 1",
      },
    ],
  } satisfies PriorReviewBundle,
  expectedStatus: "RESOLVED" as const,
};
