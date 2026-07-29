import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkflowActivityLog,
  buildWorkflowProgressTimeline,
  pickActiveStudioWorkflow,
} from "./workflow-progress-timeline.ts";

describe("workflow progress timeline", () => {
  it("marks military expert memo_generation as current", () => {
    const timeline = buildWorkflowProgressTimeline({
      workflowType: "military_expert_review",
      status: "running",
      currentPhase: "memo_generation",
      isTerminal: false,
      events: [
        { eventType: "queued", phase: null, payload: {}, createdAt: "2026-07-29T00:00:00.000Z" },
        { eventType: "started", phase: null, payload: {}, createdAt: "2026-07-29T00:00:01.000Z" },
        {
          eventType: "phase_changed",
          phase: "validating",
          payload: { progress_summary: "Checking your manuscript" },
          createdAt: "2026-07-29T00:00:02.000Z",
        },
        {
          eventType: "phase_changed",
          phase: "memo_generation",
          payload: { progress_summary: "Reading the manuscript" },
          createdAt: "2026-07-29T00:00:03.000Z",
        },
      ],
    });
    const current = timeline.find((step) => step.state === "current");
    assert.equal(current?.id, "memo_generation");
    assert.equal(timeline[0]?.state, "completed");
  });

  it("shows assessment validation after parse_failed", () => {
    const timeline = buildWorkflowProgressTimeline({
      workflowType: "military_expert_review",
      status: "running",
      currentPhase: "memo_generation",
      isTerminal: false,
      events: [
        { eventType: "queued", phase: null, payload: {}, createdAt: "2026-07-29T00:00:00.000Z" },
        {
          eventType: "phase_changed",
          phase: "memo_generation",
          payload: {},
          createdAt: "2026-07-29T00:00:03.000Z",
        },
        {
          eventType: "parse_failed",
          phase: null,
          payload: { parse_failure_code: "evidence_missing" },
          createdAt: "2026-07-29T00:01:30.000Z",
        },
      ],
    });
    assert.equal(timeline.find((step) => step.id === "assessment_validation")?.state, "current");
  });

  it("builds recent activity from workflow events", () => {
    const activity = buildWorkflowActivityLog([
      { eventType: "queued", phase: null, payload: {}, createdAt: "2026-07-29T00:00:00.000Z" },
      {
        eventType: "phase_changed",
        phase: "memo_generation",
        payload: { progress_summary: "Reading the manuscript" },
        createdAt: "2026-07-29T00:00:03.000Z",
      },
    ]);
    assert.equal(activity[0]?.label, "Reading the manuscript");
    assert.equal(activity[1]?.label, "Review queued");
  });

  it("prefers non-terminal military workflow over terminal literary workflow", () => {
    const picked = pickActiveStudioWorkflow(
      { isTerminal: true } as { isTerminal: boolean },
      { isTerminal: false } as { isTerminal: boolean },
    );
    assert.equal(picked?.isTerminal, false);
  });
});
