import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  reviewerDefinitionToExpertDefinition,
  type ReviewerDefinitionSource,
} from "./adapters/reviewer-definition.ts";
import { validateExpertDefinition } from "./schema.ts";

const mockLiteraryAgentSource: ReviewerDefinitionSource = {
  id: "literary_agent",
  reviewer: "Literary Agent",
  perspective: "Commercial Acquisitions",
  depth: "Professional Review",
  mission: "Assess commercial viability with evidence-backed editorial guidance.",
  system: "You are a literary agent.",
  personality: {
    archetype: "Agent",
    traits: ["direct"],
    directness: "high",
    warmth: "moderate",
    humor: "low",
    voiceNotes: "Professional",
  },
  communicationPhilosophy: ["Respect author vision", "Evidence-first reasoning"],
  expertise: {
    inScope: ["Commercial assessment", "Market positioning"],
    outOfScope: ["Line editing", "Medical fact-checking"],
  },
  evaluationFramework: {
    categories: [
      { key: "hook", name: "Hook", questions: ["Does the opening compel?"] },
    ],
  },
  evidenceRules: {
    required: true,
    quoteMaxWords: 40,
    requireLocator: true,
    requireVerification: true,
    evidenceTypes: ["MANUSCRIPT", "RUBRIC"],
    unverifiedHandling: "block",
  },
  constitution: { inherits: "storydna", additionalRules: ["Cite manuscript evidence"] },
  outputContract: {
    format: "json",
    sections: [{ heading: "Memo", guidance: "Commercial memo" }],
    requiredFields: [{ key: "grade", description: "Letter grade" }],
    rules: ["Evidence-first reasoning"],
  },
  knowledgeDomains: [
    {
      name: "Commercial fiction",
      authorities: ["Industry standards"],
      keyConcepts: ["marketability"],
      commonErrors: ["unsupported claims"],
    },
  ],
  triggers: [
    {
      key: "commercial_review",
      description: "Commercial review requested",
      signal: "review_type",
      match: "commercial",
      weight: 1,
    },
  ],
  prerequisites: [
    {
      key: "full_manuscript",
      description: "Full manuscript required",
      requires: "manuscript_text",
      onUnmet: "abort",
    },
  ],
  priority: { tier: "core", base: 90 },
  failureConditions: [
    {
      key: "short_manuscript",
      condition: "Manuscript too short",
      severity: "abort",
      disclosure: "Request full manuscript",
    },
  ],
  revisionPermissions: {
    mayRevise: [],
    prohibitions: ["Never modify manuscript text"],
  },
  capabilities: {
    fullText: true,
    evidencePresent: true,
    evidenceVerified: true,
    usesAuthorIntent: true,
  },
  scopeCompatibility: ["commercial_review"],
  estimatedCost: { perDepth: { professional: { mode: "async" } } },
};

describe("reviewer-definition adapter", () => {
  it("produces valid Literary Agent registry mirror from reviewer source", () => {
    const def = reviewerDefinitionToExpertDefinition(mockLiteraryAgentSource, {
      category: "literary_agent",
      department: "Editorial",
      version: "v1-registry-mirror",
      lifecycleStatus: "draft",
      evidenceProfileRefs: ["COMMERCIAL", "EDITORIAL"],
      registryMetadata: {
        runtime_source: "lib/ai/review-engine.ts#LITERARY_AGENT",
        execution_wired: false,
      },
    });
    const result = validateExpertDefinition(def);
    assert.equal(result.ok, true);
    assert.equal(def.identity.expert_key, "literary_agent");
    assert.equal(def.registry_metadata?.execution_wired, false);
    assert.equal(def.evidence_policy.profile_refs.includes("COMMERCIAL"), true);
  });

  it("maps evaluation categories and evidence rules", () => {
    const def = reviewerDefinitionToExpertDefinition(mockLiteraryAgentSource, {
      category: "literary_agent",
      department: "Editorial",
      version: "v1",
      lifecycleStatus: "draft",
      evidenceProfileRefs: ["COMMERCIAL"],
    });
    assert.equal(def.evaluation_framework.categories.length, 1);
    assert.equal(def.evidence_policy.manuscript_anchor_requirements.max_excerpt_words, 40);
    assert.equal(def.evidence_policy.manuscript_anchor_requirements.require_verification, true);
  });
});

describe("Literary Agent runtime unchanged", () => {
  it("review-engine still exports LITERARY_AGENT and core builders", () => {
    const src = readFileSync(join(process.cwd(), "lib/ai/review-engine.ts"), "utf8");
    assert.match(src, /export const LITERARY_AGENT/);
    assert.match(src, /export function buildSystemPrompt/);
    assert.match(src, /export function buildReviewPrompt/);
    assert.doesNotMatch(src, /expert-registry/);
    assert.doesNotMatch(src, /getActiveExpertVersion/);
  });
});
