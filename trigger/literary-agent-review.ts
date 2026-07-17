import { task } from "@trigger.dev/sdk/v3";
import { executeLiteraryAgentWorkflow } from "@/lib/editorial-workflow/start-literary-agent-workflow";

export const literaryAgentReviewTask = task({
  id: "literary-agent-review",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: 3600,
  run: async (payload: { workflowId: string }) => {
    return executeLiteraryAgentWorkflow(payload.workflowId);
  },
});
