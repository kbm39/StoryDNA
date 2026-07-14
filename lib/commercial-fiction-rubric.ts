/**
 * STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1 — fixed numerical rubric for commercial fiction reviews.
 * Letter grades are NEVER chosen by the model; application code derives them from totals.
 */

export const GRADING_FORMULA_VERSION = "STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1";

export type RubricConfidence = "high" | "medium" | "low";

export interface RubricEvidenceExample {
  text: string;
  location: string | null;
}

export interface RubricCategoryScore {
  category_key: string;
  category_name: string;
  points_earned: number;
  maximum_points: number;
  deduction: number;
  weighted_contribution: number;
  confidence: RubricConfidence;
  strengths: string[];
  deductions: string[];
  /** Exact reason for each deduction (parallel to deductions). */
  deduction_reasons: string[];
  revision_to_recover: string;
  examples: RubricEvidenceExample[];
  insufficient_evidence?: boolean;
}

export type LengthRecommendationBasis =
  | "absolute_length"
  | "structural_concentration"
  | "pacing"
  | "repetition"
  | "post_climax_material";

export interface LengthRecommendation {
  authoritative_current_word_count: number;
  recommended_cut_percentage: number | null;
  recommended_cut_words: number | null;
  resulting_word_count: number;
  genre_target_range: string;
  configuration_source: string;
  basis: LengthRecommendationBasis;
  rationale: string;
}

export interface CommercialRubricPayload {
  craft_categories: RubricCategoryScore[];
  acquisition_categories: RubricCategoryScore[];
  length_recommendations: LengthRecommendation[];
}

/** Craft — 70 points total. */
export const CRAFT_CATEGORIES: ReadonlyArray<{ key: string; name: string; max: number }> = [
  { key: "premise_hook", name: "Premise and hook", max: 7 },
  { key: "plot_architecture_causality", name: "Plot architecture and causality", max: 11 },
  { key: "pacing_narrative_tension", name: "Pacing and narrative tension", max: 11 },
  { key: "character_development_relationships", name: "Character development and relationships", max: 11 },
  { key: "voice_prose_execution", name: "Voice and prose execution", max: 9 },
  { key: "stakes_emotional_impact", name: "Stakes and emotional impact", max: 7 },
  { key: "dialogue_scene_execution", name: "Dialogue and scene execution", max: 6 },
  { key: "ending_resolution", name: "Ending and resolution", max: 8 },
];

/** Acquisition Readiness — 30 points total. */
export const ACQUISITION_CATEGORIES: ReadonlyArray<{ key: string; name: string; max: number }> = [
  { key: "genre_fulfillment_reader_expectations", name: "Genre fulfillment and reader expectations", max: 7 },
  { key: "commercial_differentiation", name: "Commercial differentiation", max: 6 },
  { key: "market_positioning_audience_clarity", name: "Market positioning and audience clarity", max: 5 },
  { key: "length_format_suitability", name: "Length and format suitability", max: 4 },
  { key: "professional_polish_continuity", name: "Professional polish and continuity", max: 5 },
  { key: "series_adaptation_potential", name: "Series or adaptation potential", max: 3 },
];

export const REQUIRED_CRAFT_KEYS = CRAFT_CATEGORIES.map((c) => c.key);
export const REQUIRED_ACQUISITION_KEYS = ACQUISITION_CATEGORIES.map((c) => c.key);
export const REQUIRED_RUBRIC_KEYS = [...REQUIRED_CRAFT_KEYS, ...REQUIRED_ACQUISITION_KEYS] as const;

export const CRAFT_MAX_TOTAL = CRAFT_CATEGORIES.reduce((s, c) => s + c.max, 0);
export const ACQUISITION_MAX_TOTAL = ACQUISITION_CATEGORIES.reduce((s, c) => s + c.max, 0);
export const OVERALL_MAX_TOTAL = CRAFT_MAX_TOTAL + ACQUISITION_MAX_TOTAL;

/** Grade bands — application code only. */
export const GRADE_BANDS: ReadonlyArray<{ grade: string; min: number; max: number }> = [
  { grade: "A+", min: 97, max: 100 },
  { grade: "A", min: 93, max: 96.99 },
  { grade: "A-", min: 90, max: 92.99 },
  { grade: "B+", min: 87, max: 89.99 },
  { grade: "B", min: 83, max: 86.99 },
  { grade: "B-", min: 80, max: 82.99 },
  { grade: "C+", min: 77, max: 79.99 },
  { grade: "C", min: 73, max: 76.99 },
  { grade: "C-", min: 70, max: 72.99 },
  { grade: "D", min: 60, max: 69.99 },
  { grade: "F", min: 0, max: 59.99 },
];

/** Default genre target ranges for length recommendations. */
export const DEFAULT_GENRE_LENGTH_TARGETS: Record<string, { range: string; source: string }> = {
  commercial_fiction: {
    range: "80,000–100,000 words",
    source: "STORYDNA_COMMERCIAL_FICTION_LENGTH_V1",
  },
  thriller: { range: "90,000–100,000 words", source: "STORYDNA_COMMERCIAL_FICTION_LENGTH_V1" },
  literary: { range: "80,000–120,000 words", source: "STORYDNA_COMMERCIAL_FICTION_LENGTH_V1" },
};

/** Prompt appendix requiring structured rubric JSON (model must NOT output letter grade). */
export function commercialRubricOutputContract(): string {
  const craftLines = CRAFT_CATEGORIES.map((c) => `  - ${c.name}: max ${c.max}`).join("\n");
  const acqLines = ACQUISITION_CATEGORIES.map((c) => `  - ${c.name}: max ${c.max}`).join("\n");

  return `

STRUCTURED RUBRIC OUTPUT (mandatory — application calculates letter grade; you must NOT assign one):

After the acquisitions memo prose, append EXACTLY this delimiter and a JSON object:

<!-- STORYDNA_RUBRIC_JSON -->
{
  "craft_categories": [ ... ],
  "acquisition_categories": [ ... ],
  "length_recommendations": [ ... ]
}

CRAFT SCORE — 70 POINTS TOTAL:
${craftLines}

ACQUISITION READINESS — 30 POINTS TOTAL:
${acqLines}

Each category object MUST include:
- category_key (use EXACTLY these keys):
  Craft: ${REQUIRED_CRAFT_KEYS.join(", ")}
  Acquisition: ${REQUIRED_ACQUISITION_KEYS.join(", ")}
- category_name
- points_earned (0 to maximum), maximum_points, deduction, weighted_contribution (= points_earned)
- confidence: "high" | "medium" | "low"
- strengths: string[]
- deductions: string[]
- deduction_reasons: string[] (one reason per deduction)
- revision_to_recover: string
- examples: [{ "text": "...", "location": "Ch. X / scene" }] — MINIMUM TWO manuscript-specific examples per category

Evidence rules:
- Generic praise ("the pacing is slow", "characters are strong") is NOT valid evidence.
- Each example must name an actual scene, chapter, passage, or recurring pattern from THIS manuscript.
- If fewer than two valid examples exist, set "insufficient_evidence": true for that category.

Do NOT include manuscript_letter_grade or any letter grade in the JSON or memo.
Do NOT write **Grade: X** anywhere — the system computes the grade from your numeric scores.

The acquisitions memo MUST open with or include this exact statement:
"The manuscript is [EXACT CANONICAL COUNT FROM MANUSCRIPT STATISTICS] words."
Use the comma-formatted number from MANUSCRIPT STATISTICS — do not round to shorthand (150k) or ranges.

length_recommendations entries MUST include:
- authoritative_current_word_count (exact canonical total from MANUSCRIPT STATISTICS)
- recommended_cut_percentage and/or recommended_cut_words
- resulting_word_count (must equal canonical minus cut, or canonical × (1 - percentage))
- genre_target_range, configuration_source, basis, rationale`;
}
