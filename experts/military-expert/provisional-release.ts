/**
 * Provisional release for Military Expert reports with unresolved confidence checks.
 * Fail-closed unless 1–9 qualifying findings remain after a single repair attempt.
 */

import {
  MILITARY_EXPERT_CATEGORIES,
  MILITARY_EXPERT_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_ESCALATION_EXPERTS,
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES,
  MILITARY_EXPERT_REALISM_STATUSES,
  MILITARY_EXPERT_RECOMMENDATION_TYPES,
  MILITARY_EXPERT_SEVERITY_LEVELS,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertFinding,
  type MilitaryExpertFindingStatus,
  type MilitaryExpertReview,
  type MilitaryExpertReviewScope,
  type MilitaryExpertReviewStatus,
} from "./contracts.ts";
import {
  analyzeContraryEvidenceViolations,
  type ContraryEvidenceFindingViolation,
} from "./contrary-evidence-schema-repair.ts";
import { normalizeMilitaryExpertReview } from "./normalization.ts";
import {
  validateMilitaryExpertGenerationPayload,
  validateMilitaryExpertSummaryBalance,
} from "./output-schema.ts";
import type { MilitaryExpertRawGenerationResponse } from "./generation-types.ts";
import { extractStrictModelJsonObject } from "./model-json-extraction.ts";
import type { MilitaryExpertParseFailureCode } from "./parsing.ts";
import {
  MILITARY_EXPERT_NORMALIZATION_VERSION,
  MILITARY_EXPERT_VALIDATOR_VERSION,
} from "./runtime-definition.ts";
import { validateMilitaryExpertReviewForProvisional } from "./validation.ts";

/** Maximum unresolved confidence findings allowed for provisional release. */
export const MAX_PROVISIONAL_UNRESOLVED_FINDINGS = 9;

export type ProvisionalReleaseFailureCode =
  | "TOO_MANY_UNRESOLVED_FINDINGS"
  | "PROVISIONAL_RELEASE_NOT_ELIGIBLE";

export interface QualifyingUnresolvedFinding {
  findingIndex: number;
  findingId?: string;
  missingFields: readonly MilitaryExpertUnresolvedConfidenceField[];
}

export interface ProvisionalReleaseDiagnostics {
  total_findings: number;
  fully_validated_findings: number;
  unresolved_finding_count: number;
  unresolved_finding_indexes: number[];
  missing_field_names: string[];
  repair_attempted: boolean;
  repair_succeeded: boolean;
  provisional_release_used: boolean;
  provisional_threshold: number;
  final_review_status: MilitaryExpertReviewStatus | "blocked";
  failure_code?: ProvisionalReleaseFailureCode;
}

export interface ProvisionalReleaseSuccess {
  ok: true;
  review: MilitaryExpertReview;
  releaseStatus: Extract<MilitaryExpertReviewStatus, "completed_with_author_review_required">;
  qualifyingFindings: readonly QualifyingUnresolvedFinding[];
  diagnostics: ProvisionalReleaseDiagnostics;
}

export interface ProvisionalReleaseBlocked {
  ok: false;
  failureCode: ProvisionalReleaseFailureCode;
  diagnostics: ProvisionalReleaseDiagnostics;
}

export type ProvisionalReleaseResult = ProvisionalReleaseSuccess | ProvisionalReleaseBlocked;

const LETTER_GRADE_PATTERN = /\b(?:grade\s*[A-F][+-]?|[A-F]\s*grade|letter\s*grade)\b/i;
const SAFETY_STEP_PATTERN =
  /\b(?:step\s+\d+|first,?\s+(?:enter|breach|assemble|deploy|position)|then,?\s+(?:move|advance|engage|detonate))\b/i;
const FABRICATED_SOURCE_PATTERN =
  /\b(?:classified\s+field\s+manual|secret\s+doctrine|internal\s+memo\s+#\d+|unpublished\s+after[- ]action)\b/i;

const BLOCKING_PARSE_FAILURE_CODES = new Set<MilitaryExpertParseFailureCode>([
  "malformed_json",
  "multiple_payloads",
  "trailing_content",
  "provider_output_truncated",
  "unsafe_content",
  "unsupported_category",
  "unsupported_enum",
  "output_too_large",
  "correlation_mismatch",
]);

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function isContraryConfidenceError(error: string): boolean {
  return /contrary_evidence|contrary-evidence handling|uncertainty_note/.test(error);
}

function findingIndexFromError(error: string): number | null {
  const match = /^findings\[(\d+)\]/.exec(error);
  return match ? Number(match[1]) : null;
}

function validateFindingBodyWithoutConfidenceFields(
  raw: unknown,
  index: number,
): { ok: boolean; errors: string[]; findingId?: string } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: [`findings[${index}]: must be an object`] };
  }

  const record = raw as Record<string, unknown>;
  const prefix = `findings[${index}]`;
  const category = str(record.category);
  const realismStatus = str(record.realism_status);
  const confidence = str(record.confidence);
  const severity = str(record.severity);
  const recommendationType = str(record.recommendation_type);
  const title = str(record.title);
  const observation = str(record.observation);

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

  if (!title) errors.push(`${prefix}: title is required`);
  if (!observation) errors.push(`${prefix}: observation is required`);
  if (record.author_challenge_allowed !== true) {
    errors.push(`${prefix}: author_challenge_allowed must be true`);
  }

  const manuscriptEvidence = Array.isArray(record.manuscript_evidence)
    ? record.manuscript_evidence
    : [];
  if (manuscriptEvidence.length === 0) {
    errors.push(`${prefix}: negative finding requires manuscript_evidence`);
  } else {
    for (const [evidenceIndex, item] of manuscriptEvidence.entries()) {
      if (!item || typeof item !== "object") {
        errors.push(`${prefix}.manuscript_evidence[${evidenceIndex}]: must be an object`);
        continue;
      }
      if (!str((item as Record<string, unknown>).excerpt)) {
        errors.push(`${prefix}.manuscript_evidence[${evidenceIndex}]: excerpt is required`);
      }
    }
  }

  if (isNegativeRealismStatus(realismStatus)) {
    if (!confidence) errors.push(`${prefix}: negative finding requires confidence`);
    if (!str(record.operational_impact)) {
      errors.push(`${prefix}: negative finding requires operational_impact`);
    }
    if (!str(record.recommendation)) {
      errors.push(`${prefix}: negative finding requires recommendation`);
    }
    if (!str(record.preservation_note)) {
      errors.push(`${prefix}: negative finding requires preservation_note`);
    }
  }

  const escalationExpert = str(record.escalation_expert) || undefined;
  if (realismStatus === "outside_expertise" && !escalationExpert) {
    errors.push(`${prefix}: outside_expertise findings must include escalation_expert`);
  }
  if (
    escalationExpert &&
    !(MILITARY_EXPERT_ESCALATION_EXPERTS as readonly string[]).includes(escalationExpert)
  ) {
    errors.push(`${prefix}: unsupported escalation_expert "${escalationExpert}"`);
  }

  const combinedText = [
    observation,
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

  return {
    ok: errors.length === 0,
    errors,
    findingId: str(record.finding_id) || undefined,
  };
}

export function qualifyUnresolvedConfidenceFinding(args: {
  parsedRoot: unknown;
  violation: ContraryEvidenceFindingViolation;
}): QualifyingUnresolvedFinding | null {
  if (!args.parsedRoot || typeof args.parsedRoot !== "object" || Array.isArray(args.parsedRoot)) {
    return null;
  }

  const findings = Array.isArray((args.parsedRoot as Record<string, unknown>).findings)
    ? ((args.parsedRoot as Record<string, unknown>).findings as unknown[])
    : [];
  const raw = findings[args.violation.findingIndex];
  const body = validateFindingBodyWithoutConfidenceFields(raw, args.violation.findingIndex);
  if (!body.ok) return null;

  const missingFields = args.violation.missingFields.filter(
    (field): field is MilitaryExpertUnresolvedConfidenceField =>
      field === "contrary_evidence" || field === "uncertainty_note",
  );
  if (missingFields.length === 0) return null;

  return {
    findingIndex: args.violation.findingIndex,
    findingId: body.findingId ?? args.violation.findingId,
    missingFields,
  };
}

export function analyzeQualifyingUnresolvedFindings(parsedRoot: unknown): {
  qualifying: QualifyingUnresolvedFinding[];
  violations: readonly ContraryEvidenceFindingViolation[];
} {
  const analysis = analyzeContraryEvidenceViolations(parsedRoot);
  const qualifying = analysis.violations
    .map((violation) => qualifyUnresolvedConfidenceFinding({ parsedRoot, violation }))
    .filter((item): item is QualifyingUnresolvedFinding => item != null);

  return { qualifying, violations: analysis.violations };
}

function reportLevelErrorsAllowProvisional(
  parsedRoot: unknown,
  qualifyingIndexes: ReadonlySet<number>,
): boolean {
  const validation = validateMilitaryExpertGenerationPayload(parsedRoot);
  if (validation.ok) return qualifyingIndexes.size === 0;

  for (const error of validation.errors) {
    const index = findingIndexFromError(error);
    if (index !== null && qualifyingIndexes.has(index) && isContraryConfidenceError(error)) {
      continue;
    }
    if (isContraryConfidenceError(error) && index !== null && qualifyingIndexes.has(index)) {
      continue;
    }
    if (index !== null && qualifyingIndexes.has(index)) {
      if (isContraryConfidenceError(error)) continue;
      return false;
    }
    if (!isContraryConfidenceError(error)) return false;
    if (index !== null && !qualifyingIndexes.has(index)) return false;
  }

  return true;
}

function parseEvidenceRecords(raw: unknown): MilitaryExpertFinding["manuscript_evidence"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const excerpt = str(record.excerpt);
      if (!excerpt) return null;
      return {
        excerpt,
        locator: str(record.locator) || undefined,
        verification_note: str(record.verification_note) || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function buildFindingFromRaw(
  raw: unknown,
  index: number,
  qualifying: QualifyingUnresolvedFinding | undefined,
): MilitaryExpertFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const category = str(record.category);
  if (!(MILITARY_EXPERT_CATEGORIES as readonly string[]).includes(category)) return null;

  const finding: MilitaryExpertFinding = {
    finding_id: str(record.finding_id) || `${category}:${str(record.title).toLowerCase()}:${index + 1}`,
    category: category as MilitaryExpertFinding["category"],
    title: str(record.title),
    observation: str(record.observation),
    manuscript_evidence: parseEvidenceRecords(record.manuscript_evidence),
    contrary_evidence: qualifying ? undefined : parseEvidenceRecords(record.contrary_evidence),
    evidence_location: str(record.evidence_location) || undefined,
    confidence: str(record.confidence) as MilitaryExpertFinding["confidence"],
    severity: str(record.severity) as MilitaryExpertFinding["severity"],
    realism_status: str(record.realism_status) as MilitaryExpertFinding["realism_status"],
    operational_impact: str(record.operational_impact),
    story_impact: str(record.story_impact),
    recommendation: str(record.recommendation),
    recommendation_type: str(record.recommendation_type) as MilitaryExpertFinding["recommendation_type"],
    preservation_note: str(record.preservation_note),
    escalation_expert: str(record.escalation_expert) as MilitaryExpertFinding["escalation_expert"],
    author_challenge_allowed: true,
    score_impact:
      typeof record.score_impact === "number" && Number.isFinite(record.score_impact)
        ? record.score_impact
        : undefined,
    uncertainty_note: qualifying ? undefined : str(record.uncertainty_note) || undefined,
    source_requirements: str(record.source_requirements) || undefined,
    finding_status: (qualifying ? "author_review_required" : "validated") as MilitaryExpertFindingStatus,
  };

  return finding;
}

function buildProvisionalReview(args: {
  parsedRoot: unknown;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  definitionHash: string;
  qualifying: readonly QualifyingUnresolvedFinding[];
}): MilitaryExpertReview | null {
  if (!args.parsedRoot || typeof args.parsedRoot !== "object" || Array.isArray(args.parsedRoot)) {
    return null;
  }

  const root = args.parsedRoot as Record<string, unknown>;
  const qualifyingByIndex = new Map(args.qualifying.map((item) => [item.findingIndex, item]));
  const findingsRaw = Array.isArray(root.findings) ? root.findings : [];
  const findings = findingsRaw
    .map((raw, index) => buildFindingFromRaw(raw, index, qualifyingByIndex.get(index)))
    .filter((item): item is MilitaryExpertFinding => item != null);

  if (findings.length !== findingsRaw.length) return null;

  const overall = root.overall_realism_assessment as Record<string, unknown> | undefined;
  if (!overall || typeof overall !== "object") return null;

  const review: MilitaryExpertReview = {
    expert_key: MILITARY_EXPERT_KEY,
    expert_version: MILITARY_EXPERT_VERSION,
    definition_hash: args.definitionHash,
    manuscript_version_id: args.manuscriptVersionId,
    review_scope: args.reviewScope,
    review_status: "completed_with_author_review_required",
    summary: str(root.summary),
    strengths: Array.isArray(root.strengths)
      ? root.strengths.map((item) => str(item)).filter(Boolean)
      : [],
    findings,
    category_assessments: Array.isArray(root.category_assessments)
      ? (root.category_assessments as unknown[])
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const record = item as Record<string, unknown>;
            return {
              category: str(record.category),
              status: str(record.status),
              confidence: str(record.confidence),
              strength_summary: str(record.strength_summary),
              concern_summary: str(record.concern_summary),
              finding_count: typeof record.finding_count === "number" ? record.finding_count : 0,
              critical_count: typeof record.critical_count === "number" ? record.critical_count : 0,
              major_count: typeof record.major_count === "number" ? record.major_count : 0,
              verification_needed: record.verification_needed === true,
              evidence_coverage: str(record.evidence_coverage),
            };
          })
          .filter((item): item is NonNullable<typeof item> => item != null)
      : [],
    overall_realism_assessment: {
      conclusion: str(overall.conclusion),
      confidence: str(overall.confidence) as MilitaryExpertReview["overall_realism_assessment"]["confidence"],
      primary_strengths: Array.isArray(overall.primary_strengths)
        ? overall.primary_strengths.map((item) => str(item)).filter(Boolean)
        : [],
      primary_concerns: Array.isArray(overall.primary_concerns)
        ? overall.primary_concerns.map((item) => str(item)).filter(Boolean)
        : [],
      preservation_priorities: Array.isArray(overall.preservation_priorities)
        ? overall.preservation_priorities.map((item) => str(item)).filter(Boolean)
        : [],
    },
    critical_issues: Array.isArray(root.critical_issues)
      ? root.critical_issues.map((item) => str(item)).filter(Boolean)
      : [],
    priority_actions: Array.isArray(root.priority_actions)
      ? root.priority_actions.map((item) => str(item)).filter(Boolean)
      : [],
    verification_requests: Array.isArray(root.verification_requests)
      ? root.verification_requests.map((item) => str(item)).filter(Boolean)
      : [],
    escalation_recommendations: Array.isArray(root.escalation_recommendations)
      ? root.escalation_recommendations.map((item) => str(item)).filter(Boolean)
      : [],
    uncertainty_summary: str(root.uncertainty_summary),
    author_challenge_supported: true,
    next_step: str(root.next_step),
    provenance: {
      validator_version: MILITARY_EXPERT_VALIDATOR_VERSION,
      normalization_version: MILITARY_EXPERT_NORMALIZATION_VERSION,
      definition_hash: args.definitionHash,
    },
  };

  const reviewErrors: string[] = [];
  validateMilitaryExpertSummaryBalance(review.summary, review.findings, reviewErrors, {
    strengths: review.strengths,
    conclusion: review.overall_realism_assessment.conclusion,
  });

  const normalized = normalizeMilitaryExpertReview(review);
  const provisionalIndexesAfterNormalize = normalized.findings.reduce<number[]>(
    (indexes, finding, index) => {
      if (finding.finding_status === "author_review_required") indexes.push(index);
      return indexes;
    },
    [],
  );
  const validation = validateMilitaryExpertReviewForProvisional(
    normalized,
    provisionalIndexesAfterNormalize,
    { expectedDefinitionHash: args.definitionHash },
  );

  if (reviewErrors.length > 0 || !validation.ok) return null;

  return normalized;
}

export function buildProvisionalReleaseDiagnostics(args: {
  parsedRoot: unknown;
  qualifying: readonly QualifyingUnresolvedFinding[];
  repairAttempted: boolean;
  repairSucceeded: boolean;
  provisionalReleaseUsed: boolean;
  finalReviewStatus: ProvisionalReleaseDiagnostics["final_review_status"];
  failureCode?: ProvisionalReleaseFailureCode;
}): ProvisionalReleaseDiagnostics {
  const findings = Array.isArray((args.parsedRoot as Record<string, unknown>)?.findings)
    ? ((args.parsedRoot as Record<string, unknown>).findings as unknown[])
    : [];
  const unresolvedIndexes = args.qualifying.map((item) => item.findingIndex);
  const missingFieldNames = [
    ...new Set(args.qualifying.flatMap((item) => [...item.missingFields])),
  ];

  return {
    total_findings: findings.length,
    fully_validated_findings: findings.length - args.qualifying.length,
    unresolved_finding_count: args.qualifying.length,
    unresolved_finding_indexes: unresolvedIndexes,
    missing_field_names: missingFieldNames,
    repair_attempted: args.repairAttempted,
    repair_succeeded: args.repairSucceeded,
    provisional_release_used: args.provisionalReleaseUsed,
    provisional_threshold: MAX_PROVISIONAL_UNRESOLVED_FINDINGS,
    final_review_status: args.finalReviewStatus,
    failure_code: args.failureCode,
  };
}

export function evaluateProvisionalRelease(args: {
  parsedRoot: unknown;
  parseFailureCode?: MilitaryExpertParseFailureCode;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  definitionHash: string;
  repairAttempted: boolean;
  repairSucceeded: boolean;
}): ProvisionalReleaseResult | null {
  if (!args.parsedRoot) return null;
  if (args.parseFailureCode && BLOCKING_PARSE_FAILURE_CODES.has(args.parseFailureCode)) {
    return null;
  }
  if (args.parseFailureCode && args.parseFailureCode !== "evidence_missing") {
    return null;
  }

  const { qualifying, violations } = analyzeQualifyingUnresolvedFindings(args.parsedRoot);
  if (violations.length === 0 || qualifying.length === 0) return null;
  if (qualifying.length !== violations.length) return null;

  const qualifyingIndexes = new Set(qualifying.map((item) => item.findingIndex));
  if (!reportLevelErrorsAllowProvisional(args.parsedRoot, qualifyingIndexes)) {
    return null;
  }

  const baseDiagnostics = (finalStatus: ProvisionalReleaseDiagnostics["final_review_status"], failureCode?: ProvisionalReleaseFailureCode) =>
    buildProvisionalReleaseDiagnostics({
      parsedRoot: args.parsedRoot,
      qualifying,
      repairAttempted: args.repairAttempted,
      repairSucceeded: args.repairSucceeded,
      provisionalReleaseUsed: finalStatus === "completed_with_author_review_required",
      finalReviewStatus: finalStatus,
      failureCode,
    });

  if (qualifying.length > MAX_PROVISIONAL_UNRESOLVED_FINDINGS) {
    return {
      ok: false,
      failureCode: "TOO_MANY_UNRESOLVED_FINDINGS",
      diagnostics: baseDiagnostics("blocked", "TOO_MANY_UNRESOLVED_FINDINGS"),
    };
  }

  const review = buildProvisionalReview({
    parsedRoot: args.parsedRoot,
    manuscriptVersionId: args.manuscriptVersionId,
    reviewScope: args.reviewScope,
    definitionHash: args.definitionHash,
    qualifying,
  });

  if (!review) {
    return {
      ok: false,
      failureCode: "PROVISIONAL_RELEASE_NOT_ELIGIBLE",
      diagnostics: baseDiagnostics("blocked", "PROVISIONAL_RELEASE_NOT_ELIGIBLE"),
    };
  }

  return {
    ok: true,
    review,
    releaseStatus: "completed_with_author_review_required",
    qualifyingFindings: qualifying,
    diagnostics: baseDiagnostics("completed_with_author_review_required"),
  };
}

export type ProvisionalReleaseDecision = "normal" | "provisional" | "blocked";

export function evaluateProvisionalReleaseDecision(count: number): ProvisionalReleaseDecision {
  if (count <= 0) return "normal";
  if (count <= MAX_PROVISIONAL_UNRESOLVED_FINDINGS) return "provisional";
  return "blocked";
}

export interface ProvisionalReleaseEligibilityAnalysis {
  eligible: boolean;
  decision: ProvisionalReleaseDecision;
  qualifyingCount: number;
  qualifyingUnresolved: readonly QualifyingUnresolvedFinding[];
  blockReason?: "too_many_unresolved" | "not_eligible";
}

export function isCompleteReportJsonExtracted(raw: MilitaryExpertRawGenerationResponse): boolean {
  if (raw.finishStatus === "truncated") return false;
  try {
    extractStrictModelJsonObject(raw.responseText);
    return true;
  } catch {
    return false;
  }
}

export function analyzeProvisionalReleaseEligibility(parsedRoot: unknown): ProvisionalReleaseEligibilityAnalysis {
  const { qualifying, violations } = analyzeQualifyingUnresolvedFindings(parsedRoot);
  const qualifyingIndexes = new Set(qualifying.map((item) => item.findingIndex));

  if (violations.length === 0 || qualifying.length === 0 || qualifying.length !== violations.length) {
    return {
      eligible: false,
      decision: "blocked",
      qualifyingCount: qualifying.length,
      qualifyingUnresolved: qualifying,
      blockReason: "not_eligible",
    };
  }

  if (!reportLevelErrorsAllowProvisional(parsedRoot, qualifyingIndexes)) {
    return {
      eligible: false,
      decision: "blocked",
      qualifyingCount: qualifying.length,
      qualifyingUnresolved: qualifying,
      blockReason: "not_eligible",
    };
  }

  const decision = evaluateProvisionalReleaseDecision(qualifying.length);
  if (decision === "blocked") {
    return {
      eligible: false,
      decision,
      qualifyingCount: qualifying.length,
      qualifyingUnresolved: qualifying,
      blockReason: "too_many_unresolved",
    };
  }

  return {
    eligible: true,
    decision,
    qualifyingCount: qualifying.length,
    qualifyingUnresolved: qualifying,
  };
}

export function buildProvisionalMilitaryExpertReview(args: {
  parsed: unknown;
  manuscriptVersionId: string;
  reviewScope: MilitaryExpertReviewScope;
  definitionHash: string;
  repairAttempted: boolean;
  repairSucceeded: boolean;
}):
  | {
      ok: true;
      review: MilitaryExpertReview;
      unresolvedFindingIndexes: number[];
      eventPayload: Record<string, unknown>;
    }
  | { ok: false } {
  const result = evaluateProvisionalRelease({
    parsedRoot: args.parsed,
    parseFailureCode: "evidence_missing",
    manuscriptVersionId: args.manuscriptVersionId,
    reviewScope: args.reviewScope,
    definitionHash: args.definitionHash,
    repairAttempted: args.repairAttempted,
    repairSucceeded: args.repairSucceeded,
  });

  if (!result?.ok) return { ok: false };

  return {
    ok: true,
    review: result.review,
    unresolvedFindingIndexes: result.qualifyingFindings.map((item) => item.findingIndex),
    eventPayload: {
      total_findings: result.diagnostics.total_findings,
      fully_validated_findings: result.diagnostics.fully_validated_findings,
      unresolved_finding_count: result.diagnostics.unresolved_finding_count,
      unresolved_finding_indexes: result.diagnostics.unresolved_finding_indexes,
      missing_field_names: result.diagnostics.missing_field_names,
      repair_attempted: result.diagnostics.repair_attempted,
      repair_succeeded: result.diagnostics.repair_succeeded,
      provisional_release_used: result.diagnostics.provisional_release_used,
      provisional_threshold: result.diagnostics.provisional_threshold,
      final_review_status: result.diagnostics.final_review_status,
    },
  };
}
