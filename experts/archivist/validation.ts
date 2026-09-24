/**
 * Deterministic Archivist review validation — fail-closed, no substantive repair.
 */

import { manuscriptPassageLocated } from "@/lib/passage-locate.ts";
import {
  ARCHIVIST_CONTINUITY_COMPATIBILITIES,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_OBSERVATION_TEMPORAL_RELATIONS,
  ARCHIVIST_REVIEW_SCHEMA,
  ARCHIVIST_VERSION,
  CONTENT_HASH_PATTERN,
  isArchivistAuthority,
  isArchivistClassification,
  isArchivistConfidence,
  isArchivistFactType,
  isArchivistIssueType,
  isArchivistSeverity,
  isModelProposableAuthority,
  type ArchivistCanonDelta,
  type ArchivistEntityAmbiguity,
  type ArchivistEvidenceRecord,
  type ArchivistFinding,
  type ArchivistReview,
  type ArchivistValidationResult,
} from "./contracts.ts";
import { countExcerptWords, confirmedContradictionHasBothSides } from "./evidence.ts";
import { ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS } from "./contracts.ts";
import {
  hasPriorCanonLocator,
  hasPriorCanonSourceIdentity,
  isPriorCanonFinding,
} from "./prior-canon-provenance.ts";

const LETTER_GRADE_PATTERN =
  /\b(?:grade\s*[A-F][+-]?|[A-F][+-]?\s*grade|letter\s*grade|[A-F][+-]?\s*(?:average|score))\b/i;

const TEMPORAL_RELATIONS = ARCHIVIST_OBSERVATION_TEMPORAL_RELATIONS;

export interface ValidateArchivistReviewOptions {
  expectedDefinitionHash?: string;
  manuscriptText?: string;
}

function pushIf(condition: boolean, errors: string[], message: string): void {
  if (condition) errors.push(message);
}

function validateEvidenceRecord(
  record: ArchivistEvidenceRecord,
  prefix: string,
  errors: string[],
  manuscriptText?: string,
): void {
  pushIf(!record.excerpt?.trim(), errors, `${prefix}: excerpt is required`);
  pushIf(!record.locator?.trim(), errors, `${prefix}: locator is required`);
  if (countExcerptWords(record.excerpt ?? "") > ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS) {
    errors.push(`${prefix}: excerpt exceeds ${ARCHIVIST_MAX_EVIDENCE_EXCERPT_WORDS} words`);
  }
  if (
    manuscriptText &&
    record.source_kind === "manuscript" &&
    record.excerpt?.trim() &&
    !manuscriptPassageLocated(manuscriptText, record.excerpt)
  ) {
    errors.push(`${prefix}: manuscript excerpt failed passage verification`);
  }
}

function validateFinding(
  finding: ArchivistFinding,
  index: number,
  errors: string[],
  options?: ValidateArchivistReviewOptions,
): void {
  const prefix = `findings[${index}]`;
  pushIf(!finding.id?.trim(), errors, `${prefix}: id is required`);

  if (!isArchivistIssueType(String(finding.issue_type))) {
    errors.push(`${prefix}: unsupported issue_type "${String(finding.issue_type)}"`);
  }
  if (!isArchivistClassification(String(finding.classification))) {
    errors.push(`${prefix}: unsupported classification "${String(finding.classification)}"`);
  }
  if (
    finding.model_classification &&
    !isArchivistClassification(String(finding.model_classification))
  ) {
    errors.push(`${prefix}: unsupported model_classification`);
  }
  if (
    finding.final_classification &&
    !isArchivistClassification(String(finding.final_classification))
  ) {
    errors.push(`${prefix}: unsupported final_classification`);
  }
  if (
    finding.confirmation_eligibility &&
    !["eligible", "ineligible", "insufficient_evidence"].includes(finding.confirmation_eligibility)
  ) {
    errors.push(`${prefix}: unsupported confirmation_eligibility`);
  }
  if (!isArchivistSeverity(String(finding.severity))) {
    errors.push(`${prefix}: unsupported severity "${String(finding.severity)}"`);
  }
  if (!isArchivistConfidence(String(finding.confidence))) {
    errors.push(`${prefix}: unsupported confidence "${String(finding.confidence)}"`);
  }
  if (finding.author_challenge_supported !== true) {
    errors.push(`${prefix}: author_challenge_supported must be true`);
  }
  if (finding.author_action !== "pending") {
    errors.push(`${prefix}: author_action must remain pending until explicit author action`);
  }
  if (!(TEMPORAL_RELATIONS as readonly string[]).includes(finding.temporal_analysis?.relation)) {
    errors.push(`${prefix}: unsupported temporal relation`);
  }
  if (
    finding.temporal_analysis?.continuity_compatibility &&
    !(ARCHIVIST_CONTINUITY_COMPATIBILITIES as readonly string[]).includes(
      finding.temporal_analysis.continuity_compatibility,
    )
  ) {
    errors.push(`${prefix}: unsupported continuity compatibility`);
  }
  pushIf(!finding.explanation?.trim(), errors, `${prefix}: explanation is required`);
  pushIf(
    !finding.suggested_resolution?.trim(),
    errors,
    `${prefix}: suggested_resolution is required`,
  );
  pushIf(
    !finding.current_location?.locator?.trim(),
    errors,
    `${prefix}: current_location.locator is required`,
  );

  for (const [i, record] of (finding.current_evidence ?? []).entries()) {
    validateEvidenceRecord(
      record,
      `${prefix}.current_evidence[${i}]`,
      errors,
      options?.manuscriptText,
    );
  }
  for (const [i, record] of (finding.conflicting_evidence ?? []).entries()) {
    validateEvidenceRecord(
      record,
      `${prefix}.conflicting_evidence[${i}]`,
      errors,
      record.source_kind === "manuscript" ? options?.manuscriptText : undefined,
    );
  }

  if (LETTER_GRADE_PATTERN.test(finding.explanation) || LETTER_GRADE_PATTERN.test(finding.suggested_resolution)) {
    errors.push(`${prefix}: letter grades are not permitted`);
  }

  if (finding.classification === "confirmed_contradiction") {
    if (!confirmedContradictionHasBothSides(finding)) {
      errors.push(`${prefix}: confirmed_contradiction requires both-side located evidence and locators`);
    }
    const compatibility = finding.temporal_analysis?.continuity_compatibility;
    if (compatibility === "compatible_change") {
      errors.push(`${prefix}: compatible temporal change cannot be a confirmed contradiction`);
    }
    if (compatibility === "insufficient_evidence") {
      errors.push(
        `${prefix}: insufficient continuity evidence cannot be a confirmed contradiction`,
      );
    }
    if (finding.temporal_analysis?.relation === "unknown" && !compatibility) {
      errors.push(
        `${prefix}: unknown temporal relation cannot be confirmed; use author_verification_needed`,
      );
    }
    if (finding.confidence === "insufficient") {
      errors.push(`${prefix}: confirmed_contradiction cannot use insufficient confidence`);
    }
    if (finding.conflicting_canon_status === "superseded") {
      errors.push(`${prefix}: cannot confirm a contradiction against superseded canon`);
    }
    if (finding.conflicting_canon_fact_id && !finding.conflicting_source) {
      errors.push(`${prefix}: conflicting canon fact referenced without provenance`);
    }
    if (finding.conflicting_canon_fact_id && (finding.conflicting_evidence?.length ?? 0) === 0) {
      errors.push(`${prefix}: conflicting canon fact referenced without conflicting evidence`);
    }
    if (isPriorCanonFinding(finding)) {
      if (!hasPriorCanonLocator(finding)) {
        errors.push(`${prefix}: prior-canon locator is required for a confirmed contradiction`);
      }
      if (!hasPriorCanonSourceIdentity(finding)) {
        errors.push(`${prefix}: prior-canon source identity is required for a confirmed contradiction`);
      }
      if (!finding.conflicting_source) {
        errors.push(`${prefix}: conflicting canon fact referenced without provenance`);
      }
    }
  }
}

function validateCanonDelta(
  delta: ArchivistCanonDelta,
  index: number,
  ambiguities: ArchivistEntityAmbiguity[],
  errors: string[],
): void {
  const prefix = `canon_delta[${index}]`;
  pushIf(!delta.id?.trim(), errors, `${prefix}: id is required`);
  if (!isArchivistFactType(String(delta.fact_type))) {
    errors.push(`${prefix}: unsupported fact type "${String(delta.fact_type)}"`);
  }
  if (!isArchivistConfidence(String(delta.confidence))) {
    errors.push(`${prefix}: unsupported confidence "${String(delta.confidence)}"`);
  }
  if (!isArchivistAuthority(String(delta.proposed_authority))) {
    errors.push(`${prefix}: unsupported proposed_authority "${String(delta.proposed_authority)}"`);
  } else if (!isModelProposableAuthority(delta.proposed_authority)) {
    errors.push(
      `${prefix}: model output may not propose authority "${delta.proposed_authority}"`,
    );
  }
  if (delta.status !== "candidate") {
    errors.push(`${prefix}: canon_delta status must be candidate; accepted facts cannot be emitted`);
  }
  if (Object.keys(delta.proposed_fact_value ?? {}).length === 0) {
    errors.push(`${prefix}: proposed_fact_value is required`);
  }
  pushIf(!delta.entity?.alias?.trim(), errors, `${prefix}: entity alias is required`);
  pushIf(
    !delta.source_location?.locator?.trim(),
    errors,
    `${prefix}: source_location.locator is required`,
  );

  if (delta.entity.resolution === "resolved" && !delta.entity.entity_id?.trim()) {
    errors.push(
      `${prefix}: resolved entity requires a StoryDNA entity_id after deterministic resolution`,
    );
  }
  if (
    (delta.entity.resolution === "ambiguous" || delta.entity.resolution === "unresolved") &&
    delta.entity.entity_id
  ) {
    errors.push(`${prefix}: ambiguous entity must not silently resolve to entity_id`);
  }
  if (delta.entity.resolution === "ambiguous" && (delta.entity.candidates?.length ?? 0) < 2) {
    errors.push(`${prefix}: ambiguous entity requires at least two candidates`);
  }

  const alias = delta.entity.alias.trim().toLowerCase();
  const matchingAmbiguity = ambiguities.find((item) => item.alias.trim().toLowerCase() === alias);
  if (matchingAmbiguity && delta.entity.resolution === "resolved") {
    errors.push(`${prefix}: silent resolution of ambiguous alias "${delta.entity.alias}"`);
  }

  if (delta.inferred && delta.proposed_authority === "current_observation") {
    errors.push(`${prefix}: inferred candidates cannot use current_observation authority`);
  }
  if (delta.inferred && delta.confidence === "high") {
    errors.push(`${prefix}: inferred candidates cannot claim high confidence`);
  }
  if (delta.proposed_authority === "uncertain_observation" && delta.confidence === "high") {
    errors.push(`${prefix}: uncertain_observation cannot claim high confidence`);
  }

  for (const [i, record] of (delta.evidence ?? []).entries()) {
    validateEvidenceRecord(record, `${prefix}.evidence[${i}]`, errors);
  }
}

function validateAmbiguity(item: ArchivistEntityAmbiguity, index: number, errors: string[]): void {
  const prefix = `entity_ambiguities[${index}]`;
  pushIf(!item.id?.trim(), errors, `${prefix}: id is required`);
  pushIf(!item.alias?.trim(), errors, `${prefix}: alias is required`);
  if ((item.candidate_entities?.length ?? 0) < 2) {
    errors.push(`${prefix}: ambiguous alias requires at least two candidate entities`);
  }
  pushIf(
    !item.recommended_author_verification?.trim(),
    errors,
    `${prefix}: recommended_author_verification is required`,
  );
  if (!isArchivistConfidence(String(item.confidence))) {
    errors.push(`${prefix}: unsupported confidence`);
  }
}

function countEvidence(review: ArchivistReview): number {
  const findingEvidence = review.findings.reduce(
    (sum, finding) =>
      sum + (finding.current_evidence?.length ?? 0) + (finding.conflicting_evidence?.length ?? 0),
    0,
  );
  const deltaEvidence = review.canon_delta.reduce(
    (sum, delta) => sum + (delta.evidence?.length ?? 0),
    0,
  );
  const ambiguityEvidence = review.entity_ambiguities.reduce(
    (sum, item) =>
      sum +
      item.candidate_entities.reduce((inner, candidate) => inner + (candidate.evidence?.length ?? 0), 0),
    0,
  );
  return findingEvidence + deltaEvidence + ambiguityEvidence;
}

export function validateArchivistReview(
  review: ArchivistReview,
  options?: ValidateArchivistReviewOptions,
): ArchivistValidationResult {
  const errors: string[] = [];

  if (review.schema !== ARCHIVIST_REVIEW_SCHEMA) {
    errors.push(`Invalid schema: ${String(review.schema)}`);
  }
  if (review.expert_key !== ARCHIVIST_EXPERT_KEY) {
    errors.push(`Invalid expert_key: ${String(review.expert_key)}`);
  }
  if (review.expert_version !== ARCHIVIST_VERSION) {
    errors.push(`Invalid expert_version: ${String(review.expert_version)}`);
  }
  pushIf(!review.manuscript_id?.trim(), errors, "manuscript_id is required");
  pushIf(!review.manuscript_version_id?.trim(), errors, "manuscript_version_id is required");
  if (!CONTENT_HASH_PATTERN.test(review.content_hash ?? "")) {
    errors.push("content_hash must be a 64-character lowercase hex sha256");
  }
  if (review.author_challenge_supported !== true) {
    errors.push("author_challenge_supported must be true");
  }
  if (review.generation?.provider !== "none" || review.generation?.model !== "none") {
    errors.push("draft Archivist generation provider/model must be none");
  }
  if (
    options?.expectedDefinitionHash &&
    review.generation?.definition_hash !== options.expectedDefinitionHash
  ) {
    errors.push("generation.definition_hash does not match expected runtime definition hash");
  }
  if (LETTER_GRADE_PATTERN.test(review.summary?.narrative ?? "")) {
    errors.push("letter grades are not permitted in summary");
  }

  for (const [index, finding] of review.findings.entries()) {
    validateFinding(finding, index, errors, options);
  }
  for (const [index, delta] of review.canon_delta.entries()) {
    validateCanonDelta(delta, index, review.entity_ambiguities, errors);
  }
  for (const [index, item] of review.entity_ambiguities.entries()) {
    validateAmbiguity(item, index, errors);
  }

  const confirmed = review.findings.filter((finding) => finding.classification === "confirmed_contradiction");
  const possible = review.findings.filter(
    (finding) => finding.classification === "possible_continuity_conflict",
  );
  const verification = review.findings.filter(
    (finding) => finding.classification === "author_verification_needed",
  );

  pushIf(
    review.metrics.finding_count !== review.findings.length,
    errors,
    "metrics.finding_count does not match findings",
  );
  pushIf(
    review.metrics.confirmed_contradiction_count !== confirmed.length,
    errors,
    "metrics.confirmed_contradiction_count does not match findings",
  );
  pushIf(
    review.metrics.possible_conflict_count !== possible.length,
    errors,
    "metrics.possible_conflict_count does not match findings",
  );
  pushIf(
    review.metrics.author_verification_count !== verification.length,
    errors,
    "metrics.author_verification_count does not match findings",
  );
  pushIf(
    review.metrics.canon_delta_count !== review.canon_delta.length,
    errors,
    "metrics.canon_delta_count does not match canon_delta",
  );
  pushIf(
    review.metrics.entity_ambiguity_count !== review.entity_ambiguities.length,
    errors,
    "metrics.entity_ambiguity_count does not match entity_ambiguities",
  );
  pushIf(
    review.metrics.evidence_record_count !== countEvidence(review),
    errors,
    "metrics.evidence_record_count does not match evidence records",
  );
  pushIf(
    review.summary.confirmed_contradiction_count !== confirmed.length,
    errors,
    "summary.confirmed_contradiction_count does not match findings",
  );

  return { ok: errors.length === 0, errors };
}
