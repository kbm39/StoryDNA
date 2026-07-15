/**
 * Test-only stacked-deduction fixture mimicking audit patterns (back-third, Cyrus, speechifying).
 * Not imported by production code.
 */
import {
  ACQUISITION_CATEGORIES,
  CRAFT_CATEGORIES,
  type CommercialRubricPayload,
  type RubricCategoryScore,
} from "../../commercial-fiction-rubric.ts";

function cat(
  key: string,
  name: string,
  max: number,
  reason: string,
  deduction: number,
  quote: string,
): RubricCategoryScore {
  const earned = Math.max(0, max - deduction);
  return {
    category_key: key,
    category_name: name,
    points_earned: earned,
    maximum_points: max,
    deduction,
    weighted_contribution: earned,
    confidence: "high",
    strengths: deduction < max ? ["Noted strength in this area"] : [],
    deductions: deduction > 0 ? [reason] : [],
    deduction_reasons: deduction > 0 ? [reason] : [],
    revision_to_recover: deduction > 0 ? `Tighten ${reason.slice(0, 50)}` : "Maintain current level",
    examples:
      deduction > 0
        ? [
            { text: quote, location: "Ch. 22" },
            { text: `${quote} — second instance`, location: "Ch. 17" },
          ]
        : [
            { text: "Strong opening hook lands with clarity.", location: "Ch. 1" },
            { text: "Premise promise sustained in early chapters.", location: "Ch. 3" },
          ],
  };
}

function fullCategory(key: string, name: string, max: number): RubricCategoryScore {
  return cat(key, name, max, "", 0, "");
}

/** Rubric with duplicate stacking — raw score ~70 before dedup, >70 after. */
export function makeStackedAuditRubric(): CommercialRubricPayload {
  const backThirdQuote =
    "The celebratory wind-down extends through the back third without tension.";
  const speechQuote = "The thesis statement monologue at the diplomatic summit.";
  const cyrusQuote = "Cyrus survives again as a franchise asset deferring payoff.";
  const wishQuote = "Near-universal survival with frictionless institutional wins.";

  const craftMap = new Map<string, RubricCategoryScore>(
    CRAFT_CATEGORIES.map((c) => [c.key, fullCategory(c.key, c.name, c.max)]),
  );

  craftMap.set(
    "pacing_narrative_tension",
    cat("pacing_narrative_tension", "Pacing and narrative tension", 11, "Back third sags in denouement", 4, backThirdQuote),
  );
  craftMap.set(
    "plot_architecture_causality",
    cat("plot_architecture_causality", "Plot architecture and causality", 11, "Denouement bloat in back third", 4, backThirdQuote),
  );
  craftMap.set(
    "character_development_relationships",
    cat("character_development_relationships", "Character development and relationships", 11, "Cyrus survival undercuts stakes", 2, cyrusQuote),
  );
  craftMap.set(
    "dialogue_scene_execution",
    cat("dialogue_scene_execution", "Dialogue and scene execution", 6, "Diplomatic speechifying replaces drama", 2, speechQuote),
  );
  craftMap.set(
    "voice_prose_execution",
    cat("voice_prose_execution", "Voice and prose execution", 9, "Speechifying flattens voice", 2, speechQuote),
  );
  craftMap.set(
    "stakes_emotional_impact",
    cat("stakes_emotional_impact", "Stakes and emotional impact", 7, "Wish-fulfillment frictionless wins", 3, wishQuote),
  );
  craftMap.set(
    "ending_resolution",
    cat("ending_resolution", "Ending and resolution", 8, "Low-cost near-universal survival", 2, wishQuote),
  );

  const acqMap = new Map<string, RubricCategoryScore>(
    ACQUISITION_CATEGORIES.map((c) => [c.key, fullCategory(c.key, c.name, c.max)]),
  );

  acqMap.set(
    "genre_fulfillment_reader_expectations",
    cat("genre_fulfillment_reader_expectations", "Genre fulfillment and reader expectations", 7, "Back-third bloat hurts pacing", 3, backThirdQuote),
  );
  acqMap.set(
    "commercial_differentiation",
    cat("commercial_differentiation", "Commercial differentiation", 6, "Cyrus deferred payoff", 3, cyrusQuote),
  );
  acqMap.set(
    "market_positioning_audience_clarity",
    cat("market_positioning_audience_clarity", "Market positioning and audience clarity", 5, "Speechifying reduces audience clarity", 2, speechQuote),
  );
  acqMap.set(
    "series_adaptation_potential",
    cat("series_adaptation_potential", "Series or adaptation potential", 3, "Cyrus franchise asset", 1, cyrusQuote),
  );

  return {
    craft_categories: CRAFT_CATEGORIES.map((c) => craftMap.get(c.key)!),
    acquisition_categories: ACQUISITION_CATEGORIES.map((c) => acqMap.get(c.key)!),
    length_recommendations: [],
  };
}

/** Sum manuscript score from category earned points. */
export function sumRubricScore(payload: CommercialRubricPayload): number {
  const craft = payload.craft_categories.reduce((s, c) => s + c.points_earned, 0);
  const acq = payload.acquisition_categories.reduce((s, c) => s + c.points_earned, 0);
  return craft + acq;
}
