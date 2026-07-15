import { extractKeywords } from "./extract-prior-concerns.ts";
import type { GenreProfile, PriorConcern, SearchPlan } from "./types.ts";

const GENERIC_CONTRARY_LEXICON = [
  "improved", "resolved", "clarified", "deepened", "strengthened", "revised",
  "addressed", "fixed", "corrected", "expanded", "tightened", "balanced",
];

const GENERIC_RESOLUTION_LEXICON = [
  "now", "instead", "replaced", "removed", "added", "rewrote", "cut",
  "restructured", "foreshadowed", "planted", "sourced", "cited",
];

const GENRE_CONTRARY_HINTS: Record<string, string[]> = {
  romance: ["chemistry", "conflict", "stakes", "resolution", "tension"],
  mystery: ["clue", "fairness", "red herring", "reveal", "foreshadow"],
  fantasy: ["exposition", "worldbuilding", "info dump", "magic system"],
  literary_fiction: ["agency", "interiority", "motivation", "passivity"],
  narrative_nonfiction: ["source", "citation", "attribution", "evidence"],
};

export function buildSearchPlan(concern: PriorConcern, genre: GenreProfile): SearchPlan {
  const keywordQueries = [
    ...extractKeywords(concern.prior_criticism),
    ...extractKeywords(concern.root_issue),
    ...concern.prior_evidence.flatMap((e) => extractKeywords(e, 4)),
  ];

  const genreKey = genre.primary_genre.toLowerCase().replace(/\s+/g, "_");
  const genreHints = GENRE_CONTRARY_HINTS[genreKey] ?? [];

  return {
    concern_id: concern.concern_id,
    root_issue: concern.root_issue,
    quotation_checks: [...new Set(concern.prior_evidence.filter((q) => q.trim().length >= 12))],
    keyword_queries: [...new Set([...keywordQueries, ...genreHints])],
    contrary_lexicon: [...GENERIC_CONTRARY_LEXICON, ...genreHints],
    resolution_lexicon: GENERIC_RESOLUTION_LEXICON,
    genre_mode: genre.narrative_mode,
  };
}

export function buildSearchPlans(
  concerns: PriorConcern[],
  genre: GenreProfile,
): SearchPlan[] {
  return concerns.map((c) => buildSearchPlan(c, genre));
}
