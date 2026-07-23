import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LITERARY_AGENT } from "@/lib/ai/review-engine.ts";
import { literaryAgentRuntimeDefinition } from "@/experts/literary-agent/runtime-definition.ts";
import {
  projectRuntimePriority,
  reviewerDefinitionToRuntimeIdentity,
  type ReviewerDefinitionSource,
} from "./reviewer-definition.ts";
import { hashExpertRuntimeDefinition } from "../types.ts";
import { withRuntimeDefinitionHash } from "../rehash-runtime-definition.ts";

function literaryAgentSourceWithPriority(
  priority: ReviewerDefinitionSource["priority"],
): ReviewerDefinitionSource {
  return { ...LITERARY_AGENT, priority };
}

describe("reviewer-definition → runtime identity adapter", () => {
  it("projects priority with exactly tier and base", () => {
    const projected = reviewerDefinitionToRuntimeIdentity(LITERARY_AGENT);
    assert.deepEqual(projected.priority, { tier: "core", base: 100 });
    assert.equal(Object.keys(projected.priority).length, 2);
    assert.equal("runOrder" in projected.priority, false);
  });

  it("projectRuntimePriority strips runOrder", () => {
    assert.deepEqual(
      projectRuntimePriority({ tier: "core", base: 100, runOrder: 10 }),
      { tier: "core", base: 100 },
    );
    assert.deepEqual(
      projectRuntimePriority({ tier: "core", base: 100, runOrder: 999 }),
      { tier: "core", base: 100 },
    );
  });

  it("changing runOrder alone does not change runtime definition hash", () => {
    const defA = literaryAgentRuntimeDefinition();
    const hashA = hashExpertRuntimeDefinition(defA);

    const sourceB = literaryAgentSourceWithPriority({
      tier: "core",
      base: 100,
      runOrder: 999,
    });
    const identityB = reviewerDefinitionToRuntimeIdentity(sourceB);
    assert.deepEqual(identityB.priority, defA.priority);

    const defB = withRuntimeDefinitionHash({
      ...defA,
      priority: identityB.priority,
    });
    const hashB = hashExpertRuntimeDefinition(defB);
    assert.equal(hashA, hashB);
  });

  it("changing tier changes the runtime definition hash", () => {
    const base = literaryAgentRuntimeDefinition();
    const originalHash = hashExpertRuntimeDefinition(base);
    const changed = withRuntimeDefinitionHash({
      ...base,
      priority: { tier: "specialist", base: base.priority.base },
    });
    assert.notEqual(hashExpertRuntimeDefinition(changed), originalHash);
  });

  it("changing base changes the runtime definition hash", () => {
    const base = literaryAgentRuntimeDefinition();
    const originalHash = hashExpertRuntimeDefinition(base);
    const changed = withRuntimeDefinitionHash({
      ...base,
      priority: { tier: base.priority.tier, base: base.priority.base + 1 },
    });
    assert.notEqual(hashExpertRuntimeDefinition(changed), originalHash);
  });

  it("repeated hashing of identical definitions is stable", () => {
    const def = literaryAgentRuntimeDefinition();
    const h1 = hashExpertRuntimeDefinition(def);
    const h2 = hashExpertRuntimeDefinition(def);
    assert.equal(h1, h2);
    assert.match(h1, /^[a-f0-9]{64}$/);
  });

  it("literary agent runtime definition priority excludes runOrder", () => {
    const def = literaryAgentRuntimeDefinition();
    assert.deepEqual(def.priority, { tier: "core", base: 100 });
    assert.equal("runOrder" in def.priority, false);
  });
});
