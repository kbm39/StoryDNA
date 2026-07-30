import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISCOVERY_PROVIDER_USED_IN_PHASE_1 } from "../studio/military-expert-v2/discovery.ts";
import { WORKFLOW_TYPES } from "./types.ts";

describe("military expert v2 inventory workflow phase 1 boundary", () => {
  it("does not use provider refinement in phase 1", () => {
    assert.equal(DISCOVERY_PROVIDER_USED_IN_PHASE_1, false);
  });

  it("inventory workflow type is distinct from v1 review", () => {
    assert.ok(WORKFLOW_TYPES.includes("military_expert_v2_inventory"));
    assert.ok(WORKFLOW_TYPES.includes("military_expert_review"));
  });
});
