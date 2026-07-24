/**
 * Shared Expert Review Engine — runtime types (Phase 1).
 *
 * Complements ExpertDefinitionV1 (registry constitution) with execution-oriented
 * metadata. Module references are stable string IDs — never executable code in DB.
 */

import { hashExpertDefinition, isValidDefinitionHash } from "@/lib/expert-registry/definition-hash.ts";
import type { ExpertScoringWeights } from "./scoring-weights.ts";

/** Engine semver — bump when orchestration contract changes. */
export const EXPERT_REVIEW_ENGINE_VERSION = "expert_review_engine@v1.0.0-phase1" as const;

export const EXPERT_RUNTIME_SCHEMA_VERSION = "expert_runtime@v1" as const;

/** Schema version for ReviewRuntimeVersionSet audit metadata (distinct from expert runtime schema). */
export const REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION = "review_runtime_version_set@v1" as const;

/** Stable identifier pattern for version-set string fields (excluding SHA-256 hashes). */
export const VERSION_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_.@-]*$/;

/** Stable capability IDs — never use display names in runtime logic. */
export const EXPERT_CAPABILITIES = [
  "commercial_analysis",
  "developmental_editing",
  "line_editing",
  "copy_editing",
  "proofreading",
  "character_analysis",
  "plot_analysis",
  "pacing_analysis",
  "dialogue_analysis",
  "continuity",
  "timeline",
  "series_canon",
  "police",
  "military",
  "medical",
  "legal",
  "intelligence",
  "organized_crime",
  "psychology",
  "screenplay",
  "production",
  "marketing",
  "publishing",
] as const;

export type ExpertCapability = (typeof EXPERT_CAPABILITIES)[number];

export type ManuscriptScope = "full_manuscript" | "sample" | "chapter_set";
export type SeriesScope = "none" | "optional" | "required";
export type EstimatedRuntimeClass = "short" | "medium" | "long";
export type EstimatedCostClass = "low" | "medium" | "high";

export interface ModuleRef {
  /** Stable module path (e.g. @/lib/ai/review-engine) */
  moduleId: string;
  exportName: string;
}

export interface PluginRef {
  id: string;
  moduleId: string;
  exportName: string;
}

export type ValidationStage =
  | "pre_memo"
  | "post_memo"
  | "post_rubric"
  | "pre_publish";

export interface ValidationPluginRef extends PluginRef {
  stage: ValidationStage;
  failClosed: boolean;
}

export interface RepairPluginRef extends PluginRef {
  stage: "memo" | "prose_grade";
}

export interface NormalizationPluginRef extends PluginRef {
  stage: "memo_stats" | "rubric";
}

export interface GenerationCallSpec {
  id: string;
  role: "memo" | "rubric" | "candidates" | "repair";
}

export interface GenerationProfile {
  id: string;
  calls: GenerationCallSpec[];
}

export interface RubricDefinitionRef {
  kind: "structured_json" | "qualitative" | "none";
  moduleId?: string;
  exportName?: string;
  gradingFormulaVersion?: string;
}

export interface ContraryEvidencePolicy {
  enabled: boolean;
  requiresPriorReview: boolean;
  moduleId?: string;
  gateVersion?: string;
}

export interface RevisionCandidatePolicy {
  minCandidates: number;
  passageVerification: "strict_full_passage" | "none";
  commentExportTypesModuleId?: string;
}

export interface PassageVerificationPolicy {
  algorithm: "manuscript_passage_located";
  payloadBuilderModuleId: string;
  payloadBuilderExport: string;
  failOnUnverifiedPublish: true;
}

export interface PublishingPolicy {
  resultType: string;
  perspective: string;
  rpcModuleId: string;
  rpcName: string;
  authoritative: boolean;
  workflowDefinitionVersion: string;
}

export interface ExportPolicy {
  docxModuleId?: string;
  docxExportName?: string;
  reportSections: string[];
}

export interface OutputSchemaRef {
  reviewContentFormat: "markdown";
  issueSchemaRef: string;
  candidateSchemaRef: string;
}

export interface EditorInChiefRules {
  compatibleExperts: string[];
  escalationExperts: string[];
  prerequisiteExperts: string[];
  duplicateReviewPolicy: "block_same_expert_same_version";
}

/**
 * Top-level runtime schema roots that may carry module path references.
 *
 * Every root here must have a corresponding entry in RUNTIME_MODULE_REF_ROOT_COLLECTORS.
 * Module-only roots are documented there and do not produce export-verified refs.
 */
export interface ExpertRuntimeModuleReferenceFields {
  prompt_builder: {
    reviewerDefinitionModuleId: string;
    reviewerDefinitionExport: string;
    systemPromptExport: string;
    reviewPromptExport: string;
    revisionCandidatesPromptExport: string;
  };

  rubric_definition: RubricDefinitionRef;
  validation_plugins: ValidationPluginRef[];
  repair_plugins: RepairPluginRef[];
  normalization_plugins: NormalizationPluginRef[];

  contrary_evidence_policy: ContraryEvidencePolicy;
  revision_candidate_policy: RevisionCandidatePolicy;
  passage_verification_policy: PassageVerificationPolicy;
  publishing_policy: PublishingPolicy;
  export_policy: ExportPolicy;
}

export interface ExpertRuntimeDefinition extends ExpertRuntimeModuleReferenceFields {
  schema_version: typeof EXPERT_RUNTIME_SCHEMA_VERSION;

  expert_key: string;
  expert_version: string;
  display_name: string;
  department: string;
  role: string;
  purpose: string;
  enabled: boolean;

  capabilities: ExpertCapability[];

  prerequisites: string[];
  trigger_conditions: Array<{
    key: string;
    description: string;
    signal: string;
    match: string;
    weight: number;
  }>;
  priority: { tier: "core" | "standard" | "specialist"; base: number };

  knowledge_domains: Array<{
    name: string;
    authorities: string[];
    keyConcepts: string[];
    commonErrors: string[];
  }>;
  personality: {
    archetype: string;
    traits: string[];
    directness: string;
    warmth: string;
    humor: string;
    voiceNotes: string;
  };

  estimated_runtime: EstimatedRuntimeClass;
  estimated_cost: EstimatedCostClass;

  failure_conditions: Array<{
    key: string;
    condition: string;
    severity: "abort" | "degrade" | "warn";
    disclosure: string;
  }>;

  manuscript_scope: ManuscriptScope;
  series_scope: SeriesScope;

  generation_profile: GenerationProfile;

  scoring_weights: ExpertScoringWeights | null;

  required_context: Array<"storydna" | "prior_review" | "author_intent" | "series_bible">;

  output_schema: OutputSchemaRef;

  next_best_action: string;

  action_item_mapping: {
    issueToActionItem: boolean;
    candidateToActionItem: boolean;
  };

  /** Authoritative Editor-in-Chief routing relationships (compatible, escalation, prerequisites). */
  editor_in_chief_rules: EditorInChiefRules;

  /** Per-component version pins for audit (Phase 1 contract only). */
  runtime_versions: ReviewRuntimeVersionSet;
}

/**
 * Permanent audit record for a review run — persisted in later phases.
 */
export interface ReviewRuntimeVersionSet {
  schema_version: typeof REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION;
  engine_version: string;
  expert_version: string;
  prompt_version: string;
  rubric_version: string;
  validator_version: string;
  repair_version: string;
  normalization_version: string;
  contrary_evidence_version: string;
  passage_verification_version: string;
  publishing_version: string;
  export_version: string;
  constitution_definition_hash: string;
  workflow_definition_version: string;
  definition_hash: string;
}

export const REVIEW_RUNTIME_VERSION_FIELDS: ReadonlyArray<keyof ReviewRuntimeVersionSet> = [
  "schema_version",
  "engine_version",
  "expert_version",
  "prompt_version",
  "rubric_version",
  "validator_version",
  "repair_version",
  "normalization_version",
  "contrary_evidence_version",
  "passage_verification_version",
  "publishing_version",
  "export_version",
  "constitution_definition_hash",
  "workflow_definition_version",
  "definition_hash",
] as const;

function validateVersionIdentifier(field: keyof ReviewRuntimeVersionSet, value: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `Missing or empty ${field}`;
  }
  if (!VERSION_IDENTIFIER_PATTERN.test(value)) {
    return `${field} must be a stable lowercase identifier`;
  }
  return null;
}

export function validateReviewRuntimeVersionSet(
  versions: ReviewRuntimeVersionSet,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (versions.schema_version !== REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION) {
    errors.push(
      `schema_version must be ${REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION}`,
    );
  }

  const workflowVersionError = validateVersionIdentifier(
    "workflow_definition_version",
    versions.workflow_definition_version,
  );
  if (workflowVersionError) errors.push(workflowVersionError);

  for (const field of REVIEW_RUNTIME_VERSION_FIELDS) {
    if (
      field === "schema_version" ||
      field === "definition_hash" ||
      field === "constitution_definition_hash" ||
      field === "workflow_definition_version"
    ) {
      continue;
    }
    const value = versions[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`Missing or empty ${field}`);
    }
  }

  if (!versions.constitution_definition_hash?.trim()) {
    errors.push("Missing or empty constitution_definition_hash");
  } else if (!isValidDefinitionHash(versions.constitution_definition_hash)) {
    errors.push("constitution_definition_hash must be 64-char lowercase hex SHA-256");
  }

  if (!versions.definition_hash?.trim()) {
    errors.push("Missing or empty definition_hash");
  } else if (!isValidDefinitionHash(versions.definition_hash)) {
    errors.push("definition_hash must be 64-char lowercase hex SHA-256");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Hash the serializable runtime definition excluding definition_hash (self-reference). */
export function hashExpertRuntimeDefinition(def: ExpertRuntimeDefinition): string {
  const { definition_hash: _omit, ...versionsWithoutHash } = def.runtime_versions;
  void _omit;
  const body = {
    ...def,
    runtime_versions: versionsWithoutHash,
  };
  return hashExpertDefinition(body);
}

export interface ExpertRuntimeRegistryEntry {
  definition: ExpertRuntimeDefinition;
  definitionHash: string;
  registeredAt: string;
}
