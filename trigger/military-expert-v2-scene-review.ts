import { task } from "@trigger.dev/sdk/v3";
import { executeMilitaryExpertV2SceneReviewWorkflow } from "@/lib/editorial-workflow/execute-military-expert-v2-scene-review-workflow.ts";

export const militaryExpertV2SceneReviewTask = task({
  id: "military-expert-v2-scene-review",
  retry: {
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: 7200,
  run: async (payload: { workflowId: string }) => {
    return executeMilitaryExpertV2SceneReviewWorkflow(payload.workflowId);
  },
});
