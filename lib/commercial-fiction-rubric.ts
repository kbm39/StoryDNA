/**
 * STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1 — fixed numerical rubric for commercial fiction reviews.
 * Letter grades are NEVER chosen by the model; application code derives them from totals.
 */

import { STORYDNA_COUNT_METHOD } from "./word-count-reporting.ts";

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

export const RUBRIC_JSON_MARKER = "<!-- STORYDNA_RUBRIC_JSON -->";

/** Independent output budgets for the two-call Literary Agent pipeline. */
/**
 * Call A (memo prose only). Prior Hold Fast memo completed at 11,738 output tokens
 * against a 12,000 cap with no headroom; rubric is generated in Call B separately.
 */
export const COMMERCIAL_MEMO_MAX_TOKENS = 16_000;
export const COMMERCIAL_RUBRIC_MAX_TOKENS = 8_000;

/** Attach validated rubric JSON to memo prose for storage (legacy combined format). */
export function attachRubricToMemo(
  memo: string,
  payload: CommercialRubricPayload,
): string {
  return `${memo.trim()}\n\n${RUBRIC_JSON_MARKER}\n${JSON.stringify(payload, null, 2)}`;
}

/** Memo-only output contract — no rubric JSON, no model-assigned grade or overall score. */
export function commercialMemoOutputContract(): string {
  return `

MEMO-ONLY OUTPUT (mandatory):
- Output ONLY the acquisitions memo markdown sections listed above.
- Do NOT append STORYDNA_RUBRIC_JSON, any JSON block, or structured rubric scores — a separate grading call handles rubric JSON.
- Do NOT write **Grade: X**, Overall score, Final grade, or any letter grade or /100 numerical score — the application calculates grading after rubric validation.
- Do NOT embed rubric-style category-by-category scoring or point breakdowns in the memo — reserve numerical scoring for the separate rubric call.
- The memo MUST include exactly one current-total sentence:
  "The manuscript is [EXACT CANONICAL COUNT FROM MANUSCRIPT STATISTICS] words."
  Use the comma-formatted canonical_word_count from MANUSCRIPT STATISTICS — do not round to shorthand (150k) or ranges.
  Do not claim totals such as 130k, 150k, "well past 150k", or other unsupported round figures.
- Do not state any competing current total elsewhere in the memo.
- Percentage-cut recommendations must show current count, cut percentage, cut amount, and resulting count derived from the authoritative total.

CONCISION (mandatory — avoid repetition to stay within output budget):
- Each strength or weakness should appear in only ONE primary section (Strengths, Weaknesses, or the most relevant assessment section) — do not restate the same point elsewhere.
- Revision recommendations (Top 5, What Would Move, Suggested Cuts) should reference earlier findings briefly rather than re-explaining them.
- Keep quoted examples concise — cite the essential phrase, not long passages.
- Cap illustrative examples to at most three per major prose section unless a fourth is strictly necessary.
- Do NOT repeat the full plot synopsis in multiple sections — state premise once, then refer back.
- Evidence-Backed Findings holds the verbatim quotes; other sections should summarize without duplicating those quotations.`;
}

/** @deprecated Combined memo+rubric contract — use commercialMemoOutputContract + buildCommercialRubricGenerationPrompt. */
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

The acquisitions memo MUST include exactly one current-total sentence:
"The manuscript is [EXACT CANONICAL COUNT FROM MANUSCRIPT STATISTICS] words."
Use canonical_word_count from MANUSCRIPT STATISTICS — do not round to shorthand (150k) or ranges.

length_recommendations entries MUST include:
- authoritative_current_word_count (exact canonical total from MANUSCRIPT STATISTICS)
- recommended_cut_percentage and/or recommended_cut_words
- resulting_word_count (must equal canonical minus cut, or canonical × (1 - percentage))
- genre_target_range, configuration_source, basis, rationale`;
}

/** Prompt for Call B — JSON-only rubric generation (separate from memo). */
export function buildCommercialRubricGenerationPrompt(args: {
  canonicalWordCount: number;
  fullTextSupplied: boolean;
  memoContent: string;
  retryAfterTruncation?: boolean;
  contraryEvidenceGateBlock?: string;
  repairContext?: {
    parseError: string;
    malformedRaw: string;
  };
}): string {
  const craftLines = CRAFT_CATEGORIES.map((c) => `  - ${c.key}: ${c.name} (max ${c.max})`).join("\n");
  const acqLines = ACQUISITION_CATEGORIES.map(
    (c) => `  - ${c.key}: ${c.name} (max ${c.max})`,
  ).join("\n");
  const memoExcerpt =
    args.memoContent.length > 12_000
      ? `${args.memoContent.slice(0, 12_000)}\n\n[Memo truncated for context — full memo was read in Call A.]`
      : args.memoContent;

  const retryNote = args.repairContext
    ? `\nRUBRIC REPAIR: Your previous JSON response failed to parse.\nPARSE ERROR: ${args.repairContext.parseError}\nReturn ONLY valid JSON matching the schema below — no markdown fences, no prose.\nMALFORMED PREVIOUS OUTPUT (fix and return corrected JSON only):\n---\n${args.repairContext.malformedRaw.slice(0, 24_000)}\n---\n`
    : args.retryAfterTruncation
      ? `\nRETRY: Your previous rubric response was truncated or invalid. Keep EVERY field concise so all 14 categories fit. Use exactly 2 examples per category. Maximum 3 strengths and 3 deductions per category.\n`
      : "";

  return `You are scoring a commercial fiction manuscript using STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1.

OUTPUT RULES (strict):
- Return ONLY a single JSON object — no markdown fences, no prose, no commentary.
- Do NOT include manuscript_letter_grade, letter_grade, or overall_score — the application calculates the grade.
- Keep fields concise: strengths max 3 items, deductions max 3 items, exactly 2 examples per category, one-sentence revision_to_recover.
${retryNote}
MANUSCRIPT STATISTICS:
- canonical_word_count: ${args.canonicalWordCount.toLocaleString()}
- count_method: ${STORYDNA_COUNT_METHOD}
- full_text_supplied: ${args.fullTextSupplied}

COMPLETED ACQUISITIONS MEMO (from Call A — ground your scores and evidence in this assessment AND the manuscript):
---
${memoExcerpt}
---

REQUIRED JSON SHAPE:
{
  "craft_categories": [ ...8 entries... ],
  "acquisition_categories": [ ...6 entries... ],
  "length_recommendations": [ ... ]
}

CRAFT CATEGORIES (70 points — include ALL 8, exactly once):
${craftLines}

ACQUISITION CATEGORIES (30 points — include ALL 6, exactly once):
${acqLines}

Each category object MUST include:
- category_key (exact key from lists above)
- category_name
- points_earned (0 to maximum_points)
- maximum_points
- deduction
- weighted_contribution (= points_earned)
- confidence: "high" | "medium" | "low"
- strengths: string[] (max 3, concise)
- deductions: string[] (max 3, concise)
- deduction_reasons: string[] (one reason per deduction)
- revision_to_recover: string (one concise sentence)
- examples: [{ "text": "...", "location": "Ch. X / scene" }] — EXACTLY 2 manuscript-specific examples

Evidence rules:
- Generic praise ("the pacing is slow") is invalid — cite actual scenes, chapters, or passages from THIS manuscript.
- If fewer than two valid examples exist, set "insufficient_evidence": true.

length_recommendations (if any cuts are warranted):
- authoritative_current_word_count: ${args.canonicalWordCount}
- recommended_cut_percentage and/or recommended_cut_words
- resulting_word_count (must equal canonical minus cut words, or canonical × (1 - percentage/100), rounded)
- genre_target_range, configuration_source, basis, rationale
${args.contraryEvidenceGateBlock ?? ""}

Return the JSON object only.`;
}
