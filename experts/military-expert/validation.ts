/**
 * Deterministic Military Expert review validation — fail-closed, no model repair.
 */

import {
  MILITARY_EXPERT_CATEGORIES,
  MILITARY_EXPERT_CONFIDENCE_LEVELS,
  MILITARY_EXPERT_ESCALATION_EXPERTS,
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS,
  MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES,
  MILITARY_EXPERT_REALISM_STATUSES,
  MILITARY_EXPERT_RECOMMENDATION_TYPES,
  MILITARY_EXPERT_SEVERITY_LEVELS,
  MILITARY_EXPERT_VERSION,
  type MilitaryExpertFinding,
  type MilitaryExpertReview,
  type MilitaryExpertValidationResult,
} from "./contracts.ts";
import { validateMilitaryExpertSummaryBalance } from "./output-schema.ts";

const LETTER_GRADE_PATTERN = /\b(?:grade\s*[A-F][+-]?|[A-F]\s*grade|letter\s*grade)\b/i;

const SAFETY_STEP_PATTERN =
  /\b(?:step\s+\d+|first,?\s+(?:enter|breach|assemble|deploy|position)|then,?\s+(?:move|advance|engage|detonate))\b/i;

const FABRICATED_SOURCE_PATTERN =
  /\b(?:classified\s+field\s+manual|secret\s+doctrine|internal\s+memo\s+#\d+|unpublished\s+after[- ]action)\b/i;

const FULL_MANUSCRIPT_COPY_THRESHOLD_WORDS = 500;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isNegativeFinding(finding: MilitaryExpertFinding): boolean {
  return (MILITARY_EXPERT_NEGATIVE_REALISM_STATUSES as readonly string[]).includes(
    finding.realism_status,
  );
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

function validateFinding(finding: MilitaryExpertFinding, index: number, errors: string[]): void {
  const prefix = `findings[${index}]`;

  pushEnumError(errors, `${prefix}.category`, finding.category, MILITARY_EXPERT_CATEGORIES);
  pushEnumError(errors, `${prefix}.confidence`, finding.confidence, MILITARY_EXPERT_CONFIDENCE_LEVELS);
  pushEnumError(errors, `${prefix}.severity`, finding.severity, MILITARY_EXPERT_SEVERITY_LEVELS);
  pushEnumError(
    errors,
    `${prefix}.realism_status`,
    finding.realism_status,
    MILITARY_EXPERT_REALISM_STATUSES,
  );
  pushEnumError(
    errors,
    `${prefix}.recommendation_type`,
    finding.recommendation_type,
    MILITARY_EXPERT_RECOMMENDATION_TYPES,
  );

  if (finding.author_challenge_allowed !== true) {
    errors.push(`${prefix}: author_challenge_allowed must be true`);
  }

  if (finding.realism_status === "outside_expertise" && !finding.escalation_expert) {
    errors.push(`${prefix}: outside_expertise findings must include escalation_expert`);
  }

  if (
    finding.escalation_expert &&
    !(MILITARY_EXPERT_ESCALATION_EXPERTS as readonly string[]).includes(finding.escalation_expert)
  ) {
    errors.push(`${prefix}: unsupported escalation_expert "${finding.escalation_expert}"`);
  }

  if (isNegativeFinding(finding)) {
    if (!finding.manuscript_evidence?.length) {
      errors.push(`${prefix}: negative finding requires manuscript_evidence`);
    }
    if (!finding.confidence) {
      errors.push(`${prefix}: negative finding requires confidence`);
    }
    if (!finding.operational_impact?.trim()) {
      errors.push(`${prefix}: negative finding requires operational_impact`);
    }
    if (!finding.recommendation?.trim()) {
      errors.push(`${prefix}: negative finding requires recommendation`);
    }
    if (!finding.preservation_note?.trim()) {
      errors.push(`${prefix}: negative finding requires preservation_note`);
    }
  }

  if (finding.realism_status === "insufficient_evidence" && (finding.score_impact ?? 0) !== 0) {
    errors.push(`${prefix}: insufficient_evidence findings cannot carry score deductions`);
  }

  if (finding.realism_status === "accurate" && (finding.score_impact ?? 0) < 0) {
    errors.push(`${prefix}: accurate findings cannot carry negative deductions`);
  }

  if (
    finding.severity === "critical" &&
    finding.confidence !== "high" &&
    !finding.escalation_expert
  ) {
    errors.push(
      `${prefix}: critical severity requires high confidence or explicit escalation_expert`,
    );
  }

  for (const [evidenceIndex, evidence] of (finding.manuscript_evidence ?? []).entries()) {
    const evidenceWords = countWords(evidence.excerpt ?? "");
    if (evidenceWords > MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS) {
      errors.push(
        `${prefix}.manuscript_evidence[${evidenceIndex}]: excerpt exceeds ${MILITARY_EXPERT_MAX_EVIDENCE_EXCERPT_WORDS} words`,
      );
    }
    if (evidenceWords > FULL_MANUSCRIPT_COPY_THRESHOLD_WORDS) {
      errors.push(`${prefix}.manuscript_evidence[${evidenceIndex}]: appears to copy full manuscript text`);
    }
  }

  const combinedText = [
    finding.observation,
    finding.recommendation,
    finding.operational_impact,
    finding.source_requirements ?? "",
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
}

function validateFindingContraryEvidence(
  finding: MilitaryExpertFinding,
  index: number,
  errors: string[],
): void {
  const prefix = `findings[${index}]`;
  if (!isNegativeFinding(finding)) return;

  if (!("contrary_evidence" in finding) && finding.contrary_evidence === undefined) {
    if (
      !finding.uncertainty_note?.trim() ||
      !/(?:no contrary evidence|none was found|contrary evidence (?:was )?not found|did not find contrary)/i.test(
        finding.uncertainty_note,
      )
    ) {
      errors.push(
        `${prefix}: negative finding requires contrary-evidence handling (valid contrary_evidence objects or [] with explicit uncertainty_note)`,
      );
    }
  } else if (
    Array.isArray(finding.contrary_evidence) &&
    finding.contrary_evidence.length === 0 &&
    (!finding.uncertainty_note?.trim() ||
      !/(?:no contrary evidence|none was found|contrary evidence (?:was )?not found|did not find contrary)/i.test(
        finding.uncertainty_note,
      ))
  ) {
    errors.push(
      `${prefix}: negative finding requires contrary-evidence handling (valid contrary_evidence objects or [] with explicit uncertainty_note)`,
    );
  }
}

/** Validate a review that includes provisional author_review_required findings. */
export function validateMilitaryExpertReviewForProvisional(
  review: MilitaryExpertReview,
  provisionalFindingIndexes: readonly number[],
  options?: { expectedDefinitionHash?: string },
): MilitaryExpertValidationResult {
  const provisionalSet = new Set(provisionalFindingIndexes);
  const errors: string[] = [];

  if (review.expert_key !== MILITARY_EXPERT_KEY) {
    errors.push(`expert_key must be ${MILITARY_EXPERT_KEY}`);
  }

  if (review.expert_version !== MILITARY_EXPERT_VERSION) {
    errors.push(`expert_version must be ${MILITARY_EXPERT_VERSION}`);
  }

  if (options?.expectedDefinitionHash && review.definition_hash !== options.expectedDefinitionHash) {
    errors.push("definition_hash does not match expected Military Expert runtime hash");
  }

  if (review.author_challenge_supported !== true) {
    errors.push("author_challenge_supported must be true");
  }

  if (review.review_status !== "completed_with_author_review_required") {
    errors.push("review_status must be completed_with_author_review_required for provisional release");
  }

  if (!review.next_step?.trim()) {
    errors.push("next_step is required");
  }

  if (!review.summary?.trim()) {
    errors.push("summary is required");
  } else {
    validateMilitaryExpertSummaryBalance(review.summary, review.findings ?? [], errors, {
      strengths: review.strengths,
      conclusion: review.overall_realism_assessment.conclusion,
    });
  }

  if (!Array.isArray(review.strengths) || review.strengths.length === 0) {
    errors.push("strengths must be a non-empty array");
  }

  for (const [index, finding] of review.findings.entries()) {
    validateFinding(finding, index, errors);
    if (!provisionalSet.has(index)) {
      validateFindingContraryEvidence(finding, index, errors);
      if (finding.finding_status && finding.finding_status !== "validated") {
        errors.push(`findings[${index}]: finding_status must be validated or omitted`);
      }
    } else {
      if (finding.finding_status !== "author_review_required") {
        errors.push(`findings[${index}]: finding_status must be author_review_required`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateMilitaryExpertReview(
  review: MilitaryExpertReview,
  options?: { expectedDefinitionHash?: string },
): MilitaryExpertValidationResult {
  const errors: string[] = [];

  if (review.expert_key !== MILITARY_EXPERT_KEY) {
    errors.push(`expert_key must be ${MILITARY_EXPERT_KEY}`);
  }

  if (review.expert_version !== MILITARY_EXPERT_VERSION) {
    errors.push(`expert_version must be ${MILITARY_EXPERT_VERSION}`);
  }

  if (options?.expectedDefinitionHash && review.definition_hash !== options.expectedDefinitionHash) {
    errors.push("definition_hash does not match expected Military Expert runtime hash");
  }

  if (review.author_challenge_supported !== true) {
    errors.push("author_challenge_supported must be true");
  }

  if (!review.next_step?.trim()) {
    errors.push("next_step is required");
  }

  if (!review.summary?.trim()) {
    errors.push("summary is required");
  } else {
    validateMilitaryExpertSummaryBalance(review.summary, review.findings ?? [], errors, {
      strengths: review.strengths,
      conclusion: review.overall_realism_assessment.conclusion,
    });
  }

  if (!Array.isArray(review.strengths) || review.strengths.length === 0) {
    errors.push("strengths must be a non-empty array");
  }

  if (
    LETTER_GRADE_PATTERN.test(review.summary) ||
    LETTER_GRADE_PATTERN.test(review.overall_realism_assessment.conclusion)
  ) {
    errors.push("review must not include letter grades");
  }

  for (const [index, finding] of review.findings.entries()) {
    validateFinding(finding, index, errors);
    validateFindingContraryEvidence(finding, index, errors);
  }

  return { ok: errors.length === 0, errors };
}
