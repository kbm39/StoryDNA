/**
 * Archivist draft ExpertRuntimeDefinition — not production-wired.
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
  ARCHIVIST,
  buildArchivistPassagePayload,
  buildReviewPrompt,
  buildRevisionCandidatesPrompt,
  buildSystemPrompt,
} from "./definition.ts";
import { ARCHIVIST_CONSTITUTION_DEFINITION_HASH } from "./constitution-hash.ts";
import {
  ARCHIVIST_DEFINITION_VERSION,
  ARCHIVIST_EXPERT_KEY,
  ARCHIVIST_VERSION,
} from "./contracts.ts";
import { ARCHIVIST_PURPOSE } from "./constitution.ts";

export const ARCHIVIST_GENERATION_PROFILE_ID = "archivist_review_v1_draft" as const;
export const ARCHIVIST_PROMPT_VERSION = "archivist_prompt@v1-draft" as const;
export const ARCHIVIST_VALIDATOR_VERSION = "archivist_validators@v1-draft" as const;
export const ARCHIVIST_REPAIR_VERSION = "archivist_repair@v1-draft" as const;
export const ARCHIVIST_NORMALIZATION_VERSION = "archivist_normalization@v1-draft" as const;
export const ARCHIVIST_PASSAGE_VERIFICATION_VERSION = "archivist_passage@v1-draft" as const;
export const ARCHIVIST_PUBLISHING_VERSION = "publish_archivist_review_draft@v1" as const;
export const ARCHIVIST_EXPORT_VERSION = "archivist_export@v1-draft" as const;
export const ARCHIVIST_RUBRIC_VERSION = "none" as const;
export const ARCHIVIST_CONTRARY_EVIDENCE_VERSION = "disabled" as const;

function buildArchivistRuntimeDefinitionBase(): Omit<ExpertRuntimeDefinition, "runtime_versions"> {
  const identity = reviewerDefinitionToRuntimeIdentity(ARCHIVIST);

  return {
    schema_version: EXPERT_RUNTIME_SCHEMA_VERSION,
    expert_key: identity.expert_key,
    expert_version: ARCHIVIST_VERSION,
    display_name: identity.display_name,
    department: "Editorial",
    role: identity.role,
    purpose: ARCHIVIST_PURPOSE,
    enabled: false,

    capabilities: [
      "continuity",
      "timeline",
      "series_canon",
      "structured_output",
      "long_context",
      "evidence_backed",
      "author_challenge",
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
      id: ARCHIVIST_GENERATION_PROFILE_ID,
      calls: [{ id: "call_a", role: "memo" }],
    },

    prompt_builder: {
      reviewerDefinitionModuleId: "@/experts/archivist/definition",
      reviewerDefinitionExport: "ARCHIVIST",
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
        id: "archivist_review",
        moduleId: "@/experts/archivist/validation",
        exportName: "validateArchivistReview",
        stage: "pre_publish",
        failClosed: true,
      },
    ],

    repair_plugins: [],

    normalization_plugins: [
      {
        id: "archivist_review",
        moduleId: "@/experts/archivist/normalization",
        exportName: "normalizeArchivistReview",
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
      payloadBuilderModuleId: "@/experts/archivist/definition",
      payloadBuilderExport: "buildArchivistPassagePayload",
      failOnUnverifiedPublish: true,
    },

    publishing_policy: {
      resultType: "archivist_review",
      perspective: "continuity_canon",
      rpcModuleId: "@/experts/archivist/runtime-definition",
      rpcName: "publish_archivist_review_draft",
      authoritative: false,
      workflowDefinitionVersion: ARCHIVIST_DEFINITION_VERSION,
    },

    export_policy: {
      reportSections: ARCHIVIST.outputContract.sections.map((section) => section.heading),
    },

    required_context: ["storydna", "author_intent"],

    output_schema: {
      reviewContentFormat: "markdown",
      issueSchemaRef: "storydna/archivist_finding@v1",
      candidateSchemaRef: "storydna/archivist_canon_delta@v1",
    },

    next_best_action: "Archivist reviews are not yet available in production.",

    action_item_mapping: {
      issueToActionItem: true,
      candidateToActionItem: false,
    },

    editor_in_chief_rules: {
      compatibleExperts: ["developmental_editor", "literary_agent", "military_expert"],
      escalationExperts: ["librarian"],
      prerequisiteExperts: [],
      duplicateReviewPolicy: "block_same_expert_same_version",
    },
  };
}

export function archivistRuntimeDefinition(): ExpertRuntimeDefinition {
  const base = buildArchivistRuntimeDefinitionBase();
  const runtime_versionsWithoutHash = {
    schema_version: REVIEW_RUNTIME_VERSION_SET_SCHEMA_VERSION,
    engine_version: EXPERT_REVIEW_ENGINE_VERSION,
    expert_version: ARCHIVIST_VERSION,
    prompt_version: ARCHIVIST_PROMPT_VERSION,
    rubric_version: ARCHIVIST_RUBRIC_VERSION,
    validator_version: ARCHIVIST_VALIDATOR_VERSION,
    repair_version: ARCHIVIST_REPAIR_VERSION,
    normalization_version: ARCHIVIST_NORMALIZATION_VERSION,
    contrary_evidence_version: ARCHIVIST_CONTRARY_EVIDENCE_VERSION,
    passage_verification_version: ARCHIVIST_PASSAGE_VERIFICATION_VERSION,
    publishing_version: ARCHIVIST_PUBLISHING_VERSION,
    export_version: ARCHIVIST_EXPORT_VERSION,
    constitution_definition_hash: ARCHIVIST_CONSTITUTION_DEFINITION_HASH,
    workflow_definition_version: ARCHIVIST_DEFINITION_VERSION,
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

export {
  buildArchivistPassagePayload,
  buildReviewPrompt,
  buildRevisionCandidatesPrompt,
  buildSystemPrompt,
  ARCHIVIST,
  ARCHIVIST_EXPERT_KEY,
};
