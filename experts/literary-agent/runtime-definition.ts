/**
 * Literary Agent ExpertRuntimeDefinition — wraps certified V1 constants (Phase 1).
 *
 * No prompt text duplication. No runtime wiring in Phase 1.
 */

import { LITERARY_AGENT, STORYDNA_CONSTITUTION_VERSION } from "@/lib/ai/review-engine.ts";
import { GRADING_FORMULA_VERSION } from "@/lib/commercial-fiction-rubric.ts";
import { CONTRARY_EVIDENCE_GATE_VERSION } from "@/lib/contrary-evidence/constants.ts";
import { LITERARY_AGENT_DEFINITION_VERSION } from "@/lib/editorial-workflow/types.ts";
import {
  EXPERT_REVIEW_ENGINE_VERSION,
  EXPERT_RUNTIME_SCHEMA_VERSION,
  hashExpertRuntimeDefinition,
  type ExpertRuntimeDefinition,
} from "@/lib/expert-review-engine/types.ts";
import { reviewerDefinitionToRuntimeIdentity } from "@/lib/expert-review-engine/adapters/reviewer-definition.ts";

export const LITERARY_AGENT_EXPERT_VERSION = "v1.0.0-certified" as const;
export const LITERARY_AGENT_GENERATION_PROFILE_ID = "memo_rubric_v1" as const;
export const LITERARY_AGENT_PROMPT_VERSION = `literary_agent_prompt@${STORYDNA_CONSTITUTION_VERSION}` as const;
export const LITERARY_AGENT_VALIDATOR_VERSION = "literary_agent_validators@v1-certified" as const;
export const LITERARY_AGENT_REPAIR_VERSION = "literary_agent_repair@v1-certified" as const;
export const LITERARY_AGENT_NORMALIZATION_VERSION = "literary_agent_normalization@v1-certified" as const;
export const LITERARY_AGENT_PASSAGE_VERIFICATION_VERSION = "manuscript_passage_located@v1" as const;
export const LITERARY_AGENT_PUBLISHING_VERSION = "publish_commercial_review_generation@v1-certified" as const;
export const LITERARY_AGENT_EXPORT_VERSION = "literary_agent_docx@v1-certified" as const;

function buildLiteraryAgentRuntimeDefinitionBase(): Omit<
  ExpertRuntimeDefinition,
  "runtime_versions"
> {
  const identity = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);

  return {
    schema_version: EXPERT_RUNTIME_SCHEMA_VERSION,
    expert_key: identity.expert_key,
    expert_version: LITERARY_AGENT_EXPERT_VERSION,
    display_name: identity.display_name,
    department: "Publishing",
    role: identity.role,
    purpose: identity.purpose,
    enabled: true,

    capabilities: [
      "commercial_analysis",
      "publishing",
      "marketing",
      "plot_analysis",
      "pacing_analysis",
      "character_analysis",
      "dialogue_analysis",
    ],

    prerequisites: identity.prerequisites,
    trigger_conditions: identity.trigger_conditions,
    priority: identity.priority,

    knowledge_domains: identity.knowledge_domains,
    personality: identity.personality,

    estimated_runtime: "long",
    estimated_cost: "high",

    failure_conditions: identity.failure_conditions,

    manuscript_scope: "full_manuscript",
    series_scope: "optional",

    generation_profile: {
      id: LITERARY_AGENT_GENERATION_PROFILE_ID,
      calls: [
        { id: "call_a", role: "memo" },
        { id: "call_b", role: "rubric" },
        { id: "call_c", role: "candidates" },
      ],
    },

    prompt_builder: {
      reviewerDefinitionModuleId: "@/lib/ai/review-engine",
      reviewerDefinitionExport: "LITERARY_AGENT",
      systemPromptExport: "buildSystemPrompt",
      reviewPromptExport: "buildReviewPrompt",
      revisionCandidatesPromptExport: "buildRevisionCandidatesPrompt",
    },

    rubric_definition: {
      kind: "structured_json",
      moduleId: "@/lib/commercial-fiction-rubric",
      exportName: "buildCommercialRubricGenerationPrompt",
      gradingFormulaVersion: GRADING_FORMULA_VERSION,
    },

    scoring_weights: null,

    validation_plugins: [
      {
        id: "canonical_word_count",
        moduleId: "@/lib/canonical-review-input",
        exportName: "buildCanonicalReviewInput",
        stage: "pre_memo",
        failClosed: true,
      },
      {
        id: "memo_before_rubric",
        moduleId: "@/lib/commercial-review-generation",
        exportName: "validateMemoBeforeRubric",
        stage: "post_memo",
        failClosed: true,
      },
      {
        id: "post_scoring_rubric",
        moduleId: "@/lib/contrary-evidence/post-scoring-validation",
        exportName: "validatePostScoringRubric",
        stage: "post_rubric",
        failClosed: true,
      },
      {
        id: "combined_commercial_review",
        moduleId: "@/lib/commercial-review-generation",
        exportName: "validateCombinedCommercialReview",
        stage: "pre_publish",
        failClosed: true,
      },
    ],

    repair_plugins: [
      {
        id: "commercial_memo_repair",
        moduleId: "@/lib/ai/anthropic",
        exportName: "repairCommercialMemoValidation",
        stage: "memo",
      },
    ],

    // Certified top-level normalization: memo statistics only (run-fresh-editorial-generation).
    // Rubric normalization (normalizeRubricAgainstGate, including narrow-broad deduction) runs
    // inside validatePostScoringRubric — not as separate pipeline stages.
    normalization_plugins: [
      {
        id: "memo_statistics",
        moduleId: "@/lib/commercial-review-repair",
        exportName: "normalizeCommercialMemoStatistics",
        stage: "memo_stats",
      },
    ],

    contrary_evidence_policy: {
      enabled: true,
      requiresPriorReview: true,
      moduleId: "@/lib/contrary-evidence/gate",
      gateVersion: CONTRARY_EVIDENCE_GATE_VERSION,
    },

    revision_candidate_policy: {
      minCandidates: 1,
      passageVerification: "strict_full_passage",
      commentExportTypesModuleId: "@/lib/editorial-generation/replacement-payload",
    },

    passage_verification_policy: {
      algorithm: "manuscript_passage_located",
      payloadBuilderModuleId: "@/lib/editorial-generation/replacement-payload",
      payloadBuilderExport: "buildReplacementPayload",
      failOnUnverifiedPublish: true,
    },

    publishing_policy: {
      resultType: "commercial_review",
      perspective: "commercial",
      rpcModuleId: "@/lib/supabase/server",
      rpcName: "publish_commercial_review_generation",
      authoritative: true,
      workflowDefinitionVersion: LITERARY_AGENT_DEFINITION_VERSION,
    },

    export_policy: {
      docxModuleId: "@/lib/literary-agent-docx",
      docxExportName: "buildLiteraryAgentReviewDocx",
      reportSections: LITERARY_AGENT.outputContract.sections.map((s) => s.heading),
    },

    required_context: ["storydna", "prior_review", "author_intent"],

    output_schema: {
      reviewContentFormat: "markdown",
      issueSchemaRef: "storydna/editorial_issue@v1",
      candidateSchemaRef: "storydna/revision_candidate@v1",
    },

    next_best_action: "View your Literary Agent review in the Reviews section below.",

    action_item_mapping: {
      issueToActionItem: true,
      candidateToActionItem: true,
    },

    editor_in_chief_rules: {
      compatibleExperts: ["developmental_editor", "line_editor"],
      escalationExperts: ["developmental_editor"],
      prerequisiteExperts: [],
      duplicateReviewPolicy: "block_same_expert_same_version",
    },
  };
}

export function literaryAgentRuntimeDefinition(): ExpertRuntimeDefinition {
  const base = buildLiteraryAgentRuntimeDefinitionBase();
  const runtime_versionsWithoutHash = {
    engine_version: EXPERT_REVIEW_ENGINE_VERSION,
    expert_version: LITERARY_AGENT_EXPERT_VERSION,
    prompt_version: LITERARY_AGENT_PROMPT_VERSION,
    rubric_version: GRADING_FORMULA_VERSION,
    validator_version: LITERARY_AGENT_VALIDATOR_VERSION,
    repair_version: LITERARY_AGENT_REPAIR_VERSION,
    normalization_version: LITERARY_AGENT_NORMALIZATION_VERSION,
    contrary_evidence_version: CONTRARY_EVIDENCE_GATE_VERSION,
    passage_verification_version: LITERARY_AGENT_PASSAGE_VERIFICATION_VERSION,
    publishing_version: LITERARY_AGENT_PUBLISHING_VERSION,
    export_version: LITERARY_AGENT_EXPORT_VERSION,
    definition_hash: "",
  };
  const definitionHash = hashExpertRuntimeDefinition({
    ...base,
    runtime_versions: runtime_versionsWithoutHash,
  });

  return {
    ...base,
    runtime_versions: {
      ...runtime_versionsWithoutHash,
      definition_hash: definitionHash,
    },
  };
}

/** Certified recommendation labels from LITERARY_AGENT output contract. */
export const LITERARY_AGENT_RECOMMENDATION_VALUES = [
  "REQUEST",
  "PASS",
  "REVISE & RESUBMIT",
] as const;
