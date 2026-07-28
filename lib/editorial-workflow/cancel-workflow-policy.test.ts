import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isEditorialWorkflowCancellationIdempotent,
  isStudioCancellableWorkflowType,
  validateStudioWorkflowCancellation,
} from "./cancel-workflow-policy.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const militaryWorkflow = {
  id: "9237e53d-80f2-4355-bfc0-3118d232917c",
  manuscript_id: "e63c07fa-634d-4d32-8052-6194ff965d91",
  workflow_type: "military_expert_review",
  status: "queued" as const,
};

const literaryWorkflow = {
  id: "la-workflow-1",
  manuscript_id: "manuscript-1",
  workflow_type: "literary_agent_review",
  status: "running" as const,
};

describe("Studio workflow cancellation policy", () => {
  it("1. accepts literary_agent_review cancellation targets", () => {
    assert.equal(isStudioCancellableWorkflowType("literary_agent_review"), true);
    assert.deepEqual(
      validateStudioWorkflowCancellation({
        workflow: literaryWorkflow,
        workflowId: literaryWorkflow.id,
        manuscriptId: literaryWorkflow.manuscript_id,
      }),
      { ok: true },
    );
  });

  it("2. accepts military_expert_review cancellation targets", () => {
    assert.equal(isStudioCancellableWorkflowType("military_expert_review"), true);
    assert.deepEqual(
      validateStudioWorkflowCancellation({
        workflow: militaryWorkflow,
        workflowId: militaryWorkflow.id,
        manuscriptId: militaryWorkflow.manuscript_id,
      }),
      { ok: true },
    );
  });

  it("3. rejects wrong manuscript ID", () => {
    const result = validateStudioWorkflowCancellation({
      workflow: militaryWorkflow,
      workflowId: militaryWorkflow.id,
      manuscriptId: "other-manuscript",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "No active review to cancel.");
  });

  it("4. rejects wrong workflow ID", () => {
    const result = validateStudioWorkflowCancellation({
      workflow: militaryWorkflow,
      workflowId: "other-workflow",
      manuscriptId: militaryWorkflow.manuscript_id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "No active review to cancel.");
  });

  it("5. treats terminal statuses as idempotent", () => {
    assert.equal(isEditorialWorkflowCancellationIdempotent("cancelled"), true);
    assert.equal(isEditorialWorkflowCancellationIdempotent("completed"), true);
    assert.equal(isEditorialWorkflowCancellationIdempotent("failed"), true);
    assert.equal(isEditorialWorkflowCancellationIdempotent("queued"), false);
  });

  it("6. does not confuse Military Expert with Literary Agent lookup", () => {
    const expertExecution = readFileSync(
      join(ROOT, "app/studio/actions/expert-execution.ts"),
      "utf8",
    );
    assert.doesNotMatch(expertExecution, /getActivePublishingWorkflow\(input\.manuscriptId\)/);
    assert.match(expertExecution, /getWorkflowById\(input\.workflowId\)/);
    assert.match(expertExecution, /cancelEditorialWorkflow/);
  });

  it("7. records cancellation through markWorkflowCancelled", () => {
    const store = readFileSync(join(ROOT, "lib/editorial-workflow/workflow-store.ts"), "utf8");
    assert.match(store, /status: "cancelled"/);
    assert.match(store, /eventType: "cancelled"/);
    assert.match(store, /cancelled_at: now/);
  });

  it("8. attempts Trigger cancellation without provider execution", () => {
    const triggerClient = readFileSync(
      join(ROOT, "lib/editorial-workflow/trigger-client.ts"),
      "utf8",
    );
    const cancelWorkflow = readFileSync(
      join(ROOT, "lib/editorial-workflow/cancel-workflow.ts"),
      "utf8",
    );
    assert.match(triggerClient, /cancelTriggerRunIfPresent/);
    assert.match(triggerClient, /runs\.cancel/);
    assert.doesNotMatch(cancelWorkflow, /anthropic/i);
    assert.doesNotMatch(cancelWorkflow, /executeMilitaryExpertStudioWorkflow/);
  });

  it("9. does not mutate manuscript or review rows during cancellation", () => {
    const cancelWorkflow = readFileSync(
      join(ROOT, "lib/editorial-workflow/cancel-workflow.ts"),
      "utf8",
    );
    assert.doesNotMatch(cancelWorkflow, /from\("manuscripts"\)/);
    assert.doesNotMatch(cancelWorkflow, /from\("reviews"\)/);
    assert.doesNotMatch(cancelWorkflow, /from\("editorial_issues"\)/);
  });
});
