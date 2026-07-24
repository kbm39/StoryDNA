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

/** Sanitized expected certified result — compared via replay projection only. */
export interface LiteraryAgentExpectedCertifiedResult {
  manuscript_score: number;
  manuscript_letter_grade: string | null;
  craft_score: number;
  acquisition_readiness_score: number;
  issue_count: number;
  candidate_count: number;
  canonical_word_count: number;
  grading_formula_version: string;
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
  reviewIntent?: unknown;
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

function requireExpectedResult(
  value: unknown,
): { ok: true; value: LiteraryAgentExpectedCertifiedResult } | ReplayArtifactValidationFailure {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      code: "required_artifact_missing",
      message: "Required artifact field missing: expectedCertifiedResult",
      field: "expectedCertifiedResult",
    };
  }
  const numericFields = [
    "manuscript_score",
    "craft_score",
    "acquisition_readiness_score",
    "issue_count",
    "candidate_count",
    "canonical_word_count",
  ] as const;
  for (const field of numericFields) {
    if (typeof value[field] !== "number" || !Number.isFinite(value[field])) {
      return {
        ok: false,
        code: "invalid_artifact_bundle",
        message: `expectedCertifiedResult.${field} must be a finite number`,
        field: `expectedCertifiedResult.${field}`,
      };
    }
  }
  const grade = value.manuscript_letter_grade;
  if (grade !== null && typeof grade !== "string") {
    return {
      ok: false,
      code: "invalid_artifact_bundle",
      message: "expectedCertifiedResult.manuscript_letter_grade must be string or null",
      field: "expectedCertifiedResult.manuscript_letter_grade",
    };
  }
  const formula = requireNonEmptyString(value.grading_formula_version, "expectedCertifiedResult.grading_formula_version");
  if (!formula.ok) return formula;
  return {
    ok: true,
    value: {
      manuscript_score: value.manuscript_score as number,
      manuscript_letter_grade: grade as string | null,
      craft_score: value.craft_score as number,
      acquisition_readiness_score: value.acquisition_readiness_score as number,
      issue_count: value.issue_count as number,
      candidate_count: value.candidate_count as number,
      canonical_word_count: value.canonical_word_count as number,
      grading_formula_version: formula.value,
    },
  };
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

  const expected = requireExpectedResult(input.expectedCertifiedResult);
  if (!expected.ok) return expected;

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
    reviewIntent: input.reviewIntent ?? null,
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
