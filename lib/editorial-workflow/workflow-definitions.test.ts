import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nextBestActionForCompletedWorkflow,
  workflowMetadataForType,
} from "./workflow-definitions.ts";

describe("workflow-definitions", () => {
  it("defines Literary Agent metadata for reuse across workflow types", () => {
    const meta = workflowMetadataForType("literary_agent_review");
    assert.equal(meta.department, "Publishing");
    assert.equal(meta.owner_label, "StoryDNA");
    assert.deepEqual(meta.participating_experts, ["Literary Agent"]);
    assert.equal(meta.next_best_action, null);
  });

  it("sets next best action on completion", () => {
    const nba = nextBestActionForCompletedWorkflow("literary_agent_review");
    assert.match(nba, /Literary Agent review/i);
  });

  it("defines Military Expert local test metadata", () => {
    const meta = workflowMetadataForType("military_expert_review");
    assert.equal(meta.department, "Research");
    assert.equal(meta.owner_label, "Kevin Studio");
    assert.deepEqual(meta.participating_experts, ["Military Expert"]);
    assert.match(meta.purpose ?? "", /local test/i);
  });

  it("sets Military Expert next best action on completion", () => {
    const nba = nextBestActionForCompletedWorkflow("military_expert_review");
    assert.match(nba, /Military Expert local test/i);
  });
});
