import type { ExpertDefinitionV1 } from "./types.ts";

/** Minimal valid ExpertDefinitionV1 for unit tests. */
export function minimalValidExpertDefinition(
  overrides?: Partial<ExpertDefinitionV1>,
): ExpertDefinitionV1 {
  const base: ExpertDefinitionV1 = {
    schema_version: "expert_definition@v1",
    identity: {
      expert_key: "test_expert",
      display_name: "Test Expert",
      title: "Test Expert",
      description: "Test expert for validation.",
      department: "Editorial",
      category: "fact_checker",
    },
    purpose: {
      mission: "Verify facts with evidence.",
      responsibilities: ["Check claims"],
      non_responsibilities: ["Rewrite prose"],
      intended_use: ["fact_check"],
      prerequisites: ["manuscript"],
      trigger_conditions: [
        {
          key: "fact_check",
          description: "When fact checking is requested",
          signal: "review_type",
          match: "fact_check",
          weight: 1,
        },
      ],
      priority: { tier: "specialist", base: 50 },
    },
    professional_standards: {
      principles: ["Evidence-first reasoning"],
      ethics: ["Never fabricate sources"],
      author_respect_rules: ["Respect author intent"],
      evidence_standards: ["Every material claim requires evidence"],
      verification_standards: ["Author can verify citations"],
      bias_avoidance_rules: ["Separate fact from opinion"],
      disclosure_requirements: ["Disclose uncertainty"],
      uncertainty_rules: ["Return INSUFFICIENT_EVIDENCE when unsupported"],
      conflict_handling_rules: ["Present conflicting evidence"],
      confidence_thresholds: {
        minimum_for_material_claims: "MODERATE",
        block_on_insufficient: true,
      },
      source_integrity_rules: ["No fabricated citations"],
      non_fabrication_rules: ["No invented manuscript facts"],
      contrary_evidence_obligations: ["Search for contrary evidence"],
      escalation_rules: ["Escalate to domain specialist"],
      specialist_deference_rules: ["Defer to medical expert for clinical claims"],
      prediction_and_market_limitations: ["No sales predictions as facts"],
    },
    evaluation_framework: {
      categories: [
        { key: "accuracy", name: "Accuracy", questions: ["Is the claim supported?"] },
      ],
      review_methodology: ["Locate evidence before concluding"],
      reasoning_rules: ["Evidence → reasoning → observation → recommendation"],
      issue_priority_rules: ["Prioritize material factual errors"],
      completion_requirements: ["All material findings evidence-backed"],
      failure_conditions: [
        {
          key: "no_manuscript",
          condition: "Manuscript unavailable",
          severity: "abort",
          disclosure: "Cannot proceed without manuscript",
        },
      ],
      safety_boundaries: ["Never modify manuscript"],
      collaboration_rules: ["Coordinate with Editor-in-Chief"],
      exclusions: ["Commercial scoring"],
    },
    evidence_policy: {
      profile_refs: ["GENERAL_FACT_CHECKING"],
      allowed_evidence_types: ["MANUSCRIPT", "EXTERNAL_SOURCE", "ANALYTICAL"],
      per_output_requirements: [
        {
          output_type: "factual_assertion",
          minimum_records: 1,
          required_fields: ["claim", "evidence", "reasoning", "confidence"],
          allowed_types: ["MANUSCRIPT", "EXTERNAL_SOURCE"],
        },
      ],
      manuscript_anchor_requirements: {
        require_version_id: true,
        require_locator: true,
        max_excerpt_words: 40,
        require_verification: true,
      },
      external_source_requirements: {
        required_when: ["factual_assertion_outside_manuscript"],
        minimum_reliability: "moderate",
        require_citation_fields: ["title", "authority"],
      },
      citation_requirements: { format: "structured", allow_urls: true, allow_doi: true },
      verification_requirements: {
        author_can_locate_independently: true,
        block_on_fabricated_quotes: true,
      },
      contrary_evidence_requirements: {
        required_for_repeat_criticism: true,
        search_current_manuscript: true,
        statuses_allowed_without_deduction: ["RESOLVED"],
      },
      insufficient_evidence_behavior: "block",
      confidence_rules: {
        levels: ["HIGH", "MODERATE", "LOW", "INSUFFICIENT_EVIDENCE"],
        require_explanation: true,
        block_publish_on_insufficient: true,
      },
    },
    knowledge: {
      knowledge_domains: [
        {
          name: "General fact checking",
          authorities: ["Reference works"],
          keyConcepts: ["verification"],
          commonErrors: ["uncited claims"],
        },
      ],
      competencies: ["General factual verification", "Citation validation"],
      limitations: ["Legal advice", "Medical diagnosis", "Financial regulation"],
      professional_responsibility: {
        should_evaluate: ["Verifiable factual claims in the manuscript"],
        may_evaluate: ["Author-provided source reliability"],
        must_not_evaluate: ["Legal advice", "Medical diagnosis", "Financial regulation"],
      },
      research_permissions: { allow_external_lookup: true, allow_author_provided_sources: true },
      source_requirements: { minimum_reliability_for_facts: "moderate" },
    },
    io: {
      required_inputs: [{ key: "manuscript_text", type: "manuscript" }],
      optional_inputs: [],
      output_schema_refs: ["storydna/fact_check@v1"],
      artifact_types: ["fact_check_report"],
      issue_types: ["factual"],
      recommendation_types: ["correction"],
      completion_requirements: ["Evidence-backed findings"],
    },
    execution_profile: {
      preferred_model_capabilities: ["reasoning"],
      context_strategy: "segmented",
      estimated_runtime_class: "medium",
      estimated_cost_class: "medium",
      parallel_safe: true,
      workflow_compatibility: ["fact_check"],
    },
    versioning: {
      version: "v1-test",
      lifecycle_status: "draft",
    },
  };

  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    purpose: { ...base.purpose, ...overrides.purpose },
    professional_standards: { ...base.professional_standards, ...overrides.professional_standards },
    evaluation_framework: {
      ...base.evaluation_framework,
      ...overrides.evaluation_framework,
    },
    evidence_policy: { ...base.evidence_policy, ...overrides.evidence_policy },
    knowledge: { ...base.knowledge, ...overrides.knowledge },
    io: { ...base.io, ...overrides.io },
    execution_profile: { ...base.execution_profile, ...overrides.execution_profile },
    versioning: { ...base.versioning, ...overrides.versioning },
  };
}
