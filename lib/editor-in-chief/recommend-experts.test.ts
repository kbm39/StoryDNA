import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  bootstrapExpertRuntimeRegistry,
  clearExpertRuntimeRegistryForTests,
} from "@/lib/expert-review-engine/registry/in-code.ts";
import {
  findExpertForCapability,
  recommendCommercialLiteraryAgent,
  recommendExperts,
} from "./recommend-experts.ts";

describe("Editor-in-Chief recommend-experts façade", () => {
  beforeEach(() => {
    clearExpertRuntimeRegistryForTests();
    bootstrapExpertRuntimeRegistry();
  });

  it("commercial request resolves Literary Agent through capability lookup", () => {
    const plan = recommendCommercialLiteraryAgent();
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0]!.expertKey, "literary_agent");
    assert.ok(plan.assignments[0]!.matchedCapabilities.includes("commercial_analysis"));
    assert.equal(plan.executionPlanned, false);
  });

  it("does not hard-code display name — uses registry display_name", () => {
    const plan = recommendCommercialLiteraryAgent();
    assert.equal(plan.assignments[0]!.displayName, "Literary Agent");
  });

  it("returns unresolved for unsupported required capability", () => {
    const plan = recommendExperts({
      requestedCapabilities: [{ capability: "military", required: true }],
    });
    assert.equal(plan.assignments.length, 0);
    assert.equal(plan.unresolved[0]!.capability, "military");
  });

  it("findExpertForCapability returns null when no expert registered", () => {
    assert.equal(findExpertForCapability("police"), null);
  });

  it("explicit expert key resolves via registry", () => {
    const plan = recommendExperts({
      explicitExpertKey: "literary_agent",
      requestedCapabilities: [],
    });
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0]!.reasons[0]!.code, "explicit_expert_key");
  });
});
