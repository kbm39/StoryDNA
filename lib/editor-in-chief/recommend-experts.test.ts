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
    assert.deepEqual(plan.unresolvedExperts, []);
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
    assert.equal(plan.unresolved[0]!.reason, "no_registered_expert_for_capability");
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
    assert.deepEqual(plan.assignments[0]!.matchedCapabilities, []);
    assert.deepEqual(plan.unresolvedExperts, []);
  });

  it("unknown explicit expert key produces unresolvedExperts entry", () => {
    const plan = recommendExperts({
      explicitExpertKey: "missing_expert",
      requestedCapabilities: [],
    });
    assert.equal(plan.assignments.length, 0);
    assert.deepEqual(plan.unresolvedExperts, [
      { expertKey: "missing_expert", reason: "unknown_explicit_expert" },
    ]);
  });

  it("malformed explicit expert key produces unresolvedExperts entry", () => {
    const plan = recommendExperts({
      explicitExpertKey: "Bad-Key",
      requestedCapabilities: [],
    });
    assert.equal(plan.assignments.length, 0);
    assert.deepEqual(plan.unresolvedExperts, [
      { expertKey: "Bad-Key", reason: "malformed_explicit_expert_key" },
    ]);
  });

  it("one expert matched by two capabilities produces one assignment with merged capabilities", () => {
    const plan = recommendExperts({
      requestedCapabilities: [
        { capability: "commercial_analysis", required: true },
        { capability: "publishing", required: true },
      ],
    });
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0]!.expertKey, "literary_agent");
    assert.deepEqual(plan.assignments[0]!.matchedCapabilities, [
      "commercial_analysis",
      "publishing",
    ]);
  });

  it("duplicate capability input is deduplicated", () => {
    const plan = recommendExperts({
      requestedCapabilities: [
        { capability: "commercial_analysis", required: false },
        { capability: "commercial_analysis", required: true },
      ],
    });
    assert.equal(plan.assignments.length, 1);
    assert.deepEqual(plan.assignments[0]!.matchedCapabilities, ["commercial_analysis"]);
  });

  it("same expert selected explicitly and by capability produces one assignment", () => {
    const plan = recommendExperts({
      explicitExpertKey: "literary_agent",
      requestedCapabilities: [{ capability: "commercial_analysis", required: true }],
    });
    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0]!.expertKey, "literary_agent");
    assert.deepEqual(plan.assignments[0]!.matchedCapabilities, ["commercial_analysis"]);
    assert.ok(plan.assignments[0]!.reasons.some((r) => r.code === "explicit_expert_key"));
    assert.ok(plan.assignments[0]!.reasons.some((r) => r.code === "capability_match"));
  });

  it("produces deterministic output across reordered inputs", () => {
    const first = recommendExperts({
      explicitExpertKey: "literary_agent",
      requestedCapabilities: [
        { capability: "publishing", required: true },
        { capability: "commercial_analysis", required: true },
      ],
    });
    const second = recommendExperts({
      explicitExpertKey: "literary_agent",
      requestedCapabilities: [
        { capability: "commercial_analysis", required: true },
        { capability: "publishing", required: true },
      ],
    });
    assert.deepEqual(first, second);
  });

  it("never executes experts and keeps executionPlanned false", () => {
    const plan = recommendExperts({
      explicitExpertKey: "literary_agent",
      requestedCapabilities: [{ capability: "commercial_analysis", required: true }],
    });
    assert.equal(plan.executionPlanned, false);
    assert.ok(plan.assignments.length > 0);
  });
});
