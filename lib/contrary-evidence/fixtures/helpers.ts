import type { CommercialRubricPayload } from "../../commercial-fiction-rubric.ts";
import type { GenreProfile } from "../types.ts";

export function makeRubricDeduction(
  categoryKey: string,
  categoryName: string,
  reason: string,
  evidence: string[],
  deductionPoints: number,
): CommercialRubricPayload {
  const cat = {
    category_key: categoryKey,
    category_name: categoryName,
    points_earned: 10 - deductionPoints,
    maximum_points: 10,
    deduction: deductionPoints,
    weighted_contribution: 10 - deductionPoints,
    confidence: "high" as const,
    strengths: [],
    deductions: [reason],
    deduction_reasons: [reason],
    revision_to_recover: `Address: ${reason}`,
    examples: evidence.map((text) => ({ text, location: null })),
  };

  return {
    craft_categories: categoryKey.startsWith("genre") ? [] : [cat],
    acquisition_categories: categoryKey.startsWith("genre") ? [cat] : [],
    length_recommendations: [],
  };
}

export const GENRES = {
  romance: {
    primary_genre: "romance",
    narrative_mode: "fiction",
  } satisfies GenreProfile,
  mystery: {
    primary_genre: "mystery",
    narrative_mode: "fiction",
  } satisfies GenreProfile,
  fantasy: {
    primary_genre: "fantasy",
    narrative_mode: "fiction",
  } satisfies GenreProfile,
  literary: {
    primary_genre: "literary_fiction",
    narrative_mode: "fiction",
  } satisfies GenreProfile,
  narrativeNonfiction: {
    primary_genre: "narrative_nonfiction",
    narrative_mode: "narrative_nonfiction",
  } satisfies GenreProfile,
};
