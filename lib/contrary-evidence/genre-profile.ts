import type { AuthorIntent } from "../types.ts";
import type { GenreProfile } from "./types.ts";

/** Build a generic genre profile for contrary-evidence search (not manuscript-specific). */
export function buildGenreProfile(_intent?: AuthorIntent | null): GenreProfile {
  return {
    primary_genre: "literary_fiction",
    narrative_mode: "fiction",
    intended_audience: "commercial fiction",
  };
}
