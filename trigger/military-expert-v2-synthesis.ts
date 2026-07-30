import { task } from "@trigger.dev/sdk/v3";
import { executeMilitaryExpertV2SynthesisWorkflow } from "@/lib/editorial-workflow/execute-military-expert-v2-synthesis-workflow.ts";

export const militaryExpertV2SynthesisTask = task({
  id: "military-expert-v2-synthesis",
  retry: {
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 60_000,
  },
  maxDuration: 3600,
  run: async (payload: { workflowId: string }) => {
    return executeMilitaryExpertV2SynthesisWorkflow(payload.workflowId);
  },
});
