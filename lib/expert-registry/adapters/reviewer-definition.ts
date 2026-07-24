/**
 * Adapter: ReviewerDefinition (code) → ExpertDefinitionV1 (registry).
 * Does NOT import lib/ai/review-engine.ts — callers pass the definition in.
 *
 * Consumes the shared reviewer identity projection; applies constitution-specific mapping.
 */

import { projectSharedReviewerIdentity } from "@/lib/reviewer-definition-projection/shared-identity.ts";
import type { ReviewerDefinitionSharedInput } from "@/lib/reviewer-definition-projection/types.ts";
import type { ExpertDefinitionV1 } from "../types.ts";

/** Full ReviewerDefinition shape for registry mirroring. */
export interface ReviewerDefinitionSource extends ReviewerDefinitionSharedInput {
  depth: string;
  system: string;
  communicationPhilosophy: string[];
  evaluationFramework: {
    categories: Array<{ key: string; name: string; weight?: number; questions: string[] }>;
  };
  evidenceRules: {
    required: boolean;
    quoteMaxWords: number;
    requireLocator: boolean;
    requireVerification: boolean;
    evidenceTypes: string[];
    unverifiedHandling: string;
  };
  constitution: { inherits: string; additionalRules: string[] };
  outputContract: ReviewerDefinitionSharedInput["outputContract"] & {
    format: string;
    sections: Array<{ heading: string; guidance: string }>;
    rules: string[];
  };
  revisionPermissions: {
    mayRevise: string[];
    prohibitions: string[];
  };
  capabilities: {
    fullText: boolean;
    evidencePresent: boolean;
    evidenceVerified: boolean;
    usesAuthorIntent: boolean;
  };
  scopeCompatibility: string[];
  estimatedCost: { perDepth: Record<string, { mode: string }> };
}

function cloneEvaluationCategories(
  categories: ReviewerDefinitionSource["evaluationFramework"]["categories"],
): ReviewerDefinitionSource["evaluationFramework"]["categories"] {
  return categories.map((category) => ({
    key: category.key,
    name: category.name,
    weight: category.weight,
    questions: [...category.questions],
  }));
}

function cloneOutputSections(
  sections: ReviewerDefinitionSource["outputContract"]["sections"],
): ReviewerDefinitionSource["outputContract"]["sections"] {
  return sections.map((section) => ({
    heading: section.heading,
    guidance: section.guidance,
  }));
}

export function reviewerDefinitionToExpertDefinition(
  def: ReviewerDefinitionSource,
  options: {
    category: ExpertDefinitionV1["identity"]["category"];
    department: string;
    version: string;
    lifecycleStatus: ExpertDefinitionV1["versioning"]["lifecycle_status"];
    evidenceProfileRefs: string[];
    registryMetadata?: ExpertDefinitionV1["registry_metadata"];
    changeSummary?: string;
  },
): ExpertDefinitionV1 {
  const shared = projectSharedReviewerIdentity(def);
  const runtimeClass =
    def.capabilities.fullText && def.estimatedCost?.perDepth?.professional?.mode === "async"
      ? "long"
      : "medium";
  const evaluationCategories = cloneEvaluationCategories(def.evaluationFramework.categories);
  const outputSections = cloneOutputSections(def.outputContract.sections);
  const communicationPhilosophy = [...def.communicationPhilosophy];
  const constitutionRules = [...def.constitution.additionalRules];
  const outputRules = [...def.outputContract.rules];
  const revisionProhibitions = [...def.revisionPermissions.prohibitions];
  const scopeCompatibility = [...def.scopeCompatibility];

  return {
    schema_version: "expert_definition@v1",
    identity: {
      expert_key: shared.expert_key,
      display_name: shared.display_name,
      title: shared.display_name,
      description: shared.mission,
      department: options.department,
      category: options.category,
      role_boundaries: shared.expertise_out_of_scope,
      collaboration_role: shared.perspective,
    },
    purpose: {
      mission: shared.mission,
      responsibilities: shared.expertise_in_scope,
      non_responsibilities: shared.expertise_out_of_scope,
      intended_use: scopeCompatibility,
      prerequisites: shared.prerequisites.map((prerequisite) => prerequisite.description),
      trigger_conditions: shared.trigger_conditions,
      priority: shared.priority_source,
    },
    professional_standards: {
      principles: communicationPhilosophy,
      ethics: [
        "Never insult, dismiss, or discourage the author.",
        "Preserve author intent and vision unless explicitly asked otherwise.",
      ],
      author_respect_rules: communicationPhilosophy.filter((rule) =>
        /author|respect|vision|story/i.test(rule),
      ),
      evidence_standards: [
        "Every material claim requires verifiable evidence.",
        "Evidence-first reasoning: evidence → reasoning → observation → recommendation.",
        ...constitutionRules.filter((rule) => /evidence|quote|cite/i.test(rule)),
      ],
      verification_standards: [
        def.evidenceRules.requireVerification
          ? "Manuscript evidence must be verified against the text."
          : "Manuscript evidence should be locatable in the text.",
      ],
      bias_avoidance_rules: [
        "Distinguish fact, interpretation, prediction, preference, and professional judgment.",
      ],
      disclosure_requirements: [
        "Label objective observations vs professional opinions vs commercial judgments.",
      ],
      uncertainty_rules: [
        "Return INSUFFICIENT_EVIDENCE rather than asserting unsupported concerns.",
      ],
      conflict_handling_rules: ["Defer out-of-scope issues to specialist experts."],
      confidence_thresholds: {
        minimum_for_material_claims: "MODERATE",
        block_on_insufficient: true,
      },
      source_integrity_rules: ["Do not fabricate quotations, citations, or passage locations."],
      non_fabrication_rules: revisionProhibitions,
      contrary_evidence_obligations: [
        "Before repeating prior criticism, search for contrary evidence or repair.",
      ],
      escalation_rules: ["Escalate domain realism concerns to appropriate specialist experts."],
      specialist_deference_rules: shared.expertise_out_of_scope.map(
        (item) => `Defer to specialist for: ${item}`,
      ),
      prediction_and_market_limitations: [
        "Never promise a sale; assess likelihood candidly.",
        "Market predictions are professional judgment, not facts.",
      ],
    },
    evaluation_framework: {
      categories: evaluationCategories,
      review_methodology: [
        def.capabilities.fullText
          ? "Read the full manuscript before concluding."
          : "Review available segments before concluding.",
      ],
      reasoning_rules: outputRules.filter((rule) => !/JSON|Grade/i.test(rule)),
      issue_priority_rules: ["Prioritize highest-impact revisions over minor notes."],
      completion_requirements: def.outputContract.requiredFields.map(
        (field) => `Include ${field.key}: ${field.description}`,
      ),
      failure_conditions: shared.failure_conditions,
      safety_boundaries: revisionProhibitions,
      collaboration_rules: ["Defer out-of-scope assessments to named specialists."],
      exclusions: shared.expertise_out_of_scope,
    },
    evidence_policy: {
      profile_refs: options.evidenceProfileRefs,
      allowed_evidence_types: [
        "MANUSCRIPT",
        "ANALYTICAL",
        "RUBRIC",
        "COMPARATIVE",
        "EXTERNAL_SOURCE",
        "AUTHOR_PROVIDED",
        "SYSTEM_METADATA",
      ],
      per_output_requirements: [
        {
          output_type: "material_criticism",
          minimum_records: 1,
          required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
          allowed_types: ["MANUSCRIPT", "ANALYTICAL", "RUBRIC"],
        },
        {
          output_type: "editorial_opinion",
          minimum_records: 1,
          required_fields: ["claim", "evidence", "evidence_type", "reasoning", "confidence"],
          allowed_types: ["MANUSCRIPT", "RUBRIC"],
        },
        {
          output_type: "conclusion",
          minimum_records: 1,
          required_fields: ["claim", "evidence", "reasoning", "confidence"],
          allowed_types: ["MANUSCRIPT", "RUBRIC", "ANALYTICAL"],
        },
      ],
      manuscript_anchor_requirements: {
        require_version_id: true,
        require_locator: def.evidenceRules.requireLocator,
        max_excerpt_words: def.evidenceRules.quoteMaxWords,
        require_verification: def.evidenceRules.requireVerification,
      },
      external_source_requirements: {
        required_when: ["market_comparable_claim", "factual_assertion_outside_manuscript"],
        minimum_reliability: "moderate",
        require_citation_fields: ["title", "authority", "access_date", "identifier"],
      },
      citation_requirements: { format: "structured", allow_urls: true, allow_doi: true },
      verification_requirements: {
        author_can_locate_independently: true,
        block_on_fabricated_quotes: true,
      },
      contrary_evidence_requirements: {
        required_for_repeat_criticism: true,
        search_current_manuscript: true,
        statuses_allowed_without_deduction: ["RESOLVED", "STALE_CRITIQUE"],
      },
      insufficient_evidence_behavior: "block",
      confidence_rules: {
        levels: ["HIGH", "MODERATE", "LOW", "INSUFFICIENT_EVIDENCE"],
        require_explanation: true,
        block_publish_on_insufficient: true,
      },
    },
    knowledge: {
      knowledge_domains: shared.knowledge_domains,
      competencies: shared.expertise_in_scope,
      limitations: shared.expertise_out_of_scope,
      professional_responsibility: {
        should_evaluate: shared.expertise_in_scope,
        may_evaluate: [],
        must_not_evaluate: shared.expertise_out_of_scope,
      },
      research_permissions: {
        allow_external_lookup: def.id !== "literary_agent",
        allow_author_provided_sources: true,
      },
      source_requirements: { minimum_reliability_for_facts: "moderate" },
    },
    io: {
      required_inputs: [{ key: "manuscript_text", type: "full_text" }],
      optional_inputs: def.capabilities.usesAuthorIntent
        ? [{ key: "storydna", type: "author_intent" }]
        : [],
      output_schema_refs:
        def.id === "literary_agent"
          ? ["storydna/commercial_rubric@v1", "storydna/commercial_memo@v1"]
          : [`storydna/${def.id}_report@v1`],
      artifact_types: outputSections.map((section) => section.heading),
      issue_types: ["structural", "commercial", "craft"],
      recommendation_types: ["revision_priority", "decision"],
      completion_requirements: outputRules,
    },
    execution_profile: {
      preferred_model_capabilities: ["long_context", "structured_output"],
      context_strategy: def.capabilities.fullText ? "full_manuscript" : "segmented",
      estimated_runtime_class: runtimeClass,
      estimated_cost_class: runtimeClass === "long" ? "high" : "medium",
      parallel_safe: false,
      workflow_compatibility: [`${def.id}_review`],
    },
    versioning: {
      version: options.version,
      lifecycle_status: options.lifecycleStatus,
      change_summary: options.changeSummary,
    },
    registry_metadata: options.registryMetadata,
  };
}
