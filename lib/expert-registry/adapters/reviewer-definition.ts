/**
 * Adapter: ReviewerDefinition (code) → ExpertDefinitionV1 (registry).
 * Does NOT import lib/ai/review-engine.ts — callers pass the definition in.
 */

import type { ExpertDefinitionV1 } from "../types.ts";

/** Subset of ReviewerDefinition fields used for registry mirroring. */
export interface ReviewerDefinitionSource {
  id: string;
  reviewer: string;
  perspective: string;
  depth: string;
  mission: string;
  system: string;
  personality: {
    archetype: string;
    traits: string[];
    directness: string;
    warmth: string;
    humor: string;
    voiceNotes: string;
  };
  communicationPhilosophy: string[];
  expertise: { inScope: string[]; outOfScope: string[] };
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
  outputContract: {
    format: string;
    sections: Array<{ heading: string; guidance: string }>;
    requiredFields: Array<{ key: string; description: string; values?: string[] }>;
    rules: string[];
  };
  knowledgeDomains: Array<{
    name: string;
    authorities: string[];
    keyConcepts: string[];
    commonErrors: string[];
  }>;
  triggers: Array<{ key: string; description: string; signal: string; match: string; weight: number }>;
  prerequisites: Array<{ key: string; description: string; requires: string; onUnmet: string }>;
  priority: { tier: "core" | "standard" | "specialist"; base: number };
  failureConditions: Array<{ key: string; condition: string; severity: string; disclosure: string }>;
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
  const runtimeClass =
    def.capabilities.fullText && def.estimatedCost?.perDepth?.professional?.mode === "async"
      ? "long"
      : "medium";

  return {
    schema_version: "expert_definition@v1",
    identity: {
      expert_key: def.id,
      display_name: def.reviewer,
      title: def.reviewer,
      description: def.mission,
      department: options.department,
      category: options.category,
      role_boundaries: def.expertise.outOfScope,
      collaboration_role: def.perspective,
    },
    purpose: {
      mission: def.mission,
      responsibilities: def.expertise.inScope,
      non_responsibilities: def.expertise.outOfScope,
      intended_use: def.scopeCompatibility,
      prerequisites: def.prerequisites.map((p) => p.description),
      trigger_conditions: def.triggers,
      priority: def.priority,
    },
    professional_standards: {
      principles: def.communicationPhilosophy,
      ethics: [
        "Never insult, dismiss, or discourage the author.",
        "Preserve author intent and vision unless explicitly asked otherwise.",
      ],
      author_respect_rules: def.communicationPhilosophy.filter((r) =>
        /author|respect|vision|story/i.test(r),
      ),
      evidence_standards: [
        "Every material claim requires verifiable evidence.",
        "Evidence-first reasoning: evidence → reasoning → observation → recommendation.",
        ...def.constitution.additionalRules.filter((r) => /evidence|quote|cite/i.test(r)),
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
      non_fabrication_rules: def.revisionPermissions.prohibitions,
      contrary_evidence_obligations: [
        "Before repeating prior criticism, search for contrary evidence or repair.",
      ],
      escalation_rules: ["Escalate domain realism concerns to appropriate specialist experts."],
      specialist_deference_rules: def.expertise.outOfScope.map(
        (o) => `Defer to specialist for: ${o}`,
      ),
      prediction_and_market_limitations: [
        "Never promise a sale; assess likelihood candidly.",
        "Market predictions are professional judgment, not facts.",
      ],
    },
    evaluation_framework: {
      categories: def.evaluationFramework.categories,
      review_methodology: [
        def.capabilities.fullText
          ? "Read the full manuscript before concluding."
          : "Review available segments before concluding.",
      ],
      reasoning_rules: def.outputContract.rules.filter((r) => !/JSON|Grade/i.test(r)),
      issue_priority_rules: ["Prioritize highest-impact revisions over minor notes."],
      completion_requirements: def.outputContract.requiredFields.map(
        (f) => `Include ${f.key}: ${f.description}`,
      ),
      failure_conditions: def.failureConditions.map((f) => ({
        key: f.key,
        condition: f.condition,
        severity: f.severity as "abort" | "degrade" | "warn",
        disclosure: f.disclosure,
      })),
      safety_boundaries: def.revisionPermissions.prohibitions,
      collaboration_rules: ["Defer out-of-scope assessments to named specialists."],
      exclusions: def.expertise.outOfScope,
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
      knowledge_domains: def.knowledgeDomains,
      competencies: def.expertise.inScope,
      limitations: def.expertise.outOfScope,
      professional_responsibility: {
        should_evaluate: def.expertise.inScope,
        may_evaluate: [],
        must_not_evaluate: def.expertise.outOfScope,
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
      artifact_types: def.outputContract.sections.map((s) => s.heading),
      issue_types: ["structural", "commercial", "craft"],
      recommendation_types: ["revision_priority", "decision"],
      completion_requirements: def.outputContract.rules,
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
