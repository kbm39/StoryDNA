/**
 * Military Expert draft ExpertRuntimeDefinition — not production-wired.
 */

import {
  EXPERT_REVIEW_ENGINE_VERSION,
  EXPERT_RUNTIME_SCHEMA_VERSION,
  REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
  hashExpertRuntimeDefinition,
  type ExpertRuntimeDefinition,
} from "@/lib/expert-review-engine/types.ts";
import { reviewerDefinitionToRuntimeIdentity } from "@/lib/expert-review-engine/adapters/reviewer-definition.ts";
import {
  MILITARY_EXPERT,
  buildMilitaryExpertPassagePayload,
  buildReviewPrompt,
  buildRevisionCandidatesPrompt,
  buildSystemPrompt,
} from "./definition.ts";
import {
  MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH,
} from "./military-expert-constitution-hash.ts";
import {
  MILITARY_EXPERT_DEFINITION_VERSION,
  MILITARY_EXPERT_KEY,
  MILITARY_EXPERT_VERSION,
} from "./contracts.ts";

export const MILITARY_EXPERT_GENERATION_PROFILE_ID = "military_review_v1_draft" as const;
export const MILITARY_EXPERT_PROMPT_VERSION = "military_expert_prompt@v1-draft" as const;
export const MILITARY_EXPERT_VALIDATOR_VERSION = "military_expert_validators@v1-draft" as const;
export const MILITARY_EXPERT_REPAIR_VERSION = "military_expert_repair@v1-draft" as const;
export const MILITARY_EXPERT_NORMALIZATION_VERSION = "military_expert_normalization@v1-draft" as const;
export const MILITARY_EXPERT_PASSAGE_VERIFICATION_VERSION = "military_expert_passage@v1-draft" as const;
export const MILITARY_EXPERT_PUBLISHING_VERSION = "publish_military_expert_review_draft@v1" as const;
export const MILITARY_EXPERT_EXPORT_VERSION = "military_expert_export@v1-draft" as const;
export const MILITARY_EXPERT_RUBRIC_VERSION = "none" as const;
export const MILITARY_EXPERT_CONTRARY_EVIDENCE_VERSION = "disabled" as const;

function buildMilitaryExpertRuntimeDefinitionBase(): Omit<ExpertRuntimeDefinition, "runtime_versions"> {
  const identity = reviewerDefinitionToRuntimeIdentity(MILITARY_EXPERT);

  return {
    schema_version: EXPERT_RUNTIME_SCHEMA_VERSION,
    expert_key: identity.expert_key,
    expert_version: MILITARY_EXPERT_VERSION,
    display_name: identity.display_name,
    department: "Research",
    role: identity.role,
    purpose: identity.purpose,
    enabled: false,

    capabilities: ["military", "continuity"],

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
      id: MILITARY_EXPERT_GENERATION_PROFILE_ID,
      calls: [{ id: "call_a", role: "memo" }],
    },

    prompt_builder: {
      reviewerDefinitionModuleId: "@/experts/military-expert/definition",
      reviewerDefinitionExport: "MILITARY_EXPERT",
      systemPromptExport: "buildSystemPrompt",
      reviewPromptExport: "buildReviewPrompt",
      revisionCandidatesPromptExport: "buildRevisionCandidatesPrompt",
    },

    rubric_definition: {
      kind: "none",
    },

    scoring_weights: null,

    validation_plugins: [
      {
        id: "military_expert_review",
        moduleId: "@/experts/military-expert/validation",
        exportName: "validateMilitaryExpertReview",
        stage: "pre_publish",
        failClosed: true,
      },
    ],

    repair_plugins: [],

    normalization_plugins: [
      {
        id: "military_expert_review",
        moduleId: "@/experts/military-expert/normalization",
        exportName: "normalizeMilitaryExpertReview",
        stage: "memo_stats",
      },
    ],

    contrary_evidence_policy: {
      enabled: false,
      requiresPriorReview: false,
    },

    revision_candidate_policy: {
      minCandidates: 0,
      passageVerification: "none",
    },

    passage_verification_policy: {
      algorithm: "manuscript_passage_located",
      payloadBuilderModuleId: "@/experts/military-expert/definition",
      payloadBuilderExport: "buildMilitaryExpertPassagePayload",
      failOnUnverifiedPublish: true,
    },

    publishing_policy: {
      resultType: "military_review",
      perspective: "military_realism",
      rpcModuleId: "@/experts/military-expert/runtime-definition",
      rpcName: "publish_military_expert_review_draft",
      authoritative: false,
      workflowDefinitionVersion: MILITARY_EXPERT_DEFINITION_VERSION,
    },

    export_policy: {
      reportSections: MILITARY_EXPERT.outputContract.sections.map((section) => section.heading),
    },

    required_context: ["storydna", "author_intent"],

    output_schema: {
      reviewContentFormat: "markdown",
      issueSchemaRef: "storydna/military_expert_finding@v1",
      candidateSchemaRef: "storydna/military_expert_candidate@v1",
    },

    next_best_action: "Military Expert reviews are not yet available in production.",

    action_item_mapping: {
      issueToActionItem: true,
      candidateToActionItem: false,
    },

    editor_in_chief_rules: {
      compatibleExperts: ["developmental_editor", "line_editor", "literary_agent"],
      escalationExperts: ["librarian", "psychologist"],
      prerequisiteExperts: [],
      duplicateReviewPolicy: "block_same_expert_same_version",
    },
  };
}

export function militaryExpertRuntimeDefinition(): ExpertRuntimeDefinition {
  const base = buildMilitaryExpertRuntimeDefinitionBase();
  const runtime_versionsWithoutHash = {
    schema_version: REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
    engine_version: EXPERT_REVIEW_ENGINE_VERSION,
    expert_version: MILITARY_EXPERT_VERSION,
    prompt_version: MILITARY_EXPERT_PROMPT_VERSION,
    rubric_version: MILITARY_EXPERT_RUBRIC_VERSION,
    validator_version: MILITARY_EXPERT_VALIDATOR_VERSION,
    repair_version: MILITARY_EXPERT_REPAIR_VERSION,
    normalization_version: MILITARY_EXPERT_NORMALIZATION_VERSION,
    contrary_evidence_version: MILITARY_EXPERT_CONTRARY_EVIDENCE_VERSION,
    passage_verification_version: MILITARY_EXPERT_PASSAGE_VERIFICATION_VERSION,
    publishing_version: MILITARY_EXPERT_PUBLISHING_VERSION,
    export_version: MILITARY_EXPERT_EXPORT_VERSION,
    constitution_definition_hash: MILITARY_EXPERT_CONSTITUTION_DEFINITION_HASH,
    workflow_definition_version: MILITARY_EXPERT_DEFINITION_VERSION,
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

// Re-export builders referenced by module verification without provider wiring.
export {
  buildMilitaryExpertPassagePayload,
  buildReviewPrompt,
  buildRevisionCandidatesPrompt,
  buildSystemPrompt,
  MILITARY_EXPERT,
  MILITARY_EXPERT_KEY,
};
