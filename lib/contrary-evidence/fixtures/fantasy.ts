import { makeRubricDeduction, GENRES } from "./helpers.ts";
import type { PriorReviewBundle } from "../types.ts";

const EXPOSITION_DUMP =
  "The kingdom was founded in 1042 by three allied houses, each with its own magic statute, tax code, and regional dialect.";

export const fantasyExpositionFixture = {
  genre: GENRES.fantasy,
  priorText: `Opening\n\n${EXPOSITION_DUMP}\n\nThe guard raised his spear.`,
  currentText: `Opening\n\nThe guard raised his spear as bells marked the hour.\n\nMagic statutes were implied through action rather than lecture.`,
  priorReview: {
    review_id: "review-fantasy-1",
    manuscript_version_id: "v-prior",
    rubric_breakdown: makeRubricDeduction(
      "pacing_narrative_tension",
      "Pacing and narrative tension",
      "Opening exposition dump slows pacing",
      [EXPOSITION_DUMP],
      2,
    ),
    memo_content: "",
    editorial_issues: [],
    revision_candidates: [],
  } satisfies PriorReviewBundle,
  expectedStatus: "STALE_CRITIQUE" as const,
};
