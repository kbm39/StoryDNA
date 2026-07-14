import { GRADE_BANDS, GRADING_FORMULA_VERSION } from "./commercial-fiction-rubric.ts";

/** Derive letter grade from validated numerical total (0–100). */
export function letterGradeFromScore(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  for (const band of GRADE_BANDS) {
    if (s >= band.min && s <= band.max) return band.grade;
  }
  return "F";
}

/** Check whether a letter grade matches the score band. */
export function letterGradeMatchesScore(letterGrade: string, score: number): boolean {
  return letterGradeFromScore(score) === letterGrade.trim();
}

export { GRADING_FORMULA_VERSION, GRADE_BANDS };
