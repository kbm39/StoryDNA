/**
 * Static production import map for expert runtime modules (P2-21).
 *
 * Every module ID advertised by a validated ExpertRuntimeDefinition must appear
 * here. No runtime discovery or arbitrary dynamic import strings.
 */

/** Approved module namespace importers keyed by exact runtime moduleId. */
export const EXPERT_MODULE_IMPORTERS = {
  "@/experts/military-expert/definition": () => import("@/experts/military-expert/definition.ts"),
  "@/experts/military-expert/generation-contract": () => import("@/experts/military-expert/generation-contract.ts"),
  "@/experts/military-expert/normalization": () => import("@/experts/military-expert/normalization.ts"),
  "@/experts/military-expert/parsing": () => import("@/experts/military-expert/parsing.ts"),
  "@/experts/military-expert/prompts": () => import("@/experts/military-expert/prompts.ts"),
  "@/experts/military-expert/repair-classification": () => import("@/experts/military-expert/repair-classification.ts"),
  "@/experts/military-expert/validation": () => import("@/experts/military-expert/validation.ts"),
  "@/lib/ai/anthropic": () => import("@/lib/ai/anthropic.ts"),
  "@/lib/ai/review-engine": () => import("@/lib/ai/review-engine.ts"),
  "@/lib/canonical-review-input": () => import("@/lib/canonical-review-input.ts"),
  "@/lib/commercial-fiction-rubric": () => import("@/lib/commercial-fiction-rubric.ts"),
  "@/lib/commercial-review-generation": () => import("@/lib/commercial-review-generation.ts"),
  "@/lib/commercial-review-repair": () => import("@/lib/commercial-review-repair.ts"),
  "@/lib/contrary-evidence/post-scoring-validation": () =>
    import("@/lib/contrary-evidence/post-scoring-validation.ts"),
  "@/lib/editorial-generation/replacement-payload": () =>
    import("@/lib/editorial-generation/replacement-payload.ts"),
  "@/lib/literary-agent-docx": () => import("@/lib/literary-agent-docx.ts"),
} as const;

export type ExpertModuleImportMapKey = keyof typeof EXPERT_MODULE_IMPORTERS;

/** Deterministic sorted list of approved module IDs in the static import map. */
export function approvedExpertModuleIds(): readonly ExpertModuleImportMapKey[] {
  return (Object.keys(EXPERT_MODULE_IMPORTERS) as ExpertModuleImportMapKey[]).sort();
}
