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
});
