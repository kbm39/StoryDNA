import { task } from "@trigger.dev/sdk/v3";
import { executeMilitaryExpertStudioWorkflow } from "@/lib/editorial-workflow/execute-military-expert-studio-workflow.ts";

export const militaryExpertReviewTask = task({
  id: "military-expert-review",
  retry: {
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: 3600,
  run: async (payload: { workflowId: string }) => {
    return executeMilitaryExpertStudioWorkflow(payload.workflowId);
  },
});
