/**
 * Detect and validate model-supplied letter grades in review prose.
 * Final letter grades must come from application calculation only.
 */

export interface ProseGradeMatch {
  grade: string;
  quotation: string;
}

const LETTER = /[A-F](?:\+|-)?/;

/** Patterns for model-assigned final manuscript letter grades in memo prose. */
const PROSE_GRADE_PATTERNS: RegExp[] = [
  /\bGrade:\s*([A-F](?:\+|-)?)/gi,
  /\*\*Grade:\s*([A-F](?:\+|-)?)\*\*/gi,
  /(?:Overall|Final)\s+grade\s*[:\s—–-]+\s*([A-F](?:\+|-)?)/gi,
  /letter\s+grade\s*[:\s—–-]+\s*([A-F](?:\+|-)?)/gi,
  /\*\*([A-F](?:\+|-)?)\*\*\s*(?:\(|—|–|-)\s*(?:commercial|acquisition|manuscript)/gi,
];

function normalizeGrade(g: string): string {
  return g.trim().toUpperCase().replace(/\s+/g, "");
}

/** Detect prose letter-grade claims (memo body only — exclude rubric JSON). */
export function detectProseLetterGrades(memoContent: string): ProseGradeMatch[] {
  const body = memoContent.split("<!-- STORYDNA_RUBRIC_JSON -->")[0] ?? memoContent;
  const matches: ProseGradeMatch[] = [];
  const seen = new Set<string>();

  for (const re of PROSE_GRADE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const raw = m[1] ?? m[0];
      const gradeMatch = raw.match(LETTER);
      if (!gradeMatch) continue;
      const grade = normalizeGrade(gradeMatch[0]);
      const start = Math.max(0, m.index - 15);
      const end = Math.min(body.length, m.index + m[0].length + 30);
      const quotation = body.slice(start, end).trim();
      const key = `${grade}:${quotation.slice(0, 50)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ grade, quotation });
    }
  }

  return matches;
}

export interface ProseGradeValidationResult {
  valid: boolean;
  detected: ProseGradeMatch[];
  conflicts: ProseGradeMatch[];
}

/** Reject any model-assigned letter grade in Call A memo (before rubric exists). */
export function validateMemoProhibitedGrades(memoContent: string): ProseGradeValidationResult {
  const detected = detectProseLetterGrades(memoContent);
  return {
    valid: detected.length === 0,
    detected,
    conflicts: detected,
  };
}

/** Validate prose grades against the application-calculated letter grade. */
export function validateProseLetterGrade(
  memoContent: string,
  calculatedLetterGrade: string,
): ProseGradeValidationResult {
  const calculated = normalizeGrade(calculatedLetterGrade);
  if (!calculated) {
    return { valid: true, detected: [], conflicts: [] };
  }

  const detected = detectProseLetterGrades(memoContent);
  const conflicts = detected.filter((d) => d.grade !== calculated);

  return {
    valid: conflicts.length === 0,
    detected,
    conflicts,
  };
}

export const REVIEW_BLOCKED_MEMO_GRADE_MESSAGE =
  "REVIEW BLOCKED — MEMO CONTAINS PROHIBITED LETTER GRADE";

export const REVIEW_BLOCKED_PROSE_GRADE_MESSAGE =
  "REVIEW BLOCKED — PROSE LETTER GRADE CONTRADICTS CALCULATED GRADE";

/** Remove model prose grade lines and append the standardized calculated grade line. */
export function normalizeProseGradeLine(
  memoContent: string,
  calculatedLetterGrade: string,
  manuscriptScore: number,
): string {
  let body = memoContent.split("<!-- STORYDNA_RUBRIC_JSON -->")[0]?.trim() ?? memoContent.trim();

  for (const re of PROSE_GRADE_PATTERNS) {
    body = body.replace(re, "");
  }
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  const standardLine = `\n\n**Commercial acquisition grade (calculated): ${calculatedLetterGrade}** (${manuscriptScore}/100 — computed by StoryDNA from validated rubric scores; not author-selected.)`;

  if (body.includes("Commercial acquisition grade (calculated):")) {
    return body;
  }

  return `${body}${standardLine}`;
}

export function buildProseGradeRepairPrompt(args: {
  calculatedLetterGrade: string;
  manuscriptScore: number;
  conflict: ProseGradeMatch;
  reviewContent: string;
}): string {
  return `The acquisitions memo below contains a letter grade in prose that contradicts the application-calculated grade.

CALCULATED GRADE (authoritative): ${args.calculatedLetterGrade} (${args.manuscriptScore}/100)

CONTRADICTORY PASSAGE:
"${args.conflict.quotation}"

INSTRUCTIONS:
1. Remove every independent letter-grade claim from the memo prose (Grade:, Overall grade, Final grade, letter grade, etc.).
2. Do NOT assign a new letter grade in prose — the system adds the calculated grade line.
3. Preserve all rubric category scores and the STORYDNA_RUBRIC_JSON block unchanged unless arithmetic depends on the wrong grade (it should not).
4. Keep all other analysis intact.

---
MEMO TO CORRECT:

${args.reviewContent}`;
}
