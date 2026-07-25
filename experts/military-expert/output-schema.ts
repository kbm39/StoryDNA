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
  if (!raw || typeof raw !== "object") {
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
  observation?: string;
}): boolean {
  if (finding.contrary_evidence && finding.contrary_evidence.length > 0) return true;
  const combined = `${finding.uncertainty_note ?? ""} ${finding.observation ?? ""}`;
  return NO_CONTRARY_EVIDENCE_PATTERN.test(combined);
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
    if (
      !hasContraryEvidenceHandling({
        contrary_evidence: contraryEvidence,
        uncertainty_note: str(record.uncertainty_note) || undefined,
        observation: str(record.observation),
      })
    ) {
      errors.push(`${prefix}: negative finding requires contrary-evidence handling`);
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
  if (!summary) {
    errors.push("summary is required");
  } else {
    const summaryLower = summary.toLowerCase();
    const mentionsStrength = /strength|works|accurate|credible|effective/.test(summaryLower);
    const mentionsConcern = /concern|inaccurate|issue|uncertain|weak|problem/.test(summaryLower);
    if (!mentionsStrength || !mentionsConcern) {
      errors.push("summary must acknowledge both strengths and concerns");
    }
    if (LETTER_GRADE_PATTERN.test(summary)) {
      errors.push("summary must not include letter grades");
    }
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
    const conclusion = str(overallRecord.conclusion);
    if (!conclusion) {
      errors.push("overall_realism_assessment.conclusion is required");
    }
    if (LETTER_GRADE_PATTERN.test(conclusion)) {
      errors.push("overall_realism_assessment must not include letter grades");
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

  void findings;
  void categoryAssessments;

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

/** JSON schema description embedded in review prompts. */
export function militaryExpertOutputSchemaPromptBlock(): string {
  return [
    "OUTPUT FORMAT — respond with ONE JSON object only. No markdown wrapper. No prose outside the JSON.",
    "Required top-level keys:",
    MILITARY_EXPERT_OUTPUT_TOP_LEVEL_KEYS.map((key) => `- ${key}`).join("\n"),
    "Finding object required fields:",
    "- finding_id, category, title, observation, manuscript_evidence[], confidence, severity, realism_status, operational_impact, story_impact, recommendation, recommendation_type, preservation_note, author_challenge_allowed (true)",
    "Negative findings must include manuscript_evidence, contrary_evidence OR an explicit no-contrary-evidence statement in uncertainty_note, confidence, preservation_note.",
    `Evidence excerpts must be <= ${MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS} words.`,
    `Allowed categories: ${MILITARY_EXPERT_CATEGORIES.join(", ")}.`,
    "Do not assign letter grades or school-style percentages.",
    "Do not claim personal military service or classified knowledge.",
    "Do not fabricate sources or citations.",
  ].join("\n");
}
