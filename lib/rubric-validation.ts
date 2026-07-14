import {
  ACQUISITION_CATEGORIES,
  ACQUISITION_MAX_TOTAL,
  CRAFT_CATEGORIES,
  CRAFT_MAX_TOTAL,
  OVERALL_MAX_TOTAL,
  REQUIRED_ACQUISITION_KEYS,
  REQUIRED_CRAFT_KEYS,
  type CommercialRubricPayload,
  type LengthRecommendation,
  type RubricCategoryScore,
  type RubricConfidence,
} from "./commercial-fiction-rubric.ts";
import { letterGradeFromScore } from "./grade-calculation.ts";

export type GradeStatus =
  | "VERIFIED"
  | "PROVISIONAL_PARTIAL_COVERAGE"
  | "WITHHELD — STATISTICS FAILURE"
  | "WITHHELD — INSUFFICIENT EVIDENCE"
  | "WITHHELD — ARITHMETIC FAILURE";

export type ReviewReliabilityStatus =
  | "reliable"
  | "degraded"
  | "unreliable"
  | "blocked";

export type EvidenceCompletenessStatus = "COMPLETE" | "INSUFFICIENT" | "NOT_APPLICABLE";

export type ArithmeticValidationStatus = "VERIFIED" | "INVALID" | "NOT_APPLICABLE";

const GENERIC_EVIDENCE = [
  /^the pacing is slow\.?$/i,
  /^the characters are strong\.?$/i,
  /^the prose is compelling\.?$/i,
  /^pacing is (?:slow|weak)\.?$/i,
  /^characters are (?:strong|weak)\.?$/i,
];

function isGenericEvidence(text: string): boolean {
  const t = text.trim();
  return GENERIC_EVIDENCE.some((re) => re.test(t));
}

function num(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return NaN;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}

function parseExample(v: unknown): { text: string; location: string | null } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const text = str(o.text);
  if (!text) return null;
  return { text, location: str(o.location) || null };
}

function parseCategory(
  raw: unknown,
  defs: ReadonlyArray<{ key: string; name: string; max: number }>,
): RubricCategoryScore | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = str(o.category_key);
  const def = defs.find((d) => d.key === key);
  if (!def) return null;

  const examples = (Array.isArray(o.examples) ? o.examples : [])
    .map(parseExample)
    .filter((x): x is NonNullable<typeof x> => x != null);

  const validExamples = examples.filter((e) => !isGenericEvidence(e.text));
  const insufficient =
    Boolean(o.insufficient_evidence) || validExamples.length < 2;

  const pointsEarned = num(o.points_earned);
  const maximum = num(o.maximum_points) || def.max;
  const deduction = num(o.deduction);
  const weighted = num(o.weighted_contribution);

  const confidenceRaw = str(o.confidence).toLowerCase();
  const confidence: RubricConfidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  return {
    category_key: key,
    category_name: str(o.category_name) || def.name,
    points_earned: pointsEarned,
    maximum_points: maximum,
    deduction: isFinite(deduction) ? deduction : Math.max(0, maximum - pointsEarned),
    weighted_contribution: isFinite(weighted) ? weighted : pointsEarned,
    confidence,
    strengths: strArray(o.strengths),
    deductions: strArray(o.deductions),
    deduction_reasons: strArray(o.deduction_reasons),
    revision_to_recover: str(o.revision_to_recover),
    examples: validExamples,
    insufficient_evidence: insufficient,
  };
}

function rawCategoryKey(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  return str((raw as Record<string, unknown>).category_key);
}

/** Validate exact 14-key rubric structure on raw JSON arrays (before filtering). */
export function validateRubricCategoryKeys(craftRaw: unknown[], acqRaw: unknown[]): string[] {
  const errors: string[] = [];
  const craftKeys = craftRaw.map(rawCategoryKey).filter(Boolean);
  const acqKeys = acqRaw.map(rawCategoryKey).filter(Boolean);
  const totalRaw = craftRaw.length + acqRaw.length;

  if (craftRaw.length !== REQUIRED_CRAFT_KEYS.length) {
    errors.push(
      `Expected ${REQUIRED_CRAFT_KEYS.length} craft category entries, got ${craftRaw.length}.`,
    );
  }
  if (acqRaw.length !== REQUIRED_ACQUISITION_KEYS.length) {
    errors.push(
      `Expected ${REQUIRED_ACQUISITION_KEYS.length} acquisition category entries, got ${acqRaw.length}.`,
    );
  }
  if (totalRaw !== REQUIRED_CRAFT_KEYS.length + REQUIRED_ACQUISITION_KEYS.length) {
    errors.push(`Expected 14 total category entries, got ${totalRaw}.`);
  }

  const allKeys = [...craftKeys, ...acqKeys];
  const counts = new Map<string, number>();
  for (const k of allKeys) {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of counts) {
    if (n > 1) errors.push(`Duplicate category_key: ${k}.`);
  }

  for (const k of craftKeys) {
    if (!REQUIRED_CRAFT_KEYS.includes(k)) {
      errors.push(`Unknown craft category_key: ${k}.`);
    }
  }
  for (const k of acqKeys) {
    if (!REQUIRED_ACQUISITION_KEYS.includes(k)) {
      errors.push(`Unknown acquisition category_key: ${k}.`);
    }
  }

  for (const raw of craftRaw) {
    const k = rawCategoryKey(raw);
    if (k && REQUIRED_ACQUISITION_KEYS.includes(k)) {
      errors.push(`Acquisition category_key "${k}" appears in craft_categories.`);
    }
  }
  for (const raw of acqRaw) {
    const k = rawCategoryKey(raw);
    if (k && REQUIRED_CRAFT_KEYS.includes(k)) {
      errors.push(`Craft category_key "${k}" appears in acquisition_categories.`);
    }
  }

  const present = new Set(allKeys);
  for (const k of REQUIRED_CRAFT_KEYS) {
    if (!present.has(k)) errors.push(`Missing required craft category_key: ${k}.`);
  }
  for (const k of REQUIRED_ACQUISITION_KEYS) {
    if (!present.has(k)) errors.push(`Missing required acquisition category_key: ${k}.`);
  }

  return errors;
}

/** Normalize model output to a JSON object string (strips fences / surrounding prose). */
function normalizeRubricJsonString(raw: string): string {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/^```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  if (!jsonStr.startsWith("{")) {
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);
  }
  return jsonStr;
}

function payloadFromParsedRoot(parsed: unknown): {
  payload: CommercialRubricPayload | null;
  categoryKeyErrors: string[];
} {
  if (!parsed || typeof parsed !== "object") {
    return { payload: null, categoryKeyErrors: ["Invalid rubric JSON root."] };
  }
  const root = parsed as Record<string, unknown>;
  const craftRaw = Array.isArray(root.craft_categories) ? root.craft_categories : [];
  const acqRaw = Array.isArray(root.acquisition_categories) ? root.acquisition_categories : [];
  const categoryKeyErrors = validateRubricCategoryKeys(craftRaw, acqRaw);
  const lenRaw = Array.isArray(root.length_recommendations) ? root.length_recommendations : [];

  const craft_categories = craftRaw
    .map((c) => parseCategory(c, CRAFT_CATEGORIES))
    .filter((c): c is RubricCategoryScore => c != null);
  const acquisition_categories = acqRaw
    .map((c) => parseCategory(c, ACQUISITION_CATEGORIES))
    .filter((c): c is RubricCategoryScore => c != null);

  const length_recommendations: LengthRecommendation[] = lenRaw
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        authoritative_current_word_count: num(o.authoritative_current_word_count),
        recommended_cut_percentage:
          o.recommended_cut_percentage != null ? num(o.recommended_cut_percentage) : null,
        recommended_cut_words:
          o.recommended_cut_words != null ? num(o.recommended_cut_words) : null,
        resulting_word_count: num(o.resulting_word_count),
        genre_target_range: str(o.genre_target_range),
        configuration_source: str(o.configuration_source),
        basis: (str(o.basis) || "absolute_length") as LengthRecommendation["basis"],
        rationale: str(o.rationale),
      };
    })
    .filter((r) => isFinite(r.authoritative_current_word_count));

  return {
    payload: { craft_categories, acquisition_categories, length_recommendations },
    categoryKeyErrors,
  };
}

export type RubricGenerationFailureKind =
  | "RUBRIC_GENERATION_TRUNCATED"
  | "RUBRIC_INVALID_JSON"
  | "RUBRIC_VALIDATION_FAILED";

/** Parse rubric JSON from a rubric-only model response (Call B). */
export function parseRubricJsonString(rawContent: string): {
  jsonStr: string;
  payload: CommercialRubricPayload | null;
  parseError: string | null;
  categoryKeyErrors: string[];
  appearsTruncated: boolean;
} {
  const jsonStr = normalizeRubricJsonString(rawContent);
  const hasAcquisition = jsonStr.includes('"acquisition_categories"');
  const craftCount = (jsonStr.match(/"category_key"/g) ?? []).length;
  const appearsTruncated =
    !jsonStr.endsWith("}") ||
    (jsonStr.includes('"craft_categories"') && !hasAcquisition) ||
    craftCount < REQUIRED_CRAFT_KEYS.length + REQUIRED_ACQUISITION_KEYS.length;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      jsonStr,
      payload: null,
      parseError: "Invalid rubric JSON.",
      categoryKeyErrors: [],
      appearsTruncated: true,
    };
  }

  const { payload, categoryKeyErrors } = payloadFromParsedRoot(parsed);
  return {
    jsonStr,
    payload,
    parseError: null,
    categoryKeyErrors,
    appearsTruncated,
  };
}

/** Classify rubric-only generation failure for retry / diagnostics. */
export function classifyRubricGenerationFailure(args: {
  rawContent: string;
  outputTruncated: boolean;
  parseError: string | null;
  categoryKeyErrors: string[];
  rubricValidationErrors?: string[];
  rubricValid?: boolean;
}): RubricGenerationFailureKind | null {
  if (args.rubricValid) return null;

  const parsed = parseRubricJsonString(args.rawContent);
  if (args.outputTruncated || parsed.appearsTruncated) {
    return "RUBRIC_GENERATION_TRUNCATED";
  }
  if (args.parseError || parsed.parseError) {
    return "RUBRIC_INVALID_JSON";
  }
  if (args.categoryKeyErrors.length || parsed.categoryKeyErrors.length) {
    return "RUBRIC_VALIDATION_FAILED";
  }
  if (args.rubricValidationErrors?.length) {
    return "RUBRIC_VALIDATION_FAILED";
  }
  return "RUBRIC_VALIDATION_FAILED";
}

/** Extract and parse STORYDNA_RUBRIC_JSON from review content. */
export function extractRubricPayload(content: string): {
  memoContent: string;
  payload: CommercialRubricPayload | null;
  parseError: string | null;
  categoryKeyErrors: string[];
} {
  const marker = "<!-- STORYDNA_RUBRIC_JSON -->";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return {
      memoContent: content,
      payload: null,
      parseError: "Missing STORYDNA_RUBRIC_JSON block.",
      categoryKeyErrors: [],
    };
  }

  const memoContent = content.slice(0, idx).trim();
  const parsed = parseRubricJsonString(content.slice(idx + marker.length));
  if (parsed.parseError) {
    return {
      memoContent,
      payload: null,
      parseError: parsed.parseError,
      categoryKeyErrors: parsed.categoryKeyErrors,
    };
  }

  return {
    memoContent,
    payload: parsed.payload,
    parseError: null,
    categoryKeyErrors: parsed.categoryKeyErrors,
  };
}

export function sumCategoryPoints(categories: RubricCategoryScore[]): number {
  return categories.reduce((s, c) => s + c.points_earned, 0);
}

export interface LengthValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate length recommendation arithmetic against canonical count. */
export function validateLengthRecommendations(
  recs: LengthRecommendation[],
  canonicalWordCount: number,
): LengthValidationResult {
  const errors: string[] = [];
  const tolerance = Math.max(50, Math.round(canonicalWordCount * 0.005));

  for (const r of recs) {
    if (r.authoritative_current_word_count !== canonicalWordCount) {
      errors.push(
        `Length recommendation uses ${r.authoritative_current_word_count.toLocaleString()} instead of canonical ${canonicalWordCount.toLocaleString()}.`,
      );
    }

    let expected: number | null = null;
    if (r.recommended_cut_words != null && isFinite(r.recommended_cut_words)) {
      expected = canonicalWordCount - r.recommended_cut_words;
    } else if (
      r.recommended_cut_percentage != null &&
      isFinite(r.recommended_cut_percentage)
    ) {
      expected = Math.round(canonicalWordCount * (1 - r.recommended_cut_percentage / 100));
    }

    if (expected != null && isFinite(r.resulting_word_count)) {
      if (Math.abs(expected - r.resulting_word_count) > tolerance) {
        errors.push(
          `Length math mismatch: expected ~${expected.toLocaleString()} resulting words, got ${r.resulting_word_count.toLocaleString()}.`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface RubricValidationResult {
  valid: boolean;
  craftScore: number;
  acquisitionScore: number;
  manuscriptScore: number;
  letterGrade: string;
  gradeStatus: GradeStatus;
  evidenceCompletenessStatus: EvidenceCompletenessStatus;
  arithmeticValidationStatus: ArithmeticValidationStatus;
  reviewReliabilityStatus: ReviewReliabilityStatus;
  validationErrors: string[];
  partialCoverage: boolean;
}

export function validateCommercialRubric(args: {
  payload: CommercialRubricPayload | null;
  parseError: string | null;
  categoryKeyErrors?: string[];
  canonicalWordCount: number;
  fullTextSupplied: boolean;
  statisticsValid: boolean;
}): RubricValidationResult {
  const errors: string[] = [];
  const partialCoverage = !args.fullTextSupplied;

  if (args.parseError) errors.push(args.parseError);
  if (args.categoryKeyErrors?.length) errors.push(...args.categoryKeyErrors);

  if (!args.payload) {
    return {
      valid: false,
      craftScore: 0,
      acquisitionScore: 0,
      manuscriptScore: 0,
      letterGrade: "",
      gradeStatus: args.statisticsValid
        ? "WITHHELD — INSUFFICIENT EVIDENCE"
        : "WITHHELD — STATISTICS FAILURE",
      evidenceCompletenessStatus: "INSUFFICIENT",
      arithmeticValidationStatus: "INVALID",
      reviewReliabilityStatus: args.statisticsValid ? "degraded" : "blocked",
      validationErrors: errors.length ? errors : ["Missing rubric payload."],
      partialCoverage,
    };
  }

  const { payload } = args;

  const keyErrors = validateRubricCategoryKeys(
    payload.craft_categories.map((c) => ({ category_key: c.category_key })),
    payload.acquisition_categories.map((c) => ({ category_key: c.category_key })),
  );
  errors.push(...keyErrors);

  for (const cat of [...payload.craft_categories, ...payload.acquisition_categories]) {
    if (cat.points_earned < 0) errors.push(`${cat.category_key}: negative points.`);
    if (cat.points_earned > cat.maximum_points) {
      errors.push(`${cat.category_key}: exceeds maximum (${cat.points_earned} > ${cat.maximum_points}).`);
    }
    if (cat.insufficient_evidence) {
      errors.push(`${cat.category_key}: INSUFFICIENT EVIDENCE.`);
    }
    if (Math.abs(cat.weighted_contribution - cat.points_earned) > 0.01) {
      errors.push(`${cat.category_key}: weighted_contribution must equal points_earned.`);
    }
  }

  const craftScore = sumCategoryPoints(payload.craft_categories);
  const acquisitionScore = sumCategoryPoints(payload.acquisition_categories);
  const manuscriptScore = craftScore + acquisitionScore;

  if (Math.abs(craftScore - sumCategoryPoints(payload.craft_categories)) > 0.01) {
    errors.push("Craft subtotal arithmetic failure.");
  }
  if (craftScore > CRAFT_MAX_TOTAL + 0.01) {
    errors.push(`Craft score ${craftScore} exceeds maximum ${CRAFT_MAX_TOTAL}.`);
  }
  if (acquisitionScore > ACQUISITION_MAX_TOTAL + 0.01) {
    errors.push(`Acquisition score ${acquisitionScore} exceeds maximum ${ACQUISITION_MAX_TOTAL}.`);
  }
  if (manuscriptScore > OVERALL_MAX_TOTAL + 0.01) {
    errors.push(`Overall score ${manuscriptScore} exceeds maximum ${OVERALL_MAX_TOTAL}.`);
  }

  const lengthVal = validateLengthRecommendations(
    payload.length_recommendations,
    args.canonicalWordCount,
  );
  errors.push(...lengthVal.errors);

  const hasInsufficientEvidence = [...payload.craft_categories, ...payload.acquisition_categories].some(
    (c) => c.insufficient_evidence,
  );

  let gradeStatus: GradeStatus;
  if (!args.statisticsValid) {
    gradeStatus = "WITHHELD — STATISTICS FAILURE";
  } else if (hasInsufficientEvidence || errors.some((e) => e.includes("INSUFFICIENT"))) {
    gradeStatus = "WITHHELD — INSUFFICIENT EVIDENCE";
  } else if (errors.length > 0) {
    gradeStatus = "WITHHELD — ARITHMETIC FAILURE";
  } else if (partialCoverage) {
    gradeStatus = "PROVISIONAL_PARTIAL_COVERAGE";
  } else {
    gradeStatus = "VERIFIED";
  }

  const letterGrade =
    gradeStatus === "VERIFIED" || gradeStatus === "PROVISIONAL_PARTIAL_COVERAGE"
      ? letterGradeFromScore(manuscriptScore)
      : "";

  let reviewReliabilityStatus: ReviewReliabilityStatus = "reliable";
  if (!args.statisticsValid) reviewReliabilityStatus = "blocked";
  else if (errors.length > 0) reviewReliabilityStatus = "unreliable";
  else if (partialCoverage) reviewReliabilityStatus = "degraded";

  const valid =
    args.statisticsValid &&
    !hasInsufficientEvidence &&
    errors.length === 0 &&
    gradeStatus !== "WITHHELD — STATISTICS FAILURE" &&
    gradeStatus !== "WITHHELD — INSUFFICIENT EVIDENCE" &&
    gradeStatus !== "WITHHELD — ARITHMETIC FAILURE";

  return {
    valid,
    craftScore,
    acquisitionScore,
    manuscriptScore,
    letterGrade,
    gradeStatus,
    evidenceCompletenessStatus: hasInsufficientEvidence ? "INSUFFICIENT" : "COMPLETE",
    arithmeticValidationStatus:
      errors.some((e) => e.includes("arithmetic") || e.includes("exceeds") || e.includes("category_key"))
        ? "INVALID"
        : "VERIFIED",
    reviewReliabilityStatus,
    validationErrors: errors,
    partialCoverage,
  };
}

/** Round-trip helpers for length math (used in tests and validation). */
export function resultingWordCountFromCut(
  canonicalWordCount: number,
  cutPercentage: number,
): number {
  return Math.round(canonicalWordCount * (1 - cutPercentage / 100));
}

export function resultingWordCountFromWords(
  canonicalWordCount: number,
  cutWords: number,
): number {
  return canonicalWordCount - cutWords;
}
