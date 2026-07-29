/**
 * Strict JSON output schema for Military Expert model responses (PR 2 — draft).
 */

import {
  MILITARY_EXPERT_CATEGORIES,
  MILITARY_EXPERT_CATEGORY_ASSESSMENT_STATUSES,
  MILITARY_EXPERT_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_ESCALATION_EXPERTS,
  MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS,
  MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES,
  MILITARY_EXPERT_REALISM_STATUSES,
  MILITARY_EXPERT_RECOMMENDATION_TYPES,
  MILITARY_EXPERT_SEVERITY_LEVELS,
  type MilitaryExpertCategoryAssessment,
  type MilitaryExpertEvidenceRecord,
  type MilitaryExpertFinding,
  type MilitaryExpertOverallRealismAssessment,
} from "./contracts.ts";

export const MILITARY_EXPERT_OUTPUT_SCHEMA_VERSION = "military_expert_output@v1-draft" as const;

export const MILITARY_EXPERT_OVERALL_REALISM_ASSESSMENT_KEYS = [
  "conclusion",
  "confidence",
  "primary_strengths",
  "primary_concerns",
  "preservation_priorities",
] as const;

export const MILITARY_EXPERT_OVERALL_REALISM_PROHIBITED_SUBSTITUTE_KEYS = [
  "assessment",
  "verdict",
  "overall_conclusion",
  "notes",
  "summary",
] as const;

export const MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE =
  "No contrary evidence was found in the supplied scope." as const;

export const MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS = [
  "summary",
  "strengths",
  "findings",
  "category_assessments",
  "overall_realism_assessment",
  "critical_issues",
  "priority_actions",
  "verification_requests",
  "escalation_recommendations",
  "uncertainty_summary",
  "next_step",
  "author_challenge_supported",
] as const;

export interface MilitaryExpertGenerationPayload {
  summary: string;
  strengths: string[];
  findings: MilitaryExpertFinding[];
  category_assessments: MilitaryExpertCategoryAssessment[];
  overall_realism_assessment: MilitaryExpertOverallRealismAssessment;
  critical_issues: string[];
  priority_actions: string[];
  verification_requests: string[];
  escalation_recommendations: string[];
  uncertainty_summary: string;
  next_step: string;
  author_challenge_supported: true;
}

export interface MilitaryExpertSchemaValidationResult {
  ok: boolean;
  errors: string[];
}

const LETTER_GRADE_PATTERN = /\b(?:grade\s*[A-F][+-]?|[A-F]\s*grade|letter\s*grade)\b/i;

const SAFETY_STEP_PATTERN =
  /\b(?:step\s+\d+|first,?\s+(?:enter|breach|assemble|deploy|position)|then,?\s+(?:move|advance|engage|detonate))\b/i;

const FABRICATED_SOURCE_PATTERN =
  /\b(?:classified\s+field\s+manual|secret\s+doctrine|internal\s+memo\s+#\d+|unpublished\s+after[- ]action)\b/i;

const SERVICE_HISTORY_PATTERN =
  /\b(?:when i (?:was|served)|during my (?:deployment|service|tour)|as a (?:former|retired) (?:soldier|marine|sailor|airman))\b/i;

const NO_CONTRARY_EVIDENCE_PATTERN =
  /(?:no contrary evidence|none was found|contrary evidence (?:was )?not found|did not find contrary)/i;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => str(item)).filter(Boolean);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isNegativeRealismStatus(status: string): boolean {
  return (MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES as readonly string[]).includes(status);
}

/** Deterministic summary balance check — applied after findings are parsed. */
export const MILITARY_EXPERT_SUMMARY_BALANCE_VERSION = "military_expert_summary_balance@v2" as const;

export interface SummaryBalanceAudit {
  readonly version: typeof MILITARY_EXPERT_SUMMARY_BALANCE_VERSION;
  readonly strengths_field_satisfied: boolean;
  readonly summary_strength_signal: boolean;
  readonly conclusion_strength_signal: boolean;
  readonly cross_field_balanced: boolean;
  readonly concern_acknowledged: boolean;
  readonly satisfied_fields: readonly string[];
}

function hasMeaningfulStrengthContent(texts: readonly string[]): boolean {
  const joined = texts.join(" ").toLowerCase().trim();
  if (joined.length < 8) return false;
  if (/^(good|nice|well written|great|fine)\.?$/i.test(joined)) return false;
  return (
    /\b(command|chain|coordination|credible|plausible|intent|structure|interaction|realism|depiction|tension|pacing|dialogue|officer|rank|organization|operational|effective|accurate|clear|works)\b/.test(
      joined,
    ) || joined.split(/\s+/).filter(Boolean).length >= 4
  );
}

function summaryStrengthSignal(summaryLower: string): boolean {
  return (
    /\bstrength|\bworks\b|\bcredible\b|\beffective\b|\bplausible\b|no material inaccuracies|no negative findings|no material concerns in scope/.test(
      summaryLower,
    ) ||
    (/\baccurate\b/.test(summaryLower) && !/\binaccurate\b/.test(summaryLower)) ||
    /\bclear\b|\bintent\b/.test(summaryLower)
  );
}

function conclusionStrengthSignal(conclusionLower: string): boolean {
  if (/\b(no strengths|entirely wrong|completely inaccurate|nothing works|nothing in this scene)\b/.test(conclusionLower)) {
    return false;
  }
  return (
    /\bcredible\b|\bplausible\b|\b(strength|strengths)\b|\baccurate\b|\bclear intent\b|\bno material inaccuracies\b|\bcoordination\b/.test(
      conclusionLower,
    ) ||
    (/\bworks\b/.test(conclusionLower) &&
      !/\b(nothing|doesn't|does not|not work|won't work)\b/.test(conclusionLower))
  );
}

export function auditMilitaryExpertSummaryBalance(
  summary: string,
  findings: readonly { realism_status: string }[],
  options: {
    strengths?: readonly string[];
    conclusion?: string;
  } = {},
): SummaryBalanceAudit {
  const summaryLower = summary.toLowerCase();
  const strengths = options.strengths ?? [];
  const conclusion = (options.conclusion ?? "").toLowerCase();
  const strengthsFieldSatisfied = strengths.length > 0 && hasMeaningfulStrengthContent(strengths);
  const summarySignal = summaryStrengthSignal(summaryLower);
  const conclusionSignal = conclusion.length > 0 && conclusionStrengthSignal(conclusion);
  const crossFieldBalanced = strengthsFieldSatisfied || summarySignal || conclusionSignal;
  const hasNegativeFinding = findings.some((finding) =>
    isNegativeRealismStatus(finding.realism_status),
  );
  const concernAcknowledged =
    !hasNegativeFinding ||
    /\bconcern|\bconcerns|\binaccurate\b|\bissue|\buncertain\b|\bweak\b|\bproblem|\binaccuracy|\braises\b|\brequires\b|\berror\b|\bviolation\b|\bcorrection\b|\bconfirmed\b/.test(
      summaryLower,
    );
  const satisfiedFields: string[] = [];
  if (strengthsFieldSatisfied) satisfiedFields.push("strengths");
  if (summarySignal) satisfiedFields.push("summary");
  if (conclusionSignal) satisfiedFields.push("conclusion");

  return {
    version: MILITARY_EXPERT_SUMMARY_BALANCE_VERSION,
    strengths_field_satisfied: strengthsFieldSatisfied,
    summary_strength_signal: summarySignal,
    conclusion_strength_signal: conclusionSignal,
    cross_field_balanced: crossFieldBalanced,
    concern_acknowledged: concernAcknowledged,
    satisfied_fields: satisfiedFields,
  };
}

export function validateMilitaryExpertSummaryBalance(
  summary: string,
  findings: readonly { realism_status: string }[],
  errors: string[],
  options: {
    strengths?: readonly string[];
    conclusion?: string;
  } = {},
): SummaryBalanceAudit | null {
  if (!summary.trim()) {
    errors.push("summary is required");
    return null;
  }

  const audit = auditMilitaryExpertSummaryBalance(summary, findings, options);

  if (!audit.cross_field_balanced) {
    errors.push("summary must acknowledge material strengths");
  }

  if (!audit.concern_acknowledged) {
    errors.push("summary must acknowledge material concerns when negative findings exist");
  }

  return audit;
}

function pushEnumError(
  errors: string[],
  label: string,
  value: string,
  allowed: readonly string[],
): void {
  if (!(allowed as readonly string[]).includes(value)) {
    errors.push(`${label}: unsupported value "${value}"`);
  }
}

function parseEvidenceRecord(
  raw: unknown,
  label: string,
  errors: string[],
): MilitaryExpertEvidenceRecord | null {
  if (typeof raw === "string") {
    errors.push(`${label}: must be an object with excerpt/locator fields, not a string`);
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${label}: must be an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;
  const excerpt = str(record.excerpt);
  if (!excerpt) {
    errors.push(`${label}: excerpt is required`);
    return null;
  }
  const words = countWords(excerpt);
  if (words > MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS) {
    errors.push(
      `${label}: excerpt exceeds ${MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS} words`,
    );
  }
  return {
    excerpt,
    locator: str(record.locator) || undefined,
    verification_note: str(record.verification_note) || undefined,
  };
}

function hasContraryEvidenceHandling(finding: {
  contrary_evidence?: MilitaryExpertEvidenceRecord[];
  uncertainty_note?: string;
}): boolean {
  if (finding.contrary_evidence && finding.contrary_evidence.length > 0) return true;
  if (Array.isArray(finding.contrary_evidence) && finding.contrary_evidence.length === 0) {
    return (
      finding.uncertainty_note !== undefined &&
      NO_CONTRARY_EVIDENCE_PATTERN.test(finding.uncertainty_note)
    );
  }
  return false;
}

/** Deterministic conclusion balance check — applied after findings are parsed. */
export function validateMilitaryExpertConclusionBalance(
  conclusion: string,
  findings: readonly { realism_status: string }[],
  errors: string[],
): void {
  if (!conclusion.trim()) return;

  const conclusionLower = conclusion.toLowerCase();
  const hasNegativeFinding = findings.some((finding) =>
    isNegativeRealismStatus(finding.realism_status),
  );

  if (hasNegativeFinding) {
    const deniesConcerns =
      /no (?:material )?(?:concerns|inaccuracies|issues|problems)|no negative findings|fully accurate|no realism concerns/.test(
        conclusionLower,
      );
    if (deniesConcerns) {
      errors.push("overall_realism_assessment.conclusion must not contradict negative findings");
    }
  }

  if (!hasNegativeFinding && findings.length === 0) {
    const claimsErrors =
      /confirmed error|major inaccurac|significant concern/.test(conclusionLower) ||
      (/material inaccurac/.test(conclusionLower) &&
        !/no material inaccuracies|no material concerns|no negative findings/.test(conclusionLower));
    if (claimsErrors) {
      errors.push(
        "overall_realism_assessment.conclusion must not contradict true-negative findings",
      );
    }
  }
}

function parseFinding(raw: unknown, index: number, errors: string[]): MilitaryExpertFinding | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`findings[${index}]: must be an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;
  const prefix = `findings[${index}]`;
  const category = str(record.category);
  const realismStatus = str(record.realism_status);
  const confidence = str(record.confidence);
  const severity = str(record.severity);
  const recommendationType = str(record.recommendation_type);

  pushEnumError(errors, `${prefix}.category`, category, MILITARY_EXPERT_CATEGORIES);
  pushEnumError(errors, `${prefix}.realism_status`, realismStatus, MILITARY_EXPERT_REALISM_STATUSES);
  pushEnumError(errors, `${prefix}.confidence`, confidence, MILITARY_EXPERT_CONFIDENCE_LEVELS);
  pushEnumError(errors, `${prefix}.severity`, severity, MILITARY_EXPERT_SEVERITY_LEVELS);
  pushEnumError(
    errors,
    `${prefix}.recommendation_type`,
    recommendationType,
    MILITARY_EXPERT_RECOMMENDATION_TYPES,
  );

  if (record.author_challenge_allowed !== true) {
    errors.push(`${prefix}: author_challenge_allowed must be true`);
  }

  const manuscriptEvidence = (Array.isArray(record.manuscript_evidence)
    ? record.manuscript_evidence
    : []
  )
    .map((item, evidenceIndex) =>
      parseEvidenceRecord(item, `${prefix}.manuscript_evidence[${evidenceIndex}]`, errors),
    )
    .filter((item): item is MilitaryExpertEvidenceRecord => item != null);

  const contraryEvidence = Array.isArray(record.contrary_evidence)
    ? record.contrary_evidence
        .map((item, evidenceIndex) =>
          parseEvidenceRecord(item, `${prefix}.contrary_evidence[${evidenceIndex}]`, errors),
        )
        .filter((item): item is MilitaryExpertEvidenceRecord => item != null)
    : undefined;

  const escalationExpert = str(record.escalation_expert) || undefined;
  if (
    escalationExpert &&
    !(MILITARY_EXPERT_ESCALATION_EXPERTS as readonly string[]).includes(escalationExpert)
  ) {
    errors.push(`${prefix}: unsupported escalation_expert "${escalationExpert}"`);
  }

  if (realismStatus === "outside_expertise" && !escalationExpert) {
    errors.push(`${prefix}: outside_expertise findings must include escalation_expert`);
  }

  const scoreImpact =
    typeof record.score_impact === "number" && Number.isFinite(record.score_impact)
      ? record.score_impact
      : undefined;

  if (realismStatus === "insufficient_evidence" && (scoreImpact ?? 0) !== 0) {
    errors.push(`${prefix}: insufficient_evidence findings cannot carry score deductions`);
  }

  if (realismStatus === "accurate" && (scoreImpact ?? 0) < 0) {
    errors.push(`${prefix}: accurate findings cannot carry negative deductions`);
  }

  if (isNegativeRealismStatus(realismStatus)) {
    if (manuscriptEvidence.length === 0) {
      errors.push(`${prefix}: negative finding requires manuscript_evidence`);
    }
    if (!confidence) {
      errors.push(`${prefix}: negative finding requires confidence`);
    }
    if (!str(record.operational_impact)) {
      errors.push(`${prefix}: negative finding requires operational_impact`);
    }
    if (!str(record.recommendation)) {
      errors.push(`${prefix}: negative finding requires recommendation`);
    }
    if (!str(record.preservation_note)) {
      errors.push(`${prefix}: negative finding requires preservation_note`);
    }
    if (!("contrary_evidence" in record)) {
      errors.push(
        `${prefix}.contrary_evidence: field is required on negative findings (use [] when none exists)`,
      );
    } else if (record.contrary_evidence !== undefined && !Array.isArray(record.contrary_evidence)) {
      errors.push(`${prefix}.contrary_evidence: must be an array`);
    }
    if (
      !hasContraryEvidenceHandling({
        contrary_evidence: contraryEvidence,
        uncertainty_note: str(record.uncertainty_note) || undefined,
      })
    ) {
      errors.push(
        `${prefix}: negative finding requires contrary-evidence handling (valid contrary_evidence objects or [] with explicit uncertainty_note)`,
      );
    }
  }

  if (severity === "critical" && confidence !== "high" && !escalationExpert) {
    errors.push(
      `${prefix}: critical severity requires high confidence or explicit escalation_expert`,
    );
  }

  const combinedText = [
    str(record.observation),
    str(record.recommendation),
    str(record.operational_impact),
    str(record.source_requirements),
  ].join(" ");

  if (LETTER_GRADE_PATTERN.test(combinedText)) {
    errors.push(`${prefix}: letter grade language is not permitted`);
  }

  if (SAFETY_STEP_PATTERN.test(combinedText)) {
    errors.push(`${prefix}: safety-sensitive detail must remain generalized`);
  }

  if (FABRICATED_SOURCE_PATTERN.test(combinedText)) {
    errors.push(`${prefix}: fabricated source citation is not permitted`);
  }

  if (SERVICE_HISTORY_PATTERN.test(combinedText)) {
    errors.push(`${prefix}: service-history claims are not permitted`);
  }

  return {
    finding_id: str(record.finding_id) || `${category}:${str(record.title).toLowerCase()}:${index + 1}`,
    category: category as MilitaryExpertFinding["category"],
    title: str(record.title),
    observation: str(record.observation),
    manuscript_evidence: manuscriptEvidence,
    contrary_evidence: contraryEvidence,
    evidence_location: str(record.evidence_location) || undefined,
    confidence: confidence as MilitaryExpertFinding["confidence"],
    severity: severity as MilitaryExpertFinding["severity"],
    realism_status: realismStatus as MilitaryExpertFinding["realism_status"],
    operational_impact: str(record.operational_impact),
    story_impact: str(record.story_impact),
    recommendation: str(record.recommendation),
    recommendation_type: recommendationType as MilitaryExpertFinding["recommendation_type"],
    preservation_note: str(record.preservation_note),
    escalation_expert: escalationExpert as MilitaryExpertFinding["escalation_expert"],
    author_challenge_allowed: true,
    score_impact: scoreImpact,
    uncertainty_note: str(record.uncertainty_note) || undefined,
    source_requirements: str(record.source_requirements) || undefined,
  };
}

function parseCategoryAssessment(
  raw: unknown,
  index: number,
  errors: string[],
): MilitaryExpertCategoryAssessment | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`category_assessments[${index}]: must be an object`);
    return null;
  }
  const record = raw as Record<string, unknown>;
  const prefix = `category_assessments[${index}]`;
  const category = str(record.category);
  const status = str(record.status);
  const confidence = str(record.confidence);

  pushEnumError(errors, `${prefix}.category`, category, MILITARY_EXPERT_CATEGORIES);
  pushEnumError(
    errors,
    `${prefix}.status`,
    status,
    MILITARY_EXPERT_CATEGORY_ASSESSMENT_STATUSES,
  );
  pushEnumError(errors, `${prefix}.confidence`, confidence, MILITARY_EXPERT_CONFIDENCE_LEVELS);

  return {
    category: category as MilitaryExpertCategoryAssessment["category"],
    status: status as MilitaryExpertCategoryAssessment["status"],
    confidence: confidence as MilitaryExpertCategoryAssessment["confidence"],
    strength_summary: str(record.strength_summary),
    concern_summary: str(record.concern_summary),
    finding_count:
      typeof record.finding_count === "number" && Number.isFinite(record.finding_count)
        ? record.finding_count
        : 0,
    critical_count:
      typeof record.critical_count === "number" && Number.isFinite(record.critical_count)
        ? record.critical_count
        : 0,
    major_count:
      typeof record.major_count === "number" && Number.isFinite(record.major_count)
        ? record.major_count
        : 0,
    verification_needed: record.verification_needed === true,
    evidence_coverage: str(record.evidence_coverage) || "none",
    score:
      typeof record.score === "number" && Number.isFinite(record.score) ? record.score : undefined,
  };
}

/** Validate parsed JSON root against the Military Expert output schema. */
export function validateMilitaryExpertGenerationPayload(
  parsed: unknown,
): MilitaryExpertSchemaValidationResult {
  const errors: string[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errors: ["Root must be a JSON object"] };
  }

  const root = parsed as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (!(MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      errors.push(`Unsupported top-level field "${key}"`);
    }
  }

  for (const requiredKey of MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS) {
    if (!(requiredKey in root)) {
      errors.push(`Missing required field "${requiredKey}"`);
    }
  }

  const summary = str(root.summary);
  if (LETTER_GRADE_PATTERN.test(summary)) {
    errors.push("summary must not include letter grades");
  }

  const strengths = strArray(root.strengths);
  if (strengths.length === 0) {
    errors.push("strengths must be a non-empty array");
  }

  if (root.author_challenge_supported !== true) {
    errors.push("author_challenge_supported must be true");
  }

  if (!str(root.next_step)) {
    errors.push("next_step is required");
  }

  const findings = Array.isArray(root.findings)
    ? root.findings
        .map((item, index) => parseFinding(item, index, errors))
        .filter((item): item is MilitaryExpertFinding => item != null)
    : [];
  if (!Array.isArray(root.findings)) {
    errors.push("findings must be an array");
  }

  const overallForBalance =
    root.overall_realism_assessment && typeof root.overall_realism_assessment === "object"
      ? (root.overall_realism_assessment as Record<string, unknown>)
      : null;
  const conclusionForBalance = overallForBalance ? str(overallForBalance.conclusion) : "";

  validateMilitaryExpertSummaryBalance(summary, findings, errors, {
    strengths,
    conclusion: conclusionForBalance,
  });

  const categoryAssessments = Array.isArray(root.category_assessments)
    ? root.category_assessments
        .map((item, index) => parseCategoryAssessment(item, index, errors))
        .filter((item): item is MilitaryExpertCategoryAssessment => item != null)
    : [];
  if (!Array.isArray(root.category_assessments)) {
    errors.push("category_assessments must be an array");
  }

  const overall = root.overall_realism_assessment;
  if (!overall || typeof overall !== "object") {
    errors.push("overall_realism_assessment must be an object");
  } else {
    const overallRecord = overall as Record<string, unknown>;
    for (const key of Object.keys(overallRecord)) {
      if (!(MILITARY_EXPERT_OVERALL_REALISM_ASSESSMENT_KEYS as readonly string[]).includes(key)) {
        if (
          (MILITARY_EXPERT_OVERALL_REALISM_PROHIBITED_SUBSTITUTE_KEYS as readonly string[]).includes(
            key,
          )
        ) {
          errors.push(`overall_realism_assessment.${key} is invalid — use conclusion instead`);
        } else {
          errors.push(`overall_realism_assessment.${key} is unsupported`);
        }
      }
    }

    if (!("conclusion" in overallRecord)) {
      errors.push("overall_realism_assessment.conclusion is required (field missing)");
    } else if (overallRecord.conclusion === null) {
      errors.push(
        "overall_realism_assessment.conclusion must be a non-empty string (null is invalid)",
      );
    } else {
      const conclusion = str(overallRecord.conclusion);
      if (!conclusion) {
        errors.push("overall_realism_assessment.conclusion must be a non-empty string");
      }
      if (LETTER_GRADE_PATTERN.test(conclusion)) {
        errors.push("overall_realism_assessment must not include letter grades");
      }
      validateMilitaryExpertConclusionBalance(conclusion, findings, errors);
    }

    pushEnumError(
      errors,
      "overall_realism_assessment.confidence",
      str(overallRecord.confidence),
      MILITARY_EXPERT_CONFIDENCE_LEVELS,
    );
  }

  if (SERVICE_HISTORY_PATTERN.test(summary)) {
    errors.push("summary must not claim personal service history");
  }

  return { ok: errors.length === 0, errors };
}

/** Convert a validated schema root into a typed generation payload. */
export function coerceMilitaryExpertGenerationPayload(
  parsed: unknown,
): MilitaryExpertGenerationPayload | null {
  const validation = validateMilitaryExpertGenerationPayload(parsed);
  if (!validation.ok || !parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const overall = root.overall_realism_assessment as Record<string, unknown>;

  return {
    summary: str(root.summary),
    strengths: strArray(root.strengths),
    findings: (Array.isArray(root.findings) ? root.findings : [])
      .map((item, index) => parseFinding(item, index, []))
      .filter((item): item is MilitaryExpertFinding => item != null),
    category_assessments: (Array.isArray(root.category_assessments)
      ? root.category_assessments
      : []
    )
      .map((item, index) => parseCategoryAssessment(item, index, []))
      .filter((item): item is MilitaryExpertCategoryAssessment => item != null),
    overall_realism_assessment: {
      conclusion: str(overall.conclusion),
      confidence: str(overall.confidence) as MilitaryExpertOverallRealismAssessment["confidence"],
      primary_strengths: strArray(overall.primary_strengths),
      primary_concerns: strArray(overall.primary_concerns),
      preservation_priorities: strArray(overall.preservation_priorities),
    },
    critical_issues: strArray(root.critical_issues),
    priority_actions: strArray(root.priority_actions),
    verification_requests: strArray(root.verification_requests),
    escalation_recommendations: strArray(root.escalation_recommendations),
    uncertainty_summary: str(root.uncertainty_summary),
    next_step: str(root.next_step),
    author_challenge_supported: true,
  };
}

/** Top-level fields the model must not invent (common Haiku 4.5 smoke failures). */
export const MILITARY_EXPERT_PROHIBITED_TOP_LEVEL_FIELDS = [
  "author_challenge_note",
  "closing_note",
  "author_notes",
  "review_notes",
  "metadata",
] as const;

/** JSON schema description embedded in review prompts — single authoritative contract block. */
export function militaryExpertOutputSchemaPromptBlock(): string {
  const evidenceShapeExample = JSON.stringify(
    {
      excerpt: "quoted passage from supplied text",
      locator: "optional scene/chapter label",
      verification_note: "optional editorial note",
    },
    null,
    0,
  );

  return [
    "OUTPUT CONTRACT — respond with exactly ONE JSON object only.",
    "- Begin with `{` and end with `}`; the final character of your response must be `}`.",
    "- No markdown fences. No introduction before the JSON. No conclusion or commentary after the closing `}`.",
    "- Do not say \"Here is the report.\" Do not add notes, summaries, apologies, or explanations outside the object.",
    "- Do not add any top-level field outside the required list below.",
    `- Prohibited extra top-level fields (never create these): ${MILITARY_EXPERT_PROHIBITED_TOP_LEVEL_FIELDS.join(", ")}.`,
    "- Author-facing commentary belongs only in summary, next_step, preservation_note, or uncertainty_summary — never in new top-level fields.",
    "",
    "Required top-level keys (all must be present):",
    MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS.map((key) => `- ${key}`).join("\n"),
    "",
    "Exact enum values — synonyms are invalid; empty string is invalid; use the nearest allowed value; never invent a new enum:",
    `- confidence: ${MILITARY_EXPERT_CONFIDENCE_LEVELS.join(" | ")}`,
    `- severity: ${MILITARY_EXPERT_SEVERITY_LEVELS.join(" | ")}`,
    `- realism_status: ${MILITARY_EXPERT_REALISM_STATUSES.join(" | ")}`,
    `- recommendation_type: ${MILITARY_EXPERT_RECOMMENDATION_TYPES.join(" | ")}`,
    `- category: ${MILITARY_EXPERT_CATEGORIES.join(" | ")}`,
    `- category_assessment.status: ${MILITARY_EXPERT_CATEGORY_ASSESSMENT_STATUSES.join(" | ")} (required; never omit; never empty string; use not_applicable for true-negative categories with no issue)`,
    "",
    "manuscript_evidence contract (every item must be an object — strings and bare quotation arrays are invalid):",
    `- Required object shape: ${evidenceShapeExample}`,
    "- excerpt: required; quote or paraphrase only from supplied passages — do not invent text.",
    "- locator: optional scene/chapter label.",
    "- verification_note: optional editorial note.",
    "- Every negative finding must include at least one valid manuscript_evidence object.",
    "",
    "overall_realism_assessment contract (required object on every response):",
    `- Exact keys: ${MILITARY_EXPERT_OVERALL_REALISM_ASSESSMENT_KEYS.join(", ")}`,
    "- conclusion: REQUIRED non-empty author-facing string synthesizing the overall military-realism judgment.",
    "- conclusion must remain proportionate to findings, acknowledge uncertainty where appropriate, and must not contradict the findings array or duplicate the entire summary.",
    `- Invalid substitutes for conclusion: ${MILITARY_EXPERT_OVERALL_REALISM_PROHIBITED_SUBSTITUTE_KEYS.join(", ")} — empty string, null, and omitted field are also invalid.`,
    '- Positive finding case example shape: {"conclusion":"Mixed credibility with one comms concern to address.","confidence":"medium","primary_strengths":["Command scenes"],"primary_concerns":["Informal comms"],"preservation_priorities":["Keep tension beat"]}',
    '- True-negative case example shape: {"conclusion":"No material inaccuracies in supplied scope; residual period uncertainty remains.","confidence":"medium","primary_strengths":["Squad coordination"],"primary_concerns":[],"preservation_priorities":["Keep pacing"]}',
    '- Safety-escalation case example shape: {"conclusion":"Operational tension works, but breaching detail should stay generalized without procedural instruction.","confidence":"medium","primary_strengths":["Assault pacing"],"primary_concerns":["Instructional breaching tone"],"preservation_priorities":["Preserve stakes"]}',
    "",
    "contrary_evidence contract (mandatory on every negative finding):",
    "- Every negative finding MUST include the contrary_evidence property — omission is invalid.",
    "- Never omit contrary_evidence. Never use null. Always use an array.",
    "- When contrary evidence exists: include one or more valid evidence objects in contrary_evidence.",
    "- When no contrary evidence exists: set contrary_evidence: [] AND include a non-empty uncertainty_note.",
    `- Empty-contrary example fragment: {"contrary_evidence":[],"uncertainty_note":"No meaningful contrary evidence was identified in the supplied manuscript evidence."}`,
    `- Alternate accepted empty-contrary note example: "${MILITARY_EXPERT_NO_CONTRARY_EVIDENCE_UNCERTAINTY_EXAMPLE}"`,
    "- A generic uncertainty statement elsewhere (summary, observation, or top-level uncertainty_summary) is NOT a substitute for finding-level contrary_evidence handling.",
    "- manuscript_evidence objects cannot satisfy contrary_evidence unless placed in contrary_evidence.",
    "- Do not invent contrary evidence or manufacture rebuttals merely to satisfy the schema.",
    '- Present example fragment: {"contrary_evidence":[{"excerpt":"Officer oversight appears in an earlier beat.","locator":"scene"}]}',
    "- True-negative outputs with no negative findings must not fabricate contrary_evidence entries.",
    "- Do not create substitute fields such as contrary_evidence_note or evidence_strings.",
    "",
    "Finding object required fields:",
    "- finding_id, category, title, observation, manuscript_evidence[], confidence, severity, realism_status, operational_impact, story_impact, recommendation, recommendation_type, preservation_note, author_challenge_allowed (true)",
    `Evidence excerpts must be <= ${MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS} words.`,
    "Do not assign letter grades or school-style percentages.",
    "Do not claim personal military service or classified knowledge.",
    "Do not fabricate sources or citations.",
    "",
    "Summary balance:",
    "- Identify material strengths (specific accurate depictions or credible elements).",
    "- When negative findings exist, also identify material concerns proportionately.",
    "- When findings is empty (true negative), do NOT fabricate concerns; acknowledge scope reviewed and any residual uncertainty.",
    "- Do not contradict the findings array.",
    "",
    "Category assessment examples (synthetic):",
    '- Positive: {"category":"command_and_organization","status":"credible","confidence":"medium",...}',
    '- True-negative: {"category":"operations_and_tactics","status":"not_applicable","confidence":"medium",...}',
    "",
    "True-negative shape (zero findings):",
    "- findings: []",
    "- summary: acknowledge material strengths and scope reviewed; note residual uncertainty without inventing inaccuracies.",
    "- strengths: non-empty array of specific accurate depictions.",
    "- next_step: actionable author guidance even when no changes are required.",
    "- author_challenge_supported: true",
    "- category_assessments and overall_realism_assessment still required.",
  ].join("\n");
}
