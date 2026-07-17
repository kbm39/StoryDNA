/**
 * Literary Agent registry mirror — server-only entry imports LITERARY_AGENT at runtime.
 * Does NOT wire the review pipeline to the database.
 */

import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { reviewerDefinitionToExpertDefinition } from "../adapters/reviewer-definition.ts";
import type { ExpertDefinitionV1 } from "../types.ts";

export const LITERARY_AGENT_RUNTIME_SOURCE =
  "lib/ai/review-engine.ts#LITERARY_AGENT" as const;

/** Declarative competency ceilings for orchestration planning — not runtime-computed in Phase 1. */
const LITERARY_AGENT_DOMAIN_CONFIDENCE: ExpertDefinitionV1["knowledge"]["domain_confidence"] = [
  { domain: "Commercial marketability", confidence_percent: 95 },
  { domain: "Reader engagement", confidence_percent: 92 },
  { domain: "Series positioning", confidence_percent: 90 },
  { domain: "Military realism", confidence_percent: 40, notes: "Defer to Military Expert" },
  { domain: "Medical realism", confidence_percent: 15, notes: "Defer to Medical Expert" },
];

export function literaryAgentRegistryDefinitionV1(): ExpertDefinitionV1 {
  const base = reviewerDefinitionToExpertDefinition(LITERARY_AGENT, {
    category: "literary_agent",
    department: "Editorial",
    version: "v1-registry-mirror",
    lifecycleStatus: "draft",
    evidenceProfileRefs: ["COMMERCIAL", "EDITORIAL", "PUBLISHING"],
    changeSummary:
      "Registry mirror of code-defined LITERARY_AGENT — not runtime-wired in Phase 1.",
    registryMetadata: {
      runtime_source: LITERARY_AGENT_RUNTIME_SOURCE,
      execution_wired: false,
      execution_model: "expert_version",
      notes:
        "Commercial scoring, contrary-evidence gates, and publication remain in review-engine.ts. Future Publishing Workflow executes expert_version_id, not hard-coded reviewer types.",
    },
  });

  return {
    ...base,
    knowledge: {
      ...base.knowledge,
      competencies: [
        "Commercial fiction",
        "Marketability",
        "Reader engagement",
        "Series positioning",
        "Acquisition readiness",
      ],
      limitations: [
        "Police tactics",
        "Military realism",
        "Medical diagnosis",
        "Structural engineering",
        "Domain-specific procedural realism",
      ],
      professional_responsibility: {
        should_evaluate: [
          "Commercial viability",
          "Market positioning",
          "Reader engagement signals",
          "Acquisition readiness",
        ],
        may_evaluate: ["Genre craft signals that affect commercial positioning"],
        must_not_evaluate: [
          "Police tactics",
          "Military realism",
          "Medical diagnosis",
          "Structural engineering",
          "Line-level copy editing",
        ],
      },
      domain_confidence: LITERARY_AGENT_DOMAIN_CONFIDENCE,
    },
  };
}
