import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import { literaryAgentRegistryDefinitionV1 } from "@/lib/expert-registry/seed/literary-agent-registry.v1.ts";
import { reviewerDefinitionToExpertDefinition } from "@/lib/expert-registry/adapters/reviewer-definition.ts";
import { reviewerDefinitionToRuntimeIdentity } from "@/lib/expert-review-engine/adapters/reviewer-definition.ts";
import { hashExpertDefinition } from "@/lib/expert-registry/definition-hash.ts";
import { hashExpertRuntimeDefinition } from "@/lib/expert-review-engine/types.ts";
import {
  projectRuntimePriority,
  projectSharedReviewerIdentity,
} from "./shared-identity.ts";

const EXPECTED_RUNTIME_DEFINITION_HASH =
  "f4006eaa497dd1d821f30fdac33dcb4869eff68d1af46b1f7401a972020ca50b";

describe("shared reviewer identity projection", () => {
  it("includes only approved common identity fields", () => {
    const shared = projectSharedReviewerIdentity(LITERARY_AGENT);
    assert.deepEqual(Object.keys(shared).sort(), [
      "display_name",
      "expert_key",
      "expertise_in_scope",
      "expertise_out_of_scope",
      "failure_conditions",
      "knowledge_domains",
      "mission",
      "personality",
      "perspective",
      "prerequisite_keys",
      "prerequisites",
      "priority_source",
      "recommendation_field_keys",
      "recommendation_values",
      "trigger_conditions",
    ]);
  });

  it("does not share nested references with LITERARY_AGENT", () => {
    const shared = projectSharedReviewerIdentity(LITERARY_AGENT);

    assert.notEqual(shared.personality, LITERARY_AGENT.personality);
    assert.notEqual(shared.personality.traits, LITERARY_AGENT.personality.traits);
    assert.notEqual(shared.knowledge_domains, LITERARY_AGENT.knowledgeDomains);
    assert.notEqual(shared.knowledge_domains[0], LITERARY_AGENT.knowledgeDomains[0]);
    assert.notEqual(
      shared.knowledge_domains[0]!.authorities,
      LITERARY_AGENT.knowledgeDomains[0]!.authorities,
    );
    assert.notEqual(shared.trigger_conditions, LITERARY_AGENT.triggers);
    assert.notEqual(shared.prerequisites, LITERARY_AGENT.prerequisites);
    assert.notEqual(shared.expertise_in_scope, LITERARY_AGENT.expertise.inScope);
    assert.notEqual(shared.expertise_out_of_scope, LITERARY_AGENT.expertise.outOfScope);
    assert.notEqual(shared.priority_source, LITERARY_AGENT.priority);
  });

  it("two independent projections do not share mutable nested references", () => {
    const first = projectSharedReviewerIdentity(LITERARY_AGENT);
    const second = projectSharedReviewerIdentity(LITERARY_AGENT);

    assert.notEqual(first.personality.traits, second.personality.traits);
    assert.notEqual(first.knowledge_domains[0]!.keyConcepts, second.knowledge_domains[0]!.keyConcepts);
  });

  it("mutating runtime adapter output does not mutate constitution output or LITERARY_AGENT", () => {
    const traitsBefore = [...LITERARY_AGENT.personality.traits];
    const domainAuthoritiesBefore = [...LITERARY_AGENT.knowledgeDomains[0]!.authorities];

    const runtime = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);
    const constitution = reviewerDefinitionToExpertDefinition(LITERARY_AGENT, {
      category: "literary_agent",
      department: "Editorial",
      version: "v1-registry-mirror",
      lifecycleStatus: "draft",
      evidenceProfileRefs: ["COMMERCIAL"],
    });

    runtime.personality.traits.push("mutated-runtime-trait");
    runtime.knowledge_domains[0]!.authorities.push("mutated-runtime-authority");
    constitution.purpose.trigger_conditions[0]!.description = "mutated-constitution-trigger";
    constitution.knowledge.knowledge_domains[0]!.keyConcepts.push("mutated-constitution-concept");

    assert.deepEqual(LITERARY_AGENT.personality.traits, traitsBefore);
    assert.deepEqual(LITERARY_AGENT.knowledgeDomains[0]!.authorities, domainAuthoritiesBefore);

    const runtimeAgain = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);
    const constitutionAgain = reviewerDefinitionToExpertDefinition(LITERARY_AGENT, {
      category: "literary_agent",
      department: "Editorial",
      version: "v1-registry-mirror",
      lifecycleStatus: "draft",
      evidenceProfileRefs: ["COMMERCIAL"],
    });

    assert.notEqual(runtimeAgain.personality.traits, runtime.personality.traits);
    assert.notEqual(
      constitutionAgain.purpose.trigger_conditions[0]!.description,
      constitution.purpose.trigger_conditions[0]!.description,
    );
  });

  it("projectRuntimePriority strips runOrder without affecting runtime hash inputs", () => {
    const shared = projectSharedReviewerIdentity({
      ...LITERARY_AGENT,
      priority: { tier: "core", base: 100, runOrder: 999 },
    });
    assert.deepEqual(projectRuntimePriority(shared.priority_source), { tier: "core", base: 100 });
    assert.equal("runOrder" in projectRuntimePriority(shared.priority_source), false);
  });

  it("runtime definition hash remains unchanged on main", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal(hashExpertRuntimeDefinition(def), EXPECTED_RUNTIME_DEFINITION_HASH);
    assert.equal(def.runtime_versions.definition_hash, EXPECTED_RUNTIME_DEFINITION_HASH);
  });

  it("runtime schema still excludes removed relationship top-level fields", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.equal("compatible_experts" in def, false);
    assert.equal("escalation_experts" in def, false);
    assert.ok(def.editor_in_chief_rules.compatibleExperts.length > 0);
  });

  it("registry and runtime adapters both consume the shared projection", () => {
    const shared = projectSharedReviewerIdentity(LITERARY_AGENT);
    const runtime = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);
    const constitution = reviewerDefinitionToExpertDefinition(LITERARY_AGENT, {
      category: "literary_agent",
      department: "Editorial",
      version: "v1-registry-mirror",
      lifecycleStatus: "draft",
      evidenceProfileRefs: ["COMMERCIAL"],
    });

    assert.equal(runtime.expert_key, shared.expert_key);
    assert.equal(constitution.identity.expert_key, shared.expert_key);
    assert.deepEqual(runtime.priority, projectRuntimePriority(shared.priority_source));
    assert.deepEqual(constitution.purpose.priority, shared.priority_source);
  });

  it("registry serialized output remains stable for Literary Agent mirror", () => {
    const hashBefore = hashExpertDefinition(literaryAgentRegistryDefinitionV1());
    const hashAfter = hashExpertDefinition(literaryAgentRegistryDefinitionV1());
    assert.equal(hashBefore, hashAfter);
    assert.match(hashBefore, /^[a-f0-9]{64}$/);
  });
});
