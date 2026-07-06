// Plain data (no heavy imports) so both the on-page legend and the Word export
// render from one source of truth.

export interface GradeLegendRow {
  grade: string;
  quality: string;
  market: string;
  submission: string;
}

export const GRADE_LEGEND: GradeLegendRow[] = [
  {
    grade: "A",
    quality: "Polished, professional craft — structure, pacing, character, and prose all working.",
    market: "Strong hook with clear comps and audience; stands out in the market.",
    submission: "Query-ready now (A/A+), or after light polish (A−).",
  },
  {
    grade: "B",
    quality: "Solid craft with real strengths; a few areas want another pass.",
    market: "Marketable, but the hook and positioning need sharpening.",
    submission: "Close — roughly one focused revision away from querying.",
  },
  {
    grade: "C",
    quality: "Promising but uneven; several notable craft issues to fix.",
    market: "Unclear or niche positioning; needs development to compete.",
    submission: "Not yet — substantial revision before querying.",
  },
  {
    grade: "D",
    quality: "Significant problems across multiple craft areas.",
    market: "A hard sell as-is; major gaps for the current market.",
    submission: "Far from ready; deep structural and craft work needed.",
  },
  {
    grade: "F",
    quality: "Fundamental craft issues; early-draft stage.",
    market: "Not commercially viable in its current form.",
    submission: "Not a submission candidate yet; rebuild from the ground up.",
  },
];

export const GRADE_LEGEND_NOTE =
  "A + or − marks gradations within a band. OpenAI grades commercial prospects; Claude grades craft — so a manuscript can carry two different grades.";
