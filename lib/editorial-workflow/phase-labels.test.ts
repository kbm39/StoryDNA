import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorPhaseLabel, workflowDisplayName } from "./phase-labels.ts";
import { INTERNAL_PHASES } from "./types.ts";

describe("authorPhaseLabel", () => {
  it("maps every internal phase to a non-empty author label", () => {
    for (const phase of INTERNAL_PHASES) {
      const label = authorPhaseLabel(phase);
      assert.ok(label.length > 0);
      assert.ok(!label.includes("%"));
    }
  });

  it("returns Publishing Workflow for null phase", () => {
    assert.equal(authorPhaseLabel(null), "Publishing Workflow");
  });
});

describe("workflowDisplayName", () => {
  it("names literary agent review for authors", () => {
    assert.equal(workflowDisplayName("literary_agent_review"), "Literary Agent Review");
  });
});
