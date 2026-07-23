/**
 * Module-reference metadata for expert_runtime@v1.
 *
 * Export-verified section IDs are defined here and referenced by the collector.
 * Root-level schema coverage is enforced via ExpertRuntimeModuleReferenceFields +
 * RUNTIME_MODULE_REF_ROOT_COLLECTORS (see collect-module-refs.ts).
 */

export type ModuleExportKind = "function" | "object";

/** Export-verified section IDs emitted by the collector for dynamic import tests. */
export const RUNTIME_MODULE_REF_EXPORT_SECTIONS = [
  "prompt_builder.reviewerDefinitionExport",
  "prompt_builder.systemPromptExport",
  "prompt_builder.reviewPromptExport",
  "prompt_builder.revisionCandidatesPromptExport",
  "rubric_definition.export",
  "validation_plugins",
  "repair_plugins",
  "normalization_plugins",
  "passage_verification_policy.payloadBuilder",
  "export_policy.docx",
] as const;

export type RuntimeModuleRefExportSection = (typeof RUNTIME_MODULE_REF_EXPORT_SECTIONS)[number];

/**
 * Module path fields without a named JS export — documented but not export-verified in P2-03.
 * Roots are still required in RUNTIME_MODULE_REF_ROOT_COLLECTORS as module-only handlers.
 */
export const RUNTIME_MODULE_ONLY_FIELD_PATHS = [
  "contrary_evidence_policy.moduleId",
  "revision_candidate_policy.commentExportTypesModuleId",
  "publishing_policy.rpcModuleId",
] as const;
