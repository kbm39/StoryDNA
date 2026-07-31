/**
 * Constitutional classification model — Amendment 001.
 */

import type { CapabilityClassification } from "./types.ts";

export type ClassificationDefinition = {
  classification: CapabilityClassification;
  label: string;
  owner: string;
  implementation_location: string;
  experts_affected: string;
  certification_requirement: string;
  migration_requirement: string;
  backward_compatibility_expectation: string;
  default_propagation_behavior: string;
  examples: string[];
};

export const CAPABILITY_CLASSIFICATION_DEFINITIONS: readonly ClassificationDefinition[] =
  Object.freeze([
    {
      classification: "expert_specific",
      label: "Expert-specific",
      owner: "Single certified expert domain",
      implementation_location: "experts/{expert_key}/ or expert-scoped lib modules",
      experts_affected: "One expert only unless amendment expands scope",
      certification_requirement: "Expert benchmark must cover capability in isolation",
      migration_requirement: "None for other experts; contract must not leak into shared layers silently",
      backward_compatibility_expectation: "Other experts unaffected; shared contracts unchanged",
      default_propagation_behavior: "Do not propagate unless review approves expert_family or broader",
      examples: [
        "weapons authenticity",
        "medical dosage analysis",
        "financial transaction tracing",
      ],
    },
    {
      classification: "expert_family",
      label: "Expert family",
      owner: "Shared contract within a related expert class",
      implementation_location:
        "lib/expert-review-engine/ shared contracts or experts/{family}/ shared modules",
      experts_affected: "Related experts in the same operational or evidence family",
      certification_requirement: "Each family member must pass family contract benchmark",
      migration_requirement: "Migrate family members to shared contract with per-expert adapters",
      backward_compatibility_expectation: "Non-family experts remain unchanged",
      default_propagation_behavior: "Propagate to named family; not automatic to all experts",
      examples: [
        "scene inventory for scene-centric experts",
        "medical evidence handling across Combat Medicine and Medical Expert",
        "operational timeline analysis across Military and Intelligence experts",
      ],
    },
    {
      classification: "editorial_board_shared",
      label: "Editorial Board shared",
      owner: "All finding-producing experts via shared finding contract",
      implementation_location:
        "lib/expert-review-engine/, experts/*/output-schema, shared validation plugins",
      experts_affected: "All experts that produce retained findings",
      certification_requirement: "Board-wide acceptance tests before commercial retain",
      migration_requirement: "Retrofit existing experts to shared finding contract",
      backward_compatibility_expectation: "Historical findings preserved; new fields additive when possible",
      default_propagation_behavior: "Expected on all finding-producing experts after certification",
      examples: [
        "manuscript evidence",
        "contrary evidence",
        "confidence",
        "uncertainty notes",
        "burden-of-proof status",
        "provisional findings",
        "immutable provenance",
        "safe recommendations",
      ],
    },
    {
      classification: "editor_in_chief_owned",
      label: "Editor-in-Chief owned",
      owner: "Editor-in-Chief orchestration layer",
      implementation_location: "lib/editor-in-chief/, lib/studio/cross-expert-adjudication/",
      experts_affected: "Experts as inputs only; EIC produces derived unified records",
      certification_requirement: "Cross-expert adjudication benchmarks and EIC acceptance tests",
      migration_requirement: "Wire expert outputs into EIC ingest; no expert rewrites findings",
      backward_compatibility_expectation: "Expert artifacts remain immutable",
      default_propagation_behavior: "Never assigned as expert judgment; orchestration only",
      examples: [
        "cross-expert contradiction detection",
        "authoritative ownership",
        "duplicate merging",
        "expert routing",
        "unified priorities",
        "capability-propagation review itself",
      ],
    },
    {
      classification: "platform_wide",
      label: "Platform-wide",
      owner: "StoryDNA platform architecture",
      implementation_location:
        "lib/governance/, lib/editorial-workflow/, app/studio/, database schema (when ratified)",
      experts_affected: "All workflows, experts, reports, and author surfaces",
      certification_requirement: "Platform conformance tests and constitutional compliance review",
      migration_requirement: "May require schema, workflow, and UI migration",
      backward_compatibility_expectation: "Explicit migration plan required for breaking changes",
      default_propagation_behavior: "Available to all products/workflows once implemented",
      examples: [
        "Author Intent",
        "publication state",
        "series context",
        "version evolution",
        "cost accounting",
        "workflow observability",
        "data immutability",
        "certification metadata",
        "audit logging",
      ],
    },
  ]);

export function getClassificationDefinition(
  classification: CapabilityClassification,
): ClassificationDefinition {
  const found = CAPABILITY_CLASSIFICATION_DEFINITIONS.find(
    (d) => d.classification === classification,
  );
  if (!found) {
    throw new Error(`Unknown classification: ${classification}`);
  }
  return found;
}

export function isValidClassification(value: string): value is CapabilityClassification {
  return CAPABILITY_CLASSIFICATION_DEFINITIONS.some((d) => d.classification === value);
}
