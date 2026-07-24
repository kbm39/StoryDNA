/**
 * Typed invocation contracts for the expert plugin executor (P2-22).
 *
 * Documents the explicit allowlist of deterministic, non-model, non-publishing
 * exports that may be invoked. No fallback execution for unknown exports.
 */

import type { ExpertModuleImportMapKey } from "./module-import-map.ts";

/** Approved invocation kinds for P2-22 deterministic plugin execution. */
export const EXPERT_PLUGIN_INVOCATION_KINDS = [
  "prompt_builder",
  "validator",
  "normalizer",
  "payload_builder",
] as const;

export type ExpertPluginInvocationKind = (typeof EXPERT_PLUGIN_INVOCATION_KINDS)[number];

export interface AllowedPluginExportEntry {
  moduleId: ExpertModuleImportMapKey;
  exportName: string;
  invocationKind: ExpertPluginInvocationKind;
  /** Human-readable classification for diagnostics. */
  classification: "pure_function" | "validation_function" | "prompt_builder" | "normalizer" | "payload_builder";
}

/**
 * Explicit P2-22 invocation allowlist — only these moduleId+exportName pairs may execute.
 *
 * Disallowed (not listed): LITERARY_AGENT (object), repairCommercialMemoValidation (model),
 * buildCommercialRubricGenerationPrompt (rubric generation context), buildLiteraryAgentReviewDocx
 * (file export), provider SDK modules, publishing RPC modules, unknown categories.
 */
export const ALLOWED_PLUGIN_EXPORTS: readonly AllowedPluginExportEntry[] = [
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildSystemPrompt",
    invocationKind: "prompt_builder",
    classification: "prompt_builder",
  },
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildReviewPrompt",
    invocationKind: "prompt_builder",
    classification: "prompt_builder",
  },
  {
    moduleId: "@/lib/ai/review-engine",
    exportName: "buildRevisionCandidatesPrompt",
    invocationKind: "prompt_builder",
    classification: "prompt_builder",
  },
  {
    moduleId: "@/lib/canonical-review-input",
    exportName: "buildCanonicalReviewInput",
    invocationKind: "validator",
    classification: "validation_function",
  },
  {
    moduleId: "@/lib/commercial-review-generation",
    exportName: "validateMemoBeforeRubric",
    invocationKind: "validator",
    classification: "validation_function",
  },
  {
    moduleId: "@/lib/contrary-evidence/post-scoring-validation",
    exportName: "validatePostScoringRubric",
    invocationKind: "validator",
    classification: "validation_function",
  },
  {
    moduleId: "@/lib/commercial-review-generation",
    exportName: "validateCombinedCommercialReview",
    invocationKind: "validator",
    classification: "validation_function",
  },
  {
    moduleId: "@/lib/commercial-review-repair",
    exportName: "normalizeCommercialMemoStatistics",
    invocationKind: "normalizer",
    classification: "normalizer",
  },
  {
    moduleId: "@/lib/editorial-generation/replacement-payload",
    exportName: "buildReplacementPayload",
    invocationKind: "payload_builder",
    classification: "payload_builder",
  },
] as const;

/** Export categories explicitly blocked from P2-22 invocation. */
export const DISALLOWED_EXPORT_CATEGORIES = [
  "object_export",
  "repair_model_calling",
  "rubric_generation",
  "review_generation",
  "publication",
  "trigger_function",
  "database_write",
  "docx_file_export",
  "provider_sdk",
  "unknown_category",
] as const;

export type DisallowedExportCategory = (typeof DISALLOWED_EXPORT_CATEGORIES)[number];

/** Keys that must never appear in executor input payloads. */
export const FORBIDDEN_INPUT_KEYS = [
  "anthropicApiKey",
  "apiKey",
  "supabaseClient",
  "triggerClient",
  "publishRpc",
  "workflowId",
  "triggerRunId",
  "realManuscriptBlob",
] as const;

export interface InvocationKindInputContract {
  requiredFields: readonly string[];
  optionalFields: readonly string[];
  forbiddenFields: readonly string[];
  outputExpectation: string;
}

/** Input contract metadata per invocation kind. */
export const INVOCATION_KIND_INPUT_CONTRACTS: Readonly<
  Record<ExpertPluginInvocationKind, InvocationKindInputContract>
> = {
  prompt_builder: {
    requiredFields: ["args"],
    optionalFields: [],
    forbiddenFields: [...FORBIDDEN_INPUT_KEYS],
    outputExpectation: "string prompt text",
  },
  validator: {
    requiredFields: ["args"],
    optionalFields: [],
    forbiddenFields: [...FORBIDDEN_INPUT_KEYS],
    outputExpectation: "validation outcome object with ok boolean",
  },
  normalizer: {
    requiredFields: ["args"],
    optionalFields: [],
    forbiddenFields: [...FORBIDDEN_INPUT_KEYS],
    outputExpectation: "normalization result object",
  },
  payload_builder: {
    requiredFields: ["args"],
    optionalFields: [],
    forbiddenFields: [...FORBIDDEN_INPUT_KEYS],
    outputExpectation: "plain JSON payload object",
  },
};

const allowlistKey = (moduleId: string, exportName: string): string =>
  `${moduleId}::${exportName}`;

const ALLOWLIST_INDEX = new Map<string, AllowedPluginExportEntry>(
  ALLOWED_PLUGIN_EXPORTS.map((entry) => [allowlistKey(entry.moduleId, entry.exportName), entry]),
);

/** Lookup an allowlisted export entry, or null when not permitted. */
export function lookupAllowedPluginExport(
  moduleId: string,
  exportName: string,
): AllowedPluginExportEntry | null {
  return ALLOWLIST_INDEX.get(allowlistKey(moduleId, exportName)) ?? null;
}

export function isExpertPluginInvocationKind(value: string): value is ExpertPluginInvocationKind {
  return (EXPERT_PLUGIN_INVOCATION_KINDS as readonly string[]).includes(value);
}

/** Maximum serialized output size (bytes) for executor metadata safety. */
export const MAX_PLUGIN_OUTPUT_BYTES = 512_000;
