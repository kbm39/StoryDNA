/**
 * Literary Agent replay artifact contract (P2-24).
 *
 * Typed bundle for captured certified model outputs and deterministic metadata.
 * No provider credentials, secrets, or production DB identifiers required for tests.
 */

import type { GenerationMeta } from "@/lib/ai/shared.ts";
import type { ComparisonMode, ConcernAssessment, ScoringGateResult } from "@/lib/contrary-evidence/types.ts";
import type { NormalizeRubricResult } from "@/lib/contrary-evidence/normalize-rubric-against-gate.ts";
import type { ReviewMeta } from "@/lib/types.ts";
import { LITERARY_AGENT_EXPERT_VERSION } from "@/experts/literary-agent/runtime-definition.ts";

export const LITERARY_AGENT_REPLAY_ARTIFACT_SCHEMA_VERSION = "p2-24.v1" as const;

export const SUPPORTED_REPLAY_ARTIFACT_SCHEMA_VERSIONS = new Set<string>([
  LITERARY_AGENT_REPLAY_ARTIFACT_SCHEMA_VERSION,
]);

export const LITERARY_AGENT_REPLAY_EXPERT_KEY = "literary_agent" as const;

export const LITERARY_AGENT_REPLAY_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b" as const;

export type LiteraryAgentReplaySourceType =
  | "synthetic"
  | "local_capture"
  | "certified_export";

export type LiteraryAgentReplayRedactionStatus =
  | "fully_synthetic"
  | "sanitized_local"
  | "unspecified";

export interface LiteraryAgentCapturedModelOutput {
  rawContent: string;
  generationMeta: GenerationMeta;
}

export interface LiteraryAgentReplayManuscriptMetadata {
  manuscriptId: string;
  characterCount?: number | null;
  sentChars?: number | null;
  passageVerificationText?: string;
}

export interface LiteraryAgentReplayValidationMetadata {
  extractedText: string;
  storedWordCount: number | null;
  contentHash?: string | null;
  reviewMeta?: ReviewMeta | null;
  preGateAssessments?: readonly ConcernAssessment[];
  preScoringGate?: ScoringGateResult;
  gateRequired?: boolean;
  gateRan?: boolean;
  priorReviewId?: string | null;
  comparison_mode?: ComparisonMode;
  normalizationResult?: NormalizeRubricResult;
}

export const LITERARY_AGENT_REVIEW_INTENTS = [
  "fresh_review",
  "revision_comparison",
  "same_version_reassessment",
] as const;

export type LiteraryAgentReviewIntent = (typeof LITERARY_AGENT_REVIEW_INTENTS)[number];

export const REPLAY_COMPARISON_PROJECTION_GROUPS = [
  "outcome",
  "categories",
  "contrary_evidence",
  "editorial_issues",
  "revision_candidates",
  "normalization",
] as const;

export type ReplayComparisonProjectionGroup = (typeof REPLAY_COMPARISON_PROJECTION_GROUPS)[number];

/**
 * Fields intentionally excluded from replay comparison projection.
 * Each entry is justified — no broad recursive name-based deletion is used.
 */
export const REPLAY_COMPARISON_EXPLICITLY_IGNORED_FIELDS = [
  { field: "database_ids", reason: "Generated at publish time; not deterministic across replay runs." },
  { field: "timestamps", reason: "Captured-at and server execution timestamps vary by run." },
  { field: "provider_request_ids", reason: "Provider metadata is nondeterministic and not part of certified structure." },
  { field: "server_execution_metadata", reason: "Runtime correlation and workflow IDs are replay-local." },
  { field: "docx_binary", reason: "Binary document output is out of replay scope." },
  { field: "transient_ui_state", reason: "UI-only presentation state is not part of certified review structure." },
  { field: "full_manuscript_text", reason: "Compared only via manuscript hash and canonical word count." },
  { field: "full_memo_text", reason: "Memo prose excluded; recommendation extracted deterministically." },
  { field: "full_prompt_text", reason: "Prompts are not replayed." },
  { field: "unrestricted_replacement_text", reason: "Replacement prose compared via SHA-256 hashes only." },
] as const;

export interface ReplayOutcomeProjection {
  manuscript_score: number;
  manuscript_letter_grade: string | null;
  craft_score: number;
  acquisition_readiness_score: number;
  recommendation: string;
  grading_formula_version: string;
  canonical_word_count: number;
  grade_status: string;
  review_reliability_status: string;
}

export interface ReplayCategoryProjection {
  category_key: string;
  points_earned: number;
  maximum_points: number;
  deduction: number;
  weighted_contribution: number;
  normalized_score: number;
  confidence: string;
  deduction_total: number;
  has_positive_evidence: boolean;
  strength_count: number;
  deduction_reason_hashes: readonly string[];
  example_hashes: readonly string[];
}

export interface ReplayContraryEvidenceProjection {
  concern_id: string;
  rubric_category: string | null;
  status: string;
  confidence: string;
  points_invalidated: number;
  duplicate_points_removed: number;
  overbreadth_points_removed: number;
  remaining_deduction: number;
  accepted_final_deduction: number;
  prior_deduction: number;
  duplicate_status: boolean;
  overbreadth_status: boolean;
  invalidation_status: boolean;
  narrowed_finding_hash: string | null;
}

export interface ReplayEditorialIssueProjection {
  issue_key: string;
  category: string | null;
  title_hash: string;
  severity: string;
  status: string;
  deduction_amount: number;
  source_section: string | null;
  success_criterion_hash: string | null;
  candidate_count: number;
  recommended_action_hash: string | null;
}

export interface ReplayRevisionCandidateProjection {
  candidate_key: string;
  linked_issue_key: string;
  operation: string;
  location: string | null;
  reason_hash: string | null;
  status: string;
  replacement_text_hash: string;
  original_text_hash: string;
  order: number;
  confidence: number;
}

export interface ReplayNormalizationProjection {
  issue_count: number;
  candidate_count: number;
  points_invalidated: number;
  duplicate_points_removed: number;
  overbreadth_points_removed: number;
  restored_points_total: number;
  duplicate_deduction_count: number;
  blocked_stale_deduction_count: number;
  overbroad_deductions_narrowed: number;
  raw_model_score: number;
}

/** Sanitized expected certified result — compared via replay projection only. */
export interface LiteraryAgentExpectedCertifiedResult {
  outcome: ReplayOutcomeProjection;
  categories: Record<string, ReplayCategoryProjection>;
  contrary_evidence: Record<string, ReplayContraryEvidenceProjection>;
  editorial_issues: Record<string, ReplayEditorialIssueProjection>;
  revision_candidates: Record<string, ReplayRevisionCandidateProjection>;
  normalization: ReplayNormalizationProjection;
}

export interface LiteraryAgentReplayArtifactBundle {
  artifactSchemaVersion: string;
  expertKey: string;
  expertVersion: string;
  definitionHash: string;
  manuscriptVersionId: string;
  canonicalWordCount: number;
  manuscriptMetadata: LiteraryAgentReplayManuscriptMetadata;
  manuscriptHash: string;
  reviewIntent: LiteraryAgentReviewIntent;
  certifiedPipelineVersion: string;
  capturedMemoOutput: LiteraryAgentCapturedModelOutput;
  capturedRubricOutput: LiteraryAgentCapturedModelOutput;
  capturedRevisionCandidateOutput: LiteraryAgentCapturedModelOutput;
  capturedValidationMetadata: LiteraryAgentReplayValidationMetadata;
  expectedCertifiedResult: LiteraryAgentExpectedCertifiedResult;
  capturedAt: string;
  sourceType: LiteraryAgentReplaySourceType;
  redactionStatus: LiteraryAgentReplayRedactionStatus;
}

export type ReplayArtifactValidationCode =
  | "invalid_artifact_bundle"
  | "version_mismatch"
  | "definition_hash_mismatch"
  | "unsupported_artifact_schema"
  | "required_artifact_missing";

export interface ReplayArtifactValidationFailure {
  ok: false;
  code: ReplayArtifactValidationCode;
  message: string;
  field?: string;
}

export interface ReplayArtifactValidationSuccess {
  ok: true;
  bundle: LiteraryAgentReplayArtifactBundle;
}

export type ReplayArtifactValidationResult =
  | ReplayArtifactValidationSuccess
  | ReplayArtifactValidationFailure;

const SECRET_FIELD_PATTERN =
  /^(api[_-]?key|secret|password|authorization|credential|private[_-]?key|access[_-]?token|refresh[_-]?token)$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasSecretLikeFields(value: unknown, path = "$"): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (/^sk-[a-zA-Z0-9]{10,}/.test(value)) return path;
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const nested = hasSecretLikeFields(value[index], `${path}[${index}]`);
      if (nested) return nested;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_FIELD_PATTERN.test(key)) return `${path}.${key}`;
    const childPath = hasSecretLikeFields(nested, `${path}.${key}`);
    if (childPath) return childPath;
  }
  return null;
}

function requireNonEmptyString(
  value: unknown,
  field: string,
): { ok: true; value: string } | ReplayArtifactValidationFailure {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: `Required artifact field missing or empty: ${field}`,
      field,
    };
  }
  return { ok: true, value: value.trim() };
}

function requireCapturedOutput(
  value: unknown,
  field: string,
): { ok: true; value: LiteraryAgentCapturedModelOutput } | ReplayArtifactValidationFailure {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: `Required captured output missing: ${field}`,
      field,
    };
  }
  const raw = requireNonEmptyString(value.rawContent, `${field}.rawContent`);
  if (!raw.ok) return raw;
  if (!isPlainObject(value.generationMeta)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: `Required generation metadata missing: ${field}.generationMeta`,
      field: `${field}.generationMeta`,
    };
  }
  return {
    ok: true,
    value: {
      rawContent: raw.value,
      generationMeta: value.generationMeta as unknown as GenerationMeta,
    },
  };
}

function requireFiniteNumber(
  value: unknown,
  field: string,
): { ok: true; value: number } | ReplayArtifactValidationFailure {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: `${field} must be a finite number`,
      field,
    };
  }
  return { ok: true, value };
}

function requirePlainObjectField(
  value: unknown,
  field: string,
): { ok: true; value: Record<string, unknown> } | ReplayArtifactValidationFailure {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: `Required artifact field missing: ${field}`,
      field,
    };
  }
  return { ok: true, value };
}

function requireReviewIntent(
  value: unknown,
): { ok: true; value: LiteraryAgentReviewIntent } | ReplayArtifactValidationFailure {
  const intent = requireNonEmptyString(value, "reviewIntent");
  if (!intent.ok) return intent;
  if (!LITERARY_AGENT_REVIEW_INTENTS.includes(intent.value as LiteraryAgentReviewIntent)) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: `Unsupported reviewIntent: ${intent.value}`,
      field: "reviewIntent",
    };
  }
  return { ok: true, value: intent.value as LiteraryAgentReviewIntent };
}

function requireExpectedResult(
  value: unknown,
): { ok: true; value: LiteraryAgentExpectedCertifiedResult } | ReplayArtifactValidationFailure {
  const root = requirePlainObjectField(value, "expectedCertifiedResult");
  if (!root.ok) return root;

  for (const group of REPLAY_COMPARISON_PROJECTION_GROUPS) {
    if (!(group in root.value)) {
      return {
        ok: false,
        code: "required_artifact_missing",
        message: `expectedCertifiedResult.${group} is required`,
        field: `expectedCertifiedResult.${group}`,
      };
    }
  }

  const outcomeObj = requirePlainObjectField(root.value.outcome, "expectedCertifiedResult.outcome");
  if (!outcomeObj.ok) return outcomeObj;
  const outcomeNumericFields = [
    "manuscript_score",
    "craft_score",
    "acquisition_readiness_score",
    "canonical_word_count",
  ] as const;
  for (const field of outcomeNumericFields) {
    const numeric = requireFiniteNumber(outcomeObj.value[field], `expectedCertifiedResult.outcome.${field}`);
    if (!numeric.ok) return numeric;
  }
  const recommendation = requireNonEmptyString(
    outcomeObj.value.recommendation,
    "expectedCertifiedResult.outcome.recommendation",
  );
  if (!recommendation.ok) return recommendation;
  const gradeStatus = requireNonEmptyString(
    outcomeObj.value.grade_status,
    "expectedCertifiedResult.outcome.grade_status",
  );
  if (!gradeStatus.ok) return gradeStatus;
  const reliabilityStatus = requireNonEmptyString(
    outcomeObj.value.review_reliability_status,
    "expectedCertifiedResult.outcome.review_reliability_status",
  );
  if (!reliabilityStatus.ok) return reliabilityStatus;
  const grade = outcomeObj.value.manuscript_letter_grade;
  if (grade !== null && typeof grade !== "string") {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "expectedCertifiedResult.outcome.manuscript_letter_grade must be string or null",
      field: "expectedCertifiedResult.outcome.manuscript_letter_grade",
    };
  }
  const formula = requireNonEmptyString(
    outcomeObj.value.grading_formula_version,
    "expectedCertifiedResult.outcome.grading_formula_version",
  );
  if (!formula.ok) return formula;

  const categories = requirePlainObjectField(root.value.categories, "expectedCertifiedResult.categories");
  if (!categories.ok) return categories;
  const contraryEvidence = requirePlainObjectField(
    root.value.contrary_evidence,
    "expectedCertifiedResult.contrary_evidence",
  );
  if (!contraryEvidence.ok) return contraryEvidence;
  const editorialIssues = requirePlainObjectField(
    root.value.editorial_issues,
    "expectedCertifiedResult.editorial_issues",
  );
  if (!editorialIssues.ok) return editorialIssues;
  const revisionCandidates = requirePlainObjectField(
    root.value.revision_candidates,
    "expectedCertifiedResult.revision_candidates",
  );
  if (!revisionCandidates.ok) return revisionCandidates;
  const normalizationObj = requirePlainObjectField(
    root.value.normalization,
    "expectedCertifiedResult.normalization",
  );
  if (!normalizationObj.ok) return normalizationObj;
  const normalizationNumericFields = [
    "issue_count",
    "candidate_count",
    "points_invalidated",
    "duplicate_points_removed",
    "overbreadth_points_removed",
    "restored_points_total",
    "duplicate_deduction_count",
    "blocked_stale_deduction_count",
    "overbroad_deductions_narrowed",
    "raw_model_score",
  ] as const;
  for (const field of normalizationNumericFields) {
    const numeric = requireFiniteNumber(
      normalizationObj.value[field],
      `expectedCertifiedResult.normalization.${field}`,
    );
    if (!numeric.ok) return numeric;
  }

  return {
    ok: true,
    value: root.value as unknown as LiteraryAgentExpectedCertifiedResult,
  };
}

/** Fail closed when a replay comparison projection omits required structural groups. */
export function assertReplayComparisonProjectionComplete(
  projection: LiteraryAgentExpectedCertifiedResult,
): void {
  for (const group of REPLAY_COMPARISON_PROJECTION_GROUPS) {
    if (!(group in projection)) {
      throw new Error(`Replay comparison projection missing required group: ${group}`);
    }
  }
  if (Object.keys(projection.categories).length === 0) {
    throw new Error("Replay comparison projection requires at least one category");
  }
  if (Object.keys(projection.editorial_issues).length === 0) {
    throw new Error("Replay comparison projection requires at least one editorial issue");
  }
  if (Object.keys(projection.revision_candidates).length === 0) {
    throw new Error("Replay comparison projection requires at least one revision candidate");
  }
  if (!projection.outcome.recommendation) {
    throw new Error("Replay comparison projection requires outcome.recommendation");
  }
}

/** Validate and normalize a replay artifact bundle. Does not mutate input. */
export function validateLiteraryAgentReplayArtifactBundle(
  input: unknown,
): ReplayArtifactValidationResult {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "Artifact bundle must be a plain object",
    };
  }

  const secretPath = hasSecretLikeFields(input);
  if (secretPath) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: `Artifact bundle contains prohibited secret-like field at ${secretPath}`,
      field: secretPath,
    };
  }

  const schemaVersion = requireNonEmptyString(input.artifactSchemaVersion, "artifactSchemaVersion");
  if (!schemaVersion.ok) return schemaVersion;
  if (!SUPPORTED_REPLAY_ARTIFACT_SCHEMA_VERSIONS.has(schemaVersion.value)) {
    return {
      ok: false,
      code: "unsupported_artifact_schema",
      message: `Unsupported artifact schema version: ${schemaVersion.value}`,
      field: "artifactSchemaVersion",
    };
  }

  const expertKey = requireNonEmptyString(input.expertKey, "expertKey");
  if (!expertKey.ok) return expertKey;
  if (expertKey.value !== LITERARY_AGENT_REPLAY_EXPERT_KEY) {
    return {
      ok: false,
      code: "version_mismatch",
      message: `Unsupported expert_key: ${expertKey.value}`,
      field: "expertKey",
    };
  }

  const expertVersion = requireNonEmptyString(input.expertVersion, "expertVersion");
  if (!expertVersion.ok) return expertVersion;
  if (expertVersion.value !== LITERARY_AGENT_EXPERT_VERSION) {
    return {
      ok: false,
      code: "version_mismatch",
      message: `Unsupported expert_version: ${expertVersion.value}`,
      field: "expertVersion",
    };
  }

  const definitionHash = requireNonEmptyString(input.definitionHash, "definitionHash");
  if (!definitionHash.ok) return definitionHash;
  if (definitionHash.value.toLowerCase() !== LITERARY_AGENT_REPLAY_DEFINITION_HASH) {
    return {
      ok: false,
      code: "definition_hash_mismatch",
      message: `Unsupported definition_hash: ${definitionHash.value}`,
      field: "definitionHash",
    };
  }

  const manuscriptVersionId = requireNonEmptyString(input.manuscriptVersionId, "manuscriptVersionId");
  if (!manuscriptVersionId.ok) return manuscriptVersionId;

  if (typeof input.canonicalWordCount !== "number" || !Number.isFinite(input.canonicalWordCount)) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "canonicalWordCount must be a finite number",
      field: "canonicalWordCount",
    };
  }
  if (input.canonicalWordCount <= 0) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "canonicalWordCount must be positive",
      field: "canonicalWordCount",
    };
  }

  const manuscriptHash = requireNonEmptyString(input.manuscriptHash, "manuscriptHash");
  if (!manuscriptHash.ok) return manuscriptHash;

  const certifiedPipelineVersion = requireNonEmptyString(
    input.certifiedPipelineVersion,
    "certifiedPipelineVersion",
  );
  if (!certifiedPipelineVersion.ok) return certifiedPipelineVersion;

  const capturedAt = requireNonEmptyString(input.capturedAt, "capturedAt");
  if (!capturedAt.ok) return capturedAt;

  const sourceType = requireNonEmptyString(input.sourceType, "sourceType");
  if (!sourceType.ok) return sourceType;

  const redactionStatus = requireNonEmptyString(input.redactionStatus, "redactionStatus");
  if (!redactionStatus.ok) return redactionStatus;

  if (!isPlainObject(input.manuscriptMetadata)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: "Required artifact field missing: manuscriptMetadata",
      field: "manuscriptMetadata",
    };
  }
  const manuscriptId = requireNonEmptyString(input.manuscriptMetadata.manuscriptId, "manuscriptMetadata.manuscriptId");
  if (!manuscriptId.ok) return manuscriptId;

  if (!isPlainObject(input.capturedValidationMetadata)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: "Required artifact field missing: capturedValidationMetadata",
      field: "capturedValidationMetadata",
    };
  }
  const extractedText = requireNonEmptyString(
    input.capturedValidationMetadata.extractedText,
    "capturedValidationMetadata.extractedText",
  );
  if (!extractedText.ok) return extractedText;

  const memoOutput = requireCapturedOutput(input.capturedMemoOutput, "capturedMemoOutput");
  if (!memoOutput.ok) return memoOutput;

  const rubricOutput = requireCapturedOutput(input.capturedRubricOutput, "capturedRubricOutput");
  if (!rubricOutput.ok) return rubricOutput;

  const revisionOutput = requireCapturedOutput(
    input.capturedRevisionCandidateOutput,
    "capturedRevisionCandidateOutput",
  );
  if (!revisionOutput.ok) return revisionOutput;

  const reviewIntent = requireReviewIntent(input.reviewIntent);
  if (!reviewIntent.ok) return reviewIntent;

  const expected = requireExpectedResult(input.expectedCertifiedResult);
  if (!expected.ok) return expected;

  const comparisonMode = input.capturedValidationMetadata?.comparison_mode;
  if (
    comparisonMode === "SAME_VERSION_REASSESSMENT" &&
    reviewIntent.value !== "same_version_reassessment"
  ) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "reviewIntent must be same_version_reassessment when comparison_mode is SAME_VERSION_REASSESSMENT",
      field: "reviewIntent",
    };
  }
  if (
    comparisonMode === "REVISION_COMPARISON" &&
    reviewIntent.value === "same_version_reassessment"
  ) {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "reviewIntent same_version_reassessment is incompatible with REVISION_COMPARISON mode",
      field: "reviewIntent",
    };
  }

  const bundle: LiteraryAgentReplayArtifactBundle = {
    artifactSchemaVersion: schemaVersion.value,
    expertKey: expertKey.value,
    expertVersion: expertVersion.value,
    definitionHash: definitionHash.value,
    manuscriptVersionId: manuscriptVersionId.value,
    canonicalWordCount: input.canonicalWordCount,
    manuscriptMetadata: {
      manuscriptId: manuscriptId.value,
      characterCount:
        typeof input.manuscriptMetadata.characterCount === "number"
          ? input.manuscriptMetadata.characterCount
          : null,
      sentChars:
        typeof input.manuscriptMetadata.sentChars === "number"
          ? input.manuscriptMetadata.sentChars
          : null,
      passageVerificationText:
        typeof input.manuscriptMetadata.passageVerificationText === "string"
          ? input.manuscriptMetadata.passageVerificationText
          : undefined,
    },
    manuscriptHash: manuscriptHash.value,
    reviewIntent: reviewIntent.value,
    certifiedPipelineVersion: certifiedPipelineVersion.value,
    capturedMemoOutput: memoOutput.value,
    capturedRubricOutput: rubricOutput.value,
    capturedRevisionCandidateOutput: revisionOutput.value,
    capturedValidationMetadata: {
      extractedText: extractedText.value,
      storedWordCount:
        typeof input.capturedValidationMetadata.storedWordCount === "number"
          ? input.capturedValidationMetadata.storedWordCount
          : null,
      contentHash:
        typeof input.capturedValidationMetadata.contentHash === "string"
          ? input.capturedValidationMetadata.contentHash
          : null,
      reviewMeta: (input.capturedValidationMetadata.reviewMeta as ReviewMeta | null | undefined) ?? null,
      preGateAssessments: Array.isArray(input.capturedValidationMetadata.preGateAssessments)
        ? (input.capturedValidationMetadata.preGateAssessments as ConcernAssessment[])
        : [],
      preScoringGate: isPlainObject(input.capturedValidationMetadata.preScoringGate)
        ? (input.capturedValidationMetadata.preScoringGate as unknown as ScoringGateResult)
        : {
            valid: true,
            errors: [],
            assessments: [],
            adjusted_deductions: [],
            total_points_restored: 0,
          },
      gateRequired: Boolean(input.capturedValidationMetadata.gateRequired),
      gateRan: Boolean(input.capturedValidationMetadata.gateRan),
      priorReviewId:
        typeof input.capturedValidationMetadata.priorReviewId === "string"
          ? input.capturedValidationMetadata.priorReviewId
          : null,
      comparison_mode: input.capturedValidationMetadata.comparison_mode as ComparisonMode | undefined,
      normalizationResult: input.capturedValidationMetadata.normalizationResult as
        | NormalizeRubricResult
        | undefined,
    },
    expectedCertifiedResult: expected.value,
    capturedAt: capturedAt.value,
    sourceType: sourceType.value as LiteraryAgentReplaySourceType,
    redactionStatus: redactionStatus.value as LiteraryAgentReplayRedactionStatus,
  };

  return { ok: true, bundle };
}

/** Unknown top-level fields are ignored — replay behavior is driven only by the contract. */
export function artifactBundleIgnoresUnknownFields(): true {
  return true;
}
