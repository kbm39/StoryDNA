import { task } from "@trigger.dev/sdk/v3";
import { executeMilitaryExpertV2InventoryWorkflow } from "@/lib/editorial-workflow/execute-military-expert-v2-inventory-workflow.ts";

export const militaryExpertV2InventoryTask = task({
  id: "military-expert-v2-inventory",
  retry: {
    maxAttempts: 1,
    factor: 2,
    minTimeoutInMs: 30_000,
  },
  maxDuration: 1800,
  run: async (payload: { workflowId: string }) => {
    return executeMilitaryExpertV2InventoryWorkflow(payload.workflowId);
  },
});
