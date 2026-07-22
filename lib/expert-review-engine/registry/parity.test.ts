import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { GRADING_FORMULA_VERSION } from "@/lib/commercial-fiction-rubric.ts";
import {
  LITERARY_AGENT_GENERATION_PROFILE_ID,
  LITERARY_AGENT_RECOMMENDATION_VALUES,
  literaryAgentRuntimeDefinition,
} from "@/experts/literary-agent/runtime-definition.ts";
import { reviewerDefinitionToRuntimeIdentity } from "../adapters/reviewer-definition.ts";
import {
  clearExpertRuntimeRegistryForTests,
  getExpertRuntimeDefinition,
  bootstrapExpertRuntimeRegistry,
  registerExpertRuntimeDefinition,
  ExpertRegistryError,
} from "./in-code.ts";
import {
  hashExpertRuntimeDefinition,
  validateReviewRuntimeVersionSet,
  REVIEW_RUNTIME_VERSION_FIELDS,
} from "../types.ts";
import { withRuntimeDefinitionHash } from "../rehash-runtime-definition.ts";
import { validateExpertRuntimeDefinition } from "../validate-runtime-definition.ts";
import {
  recommendCommercialLiteraryAgent,
  recommendExperts,
} from "@/lib/editor-in-chief/recommend-experts.ts";

describe("Literary Agent V1 certified parity — runtime definition", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
  });

  it("1. stable expert id remains literary_agent", () => {
    assert.equal(LITERARY_AGENT.id, "literary_agent");
    assert.equal(literaryAgentRuntimeDefinition().expert_key, "literary_agent");
  });

  it("2. generation profile remains memo_rubric_v1 with three calls", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal(def.generation_profile.id, LITERARY_AGENT_GENERATION_PROFILE_ID);
    assert.equal(def.generation_profile.id, "memo_rubric_v1");
    assert.deepEqual(
      def.generation_profile.calls.map((c) => c.id),
      ["call_a", "call_b", "call_c"],
    );
  });

  it("3. grading formula version unchanged", () => {
    assert.equal(literaryAgentRuntimeDefinition().rubric_definition.gradingFormulaVersion, GRADING_FORMULA_VERSION);
    assert.equal(GRADING_FORMULA_VERSION, "STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1");
  });

  it("4. prompt builder references existing review-engine module", () => {
    const pb = literaryAgentRuntimeDefinition().prompt_builder;
    assert.equal(pb.reviewerDefinitionModuleId, "@/lib/ai/review-engine");
    assert.equal(pb.reviewerDefinitionExport, "LITERARY_AGENT");
    assert.equal(pb.systemPromptExport, "buildSystemPrompt");
    assert.equal(pb.reviewPromptExport, "buildReviewPrompt");
    assert.equal(pb.revisionCandidatesPromptExport, "buildRevisionCandidatesPrompt");
  });

  it("5. rubric references existing commercial-fiction-rubric module", () => {
    const rubric = literaryAgentRuntimeDefinition().rubric_definition;
    assert.equal(rubric.moduleId, "@/lib/commercial-fiction-rubric");
    assert.equal(rubric.gradingFormulaVersion, GRADING_FORMULA_VERSION);
  });

  it("6. validator and repair plugins reference certified modules", () => {
    const def = literaryAgentRuntimeDefinition();
    const validatorIds = def.validation_plugins.map((p) => p.id);
    assert.ok(validatorIds.includes("memo_before_rubric"));
    assert.ok(validatorIds.includes("post_scoring_rubric"));
    const repair = def.repair_plugins[0];
    assert.equal(repair!.moduleId, "@/lib/ai/anthropic");
    assert.equal(repair!.exportName, "repairCommercialMemoValidation");
    const normalizer = def.normalization_plugins.find((p) => p.id === "memo_statistics");
    assert.equal(normalizer!.moduleId, "@/lib/commercial-review-repair");
    assert.equal(normalizer!.exportName, "normalizeCommercialMemoStatistics");
  });

  it("6b. normalization metadata matches certified call graph", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.deepEqual(
      def.normalization_plugins.map((p) => p.id),
      ["memo_statistics"],
    );
    assert.equal(
      def.normalization_plugins.some((p) => p.id === "narrow_broad_deduction"),
      false,
    );
    assert.equal(
      def.normalization_plugins.some((p) => p.id === "rubric_against_gate"),
      false,
    );
    const postScoring = def.validation_plugins.find((p) => p.id === "post_scoring_rubric");
    assert.equal(postScoring!.moduleId, "@/lib/contrary-evidence/post-scoring-validation");
    assert.equal(postScoring!.exportName, "validatePostScoringRubric");
  });

  it("7–8. registry resolves by key and commercial_analysis capability", () => {
    assert.ok(getExpertRuntimeDefinition("literary_agent"));
    const plan = recommendCommercialLiteraryAgent();
    assert.equal(plan.assignments[0]!.expertKey, "literary_agent");
    assert.equal(plan.unresolved.length, 0);
  });

  it("9. duplicate key registration fails", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.throws(
      () => registerExpertRuntimeDefinition({ ...def, expert_version: "v9.9.9" }),
      ExpertRegistryError,
    );
  });

  it("10. invalid runtime definition fails validation", () => {
    const def = literaryAgentRuntimeDefinition();
    const result = validateExpertRuntimeDefinition({
      ...def,
      capabilities: [],
    });
    assert.equal(result.ok, false);
  });

  it("11. disabled expert excluded unless includeDisabled", () => {
    clearExpertRuntimeRegistryForTests();
    registerExpertRuntimeDefinition(
      withRuntimeDefinitionHash({ ...literaryAgentRuntimeDefinition(), enabled: false }),
    );
    assert.equal(getExpertRuntimeDefinition("literary_agent"), null);
    assert.ok(getExpertRuntimeDefinition("literary_agent", { includeDisabled: true }));
  });

  it("12. Editor-in-Chief commercial routing returns Literary Agent via capability", () => {
    const plan = recommendExperts({
      requestedCapabilities: [{ capability: "commercial_analysis", required: true }],
    });
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0]!.expertKey, "literary_agent");
    assert.equal(plan.executionPlanned, false);
  });

  it("13. unsupported capability returns unresolved", () => {
    const plan = recommendExperts({
      requestedCapabilities: [{ capability: "police", required: true }],
    });
    assert.equal(plan.assignments.length, 0);
    assert.equal(plan.unresolved.length, 1);
    assert.equal(plan.unresolved[0]!.capability, "police");
  });

  it("14. ReviewRuntimeVersionSet validates all required fields", () => {
    const def = literaryAgentRuntimeDefinition();
    const check = validateReviewRuntimeVersionSet(def.runtime_versions);
    assert.equal(check.ok, true);
    assert.equal(REVIEW_RUNTIME_VERSION_FIELDS.length, 12);
    for (const field of REVIEW_RUNTIME_VERSION_FIELDS) {
      assert.ok(def.runtime_versions[field]);
    }
  });

  it("15. definition hash is deterministic", () => {
    const h1 = hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
    const h2 = hashExpertRuntimeDefinition(literaryAgentRuntimeDefinition());
    assert.equal(h1, h2);
    assert.match(h1, /^[a-f0-9]{64}$/);
  });

  it("adapter identity matches LITERARY_AGENT deterministically", () => {
    const projected = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);
    assert.equal(projected.expert_key, LITERARY_AGENT.id);
    assert.equal(projected.display_name, LITERARY_AGENT.reviewer);
    assert.deepEqual(projected.recommendation_values, [...LITERARY_AGENT_RECOMMENDATION_VALUES]);
    assert.deepEqual(projected.personality, LITERARY_AGENT.personality);
  });

  it("recommendation labels preserved from output contract", () => {
    const decisionField = LITERARY_AGENT.outputContract.requiredFields.find((f) => f.key === "Decision");
    assert.deepEqual(decisionField!.values, [...LITERARY_AGENT_RECOMMENDATION_VALUES]);
  });

  it("publishing policy preserves commercial authoritative semantics", () => {
    const pub = literaryAgentRuntimeDefinition().publishing_policy;
    assert.equal(pub.perspective, "commercial");
    assert.equal(pub.rpcName, "publish_commercial_review_generation");
    assert.equal(pub.authoritative, true);
    assert.equal(pub.workflowDefinitionVersion, "literary_agent_review@v1");
  });

  it("passage verification policy references replacement-payload builder", () => {
    const pv = literaryAgentRuntimeDefinition().passage_verification_policy;
    assert.equal(pv.algorithm, "manuscript_passage_located");
    assert.equal(pv.payloadBuilderExport, "buildReplacementPayload");
    assert.equal(pv.failOnUnverifiedPublish, true);
  });
});

describe("production runtime files untouched", () => {
  it("run-fresh-editorial-generation entry constant unchanged", async () => {
    const mod = await import("@/lib/editorial-generation/run-fresh-editorial-generation.ts");
    assert.equal(mod.EDITORIAL_GENERATION_ENTRY, "lib/editorial-generation/run-fresh-editorial-generation.ts");
  });
});
