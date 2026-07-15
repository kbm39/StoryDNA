/**
 * Test-only fixture containing manuscript-specific terms.
 * Must never be imported by production modules outside tests.
 */
import { makeRubricDeduction } from "./helpers.ts";
import type { GenreProfile, PriorReviewBundle } from "../types.ts";

const COLE_PASSAGE =
  "Cole froze at the Qalandiya checkpoint while Amit argued with the IDF officer.";

export const holdFastTestFixture = {
  genre: {
    primary_genre: "literary_fiction",
    narrative_mode: "fiction",
  } satisfies GenreProfile,
  manuscriptTitle: "Hold Fast: The Reckoning",
  characterNames: ["Cole", "Amit", "Cyrus"],
  priorText: `Chapter 12\n\n${COLE_PASSAGE}`,
  currentText: `Chapter 12\n\nCole moved with deliberate agency at the checkpoint while consequences tightened.`,
  priorReview: {
    review_id: "review-hold-fast-test",
    manuscript_version_id: "v-hold-fast-prior",
    rubric_breakdown: makeRubricDeduction(
      "character_development_relationships",
      "Character development and relationships",
      "Protagonist passivity undermines stakes at military checkpoint scenes",
      [COLE_PASSAGE],
      3,
    ),
    memo_content: "Hold Fast shows ambition but Cole remains passive in key scenes.",
    editorial_issues: [],
    revision_candidates: [],
  } satisfies PriorReviewBundle,
};
